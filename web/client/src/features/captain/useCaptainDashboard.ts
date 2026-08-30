/** Live captain dashboard data, including independently operable active orders. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWebAuth } from '@/contexts/WebAuthContext';
import {
  webSupabase,
  type WebCaptainAvailability,
  type WebCaptainHomeMetrics,
  type WebOrder,
  type WebOrderStop,
  type WebProfile,
} from '@/data/supabase/webSupabaseContract';
import { withWebRequestTimeout } from '@/lib/authRequest';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';

const LOAD_TIMEOUT_MESSAGE = 'انتهت مهلة تحميل حساب الكابتن بعد 15 ثانية. حاول مرة أخرى.';
const ACTION_TIMEOUT_MESSAGE = 'انتهت مهلة حفظ التحديث بعد 15 ثانية. تحقق من الحالة قبل إعادة المحاولة.';
const activeStatuses = new Set<WebOrder['status']>(['assigned', 'received', 'in_delivery']);

type StopsByOrderId = Record<string, WebOrderStop[]>;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function useCaptainDashboard() {
  const { session } = useWebAuth();
  const userId = session?.user.id ?? null;
  const [profile, setProfile] = useState<WebProfile | null>(null);
  const [homeMetrics, setHomeMetrics] = useState<WebCaptainHomeMetrics | null>(null);
  const [availability, setAvailability] = useState<WebCaptainAvailability | null>(null);
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const [activeOrderStops, setActiveOrderStops] = useState<StopsByOrderId>({});
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [updatingOrderIds, setUpdatingOrderIds] = useState<string[]>([]);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const mounted = useRef(true);

  const reload = useCallback(async ({ background = false }: { background?: boolean } = {}) => {
    if (!userId) {
      setProfile(null);
      setHomeMetrics(null);
      setAvailability(null);
      setOrders([]);
      setActiveOrderStops({});
      setIsInitialLoading(false);
      return;
    }

    if (!background) setReadError(null);
    try {
      const [nextProfile, nextMetrics, nextOrders] = await Promise.all([
        withWebRequestTimeout(webSupabase.reads.myProfile(userId), LOAD_TIMEOUT_MESSAGE),
        withWebRequestTimeout(webSupabase.reads.captainHomeMetrics(), LOAD_TIMEOUT_MESSAGE),
        withWebRequestTimeout(webSupabase.reads.captainOrders(userId), LOAD_TIMEOUT_MESSAGE),
      ]);
      const nextActiveOrders = nextOrders.filter((order) => activeStatuses.has(order.status));
      const stopEntries = await Promise.all(
        nextActiveOrders.map(async (order) => [
          order.id,
          await withWebRequestTimeout(
            webSupabase.reads.orderStops(order.id),
            LOAD_TIMEOUT_MESSAGE,
          ),
        ] as const),
      );
      if (!mounted.current) return;

      setProfile(nextProfile);
      setHomeMetrics(nextMetrics);
      setAvailability(nextMetrics.availability);
      setOrders(nextOrders);
      setActiveOrderStops(Object.fromEntries(stopEntries));
    } catch (error) {
      if (mounted.current && !background) {
        setReadError(getErrorMessage(error, 'تعذر تحميل حساب الكابتن. حاول مرة أخرى.'));
      }
    } finally {
      if (mounted.current) setIsInitialLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => { mounted.current = false; };
  }, [reload]);

  const captainRealtimeTargets = useMemo(() => userId ? [
    { table: 'orders' as const, filter: `assigned_captain_id=eq.${userId}` },
    { table: 'captain_status' as const, filter: `captain_id=eq.${userId}` },
  ] : [], [userId]);
  const refreshFromRealtime = useCallback(() => reload({ background: true }), [reload]);

  useRealtimeRefresh({
    enabled: Boolean(userId),
    channelName: 'captain-home',
    targets: captainRealtimeTargets,
    onRefresh: refreshFromRealtime,
  });

  const updateAvailability = useCallback(async (nextAvailability: WebCaptainAvailability): Promise<boolean> => {
    if (updatingAvailability) return false;
    setUpdatingAvailability(true);
    try {
      const status = await withWebRequestTimeout(
        webSupabase.actions.setCaptainAvailability(nextAvailability),
        ACTION_TIMEOUT_MESSAGE,
      );
      if (mounted.current) setAvailability(status.availability);
      return true;
    } catch (error) {
      if (mounted.current) setReadError(getErrorMessage(error, 'تعذر تحديث حالة التوفر.'));
      return false;
    } finally {
      if (mounted.current) setUpdatingAvailability(false);
    }
  }, [updatingAvailability]);

  const isOrderSaving = useCallback(
    (orderId: string) => updatingOrderIds.includes(orderId),
    [updatingOrderIds],
  );

  const transitionOrder = useCallback(async (
    orderId: string,
    nextStatus: Extract<WebOrder['status'], 'received' | 'in_delivery' | 'completed' | 'false_order'>,
  ): Promise<boolean> => {
    if (updatingOrderIds.includes(orderId)) return false;
    setTransitionError(null);
    setUpdatingOrderIds((current) => [...current, orderId]);
    try {
      const updatedOrder = await withWebRequestTimeout(
        webSupabase.actions.transitionAssignedOrder(orderId, nextStatus),
        ACTION_TIMEOUT_MESSAGE,
      );
      if (mounted.current) {
        setOrders((current) => current.map((order) => order.id === updatedOrder.id ? updatedOrder : order));
        if (!activeStatuses.has(updatedOrder.status)) {
          setActiveOrderStops((current) => {
            const { [updatedOrder.id]: _completedOrderStops, ...remaining } = current;
            return remaining;
          });
        }
      }
      void reload({ background: true });
      return true;
    } catch (error) {
      if (mounted.current) {
        const message = getErrorMessage(error, 'تعذر تحديث مرحلة الطلب.');
        setTransitionError(message);
        if (nextStatus !== 'false_order') setReadError(message);
      }
      return false;
    } finally {
      if (mounted.current) {
        setUpdatingOrderIds((current) => current.filter((id) => id !== orderId));
      }
    }
  }, [reload, updatingOrderIds]);

  const clearTransitionError = useCallback(() => setTransitionError(null), []);

  const derived = useMemo(() => {
    const activeOrders = orders.filter((order) => activeStatuses.has(order.status));
    const currentOrder = activeOrders[0] ?? null;
    return {
      activeOrders,
      currentOrder,
      currentOrderStops: currentOrder ? activeOrderStops[currentOrder.id] ?? [] : [],
      recentOrders: orders.slice(0, 4),
      completedCount: homeMetrics?.completed_count ?? 0,
      completedGross: homeMetrics?.completed_gross ?? 0,
    };
  }, [activeOrderStops, homeMetrics, orders]);

  return {
    profile,
    availability,
    orders,
    activeOrderStops,
    isInitialLoading,
    readError,
    transitionError,
    clearTransitionError,
    updatingAvailability,
    isOrderSaving,
    reload,
    updateAvailability,
    transitionOrder,
    ...derived,
  };
}
