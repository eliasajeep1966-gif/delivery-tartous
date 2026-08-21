import type {
  WebAuditLog,
  WebCaptainStatus,
  WebOrder,
  WebOrderStatus,
  WebProfile,
} from '@/data/supabase/webSupabaseContract';

const DAMASCUS_TIME_ZONE = 'Asia/Damascus';

export type HomeMetricId = 'pending' | 'in_delivery' | 'completed_today' | 'cancelled_today';

export type HomeOrderFilter = 'assigned' | 'delivery_active' | 'completed' | 'cancelled';

export type HomeMetric = {
  id: HomeMetricId;
  label: string;
  value: number;
  icon: 'package' | 'bike' | 'check' | 'cancel';
  orderFilter: HomeOrderFilter;
};

export type HomeActivity = {
  id: string;
  title: string;
  subtitle: string;
  timestamp: string;
  status: WebOrderStatus | null;
  href: '/orders' | '/wages' | '/users';
};

export type HomeCaptain = {
  id: string;
  name: string;
  initial: string;
  availability: 'available';
};

function damascusDayKey(value: string | Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DAMASCUS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
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

function profileName(profile: WebProfile | undefined): string {
  return profile?.full_name?.trim() || profile?.email || 'النظام';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function metadataValue(log: WebAuditLog, key: string): unknown {
  return isRecord(log.metadata) ? log.metadata[key] : undefined;
}

function metadataOrderNumber(log: WebAuditLog): string | null {
  const value = metadataValue(log, 'order_number');
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function orderStatusFrom(value: unknown): WebOrderStatus | null {
  return typeof value === 'string' && [
    'pending', 'assigned', 'received', 'in_delivery', 'completed', 'cancelled', 'false_order',
  ].includes(value) ? value as WebOrderStatus : null;
}

function activityTitle(log: WebAuditLog, order: WebOrder | undefined): string {
  const orderNumber = metadataOrderNumber(log) ?? (order ? String(order.order_number) : null);
  const orderSuffix = orderNumber ? ` #${orderNumber}` : '';

  switch (log.action) {
    case 'order_created':
    case 'order_created_with_stops':
      return `تم إنشاء الطلب${orderSuffix}`;
    case 'order_assigned':
      return `تم تعيين كابتن للطلب${orderSuffix}`;
    case 'order_cancelled':
      return `تم إلغاء الطلب${orderSuffix}`;
    case 'order_status_changed':
      return `تم تحديث حالة الطلب${orderSuffix}`;
    case 'captain_payout_recorded':
      return 'تم تسجيل دفعة كابتن';
    case 'captain_partial_payout_recorded':
      return 'تم تسجيل دفعة جزئية لكابتن';
    case 'pending_account_created':
      return 'تم إنشاء حساب معلّق';
    case 'pending_account_cancelled':
      return 'تم إلغاء حساب معلّق';
    case 'pending_account_activated':
      return 'تم تفعيل حساب';
    case 'captain_deactivated':
      return 'تم تعطيل كابتن';
    case 'captain_reactivated':
      return 'تم تفعيل كابتن';
    case 'user_permission_override_set':
      return 'تم تعديل تخصيص صلاحية';
    default:
      return 'تم تسجيل نشاط إداري';
  }
}

function activityHref(log: WebAuditLog): HomeActivity['href'] {
  if (log.entity_type === 'order') return '/orders';
  if (log.entity_type === 'captain_payout') return '/wages';
  return '/users';
}

export function buildHomeMetrics(orders: WebOrder[]): HomeMetric[] {
  const today = damascusDayKey(new Date());
  const awaitingReceiptCount = orders.filter((order) => order.status === 'assigned').length;
  const deliveryActiveCount = orders.filter((order) => order.status === 'received' || order.status === 'in_delivery').length;
  const countCompletedToday = orders.filter((order) => (
    order.status === 'completed' && order.completed_at && damascusDayKey(order.completed_at) === today
  )).length;
  const countCancelledToday = orders.filter((order) => (
    order.status === 'cancelled' && order.cancelled_at && damascusDayKey(order.cancelled_at) === today
  )).length;

  return [
    { id: 'pending', label: 'قيد الانتظار', value: awaitingReceiptCount, icon: 'package', orderFilter: 'assigned' },
    { id: 'in_delivery', label: 'قيد التوصيل', value: deliveryActiveCount, icon: 'bike', orderFilter: 'delivery_active' },
    { id: 'completed_today', label: 'طلبات مكتملة اليوم', value: countCompletedToday, icon: 'check', orderFilter: 'completed' },
    { id: 'cancelled_today', label: 'طلبات ملغاة اليوم', value: countCancelledToday, icon: 'cancel', orderFilter: 'cancelled' },
  ];
}

export function buildHomeActivities(logs: WebAuditLog[], orders: WebOrder[], profiles: WebProfile[]): HomeActivity[] {
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const seenOrderIds = new Set<string>();

  return logs
    .filter((log) => log.entity_type === 'order' || log.action.startsWith('order_'))
    .filter((log) => {
      const orderKey = log.entity_id ?? metadataOrderNumber(log);
      if (!orderKey || seenOrderIds.has(orderKey)) return false;
      seenOrderIds.add(orderKey);
      return true;
    })
    .slice(0, 6)
    .map((log) => {
      const order = log.entity_id ? ordersById.get(log.entity_id) : undefined;
      const loggedStatus = orderStatusFrom(metadataValue(log, 'next_status'));

      return {
        id: log.id,
        title: activityTitle(log, order),
        subtitle: `بواسطة ${profileName(log.actor_user_id ? profilesById.get(log.actor_user_id) : undefined)}`,
        timestamp: formatActivityTime(log.created_at),
        status: loggedStatus ?? order?.status ?? null,
        href: '/orders',
      };
    });
}

export function buildAvailableHomeCaptains(profiles: WebProfile[], statuses: WebCaptainStatus[]): HomeCaptain[] {
  const availabilityByCaptainId = new Map(statuses.map((status) => [status.captain_id, status.availability]));
  return profiles
    .filter((profile) => profile.role === 'captain' && profile.is_active && availabilityByCaptainId.get(profile.id) === 'available')
    .map((profile) => ({
      id: profile.id,
      name: profileName(profile),
      initial: profileName(profile).slice(0, 1),
      availability: 'available' as const,
    }));
}
