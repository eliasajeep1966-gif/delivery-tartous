import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  deliverySupabase,
  type CaptainAvailability,
  type CaptainWageDetailV2,
  type Order,
  type OrderStatus,
  type OrderStop,
} from '@/data/supabase/supabaseContract';
import { useAuth } from '@/features/auth/useAuth';

const activeStatuses = new Set<OrderStatus>(['assigned', 'received', 'in_delivery']);

type CaptainSnapshot = {
  orders: Order[];
  currentOrderStops: OrderStop[];
  availability: CaptainAvailability;
  wageDetails: CaptainWageDetailV2[];
};

const initialSnapshot: CaptainSnapshot = {
  orders: [],
  currentOrderStops: [],
  availability: 'unavailable',
  wageDetails: [],
};

/**
 * Captain-native operations layer. Reads and updates are deliberately routed only
 * through deliverySupabase, preserving the same RLS and RPC protections as the web UI.
 */
export function useCaptainOperationsDashboard() {
  const { session } = useAuth();
  const [snapshot, setSnapshot] = useState<CaptainSnapshot>(initialSnapshot);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) {
      setSnapshot(initialSnapshot);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [orders, statuses, wageDetails] = await Promise.all([
        deliverySupabase.reads.orders(),
        deliverySupabase.reads.captainStatuses(),
        deliverySupabase.reads.captainWageDetailsV2(userId),
      ]);
      const currentOrder = orders.find((order) => activeStatuses.has(order.status));
      const currentOrderStops = currentOrder ? await deliverySupabase.reads.orderStops(currentOrder.id) : [];
      const ownStatus = statuses.find((status) => status.captain_id === userId);

      setSnapshot({
        orders,
        currentOrderStops,
        availability: ownStatus?.availability ?? 'unavailable',
        wageDetails,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل بيانات الكابتن.');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const updateAvailability = useCallback(async (nextAvailability: CaptainAvailability) => {
    if (updatingAvailability) return false;
    setUpdatingAvailability(true);
    setError(null);

    try {
      const status = await deliverySupabase.actions.setCaptainAvailability(nextAvailability);
      setSnapshot((current) => ({ ...current, availability: status.availability }));
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحديث حالة التوفر.');
      return false;
    } finally {
      setUpdatingAvailability(false);
    }
  }, [updatingAvailability]);

  const transitionOrder = useCallback(async (
    orderId: string,
    nextStatus: Extract<OrderStatus, 'received' | 'in_delivery' | 'completed' | 'false_order'>
  ) => {
    if (updatingOrderId) return false;
    setUpdatingOrderId(orderId);
    setError(null);

    try {
      const updatedOrder = await deliverySupabase.actions.transitionAssignedOrder(orderId, nextStatus);
      setSnapshot((current) => ({
        ...current,
        orders: current.orders.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)),
        currentOrderStops: updatedOrder.status === 'completed' || updatedOrder.status === 'false_order'
          ? []
          : current.currentOrderStops,
      }));
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحديث مرحلة الطلب.');
      return false;
    } finally {
      setUpdatingOrderId(null);
    }
  }, [updatingOrderId]);

  const derived = useMemo(() => {
    const currentOrder = snapshot.orders.find((order) => activeStatuses.has(order.status)) ?? null;
    const completedOrders = snapshot.orders.filter((order) => order.status === 'completed');
    return {
      completedCount: completedOrders.length,
      captainEarnings: snapshot.wageDetails.reduce((total, entry) => total + Number(entry.captain_amount), 0),
      unpaidEarnings: snapshot.wageDetails.reduce((total, entry) => total + Number(entry.unpaid_amount), 0),
      currentOrder,
      recentOrders: snapshot.orders.slice(0, 4),
    };
  }, [snapshot.orders, snapshot.wageDetails]);

  return {
    ...snapshot,
    ...derived,
    error,
    isLoading,
    reload,
    transitionOrder,
    updateAvailability,
    updatingAvailability,
    updatingOrderId,
  };
}
