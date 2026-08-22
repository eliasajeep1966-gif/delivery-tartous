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
};

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message : 'تعذر تحميل ملخص أجور الفترة.';
}

export function useCaptainWagePeriodSummary(captainId?: string) {
  const [state, setState] = useState<PeriodSummaryState>({ period: 'daily', rows: [], loading: true, error: null });
  const requestVersion = useRef(0);
  const mounted = useRef(true);

  const load = useCallback(async (period: CaptainWagePeriod) => {
    const version = ++requestVersion.current;
    setState({ period, rows: [], loading: true, error: null });
    try {
      const result = await withWebRequestTimeout(webSupabase.reads.captainWagePeriodSummary({
        p_period: period,
        p_captain_id: captainId,
        p_limit: PERIOD_PAGE_SIZE,
      }), PERIOD_TIMEOUT);
      if (!mounted.current || version !== requestVersion.current) return;
      setState({ period, rows: result.map(mapCaptainWagePeriodRow), loading: false, error: null });
    } catch (error) {
      if (!mounted.current || version !== requestVersion.current) return;
      setState({ period, rows: [], loading: false, error: errorMessage(error) });
    }
  }, [captainId]);

  useEffect(() => {
    mounted.current = true;
    void load('daily');
    return () => { mounted.current = false; };
  }, [load, captainId]);

  return { ...state, load };
}
