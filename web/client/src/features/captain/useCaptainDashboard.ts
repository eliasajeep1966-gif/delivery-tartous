/** Design reminder — Captain dashboard derives only the authenticated captain's RLS-visible status and assigned orders. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWebAuth } from '@/contexts/WebAuthContext';
import { webSupabase, type WebCaptainAvailability, type WebOrder, type WebOrderStop, type WebProfile } from '@/data/supabase/webSupabaseContract';
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
  const [availability, setAvailability] = useState<WebCaptainAvailability | null>(null);
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const [currentOrderStops, setCurrentOrderStops] = useState<WebOrderStop[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setIsInitialLoading(false);
      return;
    }

    setReadError(null);
    try {
      const [nextProfile, statuses, nextOrders] = await Promise.all([
        withWebRequestTimeout(webSupabase.reads.myProfile(userId), LOAD_TIMEOUT_MESSAGE),
        withWebRequestTimeout(webSupabase.reads.captainStatuses(), LOAD_TIMEOUT_MESSAGE),
        withWebRequestTimeout(webSupabase.reads.captainOrders(userId), LOAD_TIMEOUT_MESSAGE),
      ]);
      const activeStatuses = new Set<WebOrder['status']>(['assigned', 'received', 'in_delivery']);
      const nextCurrentOrder = nextOrders.find((order) => activeStatuses.has(order.status));
      const nextStops = nextCurrentOrder ? await withWebRequestTimeout(webSupabase.reads.orderStops(nextCurrentOrder.id), LOAD_TIMEOUT_MESSAGE) : [];
      if (!mounted.current) return;
      setProfile(nextProfile);
      setAvailability(statuses.find((status) => status.captain_id === nextProfile.id)?.availability ?? 'unavailable');
      setOrders(nextOrders);
      setCurrentOrderStops(nextStops);
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
    setUpdatingOrderId(orderId);
    try {
      const updatedOrder = await withWebRequestTimeout(webSupabase.actions.transitionAssignedOrder(orderId, nextStatus), ACTION_TIMEOUT_MESSAGE);
      if (mounted.current) setOrders((current) => current.map((order) => order.id === updatedOrder.id ? updatedOrder : order));
      return true;
    } catch (error) {
      if (mounted.current) setReadError(getErrorMessage(error, 'تعذر تحديث مرحلة الطلب.'));
      return false;
    } finally {
      if (mounted.current) setUpdatingOrderId(null);
    }
  }, [updatingOrderId]);

  const derived = useMemo(() => {
    const activeStatuses = new Set<WebOrder['status']>(['assigned', 'received', 'in_delivery']);
    const currentOrder = orders.find((order) => activeStatuses.has(order.status)) ?? null;
    const completedOrders = orders.filter((order) => order.status === 'completed');
    return {
      currentOrder,
      recentOrders: orders.slice(0, 4),
      completedCount: completedOrders.length,
      completedGross: completedOrders.reduce((total, order) => total + order.fee, 0),
    };
  }, [orders]);

  return { profile, availability, orders, currentOrderStops, isInitialLoading, readError, updatingAvailability, updatingOrderId, reload, updateAvailability, transitionOrder, ...derived };
}
