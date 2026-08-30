import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { nativeAdminContract } from "@/lib/supabase/native-admin-contract";
import { getNativeSupabaseClient } from "@/lib/supabase/native-supabase";

export type NativeFinancePeriod = "daily" | "weekly" | "monthly" | "annual";

export type NativeCaptainWagePeriodRow = {
  captain_id: string;
  captain_name: string;
  captain_net_total: number;
  company_total: number;
  gross_total: number;
  order_count: number;
  paid_total: number;
  period_end: string;
  period_start: string;
  settlement_total: number;
  unpaid_total: number;
};

export type NativeCaptainWageDetailTotals = {
  gross: number;
  captain: number;
  company: number;
  settlement: number;
  paid: number;
  unpaid: number;
};

export type NativeCaptainWageDetailPage = {
  rows: NativeCaptainWageDetailRow[];
  total: number;
  totals: NativeCaptainWageDetailTotals;
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
            p_limit: Math.min(Math.max(Math.floor(input.limit ?? 5), 1), 5),
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
    async captainWageDetailsPage(input: {
      captainId: string;
      period: NativeFinancePeriod;
      limit: number;
      offset: number;
      customDate?: string | null;
    }): Promise<NativeCaptainWageDetailPage> {
      return unwrap(
        (await getNativeSupabaseClient().rpc(
          "get_captain_wage_details_page",
          {
            p_captain_id: input.captainId,
            p_period: input.period,
            p_limit: Math.min(Math.max(Math.floor(input.limit), 1), 50),
            p_offset: Math.max(Math.floor(input.offset), 0),
            p_custom_date: input.customDate ?? null,
          },
        )) as RpcResult<NativeCaptainWageDetailPage>,
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

export function useNativeAdminWagePeriods(
  enabled = true,
  initialPeriod: NativeFinancePeriod = "daily",
) {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<NativeFinancePeriod>(initialPeriod);
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
    enabled,
    staleTime: 300_000,
    
    
    retry: 1,
  });

  const changePeriod = useCallback((next: NativeFinancePeriod) => {
    setPeriod(next);
  }, []);
   const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query]); 

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = nativeAdminContract.realtime.subscribe(() => {
      void queryClient.invalidateQueries({ queryKey: ["admin-wage-periods"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-wage-details"] });
    });
    return unsubscribe;
  }, [enabled, queryClient]);
  return {
    ...query,
    data: query.data?.pages.flat() ?? [],
    period,
    changePeriod,
    loadMore,
    hasMore: Boolean(query.hasNextPage),
  };
}

export function useNativeCompanyProfitHistory(
  period: NativeFinancePeriod,
  enabled = true,
) {
  return useQuery({
    queryKey: ["admin-company-profit-history", period],
    queryFn: () =>
      nativeAdminFinanceContract.reads.companyProfitPeriodHistory({ period }),
    enabled,
    staleTime: 300_000,
    retry: 1,
  });
}

const COMPANY_PROFIT_HISTORY_PAGE_SIZE = 5;

export function useNativeFullCompanyProfitHistory() {
  const [period, setPeriod] = useState<NativeFinancePeriod>("daily");
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const query = useInfiniteQuery({
    queryKey: ["admin-company-profit-full-history", period, customDate],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      nativeAdminFinanceContract.reads.companyProfitPeriodHistory({
        period: customDate ? "daily" : period,
        beforePeriodStart: customDate ? nextDateKey(customDate) : pageParam,
        limit: COMPANY_PROFIT_HISTORY_PAGE_SIZE,
      }),
    getNextPageParam: (lastPage) => {
      if (customDate || lastPage.length !== COMPANY_PROFIT_HISTORY_PAGE_SIZE) {
        return undefined;
      }
      return lastPage.at(-1)?.period_start;
    },
    staleTime: 300_000,
    retry: 1,
  });

  const pages = query.data?.pages ?? [];
  const activePage = Math.min(page, Math.max(pages.length - 1, 0));
  const data = customDate
    ? (pages[0] ?? []).filter((row) => row.period_start === customDate)
    : (pages[activePage] ?? []);
  const hasPreviousPage = !customDate && activePage > 0;
  const hasNextPage =
    !customDate &&
    (activePage < pages.length - 1 || Boolean(query.hasNextPage));

  const changePeriod = useCallback((next: NativeFinancePeriod) => {
    setCustomDate(null);
    setPage(0);
    setPeriod(next);
  }, []);
  const selectCustomDate = useCallback((date: string) => {
    setPage(0);
    setCustomDate(date);
  }, []);
  const previousPage = useCallback(() => {
    if (hasPreviousPage) setPage((current) => current - 1);
  }, [hasPreviousPage]);
  const nextPage = useCallback(async () => {
    if (customDate || query.isFetchingNextPage) return;
    if (activePage < pages.length - 1) {
      setPage((current) => current + 1);
      return;
    }
    if (!query.hasNextPage) return;
    const result = await query.fetchNextPage();
    if (result.data?.pages[activePage + 1]?.length) {
      setPage((current) => current + 1);
    }
  }, [activePage, customDate, pages.length, query]);
  return {
    ...query,
    data,
    period: customDate ? "daily" : period,
    customDate,
    page: customDate ? 0 : activePage,
    hasNextPage,
    hasPreviousPage,
    changePeriod,
    selectCustomDate,
    previousPage,
    nextPage,
  };
}

function nextDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1, 12))
    .toISOString()
    .slice(0, 10);
}

export function useNativeCaptainWageDetails(
  captainId: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ["admin-wage-details", captainId],
    queryFn: () =>
      nativeAdminFinanceContract.reads.captainWageDetails(captainId ?? ""),
    enabled: Boolean(captainId) && enabled,
    staleTime: 300_000,
    retry: 1,
  });
}

const CAPTAIN_WAGE_DETAIL_PAGE_SIZE = 10;
type CaptainWageDetailFilter = NativeFinancePeriod | "custom";
const EMPTY_CAPTAIN_WAGE_TOTALS: NativeCaptainWageDetailTotals = {
  gross: 0,
  captain: 0,
  company: 0,
  settlement: 0,
  paid: 0,
  unpaid: 0,
};

function damascusDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Damascus",
    year: "numeric",
  }).formatToParts(value);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

export function useNativeAdminCaptainWageDetailPage(
  captainId: string | null,
  enabled = true,
) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<CaptainWageDetailFilter>("daily");
  const [customDate, setCustomDate] = useState(() => damascusDateKey(new Date()));
  const [page, setPage] = useState(0);
  const period: NativeFinancePeriod = filter === "custom" ? "daily" : filter;
  const query = useQuery({
    queryKey: [
      "admin-captain-wage-detail-page",
      captainId,
      filter,
      customDate,
      page,
    ],
    queryFn: () =>
      nativeAdminFinanceContract.reads.captainWageDetailsPage({
        captainId: captainId ?? "",
        customDate: filter === "custom" ? customDate : null,
        limit: CAPTAIN_WAGE_DETAIL_PAGE_SIZE,
        offset: page * CAPTAIN_WAGE_DETAIL_PAGE_SIZE,
        period,
      }),
    enabled: Boolean(captainId) && enabled,
    staleTime: 300_000,
    retry: 1,
  });

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = nativeAdminContract.realtime.subscribe(() => {
      void queryClient.invalidateQueries({
        queryKey: ["admin-captain-wage-detail-page", captainId],
      });
    });
    return unsubscribe;
  }, [captainId, enabled, queryClient]);

  const data = query.data;
  const total = data?.total ?? 0;
  const pageCount = Math.max(
    1,
    Math.ceil(total / CAPTAIN_WAGE_DETAIL_PAGE_SIZE),
  );
  const safePage = Math.min(page, pageCount - 1);
  const hasPreviousPage = safePage > 0;
  const hasNextPage = total > (safePage + 1) * CAPTAIN_WAGE_DETAIL_PAGE_SIZE;
  const selectFilter = useCallback((nextFilter: CaptainWageDetailFilter) => {
    setPage(0);
    setFilter(nextFilter);
  }, []);
  const selectCustomDate = useCallback((nextDate: string) => {
    setPage(0);
    setCustomDate(nextDate);
    setFilter("custom");
  }, []);

  return useMemo(
    () => ({
      ...query,
      customDate,
      filter,
      hasNextPage,
      hasPreviousPage,
      page: safePage,
      pageCount,
      rows: data?.rows ?? [],
      selectCustomDate,
      selectFilter,
      total,
      totals: data?.totals ?? EMPTY_CAPTAIN_WAGE_TOTALS,
      previousPage: () => {
        if (hasPreviousPage) setPage(safePage - 1);
      },
      nextPage: () => {
        if (hasNextPage) setPage(safePage + 1);
      },
    }),
    [
      customDate,
      data?.rows,
      data?.totals,
      filter,
      hasNextPage,
      hasPreviousPage,
      pageCount,
      query,
      safePage,
      selectCustomDate,
      selectFilter,
      total,
    ],
  );
}


