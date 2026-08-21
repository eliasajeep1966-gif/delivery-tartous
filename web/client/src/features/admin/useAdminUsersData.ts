import { useCallback, useEffect, useRef, useState } from 'react';

import { WEB_LIST_PAGE_SIZE, webSupabase, type WebCaptainStatus, type WebKeysetCursor, type WebPendingAccount, type WebProfile } from '@/data/supabase/webSupabaseContract';
import { WebRequestTimeoutError, withWebRequestTimeout } from '@/lib/authRequest';

type ReloadOptions = { background?: boolean };
type PageState = { cursors: (WebKeysetCursor | null)[]; index: number; nextCursor: WebKeysetCursor | null };
const initialPageState: PageState = { cursors: [null], index: 0, nextCursor: null };

export type AdminUsersData = {
  profiles: WebProfile[];
  captainStatuses: WebCaptainStatus[];
  pendingAccounts: WebPendingAccount[];
  isInitialLoading: boolean;
  readError: string | null;
  profilesPageNumber: number;
  pendingPageNumber: number;
  hasNextProfilesPage: boolean;
  hasPreviousProfilesPage: boolean;
  hasNextPendingPage: boolean;
  hasPreviousPendingPage: boolean;
  reload: (options?: ReloadOptions) => Promise<void>;
  nextProfilesPage: () => Promise<void>;
  previousProfilesPage: () => Promise<void>;
  nextPendingPage: () => Promise<void>;
  previousPendingPage: () => Promise<void>;
  addPendingAccount: (account: WebPendingAccount) => void;
  removePendingAccount: (pendingId: string) => void;
  replaceProfile: (profile: WebProfile) => void;
};

export function getUsersErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof WebRequestTimeoutError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallbackMessage;
}

export function useAdminUsersData(): AdminUsersData {
  const [profiles, setProfiles] = useState<WebProfile[]>([]);
  const [captainStatuses, setCaptainStatuses] = useState<WebCaptainStatus[]>([]);
  const [pendingAccounts, setPendingAccounts] = useState<WebPendingAccount[]>([]);
  const [profilesPage, setProfilesPage] = useState<PageState>(initialPageState);
  const [pendingPage, setPendingPage] = useState<PageState>(initialPageState);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const mounted = useRef(true);
  const requestVersion = useRef(0);

  const loadPages = useCallback(async (profileCursor: WebKeysetCursor | null, profileIndex: number, pendingCursor: WebKeysetCursor | null, pendingIndex: number, { background = false }: ReloadOptions = {}) => {
    const version = ++requestVersion.current;
    if (!background) setReadError(null);
    try {
      const [profilesResult, pendingResult] = await Promise.all([
        withWebRequestTimeout(webSupabase.reads.profilesPage({ cursor: profileCursor, limit: WEB_LIST_PAGE_SIZE }), 'انتهت مهلة تحميل الحسابات المفعّلة بعد 15 ثانية. حاول مرة أخرى.'),
        withWebRequestTimeout(webSupabase.reads.pendingAccountsPage({ cursor: pendingCursor, limit: WEB_LIST_PAGE_SIZE }), 'انتهت مهلة تحميل الحسابات المعلّقة بعد 15 ثانية. حاول مرة أخرى.'),
      ]);
      const captainIds = profilesResult.items.filter((profile) => profile.role === 'captain').map((profile) => profile.id);
      const statuses = await withWebRequestTimeout(webSupabase.reads.captainStatusesByCaptainIds(captainIds), 'انتهت مهلة تحميل حالات الكباتن بعد 15 ثانية. حاول مرة أخرى.');
      if (!mounted.current || version !== requestVersion.current) return;
      setProfiles(profilesResult.items);
      setCaptainStatuses(statuses);
      setPendingAccounts(pendingResult.items);
      setProfilesPage((current) => ({ cursors: [...current.cursors.slice(0, profileIndex), profileCursor], index: profileIndex, nextCursor: profilesResult.nextCursor }));
      setPendingPage((current) => ({ cursors: [...current.cursors.slice(0, pendingIndex), pendingCursor], index: pendingIndex, nextCursor: pendingResult.nextCursor }));
    } catch (error) {
      console.error('Admin Users paged load failed.', error);
      if (!mounted.current || version !== requestVersion.current) return;
      if (!background) setReadError(getUsersErrorMessage(error, 'تعذر تحميل بيانات المستخدمين. حاول مرة أخرى.'));
    } finally {
      if (mounted.current && version === requestVersion.current) setIsInitialLoading(false);
    }
  }, []);

  const reload = useCallback((options: ReloadOptions = {}) => loadPages(profilesPage.cursors[profilesPage.index] ?? null, profilesPage.index, pendingPage.cursors[pendingPage.index] ?? null, pendingPage.index, options), [loadPages, pendingPage, profilesPage]);
  useEffect(() => { mounted.current = true; void loadPages(null, 0, null, 0); return () => { mounted.current = false; }; }, [loadPages]);
  const nextProfilesPage = useCallback(async () => { if (profilesPage.nextCursor) await loadPages(profilesPage.nextCursor, profilesPage.index + 1, pendingPage.cursors[pendingPage.index] ?? null, pendingPage.index); }, [loadPages, pendingPage, profilesPage]);
  const previousProfilesPage = useCallback(async () => { if (profilesPage.index > 0) { const nextIndex = profilesPage.index - 1; await loadPages(profilesPage.cursors[nextIndex] ?? null, nextIndex, pendingPage.cursors[pendingPage.index] ?? null, pendingPage.index); } }, [loadPages, pendingPage, profilesPage]);
  const nextPendingPage = useCallback(async () => { if (pendingPage.nextCursor) await loadPages(profilesPage.cursors[profilesPage.index] ?? null, profilesPage.index, pendingPage.nextCursor, pendingPage.index + 1); }, [loadPages, pendingPage, profilesPage]);
  const previousPendingPage = useCallback(async () => { if (pendingPage.index > 0) { const nextIndex = pendingPage.index - 1; await loadPages(profilesPage.cursors[profilesPage.index] ?? null, profilesPage.index, pendingPage.cursors[nextIndex] ?? null, nextIndex); } }, [loadPages, pendingPage, profilesPage]);

  const addPendingAccount = useCallback((account: WebPendingAccount) => {
    ++requestVersion.current;
    setPendingAccounts((current) => current.some((item) => item.id === account.id) ? current : [account, ...current].slice(0, 25));
  }, []);
  const removePendingAccount = useCallback((pendingId: string) => {
    ++requestVersion.current;
    setPendingAccounts((current) => current.filter((item) => item.id !== pendingId));
  }, []);
  const replaceProfile = useCallback((profile: WebProfile) => {
    ++requestVersion.current;
    setProfiles((current) => current.map((item) => item.id === profile.id ? profile : item));
  }, []);

  return {
    profiles, captainStatuses, pendingAccounts, isInitialLoading, readError,
    profilesPageNumber: profilesPage.index + 1, pendingPageNumber: pendingPage.index + 1,
    hasNextProfilesPage: profilesPage.nextCursor !== null, hasPreviousProfilesPage: profilesPage.index > 0,
    hasNextPendingPage: pendingPage.nextCursor !== null, hasPreviousPendingPage: pendingPage.index > 0,
    reload, nextProfilesPage, previousProfilesPage, nextPendingPage, previousPendingPage,
    addPendingAccount, removePendingAccount, replaceProfile,
  };
}
