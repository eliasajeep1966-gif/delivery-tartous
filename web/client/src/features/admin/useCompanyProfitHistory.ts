import { useCallback, useEffect, useRef, useState } from 'react';

import { webSupabase } from '@/data/supabase/webSupabaseContract';
import { withWebRequestTimeout } from '@/lib/authRequest';
import { mapCompanyProfitDayDetailRow, mapCompanyProfitPeriodHistoryRow } from './financeMappers';
import type { CompanyProfitDayDetailRow, CompanyProfitPeriod, CompanyProfitPeriodHistoryRow } from './financeTypes';

type PeriodHistoryState = {
  period: CompanyProfitPeriod;
  rows: CompanyProfitPeriodHistoryRow[];
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

const PERIOD_PAGE_SIZE = 30;
const DAY_PAGE_SIZE = 50;
const HISTORY_TIMEOUT = 'انتهت مهلة تحميل سجل أرباح الفترة.';
const DAY_DETAILS_TIMEOUT = 'انتهت مهلة تحميل تفاصيل اليوم.';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function useCompanyProfitHistory() {
  const [history, setHistory] = useState<PeriodHistoryState>({ period: 'daily', rows: [], loading: true, error: null, hasMore: true });
  const [dayDetails, setDayDetails] = useState<DayDetailsState>({ day: null, rows: [], loading: false, error: null, hasMore: false });
  const periodCursor = useRef<string | undefined>(undefined);
  const dayCursor = useRef<{ completedAt?: string; ledgerId?: string }>({});
  const periodRequestVersion = useRef(0);
  const dayRequestVersion = useRef(0);
  const periodRef = useRef<CompanyProfitPeriod>('daily');
  const mounted = useRef(true);

  const loadHistory = useCallback(async (period: CompanyProfitPeriod, append = false) => {
    const requestVersion = ++periodRequestVersion.current;
    periodRef.current = period;
    if (!append) {
      periodCursor.current = undefined;
      setHistory({ period, rows: [], loading: true, error: null, hasMore: true });
      setDayDetails({ day: null, rows: [], loading: false, error: null, hasMore: false });
    } else {
      setHistory((current) => ({ ...current, loading: true, error: null }));
    }

    try {
      const result = await withWebRequestTimeout(webSupabase.reads.companyProfitPeriodHistory({
        p_period: period,
        p_limit: PERIOD_PAGE_SIZE,
        p_before_period_start: append ? periodCursor.current : undefined,
      }), HISTORY_TIMEOUT);
      if (!mounted.current || requestVersion !== periodRequestVersion.current) return;
      const rows = result.map(mapCompanyProfitPeriodHistoryRow);
      periodCursor.current = rows.at(-1)?.periodStart;
      setHistory((current) => ({
        period,
        rows: append ? [...current.rows, ...rows] : rows,
        loading: false,
        error: null,
        hasMore: rows.length === PERIOD_PAGE_SIZE,
      }));
    } catch (error) {
      if (!mounted.current || requestVersion !== periodRequestVersion.current) return;
      setHistory((current) => ({ ...current, period, loading: false, error: errorMessage(error, 'تعذر تحميل سجل أرباح الفترة.'), hasMore: false }));
    }
  }, []);

  const selectDay = useCallback(async (day: string) => {
    if (periodRef.current !== 'daily') return;
    const requestVersion = ++dayRequestVersion.current;
    dayCursor.current = {};
    setDayDetails({ day, rows: [], loading: true, error: null, hasMore: true });
    try {
      const result = await withWebRequestTimeout(webSupabase.reads.companyProfitDayDetails({
        p_business_day: day,
        p_limit: DAY_PAGE_SIZE,
      }), DAY_DETAILS_TIMEOUT);
      if (!mounted.current || requestVersion !== dayRequestVersion.current || periodRef.current !== 'daily') return;
      const rows = result.map(mapCompanyProfitDayDetailRow);
      const last = rows.at(-1);
      dayCursor.current = last ? { completedAt: last.completedAt, ledgerId: last.financialLedgerId } : {};
      setDayDetails({ day, rows, loading: false, error: null, hasMore: rows.length === DAY_PAGE_SIZE });
    } catch (error) {
      if (!mounted.current || requestVersion !== dayRequestVersion.current || periodRef.current !== 'daily') return;
      setDayDetails({ day, rows: [], loading: false, error: errorMessage(error, 'تعذر تحميل تفاصيل اليوم.'), hasMore: false });
    }
  }, []);

  const loadMoreDay = useCallback(async () => {
    const day = dayDetails.day;
    if (periodRef.current !== 'daily' || !day || dayDetails.loading || !dayDetails.hasMore) return;
    const requestVersion = dayRequestVersion.current;
    setDayDetails((current) => ({ ...current, loading: true, error: null }));
    try {
      const result = await withWebRequestTimeout(webSupabase.reads.companyProfitDayDetails({
        p_business_day: day,
        p_limit: DAY_PAGE_SIZE,
        p_before_completed_at: dayCursor.current.completedAt,
        p_before_ledger_id: dayCursor.current.ledgerId,
      }), DAY_DETAILS_TIMEOUT);
      if (!mounted.current || requestVersion !== dayRequestVersion.current || periodRef.current !== 'daily') return;
      const rows = result.map(mapCompanyProfitDayDetailRow);
      const last = rows.at(-1);
      dayCursor.current = last ? { completedAt: last.completedAt, ledgerId: last.financialLedgerId } : dayCursor.current;
      setDayDetails((current) => ({ ...current, rows: [...current.rows, ...rows], loading: false, error: null, hasMore: rows.length === DAY_PAGE_SIZE }));
    } catch (error) {
      if (!mounted.current || requestVersion !== dayRequestVersion.current || periodRef.current !== 'daily') return;
      setDayDetails((current) => ({ ...current, loading: false, error: errorMessage(error, 'تعذر تحميل المزيد من تفاصيل اليوم.') }));
    }
  }, [dayDetails.day, dayDetails.hasMore, dayDetails.loading]);

  useEffect(() => () => { mounted.current = false; }, []);

  return { history, dayDetails, loadHistory, selectDay, loadMoreDay };
}