export type NativeOfficeExpense = {
  id: string;
  title: string;
  amount: number;
  expense_date: string;
  notes: string | null;
  created_by: string;
  created_at: string;
};

export type NativeOfficeExpenseDay = {
  expenseDate: string;
  expenseTotal: number;
  expenseCount: number;
  expenses: NativeOfficeExpense[];
  hasMore: boolean;
};

type NativeOfficeExpenseDayRpcRow = {
  expense_date: string;
  expense_total: number | string;
  expense_count: number | string;
  expenses: Omit<NativeOfficeExpense, "expense_date">[];
  has_more: boolean;
};


export type NativeCompanyExpensePeriodRow = {
  period_start: string;
  period_end: string;
  company_gross_total: number;
  expense_total: number;
  net_company_total: number;
};

export type NativeCompanyReportRangeSummary = {
  period_start: string | null;
  period_end: string | null;
  order_count: number;
  gross_total: number;
  company_total: number;
  captain_net_total: number;
  captain_wage_total: number;
  captain_compensation_total: number;
  expense_total: number;
  net_company_total: number;
};

export type NativeCaptainPdfReportSummary = {
  captain_id: string;
  captain_name: string;
  period_start: string | null;
  period_end: string | null;
  order_count: number;
  gross_total: number;
  captain_total: number;
  company_total: number;
  captain_wage_total: number;
  captain_compensation_total: number;
  company_result_total: number;
};

function finiteNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export type NativeTreasuryTransactionType =
  | "company_profit_in"
  | "capital_in"
  | "withdrawal_out";

export type NativeTreasuryFilter = "all" | "wages" | "cash";

export type NativeTreasuryOverview = {
  current_balance: number;
  company_profit_total: number;
  capital_in_total: number;
  withdrawal_total: number;
  company_profit_today: number;
  cash_flow_total: number;
  transaction_count: number;
};

export type NativeTreasuryTransaction = {
  id: string;
  admin_id: string | null;
  admin_name: string | null;
  transaction_type: NativeTreasuryTransactionType;
  amount: number;
  running_balance: number;
  notes: string | null;
  source_financial_ledger_id: string | null;
  created_at: string;
  has_more: boolean;
};

type NativeTreasuryOverviewRpcRow = {
  current_balance: number | string;
  company_profit_total: number | string;
  capital_in_total: number | string;
  withdrawal_total: number | string;
  company_profit_today: number | string;
  cash_flow_total: number | string;
  transaction_count: number | string;
};

type NativeTreasuryTransactionRpcRow = Omit<
  NativeTreasuryTransaction,
  "amount" | "running_balance"
> & {
  amount: number | string;
  running_balance: number | string;
};

export const nativeTreasuryContract = {
  reads: {
    async overview(): Promise<NativeTreasuryOverview> {
      const row = first(
        (await getNativeSupabaseClient().rpc("get_treasury_overview")) as RpcResult<NativeTreasuryOverviewRpcRow[]>,
        "تعذر تحميل رصيد الصندوق.",
      );
      return {
        current_balance: finiteNumber(row.current_balance),
        company_profit_total: finiteNumber(row.company_profit_total),
        capital_in_total: finiteNumber(row.capital_in_total),
        withdrawal_total: finiteNumber(row.withdrawal_total),
        company_profit_today: finiteNumber(row.company_profit_today),
        cash_flow_total: finiteNumber(row.cash_flow_total),
        transaction_count: finiteNumber(row.transaction_count),
      };
    },
    async transactionPage(input: {
      limit?: number;
      beforeCreatedAt?: string | null;
      beforeId?: string | null;
      filter?: NativeTreasuryFilter;
    }): Promise<NativeTreasuryTransaction[]> {
      const rows = unwrap(
        (await getNativeSupabaseClient().rpc("get_treasury_transaction_page", {
          p_limit: Math.min(Math.max(Math.floor(input.limit ?? 20), 1), 50),
          p_before_created_at: input.beforeCreatedAt ?? null,
          p_before_id: input.beforeId ?? null,
          p_filter: input.filter ?? "all",
        })) as RpcResult<NativeTreasuryTransactionRpcRow[]>,
        "تعذر تحميل حركات الصندوق.",
      );
      return rows.map((row) => ({
        ...row,
        amount: finiteNumber(row.amount),
        running_balance: finiteNumber(row.running_balance),
        admin_id: optionalText(row.admin_id),
        admin_name: optionalText(row.admin_name),
        notes: optionalText(row.notes),
        source_financial_ledger_id: optionalText(row.source_financial_ledger_id),
        has_more: Boolean(row.has_more),
      }));
    },
  },
  actions: {
    async deposit(amount: number, notes?: string): Promise<NativeTreasuryTransaction> {
      return first(
        (await getNativeSupabaseClient().rpc("create_treasury_deposit", {
          p_amount: normalizeAmount(amount),
          p_notes: notes?.trim() || null,
        })) as RpcResult<NativeTreasuryTransaction[]>,
        "تعذر تسجيل الإيداع.",
      );
    },
    async withdraw(amount: number, notes?: string): Promise<NativeTreasuryTransaction> {
      return first(
        (await getNativeSupabaseClient().rpc("create_treasury_withdrawal", {
          p_amount: normalizeAmount(amount),
          p_notes: notes?.trim() || null,
        })) as RpcResult<NativeTreasuryTransaction[]>,
        "تعذر تسجيل السحب.",
      );
    },
  },
} as const;

