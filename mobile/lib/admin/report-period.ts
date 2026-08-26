export type OptionalDateRange = {
  startDate: string | null;
  endDate: string | null;
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

export function assertDateRange(startDate: string, endDate: string): OptionalDateRange {
  assertDateKey(startDate);
  assertDateKey(endDate);
  if (startDate > endDate) {
    throw new Error("يجب أن يكون تاريخ البداية قبل تاريخ النهاية أو مساوياً له.");
  }
  return { startDate, endDate };
}

export function optionalDateRange(
  enabled: boolean,
  startDate: string,
  endDate: string,
): OptionalDateRange {
  if (!enabled) return { startDate: null, endDate: null };
  return assertDateRange(startDate, endDate);
}

export function formatReportDate(value: string): string {
  return new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
    dateStyle: "medium",
    timeZone: "Asia/Damascus",
  }).format(new Date(`${value}T12:00:00Z`));
}
