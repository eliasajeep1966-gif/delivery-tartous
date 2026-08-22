import type {
  WebCaptainWageDetailV2,
  WebCaptainWagePeriodSummaryRow,
  WebCaptainWageSummary,
  WebCompanyProfitDayDetailRow,
  WebCompanyProfitHistoryRow,
  WebCompanyProfitPeriodHistoryRow,
  WebWageTotals,
} from '@/data/supabase/webSupabaseContract';

import type {
  CaptainFinanceCard,
  CaptainWagePeriodRow,
  CompanyProfitDayDetailRow,
  CompanyProfitHistoryRow,
  CompanyProfitPeriodHistoryRow,
  FinanceLedgerRow,
  FinanceOrderStatus,
  FinanceSnapshot,
  FinanceTotals,
} from './financeTypes';

function finiteNumber(value: unknown, fieldName: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`قيمة مالية غير صالحة في ${fieldName}.`);
  return parsed;
}

function financeStatus(value: string): FinanceOrderStatus {
  if (value === 'completed' || value === 'false_order') return value;
  throw new Error('وردت حالة طلب غير صالحة في كشف الأجور.');
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function mapFinanceTotals(source: WebWageTotals): FinanceTotals {
  return {
    grossTotal: finiteNumber(source.gross_total, 'gross_total'),
    captainNetTotal: finiteNumber(source.captain_net_total, 'captain_net_total'),
    companyTotal: finiteNumber(source.company_total, 'company_total'),
    settlementTotal: finiteNumber(source.settlement_total, 'settlement_total'),
    paidTotal: finiteNumber(source.paid_total, 'paid_total'),
    unpaidTotal: finiteNumber(source.unpaid_total, 'unpaid_total'),
  };
}

export function mapFinanceRows(
  captainId: string,
  captainName: string,
  details: WebCaptainWageDetailV2[],
): FinanceLedgerRow[] {
  return details.map((detail) => ({
    financialLedgerId: detail.financial_ledger_id,
    orderId: detail.order_id,
    orderNumber: finiteNumber(detail.order_number, 'order_number'),
    captainId,
    captainName,
    status: financeStatus(detail.source_status),
    grossFee: finiteNumber(detail.gross_fee, 'gross_fee'),
    captainAmount: finiteNumber(detail.captain_amount, 'captain_amount'),
    companyAmount: finiteNumber(detail.company_amount, 'company_amount'),
    settlementAmount: finiteNumber(detail.settlement_amount, 'settlement_amount'),
    completedAt: detail.completed_at,
    paidAmount: finiteNumber(detail.paid_amount, 'paid_amount'),
    unpaidAmount: finiteNumber(detail.unpaid_amount, 'unpaid_amount'),
    isFullyPaid: Boolean(detail.is_fully_paid),
    latestPayoutId: nullableString(detail.latest_payout_id),
    latestPaidAt: nullableString(detail.latest_paid_at),
  }));
}

export function mapCaptainWagePeriodRow(source: WebCaptainWagePeriodSummaryRow): CaptainWagePeriodRow {
  const captainName = source.captain_name?.trim() || 'كابتن بدون اسم';
  return {
    periodStart: source.period_start,
    periodEnd: source.period_end,
    captainId: source.captain_id,
    captainName,
    initial: captainName.slice(0, 1),
    orderCount: finiteNumber(source.order_count, 'order_count'),
    grossTotal: finiteNumber(source.gross_total, 'gross_total'),
    captainNetTotal: finiteNumber(source.captain_net_total, 'captain_net_total'),
    paidTotal: finiteNumber(source.paid_total, 'paid_total'),
    unpaidTotal: finiteNumber(source.unpaid_total, 'unpaid_total'),
    settlementTotal: finiteNumber(source.settlement_total, 'settlement_total'),
  };
}

export function mapCaptainFinanceCard(
  summary: WebCaptainWageSummary,
  details: WebCaptainWageDetailV2[] = [],
): CaptainFinanceCard {
  const captainName = summary.captain_name.trim() || 'كابتن بدون اسم';
  const rows = mapFinanceRows(summary.captain_id, captainName, details)
    .sort((first, second) => second.completedAt.localeCompare(first.completedAt));

  return {
    captainId: summary.captain_id,
    captainName,
    initial: captainName.slice(0, 1),
    orderCount: finiteNumber(summary.order_count, 'order_count'),
    grossTotal: finiteNumber(summary.gross_total, 'gross_total'),
    captainNetTotal: finiteNumber(summary.captain_net_total, 'captain_net_total'),
    paidTotal: finiteNumber(summary.paid_total, 'paid_total'),
    unpaidTotal: finiteNumber(summary.unpaid_total, 'unpaid_total'),
    rows,
  };
}

export function mapCompanyProfitPeriodHistoryRow(source: WebCompanyProfitPeriodHistoryRow): CompanyProfitPeriodHistoryRow {
  return {
    periodStart: source.period_start,
    periodEnd: source.period_end,
    grossTotal: finiteNumber(source.gross_total, 'gross_total'),
    companyTotal: finiteNumber(source.company_total, 'company_total'),
    captainNetTotal: finiteNumber(source.captain_net_total, 'captain_net_total'),
    settlementTotal: finiteNumber(source.settlement_total, 'settlement_total'),
    orderCount: finiteNumber(source.order_count, 'order_count'),
  };
}

export function mapCompanyProfitHistoryRow(source: WebCompanyProfitHistoryRow): CompanyProfitHistoryRow {
  return {
    businessDay: source.business_day,
    grossTotal: finiteNumber(source.gross_total, 'gross_total'),
    companyTotal: finiteNumber(source.company_total, 'company_total'),
    captainNetTotal: finiteNumber(source.captain_net_total, 'captain_net_total'),
    settlementTotal: finiteNumber(source.settlement_total, 'settlement_total'),
    orderCount: finiteNumber(source.order_count, 'order_count'),
  };
}

export function mapCompanyProfitDayDetailRow(source: WebCompanyProfitDayDetailRow): CompanyProfitDayDetailRow {
  return {
    financialLedgerId: source.financial_ledger_id,
    completedAt: source.completed_at,
    orderId: source.order_id,
    orderNumber: finiteNumber(source.order_number, 'order_number'),
    captainId: source.captain_id,
    captainName: source.captain_name.trim() || 'كابتن بدون اسم',
    grossFee: finiteNumber(source.gross_fee, 'gross_fee'),
    captainAmount: finiteNumber(source.captain_amount, 'captain_amount'),
    companyAmount: finiteNumber(source.company_amount, 'company_amount'),
    settlementAmount: finiteNumber(source.settlement_amount, 'settlement_amount'),
    status: financeStatus(source.source_status),
  };
}

export function mapFinanceSnapshot(
  totals: WebWageTotals,
  summaries: WebCaptainWageSummary[],
  detailsByCaptainId: Map<string, WebCaptainWageDetailV2[]> = new Map(),
): FinanceSnapshot {
  const captains = summaries
    .map((summary) => mapCaptainFinanceCard(summary, detailsByCaptainId.get(summary.captain_id) ?? []))
    .sort((first, second) => second.unpaidTotal - first.unpaidTotal || first.captainName.localeCompare(second.captainName));

  return {
    totals: mapFinanceTotals(totals),
    captains,
    allRows: captains.flatMap((captain) => captain.rows)
      .sort((first, second) => second.completedAt.localeCompare(first.completedAt)),
  };
}

export function formatFinanceMoney(value: number): string {
  return new Intl.NumberFormat('ar-SY', {
    style: 'currency',
    currency: 'SYP',
    maximumFractionDigits: 2,
  }).format(value);
}