export const nativeOfficeExpensesContract = {
  reads: {
    async periods(period: NativeFinancePeriod): Promise<NativeCompanyExpensePeriodRow[]> {
      return unwrap(
        (await getNativeSupabaseClient().rpc("get_company_expense_period_summary", {
          p_period: period,
          p_limit: 100,
        })) as RpcResult<NativeCompanyExpensePeriodRow[]>,
        "تعذر تحميل ملخص مصاريف المكتب.",
      );
    },
    async listDayPage(input: {
      startDate: string;
      endDate: string;
      beforeDay: string | null;
    }): Promise<NativeOfficeExpenseDay[]> {
      const rows = unwrap(
        (await getNativeSupabaseClient().rpc("get_office_expense_day_page", {
          p_start_date: input.startDate,
          p_end_date: input.endDate,
          p_before_day: input.beforeDay,
          p_day_limit: 5,
        })) as RpcResult<NativeOfficeExpenseDayRpcRow[]>,
        "تعذر تحميل سجل مصاريف المكتب.",
      );
      return rows.flatMap((row) => {
        const expenseDate = optionalText(row.expense_date);
        if (!expenseDate || !Array.isArray(row.expenses)) return [];
        return [{
          expenseDate,
          expenseTotal: finiteNumber(row.expense_total),
          expenseCount: Math.max(0, Math.floor(finiteNumber(row.expense_count))),
          expenses: row.expenses.map((expense) => ({
            ...expense,
            amount: finiteNumber(expense.amount),
            expense_date: expenseDate,
          })),
          hasMore: row.has_more === true,
        }];
      });
    },
  },
  actions: {
    async create(input: {
      title: string;
      amount: number;
      expenseDate: string;
      notes?: string;
    }): Promise<NativeOfficeExpense> {
      return first(
        (await getNativeSupabaseClient().rpc("create_office_expense", {
          p_title: input.title.trim(),
          p_amount: Number(input.amount.toFixed(2)),
          p_expense_date: input.expenseDate,
          p_notes: input.notes?.trim() || undefined,
        })) as RpcResult<NativeOfficeExpense[]>,
        "تعذر تسجيل مصروف المكتب.",
      );
    },
    async update(input: {
      id: string;
      title: string;
      amount: number;
      expenseDate: string;
      notes?: string;
    }): Promise<NativeOfficeExpense> {
      return first(
        (await getNativeSupabaseClient().rpc("update_office_expense", {
          p_id: input.id,
          p_title: input.title.trim(),
          p_amount: Number(input.amount.toFixed(2)),
          p_expense_date: input.expenseDate,
          p_notes: input.notes?.trim() || undefined,
        })) as RpcResult<NativeOfficeExpense[]>,
        "تعذر تعديل المصروف.",
      );
    },
    async remove(id: string): Promise<boolean> {
      return unwrap(
        (await getNativeSupabaseClient().rpc("delete_office_expense", {
          p_id: id,
        })) as RpcResult<boolean>,
        "تعذر حذف المصروف.",
      );
    },
  },
} as const;

