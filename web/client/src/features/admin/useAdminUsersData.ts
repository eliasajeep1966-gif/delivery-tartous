import { useCallback, useEffect, useRef, useState } from 'react';

import {
  webSupabase,
  type WebCaptainStatus,
  type WebPendingAccount,
  type WebProfile,
} from '@/data/supabase/webSupabaseContract';
import { WebRequestTimeoutError, withWebRequestTimeout } from '@/lib/authRequest';

type ReloadOptions = {
  background?: boolean;
};

export type AdminUsersData = {
  profiles: WebProfile[];
  captainStatuses: WebCaptainStatus[];
  pendingAccounts: WebPendingAccount[];
  isInitialLoading: boolean;
  readError: string | null;
  reload: (options?: ReloadOptions) => Promise<void>;
  addPendingAccount: (account: WebPendingAccount) => void;
  removePendingAccount: (pendingId: string) => void;
  replaceProfile: (profile: WebProfile) => void;
};

export function getUsersErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof WebRequestTimeoutError) return error.message;

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallbackMessage;
}

export function useAdminUsersData(): AdminUsersData {
  const [profiles, setProfiles] = useState<WebProfile[]>([]);
  const [captainStatuses, setCaptainStatuses] = useState<WebCaptainStatus[]>([]);
  const [pendingAccounts, setPendingAccounts] = useState<WebPendingAccount[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const mounted = useRef(true);
  const requestVersion = useRef(0);

  const reload = useCallback(async ({ background = false }: ReloadOptions = {}) => {
    const version = ++requestVersion.current;
    if (!background) setReadError(null);

    try {
      const [nextProfiles, nextCaptainStatuses, nextPendingAccounts] = await Promise.all([
        withWebRequestTimeout(
          webSupabase.reads.profiles(),
          'انتهت مهلة تحميل الحسابات المفعّلة بعد 15 ثانية. حاول مرة أخرى.',
        ),
        withWebRequestTimeout(
          webSupabase.reads.captainStatuses(),
          'انتهت مهلة تحميل حالات الكباتن بعد 15 ثانية. حاول مرة أخرى.',
        ),
        withWebRequestTimeout(
          webSupabase.reads.pendingAccounts(),
          'انتهت مهلة تحميل الحسابات المعلّقة بعد 15 ثانية. حاول مرة أخرى.',
        ),
      ]);

      if (!mounted.current || version !== requestVersion.current) return;

      setProfiles(nextProfiles);
      setCaptainStatuses(nextCaptainStatuses);
      setPendingAccounts(nextPendingAccounts);
    } catch (error) {
      console.error('Admin Users data load failed.', error);
      if (!mounted.current || version !== requestVersion.current) return;

      if (!background) {
        setReadError(getUsersErrorMessage(error, 'تعذر تحميل بيانات المستخدمين. حاول مرة أخرى.'));
      }
    } finally {
      if (mounted.current && version === requestVersion.current) {
        setIsInitialLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void reload();

    return () => {
      mounted.current = false;
    };
  }, [reload]);

  const addPendingAccount = useCallback((account: WebPendingAccount) => {
    // A locally confirmed mutation is newer than any in-flight list request.
    ++requestVersion.current;
    setPendingAccounts((current) => (
      current.some((item) => item.id === account.id) ? current : [account, ...current]
    ));
  }, []);

  const removePendingAccount = useCallback((pendingId: string) => {
    // Prevent an older reload from restoring a Pending record that was cancelled successfully.
    ++requestVersion.current;
    setPendingAccounts((current) => current.filter((item) => item.id !== pendingId));
  }, []);

  const replaceProfile = useCallback((profile: WebProfile) => {
    // Prevent an older reload from replacing a confirmed role or active-state change.
    ++requestVersion.current;
    setProfiles((current) => current.map((item) => (item.id === profile.id ? profile : item)));
  }, []);

  return {
    profiles,
    captainStatuses,
    pendingAccounts,
    isInitialLoading,
    readError,
    reload,
    addPendingAccount,
    removePendingAccount,
    replaceProfile,
  };
}
