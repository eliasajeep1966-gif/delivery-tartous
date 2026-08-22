/** Design reminder — Preserve the approved Captain Home layout; replace only aggregate metrics with the live typed summary RPC. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWebAuth } from '@/contexts/WebAuthContext';
import { webSupabase, type WebCaptainAvailability, type WebCaptainHomeMetrics, type WebOrder, type WebOrderStop, type WebProfile } from '@/data/supabase/webSupabaseContract';
import { withWebRequestTimeout } from '@/lib/authRequest';

const LOAD_TIMEOUT_MESSAGE = 'انتهت مهلة تحميل حساب الكابتن بعد 15 ثانية. حاول مرة أخرى.';
const ACTION_TIMEOUT_MESSAGE = 'انتهت مهلة حفظ التحديث بعد 15 ثانية. تحقق من الحالة قبل إعادة المحاولة.';

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
  const [currentOrderStops, setCurrentOrderStops] = useState<WebOrderStop[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [newAssignedOrder, setNewAssignedOrder] = useState<WebOrder | null>(null);
  const mounted = useRef(true);
  const knownOrderIds = useRef<Set<string>>(new Set());
  const hasLoadedOrders = useRef(false);

  const reload = useCallback(async () => {
    if (!userId) {
      knownOrderIds.current.clear();
      hasLoadedOrders.current = false;
      setNewAssignedOrder(null);
      setHomeMetrics(null);
      setAvailability(null);
      setIsInitialLoading(false);
      return;
    }

    setReadError(null);
    try {
      const [nextProfile, nextMetrics, nextOrders] = await Promise.all([
        withWebRequestTimeout(webSupabase.reads.myProfile(userId), LOAD_TIMEOUT_MESSAGE),
        withWebRequestTimeout(webSupabase.reads.captainHomeMetrics(), LOAD_TIMEOUT_MESSAGE),
        withWebRequestTimeout(webSupabase.reads.captainOrders(userId), LOAD_TIMEOUT_MESSAGE),
      ]);
      const activeStatuses = new Set<WebOrder['status']>(['assigned', 'received', 'in_delivery']);
      const nextCurrentOrder = nextOrders.find((order) => activeStatuses.has(order.status));
      const nextStops = nextCurrentOrder ? await withWebRequestTimeout(webSupabase.reads.orderStops(nextCurrentOrder.id), LOAD_TIMEOUT_MESSAGE) : [];
      const nextAssignedOrder = hasLoadedOrders.current
        ? nextOrders.find((order) => order.status === 'assigned' && !knownOrderIds.current.has(order.id)) ?? null
        : null;
      knownOrderIds.current = new Set(nextOrders.map((order) => order.id));
      hasLoadedOrders.current = true;
      if (!mounted.current) return;
      setProfile(nextProfile);
      setHomeMetrics(nextMetrics);
      setAvailability(nextMetrics.availability);
      setOrders(nextOrders);
      setCurrentOrderStops(nextStops);
      if (nextAssignedOrder) setNewAssignedOrder(nextAssignedOrder);
    } catch (error) {
      if (mounted.current) setReadError(getErrorMessage(error, 'تعذر تحميل حساب الكابتن. حاول مرة أخرى.'));
    } finally {
      if (mounted.current) setIsInitialLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => { mounted.current = false; };
  }, [reload]);

  useEffect(() => {
    if (!userId) return;

    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = webSupabase.realtime.subscribeToCaptainOrders(userId, () => {
      if (reloadTimer) return;
      reloadTimer = setTimeout(() => {
        reloadTimer = null;
        void reload();
      }, 250);
    });

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      unsubscribe();
    };
  }, [reload, userId]);

  const updateAvailability = useCallback(async (nextAvailability: WebCaptainAvailability): Promise<boolean> => {
    if (updatingAvailability) return false;
    setUpdatingAvailability(true);
    try {
      const status = await withWebRequestTimeout(webSupabase.actions.setCaptainAvailability(nextAvailability), ACTION_TIMEOUT_MESSAGE);
      if (mounted.current) setAvailability(status.availability);
      return true;
    } catch (error) {
      if (mounted.current) setReadError(getErrorMessage(error, 'تعذر تحديث حالة التوفر.'));
      return false;
    } finally {
      if (mounted.current) setUpdatingAvailability(false);
    }
  }, [updatingAvailability]);

  const transitionOrder = useCallback(async (orderId: string, nextStatus: Extract<WebOrder['status'], 'received' | 'in_delivery' | 'completed' | 'false_order'>): Promise<boolean> => {
    if (updatingOrderId) return false;
    setTransitionError(null);
    setUpdatingOrderId(orderId);
    try {
      const updatedOrder = await withWebRequestTimeout(webSupabase.actions.transitionAssignedOrder(orderId, nextStatus), ACTION_TIMEOUT_MESSAGE);
      if (mounted.current) setOrders((current) => current.map((order) => order.id === updatedOrder.id ? updatedOrder : order));
      return true;
    } catch (error) {
      if (mounted.current) {
        const message = getErrorMessage(error, 'تعذر تحديث مرحلة الطلب.');
        setTransitionError(message);
        if (nextStatus !== 'false_order') setReadError(message);
      }
      return false;
    } finally {
      if (mounted.current) setUpdatingOrderId(null);
    }
  }, [updatingOrderId]);

  const clearTransitionError = useCallback(() => setTransitionError(null), []);
  const dismissNewAssignedOrder = useCallback(() => setNewAssignedOrder(null), []);

  const derived = useMemo(() => {
    const activeStatuses = new Set<WebOrder['status']>(['assigned', 'received', 'in_delivery']);
    return {
      currentOrder: orders.find((order) => activeStatuses.has(order.status)) ?? null,
      recentOrders: orders.slice(0, 4),
      completedCount: homeMetrics?.completed_count ?? 0,
      completedGross: homeMetrics?.completed_gross ?? 0,
    };
  }, [homeMetrics, orders]);

  return { profile, availability, orders, currentOrderStops, isInitialLoading, readError, transitionError, clearTransitionError, newAssignedOrder, dismissNewAssignedOrder, updatingAvailability, updatingOrderId, reload, updateAvailability, transitionOrder, ...derived };
}
