/** Design reminder — Corporate Modern Mobile Operations: RTL report composition, #0060B8 summary hierarchy, numeric operational cards, Cairo typography. */
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Building2, ClipboardList, LoaderCircle, RefreshCw, TrendingUp, Truck } from 'lucide-react';

import { MorePageLayout } from '@/components/MorePageLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatFinanceMoney } from '@/features/admin/financeMappers';
import { filterFinanceRows, financeDayKey, firstFinancePeriodKey, formatFinanceDay, getFinancePeriodOptions } from '@/features/admin/financePeriod';
import { useAdminFinanceData } from '@/features/admin/useAdminFinanceData';

export default function Reports() {
  const { snapshot, isInitialLoading, readError, reload } = useAdminFinanceData();
  const monthOptions = useMemo(() => getFinancePeriodOptions('monthly', snapshot.allRows), [snapshot.allRows]);
  const [month, setMonth] = useState('');

  useEffect(() => {
    if (!monthOptions.some((option) => option.key === month)) setMonth(firstFinancePeriodKey('monthly', snapshot.allRows));
  }, [month, monthOptions, snapshot.allRows]);

  const rows = useMemo(() => filterFinanceRows(snapshot.allRows, 'monthly', month), [month, snapshot.allRows]);
  const totals = useMemo(() => rows.reduce((sum, row) => ({
    gross: sum.gross + row.grossFee,
    captain: sum.captain + row.captainAmount,
    company: sum.company + row.companyAmount,
    settlement: sum.settlement + row.settlementAmount,
  }), { gross: 0, captain: 0, company: 0, settlement: 0 }), [rows]);
  const daily = useMemo(() => Object.entries(rows.reduce<Record<string, typeof rows>>((groups, row) => {
    const dayKey = financeDayKey(row.completedAt);
    (groups[dayKey] ??= []).push(row);
    return groups;
  }, {})).sort(([first], [second]) => second.localeCompare(first)).map(([dayKey, dayRows]) => ({
    dayKey,
    rows: dayRows,
    gross: dayRows.reduce((sum, row) => sum + row.grossFee, 0),
  })), [rows]);
  const captainTotals = useMemo(() => snapshot.captains.map((captain) => {
    const captainRows = rows.filter((row) => row.captainId === captain.captainId);
    return { ...captain, captainAmount: captainRows.reduce((sum, row) => sum + row.captainAmount, 0), count: captainRows.length };
  }).filter((captain) => captain.count > 0), [rows, snapshot.captains]);
  const monthLabel = monthOptions.find((option) => option.key === month)?.label ?? '';

  return <MorePageLayout title="التقارير" subtitle="" Icon={BarChart3}>
    <section className="rounded-2xl border border-[#d3e3f0] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="flex items-start justify-between gap-3"><div><h2 className="text-[18px] font-bold">تقرير المكتب</h2><p className="mt-1 text-xs leading-5 text-[#58616b]">ملخص الطلبات والأجور ضمن الشهر المحدد.</p></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eaf4ff] text-[#0060B8]"><TrendingUp size={23} /></span></div><Select value={month} onValueChange={setMonth} disabled={monthOptions.length === 0}><SelectTrigger className="mt-4 h-10 rounded-xl border-[#c9d9e7] bg-[#fbfdff] text-xs"><SelectValue placeholder="لا يوجد شهر مالي" /></SelectTrigger><SelectContent dir="rtl">{monthOptions.length ? monthOptions.map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>) : <SelectItem value="__no_finance_month__" disabled>لا يوجد شهر مالي</SelectItem>}</SelectContent></Select></section>
    {isInitialLoading ? <section className="mt-4 flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-[#dbe7f2] bg-white text-sm font-bold text-[#0060B8]"><LoaderCircle className="animate-spin" size={20} />جارٍ تحميل التقارير...</section> : readError ? <section className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-center"><p className="text-sm text-[#ba1a1a]">{readError}</p><button type="button" onClick={() => void reload()} className="mx-auto mt-3 flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-xs font-bold text-[#ba1a1a]"><RefreshCw size={15} />إعادة المحاولة</button></section> : snapshot.allRows.length === 0 ? <section className="mt-4 rounded-2xl border border-dashed border-[#c7dae8] bg-white/70 px-4 py-10 text-center text-sm text-[#75818e]">لا توجد بيانات أجور للتقارير حالياً.</section> : <>
      <section className="mt-4 rounded-2xl bg-[#0060B8] p-4 text-white shadow-[0_6px_16px_rgba(0,96,184,0.2)]"><span className="text-xs text-[#dceaff]">إجمالي أجور {monthLabel}</span><strong className="mt-1 block text-[25px]">{formatFinanceMoney(totals.gross)}</strong><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white/12 p-2.5"><span className="block text-[10px] text-[#dceaff]">الكباتن</span><strong className="mt-1 block text-sm">{formatFinanceMoney(totals.captain)}</strong></div><div className="rounded-xl bg-white/12 p-2.5"><span className="block text-[10px] text-[#dceaff]">المكتب</span><strong className="mt-1 block text-sm">{formatFinanceMoney(totals.company)}</strong>{totals.settlement > 0 && <span className="mt-1 block text-[10px] text-amber-100">تسوية {formatFinanceMoney(totals.settlement)}</span>}</div></div></section>
      <section className="mt-5 grid grid-cols-2 gap-3"><article className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><ClipboardList className="text-[#0060B8]" size={20} /><p className="mt-3 text-xs font-bold text-[#58616b]">طلبات الشهر</p><strong className="mt-1 text-xl">{rows.length}</strong></article><article className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><Building2 className="text-emerald-600" size={20} /><p className="mt-3 text-xs font-bold text-[#58616b]">صافي المكتب</p><strong className="mt-1 text-lg text-emerald-700">{formatFinanceMoney(totals.company)}</strong></article></section>
      <section className="mt-6"><h2 className="mb-3 text-base font-bold">الحصيلة اليومية</h2><div className="space-y-2">{daily.map((group) => <article key={group.dayKey} className="flex items-center justify-between rounded-2xl border border-[#dbe7f2] bg-white px-3.5 py-3 shadow-[0_2px_8px_rgba(0,72,141,0.04)]"><div><strong className="text-sm">{formatFinanceDay(group.dayKey)}</strong><span className="mt-1 block text-[11px] text-[#66727e]">{group.rows.length} طلبات</span></div><strong className="text-sm text-[#0060B8]">{formatFinanceMoney(group.gross)}</strong></article>)}</div></section>
      <section className="mt-6"><h2 className="mb-3 text-base font-bold">أجور الكباتن</h2><div className="space-y-2">{captainTotals.map((captain) => <article key={captain.captainId} className="flex items-center justify-between rounded-2xl border border-[#dbe7f2] bg-white px-3.5 py-3 shadow-[0_2px_8px_rgba(0,72,141,0.04)]"><span className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#e7edf2] text-xs font-bold text-[#52606d]">{captain.initial}</span><span><strong className="block text-sm">{captain.captainName}</strong><span className="text-[10px] text-[#66727e]">{captain.count} طلبات في الشهر</span></span></span><span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700"><Truck size={15} />{formatFinanceMoney(captain.captainAmount)}</span></article>)}</div></section>
    </>}
  </MorePageLayout>;
}
