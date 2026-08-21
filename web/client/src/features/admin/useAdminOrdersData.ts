import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  webSupabase,
  type CreateOrderWithStopsInput,
  type WebCaptainStatus,
  type WebKeysetCursor,
  type WebOrder,
  type WebOrderStatus,
  type WebOrderStatusHistory,
  type WebOrderStop,
  type WebProfile,
} from '@/data/supabase/webSupabaseContract';
import { WebRequestTimeoutError, withWebRequestTimeout } from '@/lib/authRequest';

const LOAD_TIMEOUT_MESSAGE = 'انتهت مهلة تحميل بيانات الطلبات بعد 15 ثانية. حاول مرة أخرى.';
type ReloadOptions = { background?: boolean; force?: boolean };

export type LiveCaptainOption = { id: string; name: string; initial: string; availability: 'available' };
export type OrderDetails = { orderId: string; stops: WebOrderStop[]; history: WebOrderStatusHistory[] };

export type AdminOrdersData = {
  orders: WebOrder[];
  profiles: WebProfile[];
  captainStatuses: WebCaptainStatus[];
  isInitialLoading: boolean;
  readError: string | null;
  details: OrderDetails | null;
  detailsLoadingOrderId: string | null;
  detailsError: string | null;
  pageNumber: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  reload: (options?: ReloadOptions) => Promise<void>;
  nextPage: () => Promise<void>;
  previousPage: () => Promise<void>;
  addOrder: (order: WebOrder) => void;
  replaceOrder: (order: WebOrder) => void;
  loadOrderDetails: (orderId: string) => Promise<void>;
  createOrderWithStops: (input: CreateOrderWithStopsInput) => Promise<WebOrder>;
  assignOrderCaptain: (orderId: string, captainId: string) => Promise<WebOrder>;
  cancelOrder: (orderId: string, reason: string) => Promise<WebOrder>;
};

export function getOrdersErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof WebRequestTimeoutError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallbackMessage;
}

function profileDisplayName(profile: WebProfile): string {
  return profile.full_name?.trim() || profile.email;
}

