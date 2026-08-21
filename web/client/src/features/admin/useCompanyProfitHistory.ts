import { useCallback, useEffect, useRef, useState } from 'react';

import { webSupabase } from '@/data/supabase/webSupabaseContract';
import { withWebRequestTimeout } from '@/lib/authRequest';

import { mapCompanyProfitDayDetailRow, mapCompanyProfitHistoryRow } from './financeMappers';
import type { CompanyProfitDayDetailRow, CompanyProfitHistoryRow } from './financeTypes';

const HISTORY_TIMEOUT = 'انتهت مهلة تحميل سجل أرباح الشركة. حاول مرة أخرى.';
const DAY_DETAILS_TIMEOUT = 'انتهت مهلة تحميل تفاصيل اليوم. حاول مرة أخرى.';
const PAGE_SIZE = 30;
const DAY_PAGE_SIZE = 50;

type HistoryState = {
  rows: CompanyProfitHistoryRow[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
};

type DayDetailsState = {
  day: string | null;
  rows: CompanyProfitDayDetailRow[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function useCompanyProfitHistory() {
  const [history, setHistory] = useState<HistoryState>({ rows: [], loading: true, error: null, hasMore: true });
  const [dayDetails, setDayDetails] = useState<DayDetailsState>({ day: null, rows: [], loading: false, error: null, hasMore: false });
  const historyCursor = useRef<string | undefined>(undefined);
  const dayCursor = useRef<{ completedAt?: string; ledgerId?: string }>({});
  const historyRequest = useRef(0);
  const historyComplete = useRef(false);
  const dayRequest = useRef(0);
  const mounted = useRef(true);

  const loadHistory = useCallback(async (append = false) => {
    const request = ++historyRequest.current;
    if (!append) {
      historyCursor.current = undefined;
      historyComplete.current = false;
      setHistory({ rows: [], loading: true, error: null, hasMore: true });
    } else {
      setHistory((current) => ({ ...current, loading: true, error: null }));
    }
    try {
      const result = await withWebRequestTimeout(webSupabase.reads.companyProfitHistory({
        p_limit_days: PAGE_SIZE,
        p_before_day: historyCursor.current,
      }), HISTORY_TIMEOUT);
      if (!mounted.current || request !== historyRequest.current) return;
      const rows = result.map(mapCompanyProfitHistoryRow);
      historyCursor.current = rows.at(-1)?.businessDay;
      historyComplete.current = rows.length < PAGE_SIZE;
      setHistory((current) => ({ rows: append ? [...current.rows, ...rows] : rows, loading: false, error: null, hasMore: rows.length === PAGE_SIZE }));
    } catch (error) {
      if (!mounted.current || request !== historyRequest.current) return;
      setHistory((current) => ({ ...current, loading: false, error: errorMessage(error, 'تعذر تحميل سجل أرباح الشركة.'), hasMore: false }));
    }
  }, []);

  const loadAllHistory = useCallback(async () => {
    if (historyComplete.current) return;
    const request = ++historyRequest.current;
    setHistory((current) => ({ ...current, loading: true, error: null }));
    const allRows: CompanyProfitHistoryRow[] = [...history.rows];
    let cursor: string | undefined = historyCursor.current;
    try {
      while (true) {
        const result = await withWebRequestTimeout(webSupabase.reads.companyProfitHistory({
          p_limit_days: PAGE_SIZE,
          p_before_day: cursor,
        }), HISTORY_TIMEOUT);
        if (!mounted.current || request !== historyRequest.current) return;
        const rows = result.map(mapCompanyProfitHistoryRow);
        allRows.push(...rows);
        cursor = rows.at(-1)?.businessDay;
        if (rows.length < PAGE_SIZE) break;
      }
      historyCursor.current = cursor;
      historyComplete.current = true;
      setHistory({ rows: allRows, loading: false, error: null, hasMore: false });
    } catch (error) {
      if (!mounted.current || request !== historyRequest.current) return;
      setHistory((current) => ({ ...current, loading: false, error: errorMessage(error, 'تعذر تحميل سجل الأرباح الكامل.') }));
    }
  }, [history.rows]);

  const selectDay = useCallback(async (day: string) => {
    const request = ++dayRequest.current;
    dayCursor.current = {};
    setDayDetails({ day, rows: [], loading: true, error: null, hasMore: true });
    try {
      const result = await withWebRequestTimeout(webSupabase.reads.companyProfitDayDetails({
        p_business_day: day,
        p_limit: DAY_PAGE_SIZE,
      }), DAY_DETAILS_TIMEOUT);
      if (!mounted.current || request !== dayRequest.current) return;
      const rows = result.map(mapCompanyProfitDayDetailRow);
      const last = rows.at(-1);
      dayCursor.current = last ? { completedAt: last.completedAt, ledgerId: last.financialLedgerId } : {};
      setDayDetails({ day, rows, loading: false, error: null, hasMore: rows.length === DAY_PAGE_SIZE });
    } catch (error) {
      if (!mounted.current || request !== dayRequest.current) return;
      setDayDetails({ day, rows: [], loading: false, error: errorMessage(error, 'تعذر تحميل تفاصيل اليوم.'), hasMore: false });
    }
  }, []);

  const loadMoreDay = useCallback(async () => {
    const day = dayDetails.day;
    if (!day || dayDetails.loading || !dayDetails.hasMore) return;
    const request = dayRequest.current;
    setDayDetails((current) => ({ ...current, loading: true, error: null }));
    try {
      const result = await withWebRequestTimeout(webSupabase.reads.companyProfitDayDetails({
        p_business_day: day,
        p_limit: DAY_PAGE_SIZE,
        p_before_completed_at: dayCursor.current.completedAt,
        p_before_ledger_id: dayCursor.current.ledgerId,
      }), DAY_DETAILS_TIMEOUT);
      if (!mounted.current || request !== dayRequest.current) return;
      const rows = result.map(mapCompanyProfitDayDetailRow);
      const last = rows.at(-1);
      dayCursor.current = last ? { completedAt: last.completedAt, ledgerId: last.financialLedgerId } : dayCursor.current;
      setDayDetails((current) => ({ ...current, rows: [...current.rows, ...rows], loading: false, error: null, hasMore: rows.length === DAY_PAGE_SIZE }));
    } catch (error) {
      if (!mounted.current || request !== dayRequest.current) return;
      setDayDetails((current) => ({ ...current, loading: false, error: errorMessage(error, 'تعذر تحميل المزيد من تفاصيل اليوم.') }));
    }
  }, [dayDetails.day, dayDetails.hasMore, dayDetails.loading]);

  useEffect(() => {
    mounted.current = true;
    void loadHistory();
    return () => { mounted.current = false; };
  }, [loadHistory]);

  return { history, dayDetails, loadHistory, loadAllHistory, selectDay, loadMoreDay };
}
