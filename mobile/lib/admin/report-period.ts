export type CompanyReportPeriod =
  | "daily"
  | "weekly"
  | "monthly"
  | "annual";

export type DateRange = {
  startDate: string;
  endDate: string;
};

function assertDateKey(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("صيغة التاريخ غير صالحة.");
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("التاريخ المحدد غير صالح.");
  }
}

function asDate(value: string): Date {
  assertDateKey(value);
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function dateKey(value: Date): string {
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function damascusDateKey(value = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Damascus",
    year: "numeric",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export const currentDamascusDateKey = damascusDateKey;

export function rangeForPeriod(
  period: CompanyReportPeriod,
  selectedDate: string,
  latestDate = currentDamascusDateKey(),
): DateRange {
  const value = asDate(selectedDate);
  const today = asDate(latestDate);
  const cappedEnd = (end: Date) => (end.getTime() > today.getTime() ? today : end);

  if (period === "daily") {
    return { startDate: selectedDate, endDate: selectedDate };
  }

  if (period === "weekly") {
    const weekday = value.getUTCDay();
    const daysSinceMonday = (weekday + 6) % 7;
    const start = new Date(value);
    start.setUTCDate(value.getUTCDate() - daysSinceMonday);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return { startDate: dateKey(start), endDate: dateKey(cappedEnd(end)) };
  }

  if (period === "monthly") {
    const start = new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1, 12),
    );
    const end = new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0, 12),
    );
    return { startDate: dateKey(start), endDate: dateKey(cappedEnd(end)) };
  }

  const start = new Date(Date.UTC(value.getUTCFullYear(), 0, 1, 12));
  const end = new Date(Date.UTC(value.getUTCFullYear(), 11, 31, 12));
  return { startDate: dateKey(start), endDate: dateKey(cappedEnd(end)) };
}

export function assertDateRange(startDate: string, endDate: string): DateRange {
  assertDateKey(startDate);
  assertDateKey(endDate);
  if (startDate > endDate) {
    throw new Error("يجب أن يكون تاريخ البداية قبل تاريخ النهاية أو مساوياً له.");
  }
  return { startDate, endDate };
}

export function formatReportDate(value: string): string {
  return new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
    dateStyle: "medium",
    timeZone: "Asia/Damascus",
  }).format(new Date(`${value}T12:00:00Z`));
}

export function periodLabel(period: CompanyReportPeriod): string {
  const labels: Record<CompanyReportPeriod, string> = {
    daily: "يومي",
    weekly: "أسبوعي",
    monthly: "شهري",
    annual: "سنوي",
  };
  return labels[period];
}
