/** Design reminder — Corporate Modern Mobile Operations: RTL company wage ledger, #0060B8 hierarchy, white ledger cards, Cairo typography. */
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, Banknote, CalendarDays, CircleDollarSign, Clock3, LoaderCircle, Package, RefreshCw, Store, WalletCards } from 'lucide-react';

import { WagePeriodControls } from '@/components/WagePeriodControls';
import { AdminBottomNav } from '@/components/AdminBottomNav';
import { formatFinanceMoney } from '@/features/admin/financeMappers';
import { filterFinanceRows, financeDayKey, firstFinancePeriodKey, formatFinanceDay, getFinancePeriodOptions, type FinancePeriod } from '@/features/admin/financePeriod';
import { useAdminFinanceData } from '@/features/admin/useAdminFinanceData';

export default function CompanyWages() {
  const [, setLocation] = useLocation();
  const { snapshot, isInitialLoading, readError, reload } = useAdminFinanceData();
  const [period, setPeriod] = useState<FinancePeriod>('daily');
  const [periodKey, setPeriodKey] = useState('');
  const periodOptions = useMemo(() => getFinancePeriodOptions(period, snapshot.allRows), [period, snapshot.allRows]);

  useEffect(() => {
    if (!periodOptions.some((option) => option.key === periodKey)) setPeriodKey(periodOptions[0]?.key ?? '');
  }, [periodKey, periodOptions]);

  const rows = useMemo(() => filterFinanceRows(snapshot.allRows, period, periodKey), [period, periodKey, snapshot.allRows]);
  const periodLabel = periodOptions.find((option) => option.key === periodKey)?.label ?? '';
  const totals = useMemo(() => rows.reduce((sum, row) => ({
    gross: sum.gross + row.grossFee,
    company: sum.company + row.companyAmount,
    captain: sum.captain + row.captainAmount,
    settlement: sum.settlement + row.settlementAmount,
  }), { gross: 0, company: 0, captain: 0, settlement: 0 }), [rows]);
  const dailySummaries = useMemo(() => Object.entries(rows.reduce<Record<string, typeof rows>>((groups, row) => {
    const dayKey = financeDayKey(row.completedAt);
    (groups[dayKey] ??= []).push(row);
    return groups;
  }, {})).sort(([first], [second]) => second.localeCompare(first)).map(([date, dateRows]) => ({
    date,
    rows: dateRows,
    gross: dateRows.reduce((sum, row) => sum + row.grossFee, 0),
    company: dateRows.reduce((sum, row) => sum + row.companyAmount, 0),
    settlement: dateRows.reduce((sum, row) => sum + row.settlementAmount, 0),
  })), [rows]);

  const changePeriod = (nextPeriod: FinancePeriod) => {
    setPeriod(nextPeriod);
    setPeriodKey(firstFinancePeriodKey(nextPeriod, snapshot.allRows));
  };

  const content = <>
    <section className="mt-4"><WagePeriodControls period={period} periodKey={periodKey} rows={snapshot.allRows} onPeriodChange={changePeriod} onPeriodKeyChange={setPeriodKey} /></section>
    <section className="mt-4 grid grid-cols-2 gap-3"><article className="rounded-2xl border border-blue-100 bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-100 text-[#0060B8]"><Banknote size={19} /></span><p className="mt-3 text-xs font-bold text-[#4f5d6b]">الأجور الكلية</p><strong className="mt-1 block text-[18px] text-[#0060B8]">{formatFinanceMoney(totals.gross)}</strong><span className="mt-1 text-[10px] text-[#66727e]">{periodLabel}</span></article><article className="rounded-2xl border border-violet-100 bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-100 text-violet-700"><CircleDollarSign size={19} /></span><p className="mt-3 text-xs font-bold text-[#4f5d6b]">صافي ربح الشركة</p><strong className="mt-1 block text-[18px] text-violet-700">{formatFinanceMoney(totals.company)}</strong><span className="mt-1 text-[10px] text-violet-700">من Ledger الحقيقي</span></article><article className="rounded-2xl border border-emerald-100 bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Package size={19} /></span><p className="mt-3 text-xs font-bold text-[#4f5d6b]">حصة الكباتن</p><strong className="mt-1 block text-[18px] text-emerald-700">{formatFinanceMoney(totals.captain)}</strong><span className="mt-1 text-[10px] text-emerald-700">من Ledger الحقيقي</span></article><article className="rounded-2xl border border-amber-100 bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700"><CalendarDays size={19} /></span><p className="mt-3 text-xs font-bold text-[#4f5d6b]">عدد الطلبات</p><strong className="mt-1 block text-[18px] text-amber-700">{rows.length}</strong><span className="mt-1 text-[10px] text-amber-700">ضمن الفترة</span></article></section>
    <section className="mt-6"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold">تفاصيل الأجور حسب التاريخ</h2><span className="rounded-full bg-[#eae8ff] px-2.5 py-1 text-xs font-bold text-violet-700">{dailySummaries.length} تواريخ</span></div><div className="space-y-4">{dailySummaries.map((summary) => <article key={summary.date} className="overflow-hidden rounded-2xl border border-[#d3e3f0] bg-white shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="flex items-center justify-between gap-3 border-b border-[#e1ebf3] bg-[#f8fbfe] p-4"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eae8ff] text-violet-700"><CalendarDays size={18} /></span><div><h3 className="text-sm font-bold">{formatFinanceDay(summary.date)}</h3><p className="mt-0.5 text-[10px] text-[#66727e]">{summary.rows.length} طلبات</p></div></div><strong className="text-sm text-[#0060B8]">{formatFinanceMoney(summary.gross)}</strong></div><div className="grid grid-cols-2 gap-px bg-[#e1ebf3]"><div className="bg-white p-3"><span className="text-[10px] font-bold text-[#66727e]">أجور هذا التاريخ</span><strong className="mt-1 block text-sm text-[#1c1b1b]">{formatFinanceMoney(summary.gross)}</strong></div><div className="bg-white p-3"><span className="text-[10px] font-bold text-[#66727e]">صافي ربح الشركة</span><strong className="mt-1 block text-sm text-violet-700">{formatFinanceMoney(summary.company)}</strong>{summary.settlement > 0 && <span className="mt-1 block text-[10px] text-amber-700">تسوية {formatFinanceMoney(summary.settlement)}</span>}</div></div><div className="divide-y divide-[#edf2f6]">{summary.rows.map((row) => <div key={row.financialLedgerId} className="flex items-center gap-3 p-3.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-[#0060B8]"><Package size={17} /></span><div className="min-w-0 flex-1"><strong className="block text-xs">طلب #{row.orderNumber}</strong><span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[#66727e]"><span>{row.captainName}</span><span className="inline-flex items-center gap-1"><Clock3 size={12} />{new Date(row.completedAt).toLocaleTimeString('ar-SY', { timeZone: 'Asia/Damascus', hour: '2-digit', minute: '2-digit' })}</span></span></div><div className="text-left"><strong className="block text-xs text-[#1c1b1b]">{formatFinanceMoney(row.grossFee)}</strong><span className="mt-1 block text-[10px] font-bold text-violet-700">الشركة: {formatFinanceMoney(row.companyAmount)}{row.status === 'false_order' ? ` — تسوية: ${formatFinanceMoney(row.settlementAmount)}` : ''}</span></div></div>)}</div></article>)}</div></section>
  </>;

  return <div className="min-h-screen bg-[#eaf5ff] text-[#1c1b1b]" dir="rtl"><div className="relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[#f0f7ff] shadow-[0_0_40px_rgba(0,72,141,0.08)]"><header className="fixed top-0 right-0 left-0 z-30 mx-auto flex h-16 w-full max-w-[453px] items-center justify-between bg-[#0060B8] px-5 text-white shadow-[0_4px_18px_rgba(0,96,184,0.28)]"><button type="button" aria-label="العودة إلى أجور الكباتن" onClick={() => setLocation('/wages')} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 active:scale-[0.96]"><ArrowRight size={22} strokeWidth={2.4} /></button><div className="flex items-center gap-2"><div className="text-left"><p className="text-[11px] leading-4 text-[#dbeaff]">الأجور وحساب الشركة</p><h1 className="text-[19px] font-bold leading-6">أجور الشركة</h1></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><Store size={21} /></span></div></header><main className="px-5 pt-[84px] pb-24"><section className="rounded-2xl border border-[#d3e3f0] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="flex items-start justify-between gap-3"><div><h2 className="text-[18px] font-bold">كشف أجور الشركة</h2><p className="mt-1 text-xs leading-5 text-[#58616b]">تفاصيل الأجور حسب التاريخ مع إجمالي الطلبات وصافي ربح الشركة.</p></div><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700"><WalletCards size={23} /></span></div></section>{isInitialLoading ? <section className="mt-4 flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-[#dbe7f2] bg-white text-sm font-bold text-[#0060B8]"><LoaderCircle className="animate-spin" size={20} />جارٍ تحميل كشف الشركة...</section> : readError ? <section className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-center"><p className="text-sm text-[#ba1a1a]">{readError}</p><button type="button" onClick={() => void reload()} className="mx-auto mt-3 flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-xs font-bold text-[#ba1a1a]"><RefreshCw size={15} />إعادة المحاولة</button></section> : snapshot.allRows.length === 0 ? <section className="mt-4 rounded-2xl border border-dashed border-[#c7dae8] bg-white/70 px-4 py-10 text-center text-sm text-[#75818e]">لا توجد أجور شركة مسجلة حالياً.</section> : content}</main><AdminBottomNav active="wages" /></div></div>;
}
