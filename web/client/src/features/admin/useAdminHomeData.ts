/** Design reminder — Keep the approved compact Home hierarchy; replace only Home data derivation with typed live summaries. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Json } from '@delivery-contract/database.types';

import {
  webSupabase,
  type CreateOrderWithStopsInput,
  type WebBackofficeHomeSummary,
  type WebCaptainStatus,
  type WebProfile,
  type WebOrder,
  type WebOrderStatus,
} from '@/data/supabase/webSupabaseContract';
import type { HomeActivity, HomeCaptain, HomeMetric } from '@/features/admin/homeMappers';
import { WebRequestTimeoutError, withWebRequestTimeout } from '@/lib/authRequest';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';

const LOAD_TIMEOUT_MESSAGE = 'انتهت مهلة تحميل لوحة الإدارة بعد 15 ثانية. حاول مرة أخرى.';
const DAMASCUS_TIME_ZONE = 'Asia/Damascus';
const ORDER_STATUSES: readonly WebOrderStatus[] = ['pending', 'assigned', 'received', 'in_delivery', 'completed', 'cancelled', 'false_order'];
const BACKOFFICE_HOME_REALTIME_TARGETS = [
  { table: 'orders' },
  { table: 'captain_status' },
  { table: 'profiles' },
  { table: 'audit_logs', event: 'INSERT' },
] as const;

type ReloadOptions = {
  background?: boolean;
};

type JsonRecord = { [key: string]: Json | undefined };

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

function isJsonRecord(value: Json): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(record: JsonRecord, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function orderNumberValue(record: JsonRecord): string | null {
  const value = record.order_number;
  return typeof value === 'number' || typeof value === 'string' ? String(value) : null;
}

function statusValue(value: string | null): WebOrderStatus | null {
  return value && ORDER_STATUSES.includes(value as WebOrderStatus) ? value as WebOrderStatus : null;
}

function formatActivityTime(value: string): string {
  return new Intl.DateTimeFormat('ar-SY', {
    timeZone: DAMASCUS_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function activityTitle(action: string, orderNumber: string | null): string {
  const suffix = orderNumber ? ` #${orderNumber}` : '';
  const labels: Record<string, string> = {
    'إنشاء طلب': 'تم إنشاء الطلب',
    'إسناد طلب': 'تم تعيين كابتن للطلب',
    'استلام الطلب': 'تم استلام الطلب',
    'بدء التوصيل': 'تم بدء توصيل الطلب',
    'تم التوصيل': 'تم تسليم الطلب',
    'طلب كاذب': 'تم تسجيل الطلب كطلب كاذب',
    'إلغاء الطلب': 'تم إلغاء الطلب',
  };
  return `${labels[action] ?? action}${suffix}`;
}

function mapSummaryActivities(value: Json): HomeActivity[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!isJsonRecord(entry)) return [];
    const id = stringValue(entry, 'id');
    const action = stringValue(entry, 'action');
    const createdAt = stringValue(entry, 'created_at');
    if (!id || !action || !createdAt) return [];

    const orderId = stringValue(entry, 'order_id');
    const orderNumber = orderNumberValue(entry);
    const actorName = stringValue(entry, 'actor_name') || 'النظام';
    const status = statusValue(stringValue(entry, 'to_status'));

    return [{
      id,
      title: activityTitle(action, orderNumber),
      subtitle: `بواسطة ${actorName}`,
      timestamp: formatActivityTime(createdAt),
      status,
      href: '/orders',
    }];
  });
}

function mapAvailableCaptains(
  profiles: WebProfile[],
  statuses: WebCaptainStatus[],
): HomeCaptain[] {
  const availabilityByCaptainId = new Map(statuses.map((status) => [status.captain_id, status.availability]));
  return profiles
    .filter((profile) => availabilityByCaptainId.get(profile.id) === 'available')
    .map((profile) => {
      const name = profile.full_name?.trim() || profile.email;
      return { id: profile.id, name, initial: name.slice(0, 1), availability: 'available' as const };
    });
}

export function useAdminHomeData(): AdminHomeData {
  const [summary, setSummary] = useState<WebBackofficeHomeSummary | null>(null);
  const [availableCaptains, setAvailableCaptains] = useState<HomeCaptain[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const mounted = useRef(true);
  const requestVersion = useRef(0);

  const reload = useCallback(async ({ background = false }: ReloadOptions = {}) => {
    const version = ++requestVersion.current;
    if (!background) setReadError(null);

    try {
      const summaryAndProfiles = await Promise.all([
        withWebRequestTimeout(webSupabase.reads.backofficeHomeSummary(), LOAD_TIMEOUT_MESSAGE),
        withWebRequestTimeout(webSupabase.reads.availableCaptainProfiles(), 'انتهت مهلة تحميل الكباتن المتاحين بعد 15 ثانية. حاول مرة أخرى.'),
      ]);
      const [nextSummary, nextProfiles] = summaryAndProfiles;
      const nextStatuses = nextProfiles.length
        ? await withWebRequestTimeout(
          webSupabase.reads.captainStatusesByCaptainIds(nextProfiles.map((profile) => profile.id)),
          'انتهت مهلة تحميل حالات الكباتن المتاحين بعد 15 ثانية. حاول مرة أخرى.',
        )
        : [];

      if (!mounted.current || version !== requestVersion.current) return;
      setSummary(nextSummary);
      setAvailableCaptains(mapAvailableCaptains(nextProfiles, nextStatuses));
    } catch (error) {
      console.error('Admin Home summary load failed.', error);
      if (!mounted.current || version !== requestVersion.current || background) return;
      setReadError(getHomeErrorMessage(error, 'تعذر تحميل لوحة الإدارة. حاول إعادة المحاولة.'));
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

  const refreshFromRealtime = useCallback(() => reload({ background: true }), [reload]);

  useRealtimeRefresh({
    enabled: true,
    channelName: 'backoffice-home',
    targets: BACKOFFICE_HOME_REALTIME_TARGETS,
    onRefresh: refreshFromRealtime,
  });

  const metrics = useMemo<HomeMetric[]>(() => {
    const values = summary ?? {
      assigned_count: 0,
      in_delivery_count: 0,
      completed_today_count: 0,
      cancelled_today_count: 0,
      recent_order_activities: [],
    };
    return [
      { id: 'pending', label: 'قيد الانتظار', value: values.assigned_count, icon: 'package', orderFilter: 'assigned' },
      { id: 'in_delivery', label: 'قيد التوصيل', value: values.in_delivery_count, icon: 'bike', orderFilter: 'delivery_active' },
      { id: 'completed_today', label: 'طلبات مكتملة اليوم', value: values.completed_today_count, icon: 'check', orderFilter: 'completed' },
      { id: 'cancelled_today', label: 'طلبات ملغاة اليوم', value: values.cancelled_today_count, icon: 'cancel', orderFilter: 'cancelled' },
    ];
  }, [summary]);

  const activities = useMemo(() => mapSummaryActivities(summary?.recent_order_activities ?? []), [summary]);

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