export function useAdminOrdersData(status?: WebOrderStatus | readonly WebOrderStatus[]): AdminOrdersData {
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const [profiles, setProfiles] = useState<WebProfile[]>([]);
  const [captainStatuses, setCaptainStatuses] = useState<WebCaptainStatus[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [details, setDetails] = useState<OrderDetails | null>(null);
  const [detailsLoadingOrderId, setDetailsLoadingOrderId] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(WebKeysetCursor | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState<WebKeysetCursor | null>(null);
  const mounted = useRef(true);
  const listRequestVersion = useRef(0);
  const detailsRequestVersion = useRef(0);
  const statusFilterKey = typeof status === 'string' ? status : status?.join('|') ?? '';

  const loadPage = useCallback(async (cursor: WebKeysetCursor | null, index: number, { background = false }: ReloadOptions = {}) => {
    const version = ++listRequestVersion.current;
    if (!background) setReadError(null);
    try {
      const statusValues = statusFilterKey ? statusFilterKey.split('|') as WebOrderStatus[] : undefined;
      const ordersPage = await withWebRequestTimeout(webSupabase.reads.ordersPage({ cursor, status: statusValues?.length === 1 ? statusValues[0] : undefined, statuses: statusValues && statusValues.length > 1 ? statusValues : undefined }), LOAD_TIMEOUT_MESSAGE);
      const captainIds = Array.from(new Set(ordersPage.items.map((order) => order.assigned_captain_id).filter((captainId): captainId is string => Boolean(captainId))));
      const [nextProfiles, nextCaptainStatuses] = await Promise.all([
        withWebRequestTimeout(webSupabase.reads.profilesByIds(captainIds), 'انتهت مهلة تحميل أسماء الكباتن بعد 15 ثانية. حاول مرة أخرى.'),
        withWebRequestTimeout(webSupabase.reads.captainStatusesByCaptainIds(captainIds), 'انتهت مهلة تحميل حالات الكباتن بعد 15 ثانية. حاول مرة أخرى.'),
      ]);
      if (!mounted.current || version !== listRequestVersion.current) return;
      setOrders(ordersPage.items);
      setProfiles(nextProfiles);
      setCaptainStatuses(nextCaptainStatuses);
      setNextCursor(ordersPage.nextCursor);
      setPageIndex(index);
    } catch (error) {
      console.error('Admin Orders page load failed.', error);
      if (!mounted.current || version !== listRequestVersion.current) return;
      if (!background) setReadError(getOrdersErrorMessage(error, 'تعذر تحميل بيانات الطلبات. حاول مرة أخرى.'));
    } finally {
      if (mounted.current && version === listRequestVersion.current) setIsInitialLoading(false);
    }
  }, [statusFilterKey]);

  const reload = useCallback((options: ReloadOptions = {}) => loadPage(cursorHistory[pageIndex] ?? null, pageIndex, options), [cursorHistory, loadPage, pageIndex]);

  useEffect(() => {
    mounted.current = true;
    setCursorHistory([null]);
    setPageIndex(0);
    setNextCursor(null);
    void loadPage(null, 0);
    return () => { mounted.current = false; };
  }, [loadPage]);

  const nextPage = useCallback(async () => {
    if (!nextCursor) return;
    const nextIndex = pageIndex + 1;
    setCursorHistory((current) => [...current.slice(0, nextIndex), nextCursor]);
    await loadPage(nextCursor, nextIndex);
  }, [loadPage, nextCursor, pageIndex]);

  const previousPage = useCallback(async () => {
    if (pageIndex === 0) return;
    const previousIndex = pageIndex - 1;
    await loadPage(cursorHistory[previousIndex] ?? null, previousIndex);
  }, [cursorHistory, loadPage, pageIndex]);

  const addOrder = useCallback((order: WebOrder) => {
    ++listRequestVersion.current;
    setOrders((current) => (current.some((item) => item.id === order.id) ? current : [order, ...current].slice(0, 25)));
  }, []);
  const replaceOrder = useCallback((order: WebOrder) => {
    ++listRequestVersion.current;
    setOrders((current) => current.map((item) => (item.id === order.id ? order : item)));
  }, []);

  const loadOrderDetails = useCallback(async (orderId: string) => {
    const version = ++detailsRequestVersion.current;
    setDetailsError(null);
    setDetailsLoadingOrderId(orderId);
    try {
      const [stops, history] = await Promise.all([
        withWebRequestTimeout(webSupabase.reads.orderStops(orderId), 'انتهت مهلة تحميل نقاط الطلب بعد 15 ثانية. حاول مرة أخرى.'),
        withWebRequestTimeout(webSupabase.reads.orderStatusHistory(orderId), 'انتهت مهلة تحميل تسلسل حالة الطلب بعد 15 ثانية. حاول مرة أخرى.'),
      ]);
      if (!mounted.current || version !== detailsRequestVersion.current) return;
      setDetails({ orderId, stops, history });
    } catch (error) {
      console.error('Order details load failed.', error);
      if (!mounted.current || version !== detailsRequestVersion.current) return;
      setDetailsError(getOrdersErrorMessage(error, 'تعذر تحميل تفاصيل الطلب. حاول مرة أخرى.'));
    } finally {
      if (mounted.current && version === detailsRequestVersion.current) setDetailsLoadingOrderId(null);
    }
  }, []);

  const createOrderWithStops = useCallback((input: CreateOrderWithStopsInput) => withWebRequestTimeout(webSupabase.actions.createOrderWithStops(input), 'انتهت مهلة إنشاء الطلب بعد 15 ثانية. تحقّق من قائمة الطلبات قبل إعادة الإرسال.'), []);
  const assignOrderCaptain = useCallback((orderId: string, captainId: string) => withWebRequestTimeout(webSupabase.actions.assignOrderCaptain(orderId, captainId), 'انتهت مهلة تعيين الكابتن بعد 15 ثانية. تحقّق من حالة الطلب قبل إعادة المحاولة.'), []);
  const cancelOrder = useCallback((orderId: string, reason: string) => withWebRequestTimeout(webSupabase.actions.cancelOrder(orderId, reason), 'انتهت مهلة إلغاء الطلب بعد 15 ثانية. تحقّق من حالة الطلب قبل إعادة المحاولة.'), []);

  return { orders, profiles, captainStatuses, isInitialLoading, readError, details, detailsLoadingOrderId, detailsError, pageNumber: pageIndex + 1, hasNextPage: nextCursor !== null, hasPreviousPage: pageIndex > 0, reload, nextPage, previousPage, addOrder, replaceOrder, loadOrderDetails, createOrderWithStops, assignOrderCaptain, cancelOrder };
}

export type AvailableCaptainsData = { availableCaptains: LiveCaptainOption[]; isInitialLoading: boolean; hasLoaded: boolean; readError: string | null; reload: (options?: ReloadOptions) => Promise<void>; createOrderWithStops: (input: CreateOrderWithStopsInput) => Promise<WebOrder>; assignOrderCaptain: (orderId: string, captainId: string) => Promise<WebOrder> };

export function useAvailableCaptains(): AvailableCaptainsData {
  const [profiles, setProfiles] = useState<WebProfile[]>([]);
  const [captainStatuses, setCaptainStatuses] = useState<WebCaptainStatus[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const mounted = useRef(true);
  const requestVersion = useRef(0);
  const loadedRef = useRef(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const reload = useCallback(async ({ background = false, force = false }: ReloadOptions = {}) => {
    if (loadedRef.current && !force) return;
    const version = ++requestVersion.current;
    if (!background) setReadError(null);
    try {
      const captainProfiles = await withWebRequestTimeout(webSupabase.reads.availableCaptainProfiles(), 'انتهت مهلة تحميل بيانات الكباتن بعد 15 ثانية. حاول مرة أخرى.');
      const captainIds = captainProfiles.map((profile) => profile.id);
      const nextCaptainStatuses = await withWebRequestTimeout(webSupabase.reads.captainStatusesByCaptainIds(captainIds), 'انتهت مهلة تحميل حالات الكباتن بعد 15 ثانية. حاول مرة أخرى.');
      if (!mounted.current || version !== requestVersion.current) return;
      setProfiles(captainProfiles); setCaptainStatuses(nextCaptainStatuses); loadedRef.current = true; setHasLoaded(true);
    } catch (error) {
      console.error('Available captains load failed.', error);
      if (!mounted.current || version !== requestVersion.current) return;
      if (!background) setReadError(getOrdersErrorMessage(error, 'تعذر تحميل الكباتن المتاحين. حاول مرة أخرى.'));
    } finally {
      if (mounted.current && version === requestVersion.current) setIsInitialLoading(false);
    }
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const availableCaptains = useMemo(() => {
    const availabilityByCaptainId = new Map(captainStatuses.map((item) => [item.captain_id, item.availability]));
    return profiles.filter((profile) => profile.role === 'captain' && profile.is_active && availabilityByCaptainId.get(profile.id) === 'available').map((profile) => ({ id: profile.id, name: profileDisplayName(profile), initial: profileDisplayName(profile).slice(0, 1), availability: 'available' as const }));
  }, [captainStatuses, profiles]);
  const createOrderWithStops = useCallback((input: CreateOrderWithStopsInput) => withWebRequestTimeout(webSupabase.actions.createOrderWithStops(input), 'انتهت مهلة إنشاء الطلب بعد 15 ثانية. تحقّق من قائمة الطلبات قبل إعادة الإرسال.'), []);
  const assignOrderCaptain = useCallback((orderId: string, captainId: string) => withWebRequestTimeout(webSupabase.actions.assignOrderCaptain(orderId, captainId), 'انتهت مهلة تعيين الكابتن بعد 15 ثانية. تحقّق من حالة الطلب قبل إعادة المحاولة.'), []);
  return { availableCaptains, isInitialLoading, hasLoaded, readError, reload, createOrderWithStops, assignOrderCaptain };
}
