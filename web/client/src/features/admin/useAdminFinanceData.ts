import { useCallback, useEffect, useRef, useState } from 'react';

import { webSupabase, type WebCaptainPayout } from '@/data/supabase/webSupabaseContract';
import { WebRequestTimeoutError, withWebRequestTimeout } from '@/lib/authRequest';

import { mapFinanceSnapshot } from './financeMappers';
import { emptyFinanceSnapshot, type FinanceSnapshot } from './financeTypes';

type ReloadOptions = { background?: boolean };

const TOTALS_TIMEOUT = 'انتهت مهلة تحميل إجماليات الأجور بعد 15 ثانية. حاول مرة أخرى.';
const SUMMARY_TIMEOUT = 'انتهت مهلة تحميل ملخص أجور الكباتن بعد 15 ثانية. حاول مرة أخرى.';
const DETAILS_TIMEOUT = 'انتهت مهلة تحميل تفاصيل أجر الكابتن بعد 15 ثانية. حاول مرة أخرى.';
const PAYOUT_TIMEOUT = 'انتهت مهلة تسجيل الدفعة بعد 15 ثانية. تحقق من كشف الأجور قبل إعادة المحاولة.';

export function getFinanceErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.trim() : '';
  if (message.includes('15 ثانية')) return message;
  if (/network|fetch|failed to fetch/i.test(message)) return 'تعذر الاتصال بالخادم. تحقق من الإنترنت ثم حاول مرة أخرى.';
  return fallback;
}

function assertPayoutAmount(amount: number, unpaidTotal: number): void {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('أدخل مبلغ دفعة موجباً وصحيحاً.');
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
    throw new Error('يمكن تسجيل مبلغ الدفعة بمنزلتين عشريتين كحد أقصى.');
  }
  if (unpaidTotal <= 0) throw new Error('لا يوجد رصيد مستحق للكابتن.');
  if (amount > unpaidTotal) throw new Error('قيمة الدفعة أكبر من الأجر المستحق المتبقي.');
}

export type AdminFinanceData = {
  snapshot: FinanceSnapshot;
  isInitialLoading: boolean;
  readError: string | null;
  reload: (options?: ReloadOptions) => Promise<void>;
  recordPartialPayout: (captainId: string, amount: number, notes?: string) => Promise<WebCaptainPayout>;
  payoutInFlightCaptainId: string | null;
};

export function useAdminFinanceData(): AdminFinanceData {
  const [snapshot, setSnapshot] = useState<FinanceSnapshot>(emptyFinanceSnapshot);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [payoutInFlightCaptainId, setPayoutInFlightCaptainId] = useState<string | null>(null);
  const mounted = useRef(true);
  const requestVersion = useRef(0);

  const reload = useCallback(async ({ background = false }: ReloadOptions = {}) => {
    const version = ++requestVersion.current;
    if (!background) setReadError(null);

    try {
      const [totals, summaries] = await Promise.all([
        withWebRequestTimeout(webSupabase.reads.wageTotals(), TOTALS_TIMEOUT),
        withWebRequestTimeout(webSupabase.reads.captainWageSummary(), SUMMARY_TIMEOUT),
      ]);

      const detailsEntries = await Promise.all(summaries.map(async (summary) => (
        [
          summary.captain_id,
          await withWebRequestTimeout(webSupabase.reads.captainWageDetailsV2(summary.captain_id), DETAILS_TIMEOUT),
        ] as const
      )));

      if (!mounted.current || version !== requestVersion.current) return;
      setSnapshot(mapFinanceSnapshot(totals, summaries, new Map(detailsEntries)));
    } catch (error) {
      console.error('Finance data load failed.', error);
      if (!mounted.current || version !== requestVersion.current) return;
      if (!background) setReadError(getFinanceErrorMessage(error, 'تعذر تحميل بيانات الأجور. حاول مرة أخرى.'));
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

  const recordPartialPayout = useCallback(async (captainId: string, amount: number, notes?: string): Promise<WebCaptainPayout> => {
    if (payoutInFlightCaptainId) throw new Error('هناك دفعة قيد التسجيل حالياً.');
    const captain = snapshot.captains.find((item) => item.captainId === captainId);
    if (!captain) throw new Error('تعذر العثور على سجل أجر الكابتن.');
    assertPayoutAmount(amount, captain.unpaidTotal);

    setPayoutInFlightCaptainId(captainId);
    try {
      const payout = await withWebRequestTimeout(
        webSupabase.actions.createCaptainPartialPayout({ captainId, amount, notes }),
        PAYOUT_TIMEOUT,
      );
      await reload({ background: true });
      return payout;
    } catch (error) {
      if (error instanceof WebRequestTimeoutError) void reload({ background: true });
      throw error;
    } finally {
      if (mounted.current) setPayoutInFlightCaptainId(null);
    }
  }, [payoutInFlightCaptainId, reload, snapshot.captains]);

  return {
    snapshot,
    isInitialLoading,
    readError,
    reload,
    recordPartialPayout,
    payoutInFlightCaptainId,
  };
}
