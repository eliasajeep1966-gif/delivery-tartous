import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  webSupabase,
  type WebCaptainCustody,
  type WebCaptainStatus,
  type WebOrder,
  type WebProfile,
} from '@/data/supabase/webSupabaseContract';
import type { AdminCaptainListItem } from '@/features/admin/types';
import { WebRequestTimeoutError, withWebRequestTimeout } from '@/lib/authRequest';

const LOAD_TIMEOUT_MESSAGE = 'انتهت مهلة تحميل بيانات الكباتن بعد 15 ثانية. حاول مرة أخرى.';
const ACTION_TIMEOUT_MESSAGE = 'انتهت مهلة تأكيد العملية بعد 15 ثانية. تحقّق من حالة الكابتن قبل إعادة الإجراء.';

type ReloadOptions = {
  background?: boolean;
};

export type AdminLiveCaptain = AdminCaptainListItem & {
  orders: WebOrder[];
  custodyRecords: WebCaptainCustody[];
};

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof WebRequestTimeoutError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallbackMessage;
}

function captainName(profile: WebProfile): string {
  return profile.full_name?.trim() || profile.email || 'كابتن بلا اسم';
}

export function useAdminCaptainsData() {
  const [profiles, setProfiles] = useState<WebProfile[]>([]);
  const [captainStatuses, setCaptainStatuses] = useState<WebCaptainStatus[]>([]);
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const [custodyRecords, setCustodyRecords] = useState<WebCaptainCustody[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [updatingCaptainId, setUpdatingCaptainId] = useState<string | null>(null);
  const [updatingCustodyId, setUpdatingCustodyId] = useState<string | null>(null);
  const mounted = useRef(true);
  const requestVersion = useRef(0);

  const reload = useCallback(async ({ background = false }: ReloadOptions = {}) => {
    const version = ++requestVersion.current;
    if (!background) setReadError(null);

    try {
      const [nextProfiles, nextStatuses, nextOrders, nextCustodyRecords] = await Promise.all([
        withWebRequestTimeout(webSupabase.reads.profiles(), LOAD_TIMEOUT_MESSAGE),
        withWebRequestTimeout(webSupabase.reads.captainStatuses(), LOAD_TIMEOUT_MESSAGE),
        withWebRequestTimeout(webSupabase.reads.orders(), LOAD_TIMEOUT_MESSAGE),
        withWebRequestTimeout(webSupabase.reads.captainCustody(), LOAD_TIMEOUT_MESSAGE),
      ]);

      if (!mounted.current || version !== requestVersion.current) return;
      setProfiles(nextProfiles);
      setCaptainStatuses(nextStatuses);
      setOrders(nextOrders);
      setCustodyRecords(nextCustodyRecords);
    } catch (error) {
      console.error('Admin captains data load failed.', error);
      if (!mounted.current || version !== requestVersion.current || background) return;
      setReadError(getErrorMessage(error, 'تعذر تحميل إدارة الكباتن. حاول مرة أخرى.'));
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

  const captains = useMemo<AdminLiveCaptain[]>(() => {
    const statusByCaptainId = new Map(captainStatuses.map((status) => [status.captain_id, status]));
    const ordersByCaptainId = new Map<string, WebOrder[]>();
    const custodyByCaptainId = new Map<string, WebCaptainCustody[]>();

    orders.forEach((order) => {
      if (!order.assigned_captain_id) return;
      const current = ordersByCaptainId.get(order.assigned_captain_id) ?? [];
      current.push(order);
      ordersByCaptainId.set(order.assigned_captain_id, current);
    });

    custodyRecords.forEach((record) => {
      const current = custodyByCaptainId.get(record.captain_id) ?? [];
      current.push(record);
      custodyByCaptainId.set(record.captain_id, current);
    });

    return profiles
      .filter((profile) => profile.role === 'captain')
      .map((profile) => {
        const captainOrders = ordersByCaptainId.get(profile.id) ?? [];
        const activeOrder = captainOrders.find((order) => ['assigned', 'received', 'in_delivery'].includes(order.status));
        const captainCustody = custodyByCaptainId.get(profile.id) ?? [];
        const name = captainName(profile);

        return {
          id: profile.id,
          name,
          initial: name.slice(0, 1),
          availability: statusByCaptainId.get(profile.id)?.availability === 'available' ? 'available' as const : 'unavailable' as const,
          activation: profile.is_active ? 'active' as const : 'inactive' as const,
          completedOrders: captainOrders.filter((order) => order.status === 'completed').length,
          currentOrderId: activeOrder ? String(activeOrder.order_number) : undefined,
          custodyItems: captainCustody.map((record) => ({
            label: record.item_name,
            status: record.returned_at ? 'returned' as const : 'held' as const,
          })),
          orders: captainOrders,
          custodyRecords: captainCustody,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name, 'ar'));
  }, [captainStatuses, custodyRecords, orders, profiles]);

  const setCaptainActive = useCallback(async (captainId: string, isActive: boolean) => {
    if (updatingCaptainId) return;
    setUpdatingCaptainId(captainId);

    try {
      const profile = await withWebRequestTimeout(
        webSupabase.actions.setCaptainActive(captainId, isActive),
        ACTION_TIMEOUT_MESSAGE,
      );
      if (mounted.current) {
        ++requestVersion.current;
        setProfiles((current) => current.map((item) => (item.id === profile.id ? profile : item)));
      }
      void reload({ background: true });
      return profile;
    } catch (error) {
      if (error instanceof WebRequestTimeoutError) void reload({ background: true });
      throw error;
    } finally {
      if (mounted.current) setUpdatingCaptainId(null);
    }
  }, [reload, updatingCaptainId]);

  const assignCustody = useCallback(async (captainId: string, itemName: string, itemDetails?: string) => {
    if (updatingCaptainId) return;
    setUpdatingCaptainId(captainId);

    try {
      const record = await withWebRequestTimeout(
        webSupabase.actions.assignCaptainCustody(captainId, itemName, itemDetails),
        ACTION_TIMEOUT_MESSAGE,
      );
      if (mounted.current) {
        ++requestVersion.current;
        setCustodyRecords((current) => [record, ...current.filter((item) => item.id !== record.id)]);
      }
      void reload({ background: true });
      return record;
    } catch (error) {
      if (error instanceof WebRequestTimeoutError) void reload({ background: true });
      throw error;
    } finally {
      if (mounted.current) setUpdatingCaptainId(null);
    }
  }, [reload, updatingCaptainId]);

  const returnCustody = useCallback(async (custodyId: string, returnNotes?: string) => {
    if (updatingCustodyId) return;
    setUpdatingCustodyId(custodyId);

    try {
      const record = await withWebRequestTimeout(
        webSupabase.actions.returnCaptainCustody(custodyId, returnNotes),
        ACTION_TIMEOUT_MESSAGE,
      );
      if (mounted.current) {
        ++requestVersion.current;
        setCustodyRecords((current) => current.map((item) => (item.id === record.id ? record : item)));
      }
      void reload({ background: true });
      return record;
    } catch (error) {
      if (error instanceof WebRequestTimeoutError) void reload({ background: true });
      throw error;
    } finally {
      if (mounted.current) setUpdatingCustodyId(null);
    }
  }, [reload, updatingCustodyId]);

  return {
    captains,
    isInitialLoading,
    readError,
    updatingCaptainId,
    updatingCustodyId,
    reload,
    setCaptainActive,
    assignCustody,
    returnCustody,
  };
}
