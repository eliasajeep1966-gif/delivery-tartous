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
import { getPeriodOptions, type Period } from "@/lib/wage-data";

const labels: Record<Period, string> = { daily: "يومي", weekly: "أسبوعي", monthly: "شهري" };

type WagePeriodControlsProps = {
  period: Period;
  periodKey: string;
  onPeriodChange: (period: Period) => void;
  onPeriodKeyChange: (key: string) => void;
};

export function WagePeriodControls({ period, periodKey, onPeriodChange, onPeriodKeyChange }: WagePeriodControlsProps) {
  const options = getPeriodOptions(period);

  return (
    <section className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.04)]" aria-label="اختيار فترة الأجور">
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-xl bg-[#edf4fa] p-1">
          {(Object.keys(labels) as Period[]).map((item) => (
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
      <Select value={periodKey} onValueChange={onPeriodKeyChange}>
        <SelectTrigger className="mt-3 h-10 w-full rounded-xl border-[#c9d9e7] bg-[#fbfdff] text-right text-xs" aria-label="اختيار الفترة الزمنية">
          <SelectValue />
        </SelectTrigger>
        <SelectContent dir="rtl" className="border-[#c9d9e7] bg-white">
          {options.map((option) => <SelectItem key={option.key} value={option.key} className="justify-end py-2.5">{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </section>
  );
}
