import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  webSupabase,
  type CreateOrderWithStopsInput,
  type WebCaptainStatus,
  type WebOrder,
  type WebOrderStatusHistory,
  type WebOrderStop,
  type WebProfile,
} from '@/data/supabase/webSupabaseContract';
import { WebRequestTimeoutError, withWebRequestTimeout } from '@/lib/authRequest';

const LOAD_TIMEOUT_MESSAGE = 'انتهت مهلة تحميل بيانات الطلبات بعد 15 ثانية. حاول مرة أخرى.';

type ReloadOptions = {
  background?: boolean;
};

export type LiveCaptainOption = {
  id: string;
  name: string;
  initial: string;
  availability: 'available';
};

export type OrderDetails = {
  orderId: string;
  stops: WebOrderStop[];
  history: WebOrderStatusHistory[];
};

export type AdminOrdersData = {
  orders: WebOrder[];
  profiles: WebProfile[];
  captainStatuses: WebCaptainStatus[];
  availableCaptains: LiveCaptainOption[];
  isInitialLoading: boolean;
  readError: string | null;
  details: OrderDetails | null;
  detailsLoadingOrderId: string | null;
  detailsError: string | null;
  reload: (options?: ReloadOptions) => Promise<void>;
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

export function useAdminOrdersData(): AdminOrdersData {
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const [profiles, setProfiles] = useState<WebProfile[]>([]);
  const [captainStatuses, setCaptainStatuses] = useState<WebCaptainStatus[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [details, setDetails] = useState<OrderDetails | null>(null);
  const [detailsLoadingOrderId, setDetailsLoadingOrderId] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const mounted = useRef(true);
  const listRequestVersion = useRef(0);
  const detailsRequestVersion = useRef(0);

  const reload = useCallback(async ({ background = false }: ReloadOptions = {}) => {
    const version = ++listRequestVersion.current;
    if (!background) setReadError(null);

    try {
      const [nextOrders, nextProfiles, nextCaptainStatuses] = await Promise.all([
        withWebRequestTimeout(webSupabase.reads.orders(), LOAD_TIMEOUT_MESSAGE),
        withWebRequestTimeout(webSupabase.reads.profiles(), 'انتهت مهلة تحميل بيانات المستخدمين بعد 15 ثانية. حاول مرة أخرى.'),
        withWebRequestTimeout(webSupabase.reads.captainStatuses(), 'انتهت مهلة تحميل حالات الكباتن بعد 15 ثانية. حاول مرة أخرى.'),
      ]);

      if (!mounted.current || version !== listRequestVersion.current) return;
      setOrders(nextOrders);
      setProfiles(nextProfiles);
      setCaptainStatuses(nextCaptainStatuses);
    } catch (error) {
      console.error('Admin Orders data load failed.', error);
      if (!mounted.current || version !== listRequestVersion.current) return;
      if (!background) setReadError(getOrdersErrorMessage(error, 'تعذر تحميل بيانات الطلبات. حاول مرة أخرى.'));
    } finally {
      if (mounted.current && version === listRequestVersion.current) setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  const availableCaptains = useMemo(() => {
    const availabilityByCaptainId = new Map(captainStatuses.map((status) => [status.captain_id, status.availability]));
    return profiles
      .filter((profile) => profile.role === 'captain' && profile.is_active && availabilityByCaptainId.get(profile.id) === 'available')
      .map((profile) => ({
        id: profile.id,
        name: profileDisplayName(profile),
        initial: profileDisplayName(profile).slice(0, 1),
        availability: 'available' as const,
      }));
  }, [captainStatuses, profiles]);

  const addOrder = useCallback((order: WebOrder) => {
    ++listRequestVersion.current;
    setOrders((current) => (current.some((item) => item.id === order.id) ? current : [order, ...current]));
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

  const cancelOrder = useCallback((orderId: string, reason: string) => (
    withWebRequestTimeout(
      webSupabase.actions.cancelOrder(orderId, reason),
      'انتهت مهلة إلغاء الطلب بعد 15 ثانية. تحقّق من حالة الطلب قبل إعادة المحاولة.',
    )
  ), []);

  return {
    orders,
    profiles,
    captainStatuses,
    availableCaptains,
    isInitialLoading,
    readError,
    details,
    detailsLoadingOrderId,
    detailsError,
    reload,
    addOrder,
    replaceOrder,
    loadOrderDetails,
    createOrderWithStops,
    assignOrderCaptain,
    cancelOrder,
  };
}

export type AvailableCaptainsData = {
  availableCaptains: LiveCaptainOption[];
  isInitialLoading: boolean;
  readError: string | null;
  reload: (options?: ReloadOptions) => Promise<void>;
  createOrderWithStops: (input: CreateOrderWithStopsInput) => Promise<WebOrder>;
  assignOrderCaptain: (orderId: string, captainId: string) => Promise<WebOrder>;
};

/** Lightweight Home data scope: only captain options and the approved create/assign RPCs. */
export function useAvailableCaptains(): AvailableCaptainsData {
  const [profiles, setProfiles] = useState<WebProfile[]>([]);
  const [captainStatuses, setCaptainStatuses] = useState<WebCaptainStatus[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const mounted = useRef(true);
  const requestVersion = useRef(0);

  const reload = useCallback(async ({ background = false }: ReloadOptions = {}) => {
    const version = ++requestVersion.current;
    if (!background) setReadError(null);

    try {
      const [nextProfiles, nextCaptainStatuses] = await Promise.all([
        withWebRequestTimeout(webSupabase.reads.profiles(), 'انتهت مهلة تحميل بيانات الكباتن بعد 15 ثانية. حاول مرة أخرى.'),
        withWebRequestTimeout(webSupabase.reads.captainStatuses(), 'انتهت مهلة تحميل حالات الكباتن بعد 15 ثانية. حاول مرة أخرى.'),
      ]);
      if (!mounted.current || version !== requestVersion.current) return;
      setProfiles(nextProfiles);
      setCaptainStatuses(nextCaptainStatuses);
    } catch (error) {
      console.error('Available captains load failed.', error);
      if (!mounted.current || version !== requestVersion.current) return;
      if (!background) setReadError(getOrdersErrorMessage(error, 'تعذر تحميل الكباتن المتاحين. حاول مرة أخرى.'));
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

  const availableCaptains = useMemo(() => {
    const availabilityByCaptainId = new Map(captainStatuses.map((status) => [status.captain_id, status.availability]));
    return profiles
      .filter((profile) => profile.role === 'captain' && profile.is_active && availabilityByCaptainId.get(profile.id) === 'available')
      .map((profile) => ({
        id: profile.id,
        name: profileDisplayName(profile),
        initial: profileDisplayName(profile).slice(0, 1),
        availability: 'available' as const,
      }));
  }, [captainStatuses, profiles]);

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
    availableCaptains,
    isInitialLoading,
    readError,
    reload,
    createOrderWithStops,
    assignOrderCaptain,
  };
}
