/**
 * Design reminder — Corporate Modern Mobile Operations:
 * Compact RTL period controls with operational blue selection and clear date context.
 */
import { CalendarDays } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFinancePeriodOptions, type FinancePeriod } from "@/features/admin/financePeriod";
import type { FinanceLedgerRow } from "@/features/admin/financeTypes";

const labels: Record<FinancePeriod, string> = { daily: "يومي", weekly: "أسبوعي", monthly: "شهري" };

type WagePeriodControlsProps = {
  period: FinancePeriod;
  periodKey: string;
  rows: FinanceLedgerRow[];
  onPeriodChange: (period: FinancePeriod) => void;
  onPeriodKeyChange: (key: string) => void;
};

export function WagePeriodControls({ period, periodKey, rows, onPeriodChange, onPeriodKeyChange }: WagePeriodControlsProps) {
  const options = getFinancePeriodOptions(period, rows);

  return (
    <section className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.04)]" aria-label="اختيار فترة الأجور">
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-xl bg-[#edf4fa] p-1">
          {(Object.keys(labels) as FinancePeriod[]).map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => onPeriodChange(item)}
              className={`h-8 rounded-lg px-3 text-[11px] font-bold transition-all duration-150 active:scale-[0.96] ${period === item ? "bg-[#0060B8] text-white shadow-sm" : "text-[#637180] hover:bg-white"}`}
            >
              {labels[item]}
            </button>
          ))}
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0060B8]"><CalendarDays size={15} />{labels[period]}</span>
      </div>
      <Select value={periodKey} onValueChange={onPeriodKeyChange} disabled={options.length === 0}>
        <SelectTrigger className="mt-3 h-10 w-full rounded-xl border-[#c9d9e7] bg-[#fbfdff] text-right text-xs" aria-label="اختيار الفترة الزمنية">
          <SelectValue />
        </SelectTrigger>
        <SelectContent dir="rtl" className="border-[#c9d9e7] bg-white">
          {options.length > 0
            ? options.map((option) => <SelectItem key={option.key} value={option.key} className="justify-end py-2.5">{option.label}</SelectItem>)
            : <SelectItem value="__no_finance_period__" disabled className="justify-end py-2.5">لا توجد فترة مالية متاحة</SelectItem>}
        </SelectContent>
      </Select>
    </section>
  );
}
