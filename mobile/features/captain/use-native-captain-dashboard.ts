import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { deriveDeliveryTiming, type DeliveryTiming } from "@/lib/admin/delivery-duration";
import { useRealtimeOrders } from "@/lib/supabase/useRealtimeOrders";

import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import {
  nativeCaptainContract,
  type CaptainAvailability,
  type CaptainHomeMetrics,
  type CaptainOrder,
  type CaptainOrderStatusEvent,
  type CaptainOrderStop,
} from "@/lib/supabase/native-captain-contract";

const activeStatuses = new Set(["assigned", "received", "in_delivery"]);

export type CaptainOrderWithTiming = CaptainOrder & {
  deliveryTiming: DeliveryTiming | null;
};

function canShowDeliveryTiming(
  status: CaptainOrder["status"],
): status is "received" | "in_delivery" | "completed" {
  return status === "received" || status === "in_delivery" || status === "completed";
}

function groupHistoryByOrder(
  history: readonly CaptainOrderStatusEvent[],
): Map<string, { status: string; timestamp: string }[]> {
  const eventsByOrder = new Map<string, { status: string; timestamp: string }[]>();
  for (const event of history) {
    if (
      typeof event.order_id !== "string" ||
      typeof event.next_status !== "string" ||
      typeof event.changed_at !== "string"
    )
      continue;
    const events = eventsByOrder.get(event.order_id) ?? [];
    events.push({ status: event.next_status, timestamp: event.changed_at });
    eventsByOrder.set(event.order_id, events);
  }
  return eventsByOrder;
}

async function enrichCaptainOrdersWithDeliveryTiming(
  orders: readonly CaptainOrder[],
): Promise<CaptainOrderWithTiming[]> {
  const candidates = orders.filter((order) => canShowDeliveryTiming(order.status));
  if (!candidates.length) return orders.map((order) => ({ ...order, deliveryTiming: null }));

  let history: CaptainOrderStatusEvent[];
  try {
    history = await nativeCaptainContract.reads.orderStatusHistory(
      candidates.map((order) => order.id),
    );
  } catch {
    return orders.map((order) => ({ ...order, deliveryTiming: null }));
  }

  const eventsByOrder = groupHistoryByOrder(history);
  return orders.map((order) => {
    if (!canShowDeliveryTiming(order.status)) return { ...order, deliveryTiming: null };
    const statusAt = order.status === "completed" ? order.completed_at ?? order.updated_at : order.updated_at;
    return {
      ...order,
      deliveryTiming: deriveDeliveryTiming(
        order.status,
        statusAt,
        eventsByOrder.get(order.id) ?? [],
      ),
    };
  });
}

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
  const realtimeReloadTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const orderTransitionInFlight = useRef(false);
  const reloadVersion = useRef(0);

  const reload = useCallback(
    async (silent = false) => {
      const requestVersion = ++reloadVersion.current;
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
        if (!mounted.current || requestVersion !== reloadVersion.current)
          return;
        setMetrics(nextMetrics);
        setOrders(nextOrders);
        setCurrentStops(stops);
      } catch (cause) {
        if (mounted.current && !silent)
          setError(
            cause instanceof Error ? cause.message : "تعذر تحميل حساب الكابتن.",
          );
      } finally {
        if (mounted.current && requestVersion === reloadVersion.current) {
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
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active") void reload(true);
      },
    );

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
      if (orderTransitionInFlight.current) return false;
      orderTransitionInFlight.current = true;
      reloadVersion.current += 1;
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
        void reload(true);
        return true;
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "تعذر تحديث مرحلة الطلب.";
        setActionError(
          message === "Only an in-delivery order can be completed"
            ? "تم تحديث حالة الطلب مسبقاً. تم تحديث بياناتك الآن."
            : message,
        );
        void reload(true);
        return false;
      } finally {
        orderTransitionInFlight.current = false;
        setOrderSaving(false);
      }
    },
    [reload],
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


export const CAPTAIN_ORDERS_PAGE_SIZE = 10;

export function useNativeCaptainOrders() {
  const { profile, session } = useDeliveryAuth();
  const captainId = session?.user.id ?? profile?.id ?? null;
  const [page, setPage] = useState(0);
  const [orders, setOrders] = useState<CaptainOrderWithTiming[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const reloadVersion = useRef(0);
  const realtimeReloadTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const pageCount = Math.max(
    1,
    Math.ceil(total / CAPTAIN_ORDERS_PAGE_SIZE),
  );
  const safePage = Math.min(page, pageCount - 1);
  const hasPreviousPage = safePage > 0;
  const hasNextPage = total > (safePage + 1) * CAPTAIN_ORDERS_PAGE_SIZE;

  const reload = useCallback(
    async (silent = false) => {
      const requestVersion = ++reloadVersion.current;
      if (!captainId) {
        setOrders([]);
        setTotal(0);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (silent) setRefreshing(true);
      else {
        setLoading(true);
        setError(null);
      }

      try {
        const result = await nativeCaptainContract.reads.ordersPage(captainId, {
          limit: CAPTAIN_ORDERS_PAGE_SIZE,
          offset: page * CAPTAIN_ORDERS_PAGE_SIZE,
        });
        if (!mounted.current || requestVersion !== reloadVersion.current) return;

        const maxPage = Math.max(
          0,
          Math.ceil(result.total / CAPTAIN_ORDERS_PAGE_SIZE) - 1,
        );
        if (page > maxPage) {
          setPage(maxPage);
          return;
        }

        const ordersWithTiming = await enrichCaptainOrdersWithDeliveryTiming(
          result.orders,
        );
        if (!mounted.current || requestVersion !== reloadVersion.current) return;

        setOrders(ordersWithTiming);
        setTotal(result.total);
      } catch (cause) {
        if (mounted.current && requestVersion === reloadVersion.current) {
          setError(
            cause instanceof Error ? cause.message : "تعذر تحميل سجل طلباتك.",
          );
        }
      } finally {
        if (mounted.current && requestVersion === reloadVersion.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [captainId, page],
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
    return () => {
      mounted.current = false;
      reloadVersion.current += 1;
      clearTimeout(initialLoadTimer);
      if (realtimeReloadTimer.current !== null) {
        clearTimeout(realtimeReloadTimer.current);
        realtimeReloadTimer.current = null;
      }
    };
  }, [reload]);

  useRealtimeOrders({
    enabled: Boolean(captainId),
    captainId,
    onOrder: scheduleRealtimeReload,
  });

  return useMemo(
    () => ({
      orders,
      total,
      page: safePage,
      pageCount,
      loading,
      refreshing,
      error,
      hasPreviousPage,
      hasNextPage,
      reload,
      previousPage: () => {
        if (hasPreviousPage) setPage(safePage - 1);
      },
      nextPage: () => {
        if (hasNextPage) setPage(safePage + 1);
      },
    }),
    [
      error,
      hasNextPage,
      hasPreviousPage,
      loading,
      orders,
      pageCount,
      refreshing,
      reload,
      safePage,
      total,
    ],
  );
}
