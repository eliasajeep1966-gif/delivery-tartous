import type { FinanceLedgerRow } from './financeTypes';

export type FinancePeriod = 'daily' | 'weekly' | 'monthly';

export type FinancePeriodOption = {
  key: string;
  label: string;
};

const DAMASCUS_TIME_ZONE = 'Asia/Damascus';

function damascusDateParts(isoDate: string): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DAMASCUS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(isoDate));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = value('year');
  const month = value('month');
  const day = value('day');
  if (!year || !month || !day) throw new Error('تعذر استخراج تاريخ كشف الأجور.');
  return { year, month, day };
}

export function financeDayKey(completedAt: string): string {
  const { year, month, day } = damascusDateParts(completedAt);
  return `${year}-${month}-${day}`;
}

function mondayKey(dayKey: string): string {
  const date = new Date(`${dayKey}T12:00:00Z`);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

export function financePeriodKey(row: FinanceLedgerRow, period: FinancePeriod): string {
  const dayKey = financeDayKey(row.completedAt);
  if (period === 'daily') return dayKey;
  if (period === 'weekly') return mondayKey(dayKey);
  return dayKey.slice(0, 7);
}

export function formatFinanceDay(dayKey: string): string {
  return new Intl.DateTimeFormat('ar-SY', {
    timeZone: DAMASCUS_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${dayKey}T12:00:00Z`));
}

function formatFinanceMonth(monthKey: string): string {
  return new Intl.DateTimeFormat('ar-SY', {
    timeZone: DAMASCUS_TIME_ZONE,
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${monthKey}-01T12:00:00Z`));
}

export function getFinancePeriodOptions(period: FinancePeriod, rows: FinanceLedgerRow[]): FinancePeriodOption[] {
  const keys = Array.from(new Set(rows.map((row) => financePeriodKey(row, period)))
    .values()).sort((first, second) => second.localeCompare(first));
  return keys.map((key) => ({
    key,
    label: period === 'daily'
      ? formatFinanceDay(key)
      : period === 'weekly'
        ? `أسبوع يبدأ ${formatFinanceDay(key)}`
        : formatFinanceMonth(key),
  }));
}

export function filterFinanceRows(
  rows: FinanceLedgerRow[],
  period: FinancePeriod,
  periodKey: string,
): FinanceLedgerRow[] {
  if (!periodKey) return [];
  return rows.filter((row) => financePeriodKey(row, period) === periodKey);
}

export function firstFinancePeriodKey(period: FinancePeriod, rows: FinanceLedgerRow[]): string {
  return getFinancePeriodOptions(period, rows)[0]?.key ?? '';
}