export const nativeCompanyPdfReportContract = {
  reads: {
    async rangeSummary(input: {
      startDate: string | null;
      endDate: string | null;
    }): Promise<NativeCompanyReportRangeSummary> {
      const row = first(
        (await getNativeSupabaseClient().rpc(
          "get_company_report_range_summary",
          {
            p_start_date: input.startDate,
            p_end_date: input.endDate,
          },
        )) as RpcResult<NativeCompanyReportRangeSummary[]>,
        "تعذر تحميل ملخص تقرير الشركة.",
      );

      return {
        period_start: optionalText(row.period_start),
        period_end: optionalText(row.period_end),
        order_count: finiteNumber(row.order_count),
        gross_total: finiteNumber(row.gross_total),
        company_total: finiteNumber(row.company_total),
        captain_net_total: finiteNumber(row.captain_net_total),
        captain_wage_total: finiteNumber(row.captain_wage_total),
        captain_compensation_total: finiteNumber(row.captain_compensation_total),
        expense_total: finiteNumber(row.expense_total),
        net_company_total: finiteNumber(row.net_company_total),
      };
    },
    async captainSummary(input: {
      captainId: string;
      startDate: string | null;
      endDate: string | null;
    }): Promise<NativeCaptainPdfReportSummary> {
      const row = first(
        (await getNativeSupabaseClient().rpc(
          "get_captain_report_range_summary",
          {
            p_captain_id: input.captainId,
            p_start_date: input.startDate,
            p_end_date: input.endDate,
          },
        )) as RpcResult<NativeCaptainPdfReportSummary[]>,
        "تعذر تحميل ملخص تقرير الكابتن.",
      );

      return {
        captain_id: row.captain_id,
        captain_name: optionalText(row.captain_name) ?? "كابتن بدون اسم",
        period_start: optionalText(row.period_start),
        period_end: optionalText(row.period_end),
        order_count: finiteNumber(row.order_count),
        gross_total: finiteNumber(row.gross_total),
        captain_total: finiteNumber(row.captain_total),
        company_total: finiteNumber(row.company_total),
        captain_wage_total: finiteNumber(row.captain_wage_total),
        captain_compensation_total: finiteNumber(row.captain_compensation_total),
        company_result_total: finiteNumber(row.company_result_total),
      };
    },
  },
} as const;

export function useNativeTreasury(filter: NativeTreasuryFilter = "all") {
  const queryClient = useQueryClient();
  const [cursorHistory, setCursorHistory] = useState<
    Array<{ createdAt: string; id: string } | null>
  >([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [previousFilter, setPreviousFilter] = useState<NativeTreasuryFilter>(filter);
  if (previousFilter !== filter) {
    setPreviousFilter(filter);
    setCursorHistory([null]);
    setPageIndex(0);
  }
  const cursor = cursorHistory[pageIndex] ?? null;

  const overviewQuery = useQuery({
    queryKey: ["admin-treasury", "overview"],
    queryFn: () => nativeTreasuryContract.reads.overview(),
    staleTime: 20_000,
    retry: 1,
  });
  const transactionsQuery = useQuery({
    queryKey: ["admin-treasury", "transactions", filter, cursor?.createdAt ?? null, cursor?.id ?? null],
    queryFn: () =>
      nativeTreasuryContract.reads.transactionPage({
        limit: 20,
        beforeCreatedAt: cursor?.createdAt ?? null,
        beforeId: cursor?.id ?? null,
        filter,
      }),
    staleTime: 20_000,
    retry: 1,
  });

  useEffect(() => {
    const unsubscribe = nativeAdminContract.realtime.subscribe(() => {
      void queryClient.invalidateQueries({ queryKey: ["admin-treasury"] });
    });
    return unsubscribe;
  }, [queryClient]);

  const transactions = useMemo(
    () => transactionsQuery.data ?? [],
    [transactionsQuery.data],
  );
  const hasNextPage = Boolean(transactions.at(-1)?.has_more);
  const hasPreviousPage = pageIndex > 0;

  const nextPage = useCallback(() => {
    const last = transactions.at(-1);
    if (!last || !hasNextPage || transactionsQuery.isFetching) return;
    const nextIndex = pageIndex + 1;
    setCursorHistory((current) => [
      ...current.slice(0, nextIndex),
      { createdAt: last.created_at, id: last.id },
    ]);
    setPageIndex(nextIndex);
  }, [hasNextPage, pageIndex, transactions, transactionsQuery.isFetching]);

  const previousPage = useCallback(() => {
    if (!hasPreviousPage || transactionsQuery.isFetching) return;
    setPageIndex((current) => Math.max(0, current - 1));
  }, [hasPreviousPage, transactionsQuery.isFetching]);

  const invalidateTreasury = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-treasury"] });
  }, [queryClient]);

  const deposit = useCallback(
    async (amount: number, notes?: string) => {
      const result = await nativeTreasuryContract.actions.deposit(amount, notes);
      await invalidateTreasury();
      return result;
    },
    [invalidateTreasury],
  );

  const withdraw = useCallback(
    async (amount: number, notes?: string) => {
      const result = await nativeTreasuryContract.actions.withdraw(amount, notes);
      await invalidateTreasury();
      return result;
    },
    [invalidateTreasury],
  );

  return {
    overview: overviewQuery.data ?? null,
    transactions,
    isPending: overviewQuery.isPending || transactionsQuery.isPending,
    isFetching: overviewQuery.isFetching || transactionsQuery.isFetching,
    error: overviewQuery.error ?? transactionsQuery.error,
    pageNumber: pageIndex + 1,
    hasNextPage,
    hasPreviousPage,
    nextPage,
    previousPage,
    deposit,
    withdraw,
    refetch: async () => {
      await Promise.all([overviewQuery.refetch(), transactionsQuery.refetch()]);
    },
  };
}

