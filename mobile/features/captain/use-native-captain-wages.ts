import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  nativeCaptainContract,
  type CaptainWagePeriod,
  type CaptainWageRow,
  type CaptainWageTotals,
} from "@/lib/supabase/native-captain-contract";

export const CAPTAIN_WAGES_PAGE_SIZE = 10;
export type CaptainWageFilter = CaptainWagePeriod | "custom";

const EMPTY_TOTALS: CaptainWageTotals = {
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

export function useNativeCaptainWages() {
  const [filter, setFilter] = useState<CaptainWageFilter>("daily");
  const [customDate, setCustomDate] = useState(() => damascusDateKey(new Date()));
  const [periodStart, setPeriodStart] = useState(() => damascusDateKey(new Date()));
  const [periodEnd, setPeriodEnd] = useState(() => damascusDateKey(new Date()));
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<CaptainWageRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState<CaptainWageTotals>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const loadVersion = useRef(0);

  const period: CaptainWagePeriod = filter === "custom" ? "daily" : filter;
  const pageCount = Math.max(
    1,
    Math.ceil(total / CAPTAIN_WAGES_PAGE_SIZE),
  );
  const safePage = Math.min(page, pageCount - 1);
  const hasPreviousPage = safePage > 0;
  const hasNextPage = total > (safePage + 1) * CAPTAIN_WAGES_PAGE_SIZE;

  const reload = useCallback(
    async (silent = false) => {
      const requestVersion = ++loadVersion.current;
      if (silent) setRefreshing(true);
      else {
        setLoading(true);
        setError(null);
      }

      try {
        const result = await nativeCaptainContract.reads.wagesPage(period, {
          limit: CAPTAIN_WAGES_PAGE_SIZE,
          offset: page * CAPTAIN_WAGES_PAGE_SIZE,
          customDate: filter === "custom" ? customDate : null,
        });
        if (!mounted.current || requestVersion !== loadVersion.current) return;

        const maxPage = Math.max(
          0,
          Math.ceil(result.total / CAPTAIN_WAGES_PAGE_SIZE) - 1,
        );
        if (page > maxPage) {
          setPage(maxPage);
          return;
        }

        setRows(result.rows);
        setTotal(result.total);
        setTotals(result.totals);
        setPeriodStart(result.period_start);
        setPeriodEnd(result.period_end);
      } catch (cause) {
        if (mounted.current && requestVersion === loadVersion.current) {
          setError(
            cause instanceof Error ? cause.message : "تعذر تحميل أجورك.",
          );
        }
      } finally {
        if (mounted.current && requestVersion === loadVersion.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [customDate, filter, page, period],
  );

  useEffect(() => {
    mounted.current = true;
    const initialLoadTimer = setTimeout(() => {
      void reload();
    }, 0);
    return () => {
      mounted.current = false;
      loadVersion.current += 1;
      clearTimeout(initialLoadTimer);
    };
  }, [reload]);

  const selectFilter = useCallback((nextFilter: CaptainWageFilter) => {
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
      filter,
      customDate,
      periodStart,
      periodEnd,
      rows,
      total,
      totals,
      page: safePage,
      pageCount,
      loading,
      refreshing,
      error,
      hasPreviousPage,
      hasNextPage,
      reload,
      selectFilter,
      selectCustomDate,
      previousPage: () => {
        if (hasPreviousPage) setPage(safePage - 1);
      },
      nextPage: () => {
        if (hasNextPage) setPage(safePage + 1);
      },
    }),
    [
      customDate,
      error,
      periodEnd,
      periodStart,
      filter,
      hasNextPage,
      hasPreviousPage,
      loading,
      pageCount,
      refreshing,
      reload,
      rows,
      safePage,
      selectCustomDate,
      selectFilter,
      total,
      totals,
    ],
  );
}
