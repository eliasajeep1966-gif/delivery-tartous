import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { useRealtimeOrders } from "@/lib/supabase/useRealtimeOrders";

import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import {
  nativeCaptainContract,
  type CaptainAvailability,
  type CaptainHomeMetrics,
  type CaptainOrder,
  type CaptainOrderStop,
} from "@/lib/supabase/native-captain-contract";

const activeStatuses = new Set(["assigned", "received", "in_delivery"]);

export function useNativeCaptainDashboard() {
  const { profile, session } = useDeliveryAuth();
  const captainId = session?.user.id ?? profile?.id ?? null;
  const [metrics, setMetrics] = useState<CaptainHomeMetrics | null>(null);
  const [orders, setOrders] = useState<CaptainOrder[]>([]);
  const [currentStops, setCurrentStops] = useState<CaptainOrderStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [orderSaving, setOrderSaving] = useState(false);
  const mounted = useRef(true);
  const realtimeReloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(
    async (silent = false) => {
      if (!captainId) {
        setLoading(false);
        return;
      }
      if (silent) setRefreshing(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const [nextMetrics, nextOrders] = await Promise.all([
          nativeCaptainContract.reads.homeMetrics(captainId),
          nativeCaptainContract.reads.orders(captainId),
        ]);
        const current = nextOrders.find((order) =>
          activeStatuses.has(order.status),
        );
        const stops = current
          ? await nativeCaptainContract.reads.orderStops(current.id)
          : [];
        if (!mounted.current) return;
        setMetrics(nextMetrics);
        setOrders(nextOrders);
        setCurrentStops(stops);
      } catch (cause) {
        if (mounted.current && !silent)
          setError(
            cause instanceof Error ? cause.message : "تعذر تحميل حساب الكابتن.",
          );
      } finally {
        if (mounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [captainId],
  );

  const scheduleRealtimeReload = useCallback(() => {
    if (realtimeReloadTimer.current !== null) return;
    realtimeReloadTimer.current = setTimeout(() => {
      realtimeReloadTimer.current = null;
      void reload(true);
    }, 250);
  }, [reload]);

  useEffect(() => {
    mounted.current = true;
    const initialLoadTimer = setTimeout(() => {
      void reload();
    }, 0);
    if (!captainId) {
      return () => {
        mounted.current = false;
        clearTimeout(initialLoadTimer);
      };
    }

    const refreshTimer = setInterval(() => {
      if (AppState.currentState === "active") void reload(true);
    }, 60_000);
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void reload(true);
    });

    return () => {
      mounted.current = false;
      clearTimeout(initialLoadTimer);
      clearInterval(refreshTimer);
      appStateSubscription.remove();
      if (realtimeReloadTimer.current !== null) {
        clearTimeout(realtimeReloadTimer.current);
        realtimeReloadTimer.current = null;
      }
    };
  }, [captainId, reload]);

  useRealtimeOrders({
    enabled: Boolean(captainId),
    captainId,
    onOrder: scheduleRealtimeReload,
    onCaptain: (payload) => {
      const row = payload.new as { availability?: CaptainAvailability };
      if (row.availability)
        setMetrics((current) =>
          current ? { ...current, availability: row.availability! } : current,
        );
    },
  });

  const updateAvailability = useCallback(
    async (next: CaptainAvailability) => {
      if (availabilitySaving) return false;
      const previous = metrics?.availability;
      setMetrics((current) =>
        current ? { ...current, availability: next } : current,
      );
      setAvailabilitySaving(true);
      setActionError(null);
      try {
        const result =
          await nativeCaptainContract.actions.setAvailability(next);
        setMetrics((current) =>
          current ? { ...current, availability: result.availability } : current,
        );
        return true;
      } catch (cause) {
        setMetrics((current) =>
          current && previous
            ? { ...current, availability: previous }
            : current,
        );
        setActionError(
          cause instanceof Error ? cause.message : "تعذر تحديث حالة التوفر.",
        );
        return false;
      } finally {
        setAvailabilitySaving(false);
      }
    },
    [availabilitySaving, metrics?.availability],
  );

  const transitionOrder = useCallback(
    async (
      orderId: string,
      nextStatus: "received" | "in_delivery" | "completed" | "false_order",
    ) => {
      if (orderSaving) return false;
      setOrderSaving(true);
      setActionError(null);
      try {
        const updated = await nativeCaptainContract.actions.transitionOrder(
          orderId,
          nextStatus,
        );
        setOrders((current) =>
          current.map((order) => (order.id === updated.id ? updated : order)),
        );
        if (nextStatus === "completed" || nextStatus === "false_order")
          setCurrentStops([]);
        return true;
      } catch (cause) {
        setActionError(
          cause instanceof Error ? cause.message : "تعذر تحديث مرحلة الطلب.",
        );
        return false;
      } finally {
        setOrderSaving(false);
      }
    },
    [orderSaving],
  );

  return useMemo(
    () => ({
      profile,
      metrics,
      orders,
      currentOrder:
        orders.find((order) => activeStatuses.has(order.status)) ?? null,
      currentStops,
      recentOrders: orders.slice(0, 4),
      loading,
      refreshing,
      error,
      actionError,
      availabilitySaving,
      orderSaving,
      reload,
      updateAvailability,
      transitionOrder,
    }),
    [
      actionError,
      availabilitySaving,
      currentStops,
      error,
      loading,
      metrics,
      orderSaving,
      orders,
      profile,
      refreshing,
      reload,
      transitionOrder,
      updateAvailability,
    ],
  );
}
