/*
 * Design reminder — Corporate Modern Mobile Operations:
 * Compact RTL period controls with operational blue selection and clear date context.
 */
import { CalendarDays } from 'lucide-react';

import { getFinancePeriodOptions, type FinancePeriod } from '@/features/admin/financePeriod';
import type { FinanceLedgerRow } from '@/features/admin/financeTypes';

const labels: Record<FinancePeriod, string> = { daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري' };

export type WagePeriodOption = {
  key: string;
  label: string;
};

type WagePeriodControlsProps = {
  period: FinancePeriod;
  periodKey: string;
  options?: WagePeriodOption[];
  rows?: FinanceLedgerRow[];
  onPeriodChange: (period: FinancePeriod) => void;
  onPeriodKeyChange: (key: string) => void;
};

export function WagePeriodControls({ period, periodKey, options, rows, onPeriodChange, onPeriodKeyChange }: WagePeriodControlsProps) {
  const resolvedOptions = options ?? getFinancePeriodOptions(period, rows ?? []);
  const selectedLabel = resolvedOptions.find((option) => option.key === periodKey)?.label ?? labels[period];

  return <section className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.04)]" aria-label="اختيار فترة الأجور">
    <div className="flex items-center justify-between gap-2">
      <div className="flex rounded-xl bg-[#edf4fa] p-1">
        {(Object.keys(labels) as FinancePeriod[]).map((item) => <button
          type="button"
          key={item}
          onClick={() => onPeriodChange(item)}
          className={`h-8 rounded-lg px-3 text-[11px] font-bold transition-all duration-150 active:scale-[0.96] ${period === item ? 'bg-[#0060B8] text-white shadow-sm' : 'text-[#637180] hover:bg-white'}`}
        >
          {labels[item]}
        </button>)}
      </div>
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0060B8]"><CalendarDays size={15} />{labels[period]}</span>
    </div>
    <label className="mt-3 block">
      <span className="sr-only">اختر {labels[period]}</span>
      <select
        value={periodKey}
        onChange={(event) => onPeriodKeyChange(event.target.value)}
        disabled={resolvedOptions.length === 0}
        className="h-10 w-full rounded-xl border border-[#c9d9e7] bg-[#fbfdff] px-3 text-xs font-bold text-[#1c1b1b] outline-none transition-colors focus:border-[#0060B8] focus:ring-2 focus:ring-[#0060B8]/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {resolvedOptions.length === 0 ? <option value="">لا توجد فترات مسجلة</option> : resolvedOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
      </select>
      <span className="mt-1.5 block text-[10px] text-[#66727e]">الفترة المعروضة: {selectedLabel}</span>
    </label>
  </section>;
}
