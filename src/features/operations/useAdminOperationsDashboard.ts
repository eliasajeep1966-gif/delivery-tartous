import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  deliverySupabase,
  type CaptainStatus,
  type CaptainWageSummary,
  type CompanyProfitHistoryDay,
  type Order,
  type Profile,
  type WageTotals,
} from '@/data/supabase/supabaseContract';

type DashboardData = {
  orders: Order[];
  profiles: Profile[];
  captains: Profile[];
  captainStatuses: CaptainStatus[];
  wageTotals: WageTotals | null;
  wageSummaries: CaptainWageSummary[];
  profitHistory: CompanyProfitHistoryDay[];
};

const initialData: DashboardData = {
  orders: [],
  profiles: [],
  captains: [],
  captainStatuses: [],
  wageTotals: null,
  wageSummaries: [],
  profitHistory: [],
};

/**
 * Native dashboard data adapter. It consumes the approved deliverySupabase contract
 * and intentionally keeps all mutations inside that contract/RPC layer.
 */
export function useAdminOperationsDashboard() {
  const [data, setData] = useState<DashboardData>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [orders, profiles, captainStatuses, wageTotals, wageSummaries, profitHistory] = await Promise.all([
        deliverySupabase.reads.orders(),
        deliverySupabase.reads.profiles(),
        deliverySupabase.reads.captainStatuses(),
        deliverySupabase.reads.wageTotals(),
        deliverySupabase.reads.captainWageSummary(),
        deliverySupabase.reads.companyProfitHistory({ limitDays: 7 }),
      ]);

      setData({
        orders,
        profiles,
        captains: profiles.filter((profile) => profile.role === 'captain'),
        captainStatuses,
        wageTotals,
        wageSummaries,
        profitHistory,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل بيانات لوحة التشغيل.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const availableCaptainIds = useMemo(
    () => new Set(data.captainStatuses.filter((status) => status.availability === 'available').map((status) => status.captain_id)),
    [data.captainStatuses]
  );

  const metrics = useMemo(() => {
    const activeOrders = data.orders.filter((order) => !['completed', 'cancelled', 'false_order'].includes(order.status));
    return {
      activeOrders: activeOrders.length,
      inDelivery: data.orders.filter((order) => order.status === 'in_delivery').length,
      completedToday: data.orders.filter((order) => {
        if (order.status !== 'completed' || !order.completed_at) return false;
        return new Date(order.completed_at).toDateString() === new Date().toDateString();
      }).length,
      availableCaptains: availableCaptainIds.size,
    };
  }, [availableCaptainIds, data.orders]);

  return {
    ...data,
    availableCaptainIds,
    error,
    isLoading,
    metrics,
    reload,
  };
}
