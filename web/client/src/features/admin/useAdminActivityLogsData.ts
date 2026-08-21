import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  webSupabase,
  WEB_LIST_PAGE_SIZE,
  type WebAuditLog,
  type WebKeysetCursor,
  type WebOrder,
  type WebProfile,
} from '@/data/supabase/webSupabaseContract';
import { WebRequestTimeoutError, withWebRequestTimeout } from '@/lib/authRequest';

const LOAD_TIMEOUT_MESSAGE = 'انتهت مهلة تحميل سجل الحركات بعد 15 ثانية. حاول مرة أخرى.';
const DAMASCUS_TIME_ZONE = 'Asia/Damascus';

export type ActivityLogCategory = 'orders' | 'users' | 'captains' | 'system';
export type ActivityLogTone = 'blue' | 'green' | 'red' | 'violet' | 'slate';
export type ActivityLogIcon = 'package' | 'user-plus' | 'check' | 'trash' | 'truck' | 'shield' | 'wallet' | 'cancel' | 'clipboard';

export type AdminActivityLog = {
  id: string;
  category: ActivityLogCategory;
  action: string;
  subject: string;
  actor: string;
  time: string;
  details: string;
  icon: ActivityLogIcon;
  tone: ActivityLogTone;
};

type ReloadOptions = {
  background?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function metadataValue(log: WebAuditLog, key: string): unknown {
  return isRecord(log.metadata) ? log.metadata[key] : undefined;
}

function metadataText(log: WebAuditLog, key: string): string | null {
  const value = metadataValue(log, key);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function profileName(profile: WebProfile | undefined): string {
  return profile?.full_name?.trim() || profile?.email || 'النظام';
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('ar-SY', {
    timeZone: DAMASCUS_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function orderNumber(log: WebAuditLog, order: WebOrder | undefined): string | null {
  return metadataText(log, 'order_number') ?? (order ? String(order.order_number) : null);
}

function categoryFor(log: WebAuditLog): ActivityLogCategory {
  if (log.entity_type === 'order' || log.action.startsWith('order_')) return 'orders';
  if (log.entity_type === 'captain_payout' || log.action.includes('payout')) return 'captains';
  if (log.action.includes('captain_') || log.action.includes('custody')) return 'captains';
  if (log.action.includes('account') || log.action.includes('user_') || log.action.includes('permission')) return 'users';
  return 'system';
}

function presentationFor(log: WebAuditLog): Pick<AdminActivityLog, 'action' | 'details' | 'icon' | 'tone'> {
  switch (log.action) {
    case 'order_created':
    case 'order_created_with_stops':
      return { action: 'إنشاء طلب', details: 'تم إنشاء طلب جديد في النظام.', icon: 'package', tone: 'blue' };
    case 'order_assigned':
      return { action: 'تعيين كابتن', details: 'تم إسناد الطلب إلى كابتن.', icon: 'truck', tone: 'violet' };
    case 'order_status_changed':
      return { action: 'تحديث حالة طلب', details: 'تم تحديث المرحلة التشغيلية للطلب.', icon: 'check', tone: 'green' };
    case 'order_cancelled':
      return { action: 'إلغاء طلب', details: 'تم إلغاء الطلب وتسجيل السبب.', icon: 'cancel', tone: 'red' };
    case 'pending_account_created':
      return { action: 'إنشاء حساب معلّق', details: 'تمت إضافة حساب بانتظار التفعيل.', icon: 'user-plus', tone: 'green' };
    case 'pending_account_cancelled':
      return { action: 'إلغاء حساب معلّق', details: 'تم إلغاء حساب قبل تفعيله.', icon: 'trash', tone: 'red' };
    case 'pending_account_activated':
      return { action: 'تفعيل حساب', details: 'تم تفعيل الحساب بنجاح.', icon: 'check', tone: 'green' };
    case 'captain_deactivated':
      return { action: 'تعطيل كابتن', details: 'تم إيقاف حساب الكابتن.', icon: 'truck', tone: 'red' };
    case 'captain_reactivated':
      return { action: 'تفعيل كابتن', details: 'تم إعادة تفعيل حساب الكابتن.', icon: 'truck', tone: 'violet' };
    case 'captain_custody_assigned':
      return { action: 'إضافة أمانة', details: `تم تسجيل أمانة: ${metadataText(log, 'item_name') ?? 'عنصر جديد'}.`, icon: 'clipboard', tone: 'violet' };
    case 'captain_custody_returned':
      return { action: 'إرجاع أمانة', details: `تم تسجيل إرجاع أمانة: ${metadataText(log, 'item_name') ?? 'عنصر'}.`, icon: 'check', tone: 'green' };
    case 'captain_payout_recorded':
      return { action: 'تسجيل دفعة كابتن', details: 'تم تسجيل دفعة أجور لكابتن.', icon: 'wallet', tone: 'green' };
    case 'captain_partial_payout_recorded':
      return { action: 'تسجيل دفعة جزئية', details: 'تم تسجيل دفعة جزئية من أجور كابتن.', icon: 'wallet', tone: 'green' };
    case 'user_permission_override_set':
      return { action: 'تعديل تخصيص صلاحية', details: 'تم تعديل تخصيص صلاحية مستخدم.', icon: 'shield', tone: 'slate' };
    default:
      return { action: 'نشاط إداري', details: 'تم تسجيل حركة إدارية في النظام.', icon: 'clipboard', tone: 'slate' };
  }
}

function subjectFor(log: WebAuditLog, order: WebOrder | undefined, profilesById: Map<string, WebProfile>): string {
  const orderNo = orderNumber(log, order);
  if (orderNo) return `الطلب #${orderNo}`;

  const captainId = metadataText(log, 'captain_id');
  if (captainId) return profileName(profilesById.get(captainId));

  if (log.entity_id && profilesById.has(log.entity_id)) return profileName(profilesById.get(log.entity_id));

  return metadataText(log, 'email') ?? metadataText(log, 'item_name') ?? 'النظام';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof WebRequestTimeoutError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return 'تعذر تحميل سجل الحركات. حاول مرة أخرى.';
}

export function useAdminActivityLogsData() {
  const [auditLogs, setAuditLogs] = useState<WebAuditLog[]>([]);
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const [profiles, setProfiles] = useState<WebProfile[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(WebKeysetCursor | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState<WebKeysetCursor | null>(null);
  const mounted = useRef(true);
  const requestVersion = useRef(0);

  const loadPage = useCallback(async (cursor: WebKeysetCursor | null, index: number, { background = false }: ReloadOptions = {}) => {
    const version = ++requestVersion.current;
    if (!background) setReadError(null);
    try {
      const auditPage = await withWebRequestTimeout(webSupabase.reads.auditLogsPage({ cursor, limit: WEB_LIST_PAGE_SIZE }), LOAD_TIMEOUT_MESSAGE);
      const orderIds = Array.from(new Set(auditPage.items.filter((log) => log.entity_type === 'order' && log.entity_id).map((log) => log.entity_id as string)));
      const profileIds = Array.from(new Set(auditPage.items.flatMap((log) => [
        log.actor_user_id,
        log.entity_type === 'order' ? null : log.entity_id,
        metadataText(log, 'captain_id'),
      ].filter((id): id is string => Boolean(id)))));
      const [nextOrders, nextProfiles] = await Promise.all([
        withWebRequestTimeout(webSupabase.reads.ordersByIds(orderIds), LOAD_TIMEOUT_MESSAGE),
        withWebRequestTimeout(webSupabase.reads.profilesByIds(profileIds), LOAD_TIMEOUT_MESSAGE),
      ]);
      if (!mounted.current || version !== requestVersion.current) return;
      setAuditLogs(auditPage.items);
      setOrders(nextOrders);
      setProfiles(nextProfiles);
      setNextCursor(auditPage.nextCursor);
      setPageIndex(index);
      setCursorHistory((current) => [...current.slice(0, index), cursor]);
    } catch (error) {
      console.error('Admin activity logs data load failed.', error);
      if (!mounted.current || version !== requestVersion.current || background) return;
      setReadError(getErrorMessage(error));
    } finally {
      if (mounted.current && version === requestVersion.current) setIsInitialLoading(false);
    }
  }, []);

  const reload = useCallback((options: ReloadOptions = {}) => loadPage(cursorHistory[pageIndex] ?? null, pageIndex, options), [cursorHistory, loadPage, pageIndex]);
  const nextPage = useCallback(async () => {
    if (!nextCursor) return;
    await loadPage(nextCursor, pageIndex + 1);
  }, [loadPage, nextCursor, pageIndex]);
  const previousPage = useCallback(async () => {
    if (pageIndex === 0) return;
    await loadPage(cursorHistory[pageIndex - 1] ?? null, pageIndex - 1);
  }, [cursorHistory, loadPage, pageIndex]);

  useEffect(() => {
    mounted.current = true;
    void loadPage(null, 0);
    return () => {
      mounted.current = false;
    };
  }, [loadPage]);

  const activities = useMemo<AdminActivityLog[]>(() => {
    const ordersById = new Map(orders.map((order) => [order.id, order]));
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

    return auditLogs.map((log) => {
      const order = log.entity_type === 'order' && log.entity_id ? ordersById.get(log.entity_id) : undefined;
      const presentation = presentationFor(log);
      return {
        id: log.id,
        category: categoryFor(log),
        action: presentation.action,
        subject: subjectFor(log, order, profilesById),
        actor: profileName(log.actor_user_id ? profilesById.get(log.actor_user_id) : undefined),
        time: formatTime(log.created_at),
        details: presentation.details,
        icon: presentation.icon,
        tone: presentation.tone,
      };
    });
  }, [auditLogs, orders, profiles]);

  return { activities, isInitialLoading, readError, reload, pageNumber: pageIndex + 1, hasNextPage: nextCursor !== null, hasPreviousPage: pageIndex > 0, nextPage, previousPage };
}