export function useNativeOfficeExpensePeriods(
  period: NativeFinancePeriod,
  enabled = true,
) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-office-expense-periods", period],
    queryFn: () => nativeOfficeExpensesContract.reads.periods(period),
    enabled,
    staleTime: 300_000,
    retry: 1,
  });
  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = nativeAdminContract.realtime.subscribe(() => {
      void queryClient.invalidateQueries({ queryKey: ["admin-office-expense-periods"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-office-expenses"] });
    });
    return unsubscribe;
  }, [enabled, queryClient]);
  return query;
}

export function useNativeOfficeExpenses(input: {
  startDate: string;
  endDate: string;
}) {
  const queryClient = useQueryClient();
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const beforeDay = cursorHistory[pageIndex] ?? null;

  // 🔥 الترقيع الأول: دمرنا الـ useEffect واستخدمنا طريقة الـ Render Phase Update
  const [prevDates, setPrevDates] = useState(`${input.startDate}|${input.endDate}`);
  const currentDates = `${input.startDate}|${input.endDate}`;
  if (prevDates !== currentDates) {
    setPrevDates(currentDates);
    setCursorHistory([null]);
    setPageIndex(0);
  }

  const query = useQuery({
    queryKey: [
      "admin-office-expenses",
      input.startDate,
      input.endDate,
      beforeDay,
    ],
    queryFn: () => nativeOfficeExpensesContract.reads.listDayPage({
      ...input,
      beforeDay,
    }),
    staleTime: 300_000,
    retry: 1,
  });

  const days = useMemo(() => query.data ?? [], [query.data]);
  const hasNextPage = Boolean(days.at(-1)?.hasMore);
  const hasPreviousPage = pageIndex > 0;

  const nextPage = useCallback(() => {
    const lastDay = days.at(-1)?.expenseDate;
    if (!lastDay || !hasNextPage || query.isFetching) return;
    const nextIndex = pageIndex + 1;
    setCursorHistory((current) => [...current.slice(0, nextIndex), lastDay]);
    setPageIndex(nextIndex);
  }, [days, hasNextPage, pageIndex, query.isFetching]);

  const previousPage = useCallback(() => {
    if (!hasPreviousPage || query.isFetching) return;
    setPageIndex((current) => Math.max(0, current - 1));
  }, [hasPreviousPage, query.isFetching]);

  const refreshFinancialViews = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-office-expenses"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-office-expense-periods"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-wage-periods"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-company-profit-history"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-company-profit-full-history"] }),
    ]);
  };

  const createExpense = async (expenseInput: {
    title: string;
    amount: number;
    expenseDate: string;
    notes?: string;
  }) => {
    const result = await nativeOfficeExpensesContract.actions.create(expenseInput);
    await refreshFinancialViews();
    return result;
  };

  const updateExpense = async (expenseInput: {
    id: string;
    title: string;
    amount: number;
    expenseDate: string;
    notes?: string;
  }) => {
    const result = await nativeOfficeExpensesContract.actions.update(expenseInput);
    await refreshFinancialViews();
    return result;
  };

  const deleteExpense = async (id: string) => {
    const result = await nativeOfficeExpensesContract.actions.remove(id);
    await refreshFinancialViews();
    return result;
  };

  return {
    ...query,
    days,
    pageNumber: pageIndex + 1,
    hasNextPage,
    hasPreviousPage,
    nextPage,
    previousPage,
    createExpense,
    updateExpense,
    deleteExpense,
  };
}

