import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { nativeAdminContract } from "@/lib/supabase/native-admin-contract";
import { getNativeSupabaseClient } from "@/lib/supabase/native-supabase";

export type NativeFinancePeriod = "daily" | "weekly" | "monthly";

export type NativeCaptainWagePeriodRow = {
  captain_id: string;
  captain_name: string;
  captain_net_total: number;
  gross_total: number;
  order_count: number;
  paid_total: number;
  period_end: string;
  period_start: string;
  settlement_total: number;
  unpaid_total: number;
};

export type NativeCaptainWageDetailRow = {
  captain_amount: number;
  company_amount: number;
  completed_at: string;
  financial_ledger_id: string;
  gross_fee: number;
  is_fully_paid: boolean;
  latest_paid_at: string | null;
  latest_payout_id: string | null;
  order_id: string;
  order_number: number;
  paid_amount: number;
  settlement_amount: number;
  source_status: string;
  unpaid_amount: number;
};

export type NativeCaptainPayout = {
  id: string;
  captain_id: string;
  total_amount: number;
  paid_at: string;
  notes: string | null;
};

export type NativeCompanyProfitPeriodRow = {
  captain_net_total: number;
  company_total: number;
  gross_total: number;
  order_count: number;
  period_end: string;
  period_start: string;
  settlement_total: number;
};

type RpcResult<T> = { data: T | null; error: { message: string } | null };

function unwrap<T>(result: RpcResult<T>, fallback: string): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error(fallback);
  return result.data;
}

function first<T>(result: RpcResult<T[]>, fallback: string): T {
  const rows = unwrap(result, fallback);
  if (!rows[0]) throw new Error(fallback);
  return rows[0];
}

function normalizeAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error("أدخل مبلغ دفعة موجباً وصحيحاً.");
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
    throw new Error("يمكن تسجيل مبلغ الدفعة بمنزلتين عشريتين كحد أقصى.");
  }
  return Number(amount.toFixed(2));
}

export const nativeAdminFinanceContract = {
  reads: {
    async companyProfitPeriodHistory(input: {
      period: NativeFinancePeriod;
      beforePeriodStart?: string;
      limit?: number;
    }): Promise<NativeCompanyProfitPeriodRow[]> {
      return unwrap(
        (await getNativeSupabaseClient().rpc(
          "get_company_profit_period_history",
          {
            p_period: input.period,
            p_limit: input.limit ?? 100,
            p_before_period_start: input.beforePeriodStart,
          },
        )) as RpcResult<NativeCompanyProfitPeriodRow[]>,
        "تعذر تحميل سجل أرباح الشركة.",
      );
    },
    async captainWagePeriodSummary(input: {
      period: NativeFinancePeriod;
      captainId?: string;
      beforePeriodStart?: string;
      beforeCaptainId?: string;
      limit?: number;
    }): Promise<NativeCaptainWagePeriodRow[]> {
      const params: {
        p_period: NativeFinancePeriod;
        p_limit: number;
        p_before_period_start?: string;
        p_before_captain_id?: string;
        p_captain_id?: string;
      } = {
        p_period: input.period,
        p_limit: input.limit ?? 100,
      };
      if (input.captainId?.trim()) params.p_captain_id = input.captainId.trim();
      if (input.beforePeriodStart && input.beforeCaptainId) {
        params.p_before_period_start = input.beforePeriodStart;
        params.p_before_captain_id = input.beforeCaptainId;
      }

      return unwrap(
        (await getNativeSupabaseClient().rpc(
          "get_captain_wage_period_summary",
          params,
        )) as RpcResult<NativeCaptainWagePeriodRow[]>,
        "تعذر تحميل ملخص أجور الكباتن للفترة.",
      );
    },
    async captainWageDetails(
      captainId: string,
    ): Promise<NativeCaptainWageDetailRow[]> {
      return unwrap(
        (await getNativeSupabaseClient().rpc("get_captain_wage_details_v2", {
          p_captain_id: captainId,
        })) as RpcResult<NativeCaptainWageDetailRow[]>,
        "تعذر تحميل تفاصيل أجر الكابتن.",
      );
    },
  },
  actions: {
    async recordPartialPayout(
      captainId: string,
      amount: number,
      notes?: string,
    ): Promise<NativeCaptainPayout> {
      return first(
        (await getNativeSupabaseClient().rpc("create_captain_partial_payout", {
          p_captain_id: captainId,
          p_amount: normalizeAmount(amount),
          p_notes: notes?.trim() || undefined,
        })) as RpcResult<NativeCaptainPayout[]>,
        "تعذر تسجيل دفعة الكابتن.",
      );
    },
  },
} as const;

