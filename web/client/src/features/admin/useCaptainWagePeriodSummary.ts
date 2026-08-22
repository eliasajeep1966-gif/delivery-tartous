import { useCallback, useEffect, useRef, useState } from 'react';

import { webSupabase, type CaptainWagePeriod } from '@/data/supabase/webSupabaseContract';
import { withWebRequestTimeout } from '@/lib/authRequest';

import { mapCaptainWagePeriodRow } from './financeMappers';
import type { CaptainWagePeriodRow } from './financeTypes';

const PERIOD_PAGE_SIZE = 100;
const PERIOD_TIMEOUT = 'انتهت مهلة تحميل ملخص أجور الفترة.';

type PeriodSummaryState = {
  period: CaptainWagePeriod;
  rows: CaptainWagePeriodRow[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
};

type PeriodCursor = {
  periodStart?: string;
  captainId?: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message : 'تعذر تحميل ملخص أجور الفترة.';
}

export function useCaptainWagePeriodSummary(captainId?: string) {
  const [state, setState] = useState<PeriodSummaryState>({
    period: 'daily',
    rows: [],
    loading: true,
    error: null,
    hasMore: true,
  });
  const cursor = useRef<PeriodCursor>({});
  const requestVersion = useRef(0);
  const mounted = useRef(false);
  const initialCaptainKey = useRef<string | null>(null);

  const load = useCallback(async (period: CaptainWagePeriod, append = false) => {
    const version = ++requestVersion.current;
    const pageCursor = append ? cursor.current : {};

    if (!append) {
      cursor.current = {};
      setState({ period, rows: [], loading: true, error: null, hasMore: true });
    } else {
      setState((current) => ({ ...current, loading: true, error: null }));
    }

    try {
      const result = await withWebRequestTimeout(webSupabase.reads.captainWagePeriodSummary({
        p_period: period,
        p_captain_id: captainId,
        p_limit: PERIOD_PAGE_SIZE,
        p_before_period_start: pageCursor.periodStart,
        p_before_captain_id: pageCursor.captainId,
      }), PERIOD_TIMEOUT);
      if (!mounted.current || version !== requestVersion.current) return;

      const rows = result.map(mapCaptainWagePeriodRow);
      const last = rows.at(-1);
      cursor.current = last ? { periodStart: last.periodStart, captainId: last.captainId } : pageCursor;
      setState((current) => ({
        period,
        rows: append ? [...current.rows, ...rows] : rows,
        loading: false,
        error: null,
        hasMore: rows.length === PERIOD_PAGE_SIZE,
      }));
    } catch (error) {
      if (!mounted.current || version !== requestVersion.current) return;
      setState((current) => ({
        ...current,
        period,
        rows: append ? current.rows : [],
        loading: false,
        error: errorMessage(error),
        hasMore: false,
      }));
    }
  }, [captainId]);

  const loadMore = useCallback(async () => {
    if (state.loading || !state.hasMore) return;
    await load(state.period, true);
  }, [load, state.hasMore, state.loading, state.period]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const captainKey = captainId ?? '__all_captains__';
    if (initialCaptainKey.current === captainKey) return;
    initialCaptainKey.current = captainKey;
    void load('daily');
  }, [captainId, load]);

  return { ...state, load, loadMore };
}
