import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { deriveDeliveryTiming, type DeliveryTiming } from "@/lib/admin/delivery-duration";
import { useRealtimeOrders } from "@/lib/supabase/useRealtimeOrders";

import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import {
  nativeCaptainContract,
  type CaptainActiveOrder,
  type CaptainAvailability,
  type CaptainHomeMetrics,
  type CaptainOrder,
  type CaptainOrderStatusEvent,
  type CaptainOrderStop,
} from "@/lib/supabase/native-captain-contract";

const activeStatuses = new Set<CaptainOrder["status"]>([
  "assigned",
  "received",
  "in_delivery",
]);

function isNewAssignment(payload: { eventType: string; new: Record<string, unknown> }) {
  return (
    (payload.eventType === "INSERT" || payload.eventType === "UPDATE") &&
    payload.new.status === "assigned" &&
    typeof payload.new.id === "string"
  );
}

export type CaptainOrderWithTiming = CaptainOrder & {
  deliveryTiming: DeliveryTiming | null;
};

function canShowDeliveryTiming(
  status: CaptainOrder["status"],
): status is "received" | "in_delivery" | "completed" {
  return status === "received" || status === "in_delivery" || status === "completed";
}

function groupStatusEventsByOrder(
  history: readonly CaptainOrderStatusEvent[],
): Record<string, CaptainOrderStatusEvent[]> {
  return history.reduce<Record<string, CaptainOrderStatusEvent[]>>(
    (eventsByOrder, event) => {
      const events = eventsByOrder[event.order_id] ?? [];
      events.push(event);
      eventsByOrder[event.order_id] = events;
      return eventsByOrder;
    },
    {},
  );
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

export function useNativeCaptainDashboard(enabled = true) {
  const { profile, session } = useDeliveryAuth();
  const captainId = session?.user.id ?? profile?.id ?? null;
  const [metrics, setMetrics] = useState<CaptainHomeMetrics | null>(null);
  const [todayCaptainWage, setTodayCaptainWage] = useState<number | null>(null);
  const [orderCount, setOrderCount] = useState(0);
  const [activeOrders, setActiveOrders] = useState<CaptainActiveOrder[]>([]);
  const [currentOrder, setCurrentOrder] = useState<CaptainOrder | null>(null);
  const [recentOrders, setRecentOrders] = useState<CaptainOrderWithTiming[]>([]);
  const [currentStops, setCurrentStops] = useState<CaptainOrderStop[]>([]);
  const [currentStatusEvents, setCurrentStatusEvents] = useState<CaptainOrderStatusEvent[]>([]);
  const [activeStatusEvents, setActiveStatusEvents] = useState<
    Record<string, CaptainOrderStatusEvent[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [savingOrderIds, setSavingOrderIds] = useState<string[]>([]);
  const [newOrderQueue, setNewOrderQueue] = useState<string[]>([]);
  const mounted = useRef(true);
  const hasLoaded = useRef(false);
  const realtimeReloadTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const orderTransitionInFlight = useRef(new Set<string>());
  const announcedOrderIds = useRef(new Set<string>());
  const reloadVersion = useRef(0);

  const reload = useCallback(
    async (silent = false) => {
      const requestVersion = ++reloadVersion.current;
      if (!captainId) {
        setMetrics(null);
        setTodayCaptainWage(null);
        setOrderCount(0);
        setActiveOrders([]);
        setCurrentOrder(null);
        setRecentOrders([]);
        setCurrentStops([]);
        setCurrentStatusEvents([]);
        setActiveStatusEvents({});
        setNewOrderQueue([]);
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
        const [nextDashboard, wagePage] = await Promise.all([
          nativeCaptainContract.reads.dashboard(),
          nativeCaptainContract.reads
            .wagesPage("daily", { limit: 1, offset: 0, customDate: null })
            .catch(() => null),
        ]);
        const nextActiveOrders = nextDashboard.active_orders ?? [];
        const [recentOrdersWithTiming, nextActiveStatusEvents] = await Promise.all([
          enrichCaptainOrdersWithDeliveryTiming(nextDashboard.recent_orders),
          nextActiveOrders.length
            ? nativeCaptainContract.reads
                .orderStatusHistory(nextActiveOrders.map((order) => order.id))
                .catch(() => [])
            : Promise.resolve([]),
        ]);
        if (!mounted.current || requestVersion !== reloadVersion.current)
          return;
        const nextPrimaryOrder = nextActiveOrders[0] ?? null;
        const eventsByOrder = groupStatusEventsByOrder(nextActiveStatusEvents);
        setMetrics(nextDashboard.metrics);
        setTodayCaptainWage(wagePage?.totals.captain ?? null);
        setOrderCount(nextDashboard.order_count);
        setActiveOrders(nextActiveOrders);
        setCurrentOrder(nextPrimaryOrder);
        setRecentOrders(recentOrdersWithTiming);
        setCurrentStops(nextPrimaryOrder?.stops ?? []);
        setCurrentStatusEvents(
          nextPrimaryOrder ? eventsByOrder[nextPrimaryOrder.id] ?? [] : [],
        );
        setActiveStatusEvents(eventsByOrder);
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
    if (!enabled) {
      return () => {
        mounted.current = false;
        reloadVersion.current += 1;
        if (realtimeReloadTimer.current !== null) {
          clearTimeout(realtimeReloadTimer.current);
          realtimeReloadTimer.current = null;
        }
      };
    }
    const initialLoadTimer = setTimeout(() => {
      const silent = hasLoaded.current;
      hasLoaded.current = true;
      void reload(silent);
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
      reloadVersion.current += 1;
      clearTimeout(initialLoadTimer);
      clearInterval(refreshTimer);
      appStateSubscription.remove();
      if (realtimeReloadTimer.current !== null) {
        clearTimeout(realtimeReloadTimer.current);
        realtimeReloadTimer.current = null;
      }
    };
  }, [captainId, enabled, reload]);
  const announceNewOrder = useCallback(
    (orderId: string) => {
      if (!orderId || announcedOrderIds.current.has(orderId)) return;
      announcedOrderIds.current.add(orderId);
      setNewOrderQueue((current) =>
        current.includes(orderId) ? current : [...current, orderId],
      );
      scheduleRealtimeReload();
    },
    [scheduleRealtimeReload],
  );

  const handleRealtimeOrder = useCallback(
    (payload: { eventType: string; new: Record<string, unknown> }) => {
      if (isNewAssignment(payload)) announceNewOrder(payload.new.id as string);
      else scheduleRealtimeReload();
    },
    [announceNewOrder, scheduleRealtimeReload],
  );

  const dismissNewOrder = useCallback((orderId: string) => {
    setNewOrderQueue((current) => current.filter((id) => id !== orderId));
  }, []);

  useRealtimeOrders({
    enabled: Boolean(captainId) && enabled,
    captainId,
    onOrder: handleRealtimeOrder,
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

  const isOrderSaving = useCallback(
    (orderId: string) => savingOrderIds.includes(orderId),
    [savingOrderIds],
  );

  const transitionOrder = useCallback(
    async (
      orderId: string,
      nextStatus: "received" | "in_delivery" | "completed" | "false_order",
    ) => {
      if (orderTransitionInFlight.current.has(orderId)) return false;
      orderTransitionInFlight.current.add(orderId);
      setSavingOrderIds((current) =>
        current.includes(orderId) ? current : [...current, orderId],
      );
      setActionError(null);
      try {
        const updated = await nativeCaptainContract.actions.transitionOrder(
          orderId,
          nextStatus,
        );
        setActiveOrders((current) =>
          activeStatuses.has(updated.status)
            ? current.map((order) =>
                order.id === updated.id ? { ...order, ...updated } : order,
              )
            : current.filter((order) => order.id !== updated.id),
        );
        setCurrentOrder((current) =>
          current?.id === updated.id && !activeStatuses.has(updated.status)
            ? null
            : current?.id === updated.id
              ? updated
              : current,
        );
        setRecentOrders((current) =>
          current.map((order) =>
            order.id === updated.id
              ? { ...updated, deliveryTiming: order.deliveryTiming }
              : order,
          ),
        );
        if (nextStatus === "completed" || nextStatus === "false_order") {
          setNewOrderQueue((current) =>
            current.filter((id) => id !== updated.id),
          );
          setActiveStatusEvents((current) => {
            const { [updated.id]: _completedOrderEvents, ...remaining } = current;
            return remaining;
          });
          setCurrentStops((current) =>
            current.length && currentOrder?.id === updated.id ? [] : current,
          );
        }
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
        orderTransitionInFlight.current.delete(orderId);
        setSavingOrderIds((current) => current.filter((id) => id !== orderId));
      }
    },
    [currentOrder?.id, reload],
  );

  return useMemo(
    () => ({
      profile,
      metrics,
      todayCaptainWage,
      orderCount,
      activeOrders,
      activeStatusEvents,
      currentOrder,
      currentStops,
      currentStatusEvents,
      recentOrders,
      newOrderQueue,
      loading,
      refreshing,
      error,
      actionError,
      availabilitySaving,
      isOrderSaving,
      announceNewOrder,
      dismissNewOrder,
      reload,
      updateAvailability,
      transitionOrder,
    }),
    [
      actionError,
      activeOrders,
      activeStatusEvents,
      availabilitySaving,
      currentStops,
      currentStatusEvents,
      error,
      loading,
      currentOrder,
      metrics,
      todayCaptainWage,
      orderCount,
      newOrderQueue,
      announceNewOrder,
      profile,
      recentOrders,
      refreshing,
      dismissNewOrder,
      isOrderSaving,
      reload,
      transitionOrder,
      updateAvailability,
    ],
  );
}


export const CAPTAIN_ORDERS_PAGE_SIZE = 10;

export function useNativeCaptainOrders(enabled = true) {
  const { profile, session } = useDeliveryAuth();
  const captainId = session?.user.id ?? profile?.id ?? null;
  const [page, setPage] = useState(0);
  const [orders, setOrders] = useState<CaptainOrderWithTiming[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const hasLoaded = useRef(false);
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
    if (!enabled) {
      return () => {
        mounted.current = false;
        reloadVersion.current += 1;
        if (realtimeReloadTimer.current !== null) {
          clearTimeout(realtimeReloadTimer.current);
          realtimeReloadTimer.current = null;
        }
      };
    }
    const initialLoadTimer = setTimeout(() => {
      const silent = hasLoaded.current;
      hasLoaded.current = true;
      void reload(silent);
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
  }, [enabled, reload]);
  useRealtimeOrders({
    enabled: Boolean(captainId) && enabled,
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
