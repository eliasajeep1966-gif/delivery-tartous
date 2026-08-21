import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  webSupabase,
  type CreateOrderWithStopsInput,
  type WebOrder,
} from '@/data/supabase/webSupabaseContract';
import {
  buildAvailableHomeCaptains,
  buildHomeActivities,
  buildHomeMetrics,
  type HomeActivity,
  type HomeCaptain,
  type HomeMetric,
} from '@/features/admin/homeMappers';
import { WebRequestTimeoutError, withWebRequestTimeout } from '@/lib/authRequest';

const LOAD_TIMEOUT_MESSAGE = 'انتهت مهلة تحميل لوحة الإدارة بعد 15 ثانية. حاول مرة أخرى.';
const ACTIVITY_LIMIT = 6;

type ReloadOptions = {
  background?: boolean;
};

export type AdminHomeData = {
  metrics: HomeMetric[];
  activities: HomeActivity[];
  availableCaptains: HomeCaptain[];
  isInitialLoading: boolean;
  readError: string | null;
  reload: (options?: ReloadOptions) => Promise<void>;
  createOrderWithStops: (input: CreateOrderWithStopsInput) => Promise<WebOrder>;
  assignOrderCaptain: (orderId: string, captainId: string) => Promise<WebOrder>;
};

function getHomeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof WebRequestTimeoutError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallback;
}

export function useAdminHomeData(): AdminHomeData {
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const [profiles, setProfiles] = useState<Awaited<ReturnType<typeof webSupabase.reads.profiles>>>([]);
  const [captainStatuses, setCaptainStatuses] = useState<Awaited<ReturnType<typeof webSupabase.reads.captainStatuses>>>([]);
  const [auditLogs, setAuditLogs] = useState<Awaited<ReturnType<typeof webSupabase.reads.auditLogs>>>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const mounted = useRef(true);
  const requestVersion = useRef(0);

  const reload = useCallback(async ({ background = false }: ReloadOptions = {}) => {
    const version = ++requestVersion.current;
    if (!background) setReadError(null);

    try {
      const [nextOrders, nextProfiles, nextCaptainStatuses, nextAuditLogs] = await Promise.all([
        withWebRequestTimeout(webSupabase.reads.orders(), LOAD_TIMEOUT_MESSAGE),
        withWebRequestTimeout(webSupabase.reads.profiles(), 'انتهت مهلة تحميل المستخدمين بعد 15 ثانية. حاول مرة أخرى.'),
        withWebRequestTimeout(webSupabase.reads.captainStatuses(), 'انتهت مهلة تحميل حالات الكباتن بعد 15 ثانية. حاول مرة أخرى.'),
        withWebRequestTimeout(webSupabase.reads.auditLogs(ACTIVITY_LIMIT), 'انتهت مهلة تحميل آخر النشاطات بعد 15 ثانية. حاول مرة أخرى.'),
      ]);

      if (!mounted.current || version !== requestVersion.current) return;
      setOrders(nextOrders);
      setProfiles(nextProfiles);
      setCaptainStatuses(nextCaptainStatuses);
      setAuditLogs(nextAuditLogs);
    } catch (error) {
      console.error('Admin Home data load failed.', error);
      if (!mounted.current || version !== requestVersion.current || background) return;
      setReadError(getHomeErrorMessage(error, 'تعذر تحميل لوحة الإدارة. حاول مرة أخرى.'));
    } finally {
      if (mounted.current && version === requestVersion.current) setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  const metrics = useMemo(() => buildHomeMetrics(orders), [orders]);
  const activities = useMemo(() => buildHomeActivities(auditLogs, orders, profiles), [auditLogs, orders, profiles]);
  const availableCaptains = useMemo(
    () => buildAvailableHomeCaptains(profiles, captainStatuses),
    [captainStatuses, profiles],
  );

  const createOrderWithStops = useCallback((input: CreateOrderWithStopsInput) => (
    withWebRequestTimeout(
      webSupabase.actions.createOrderWithStops(input),
      'انتهت مهلة إنشاء الطلب بعد 15 ثانية. تحقّق من قائمة الطلبات قبل إعادة الإرسال.',
    )
  ), []);

  const assignOrderCaptain = useCallback((orderId: string, captainId: string) => (
    withWebRequestTimeout(
      webSupabase.actions.assignOrderCaptain(orderId, captainId),
      'انتهت مهلة تعيين الكابتن بعد 15 ثانية. تحقّق من حالة الطلب قبل إعادة المحاولة.',
    )
  ), []);

  return {
    metrics,
    activities,
    availableCaptains,
    isInitialLoading,
    readError,
    reload,
    createOrderWithStops,
    assignOrderCaptain,
  };
}