export function useNativeAdminWagePeriods() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<NativeFinancePeriod>("daily");
  const query = useInfiniteQuery({
    queryKey: ["admin-wage-periods", period],
    initialPageParam: undefined as
      | { periodStart?: string; captainId?: string }
      | undefined,
    queryFn: ({ pageParam }) =>
      nativeAdminFinanceContract.reads.captainWagePeriodSummary({
        period,
        beforePeriodStart: pageParam?.periodStart,
        beforeCaptainId: pageParam?.captainId,
      }),
    getNextPageParam: (lastPage) => {
      if (lastPage.length !== 100) return undefined;
      const last = lastPage.at(-1);
      return last
        ? { periodStart: last.period_start, captainId: last.captain_id }
        : undefined;
    },
    staleTime: 20_000,
    retry: 1,
  });

  const changePeriod = useCallback((next: NativeFinancePeriod) => {
    setPeriod(next);
  }, []);
  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query.fetchNextPage, query.hasNextPage, query.isFetchingNextPage]);
  useEffect(() => {
    const unsubscribe = nativeAdminContract.realtime.subscribe(() => {
      void queryClient.invalidateQueries({ queryKey: ["admin-wage-periods"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-wage-details"] });
    });
    const polling = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["admin-wage-periods"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-wage-details"] });
    }, 15_000);
    return () => {
      clearInterval(polling);
      unsubscribe();
    };
  }, [queryClient]);
  return {
    ...query,
    data: query.data?.pages.flat() ?? [],
    period,
    changePeriod,
    loadMore,
    hasMore: Boolean(query.hasNextPage),
  };
}

export function useNativeCompanyProfitHistory(period: NativeFinancePeriod) {
  return useQuery({
    queryKey: ["admin-company-profit-history", period],
    queryFn: () =>
      nativeAdminFinanceContract.reads.companyProfitPeriodHistory({ period }),
    staleTime: 20_000,
    retry: 1,
  });
}

const COMPANY_PROFIT_HISTORY_PAGE_SIZE = 30;

export function useNativeFullCompanyProfitHistory() {
  const [period, setPeriod] = useState<NativeFinancePeriod>("daily");
  const query = useInfiniteQuery({
    queryKey: ["admin-company-profit-full-history", period],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      nativeAdminFinanceContract.reads.companyProfitPeriodHistory({
        period,
        beforePeriodStart: pageParam,
        limit: COMPANY_PROFIT_HISTORY_PAGE_SIZE,
      }),
    getNextPageParam: (lastPage) => {
      if (lastPage.length !== COMPANY_PROFIT_HISTORY_PAGE_SIZE) {
        return undefined;
      }
      return lastPage.at(-1)?.period_start;
    },
    staleTime: 20_000,
    retry: 1,
  });

  const changePeriod = useCallback((next: NativeFinancePeriod) => {
    setPeriod(next);
  }, []);
  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query.fetchNextPage, query.hasNextPage, query.isFetchingNextPage]);

  return {
    ...query,
    data: query.data?.pages.flat() ?? [],
    period,
    changePeriod,
    loadMore,
    hasMore: Boolean(query.hasNextPage),
  };
}

export function useNativeCaptainWageDetails(captainId: string | null) {
  return useQuery({
    queryKey: ["admin-wage-details", captainId],
    queryFn: () =>
      nativeAdminFinanceContract.reads.captainWageDetails(captainId ?? ""),
    enabled: Boolean(captainId),
    staleTime: 20_000,
    retry: 1,
  });
}
