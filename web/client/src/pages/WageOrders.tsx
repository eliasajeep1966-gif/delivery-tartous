/** Design reminder — Corporate Modern Mobile Operations: RTL wage-order ledger, information-first rows, #0060B8 hierarchy, Cairo typography. */
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, CircleDollarSign, Filter, Home as HomeIcon, LoaderCircle, Menu, Package, RefreshCw, Search, Truck, WalletCards } from 'lucide-react';
import { toast } from 'sonner';

import { WagePeriodControls } from '@/components/WagePeriodControls';
import { formatFinanceMoney } from '@/features/admin/financeMappers';
import { filterFinanceRows, firstFinancePeriodKey, getFinancePeriodOptions, type FinancePeriod } from '@/features/admin/financePeriod';
import { useAdminFinanceData } from '@/features/admin/useAdminFinanceData';
import { orderStatusPresentation } from '@/features/admin/types';

type StatusFilter = 'all' | 'completed' | 'false_order';

const navItems = [
  { id: 'more', label: 'المزيد', icon: Menu },
  { id: 'orders', label: 'الطلبات', icon: Package },
  { id: 'home', label: 'الرئيسية', icon: HomeIcon },
  { id: 'captains', label: 'الكباتن', icon: Truck },
  { id: 'fees', label: 'الأجور', icon: WalletCards },
];
const filters: StatusFilter[] = ['all', 'completed', 'false_order'];

export default function WageOrders() {
  const [, setLocation] = useLocation();
  const { snapshot, isInitialLoading, readError, reload } = useAdminFinanceData();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<FinancePeriod>('daily');
  const [periodKey, setPeriodKey] = useState('');
  const periodOptions = useMemo(() => getFinancePeriodOptions(period, snapshot.allRows), [period, snapshot.allRows]);

  useEffect(() => {
    if (!periodOptions.some((option) => option.key === periodKey)) setPeriodKey(periodOptions[0]?.key ?? '');
  }, [periodKey, periodOptions]);

  const changePeriod = (nextPeriod: FinancePeriod) => {
    setPeriod(nextPeriod);
    setPeriodKey(firstFinancePeriodKey(nextPeriod, snapshot.allRows));
  };
  const periodRows = useMemo(() => filterFinanceRows(snapshot.allRows, period, periodKey), [period, periodKey, snapshot.allRows]);
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return periodRows.filter((row) => {
      const matchesFilter = filter === 'all' || row.status === filter;
      const searchable = `${row.orderNumber} ${row.captainName}`.toLowerCase();
      return matchesFilter && (!normalized || searchable.includes(normalized));
    });
  }, [filter, periodRows, query]);
  const totals = useMemo(() => filteredRows.reduce((sum, row) => ({
    gross: sum.gross + row.grossFee,
    captain: sum.captain + row.captainAmount,
    company: sum.company + row.companyAmount,
    settlement: sum.settlement + row.settlementAmount,
  }), { gross: 0, captain: 0, company: 0, settlement: 0 }), [filteredRows]);

  const navigate = (itemId: string, label: string) => {
    if (itemId === 'home') return setLocation('/');
    if (itemId === 'more') return setLocation('/more');
    if (itemId === 'captains') return setLocation('/captains');
    if (itemId === 'orders') return setLocation('/orders');
    if (itemId !== 'fees') toast.info(`واجهة «${label}» ستُبنى عند اختيارك لها.`);
  };

  const content = <>
    <section className="mt-4"><WagePeriodControls period={period} periodKey={periodKey} rows={snapshot.allRows} onPeriodChange={changePeriod} onPeriodKeyChange={setPeriodKey} /></section>
    <section className="mt-4 rounded-2xl bg-[#0060B8] p-4 text-white shadow-[0_6px_16px_rgba(0,96,184,0.2)]"><span className="text-xs text-[#dceaff]">إجمالي الأجور لكل الطلبات المعروضة</span><strong className="mt-1 block text-[25px] leading-8">{formatFinanceMoney(totals.gross)}</strong><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white/12 p-2.5"><span className="block text-[10px] text-[#dceaff]">حصة الكباتن</span><strong className="mt-1 block text-sm">{formatFinanceMoney(totals.captain)}</strong></div><div className="rounded-xl bg-white/12 p-2.5"><span className="block text-[10px] text-[#dceaff]">صافي الشركة</span><strong className="mt-1 block text-sm">{formatFinanceMoney(totals.company)}</strong>{totals.settlement > 0 && <span className="mt-1 block text-[10px] text-amber-100">تسوية {formatFinanceMoney(totals.settlement)}</span>}</div></div></section>
    <section className="mt-5" aria-label="البحث والفلاتر"><div className="relative"><Search className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#75818e]" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث برقم الطلب أو الكابتن" className="h-11 w-full rounded-xl border border-[#c9d9e7] bg-white pr-10 pl-3 text-sm placeholder:text-[#8a98a6] focus:border-[#0060B8] focus:outline-none focus:ring-2 focus:ring-[#0060B8]/15" /></div><div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[#66727e]"><Filter size={17} /></span>{filters.map((item) => <button type="button" key={item} onClick={() => setFilter(item)} className={`h-8 shrink-0 rounded-full px-3.5 text-xs font-bold transition-all duration-150 active:scale-[0.96] ${filter === item ? 'bg-[#0060B8] text-white' : 'border border-[#d4e2ec] bg-white text-[#58616b]'}`}>{item === 'all' ? 'الكل' : orderStatusPresentation[item].label}</button>)}</div></section>
    <section className="mt-5" aria-labelledby="orders-ledger-title"><div className="mb-3 flex items-center justify-between"><h2 id="orders-ledger-title" className="text-base font-bold">سجل الطلبات حسب الفترة</h2><span className="rounded-full bg-[#dbeeff] px-2.5 py-1 text-xs font-bold text-[#0060B8]">{filteredRows.length} طلبات</span></div><div className="space-y-3">{filteredRows.length ? filteredRows.map((row) => <article key={row.financialLedgerId} className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm">طلب #{row.orderNumber}</strong><span className={`mr-2 rounded-md px-2 py-0.5 text-[10px] font-bold ${orderStatusPresentation[row.status].className}`}>{orderStatusPresentation[row.status].label}</span><p className="mt-1.5 text-xs text-[#66727e]">الكابتن: {row.captainName}</p></div><div className="text-left"><strong className="text-sm">{formatFinanceMoney(row.grossFee)}</strong><p className="mt-1 text-[10px] text-[#75818e]">{new Date(row.completedAt).toLocaleDateString('ar-SY', { timeZone: 'Asia/Damascus' })}</p></div></div><div className="mt-3 rounded-xl bg-[#f5f9fc] px-3 py-2.5"><div className="flex items-center justify-between gap-2"><span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4f5d6b]"><span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#0060B8]"><Truck size={13} /></span>{row.captainName}</span><span className="text-[10px] text-emerald-700">كابتن <strong className="mr-1 text-xs">{formatFinanceMoney(row.captainAmount)}</strong></span></div><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#d7e3ed] pt-2 text-[10px]"><span className="text-[#0060B8]">الشركة <strong className="mr-1 text-xs">{formatFinanceMoney(row.companyAmount)}</strong></span>{row.status === 'false_order' && <span className="text-amber-700">تسوية <strong className="mr-1 text-xs">{formatFinanceMoney(row.settlementAmount)}</strong></span>}<span className={row.unpaidAmount > 0 ? 'text-[#ba1a1a]' : 'text-emerald-700'}>{row.unpaidAmount > 0 ? `المتبقي ${formatFinanceMoney(row.unpaidAmount)}` : 'مدفوع بالكامل'}</span></div></div></article>) : <div className="rounded-2xl border border-dashed border-[#c7dae8] bg-white/70 px-4 py-10 text-center"><Package className="mx-auto text-[#7d9ab0]" size={28} /><p className="mt-2 text-sm font-bold text-[#4f5d6b]">لا توجد طلبات مطابقة</p><p className="mt-1 text-xs text-[#75818e]">جرّب تغيير البحث أو الفلتر أو الفترة الزمنية.</p></div>}</div></section>
  </>;

  return <div className="min-h-screen bg-[#eaf5ff] text-[#1c1b1b]" dir="rtl"><div className="relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[#f0f7ff] shadow-[0_0_40px_rgba(0,72,141,0.08)]"><header className="fixed top-0 right-0 left-0 z-30 mx-auto flex h-16 w-full max-w-[453px] items-center justify-between bg-[#0060B8] px-5 text-white shadow-[0_4px_18px_rgba(0,96,184,0.28)]"><button type="button" aria-label="العودة إلى أجور الكباتن" onClick={() => setLocation('/wages')} className="grid h-10 w-10 place-items-center rounded-full transition-transform duration-150 hover:bg-white/10 active:scale-[0.96]"><ArrowRight size={22} strokeWidth={2.4} /></button><div className="flex items-center gap-2"><div className="text-left"><p className="text-[11px] leading-4 text-[#dbeaff]">الأجور والدفعات</p><h1 className="text-[19px] font-bold leading-6">كشف الطلبات</h1></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><Package size={21} /></span></div></header><main className="px-5 pt-[84px] pb-24"><section className="rounded-2xl border border-[#d3e3f0] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="flex items-start justify-between gap-3"><div><h2 className="text-[18px] font-bold">كل الطلبات والأجور</h2><p className="mt-1 text-xs leading-5 text-[#58616b]">كل طلب ظاهر مع أجره الكلي وحصة الكابتن والشركة.</p></div><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eaf4ff] text-[#0060B8]"><CircleDollarSign size={23} /></span></div><button type="button" onClick={() => setLocation('/wages')} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#a8c8ff] bg-[#eef6ff] text-xs font-bold text-[#0060B8] transition-colors hover:bg-[#dfefff]"><Truck size={17} />العودة إلى أجور الكباتن والدفعات</button></section>{isInitialLoading ? <section className="mt-4 flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-[#dbe7f2] bg-white text-sm font-bold text-[#0060B8]"><LoaderCircle className="animate-spin" size={20} />جارٍ تحميل كشف الطلبات...</section> : readError ? <section className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-center"><p className="text-sm text-[#ba1a1a]">{readError}</p><button type="button" onClick={() => void reload()} className="mx-auto mt-3 flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-xs font-bold text-[#ba1a1a]"><RefreshCw size={15} />إعادة المحاولة</button></section> : snapshot.allRows.length === 0 ? <section className="mt-4 rounded-2xl border border-dashed border-[#c7dae8] bg-white/70 px-4 py-10 text-center text-sm text-[#75818e]">لا توجد سطور أجور مسجلة حالياً.</section> : content}</main><nav aria-label="التنقل الرئيسي" className="fixed right-0 bottom-0 left-0 z-30 mx-auto flex h-[72px] w-full max-w-[453px] items-center justify-around rounded-t-2xl border-t-2 border-[#a8c8ff]/60 bg-[#0060B8] px-2 text-white shadow-[0_-4px_18px_rgba(0,96,184,0.2)]">{navItems.map((item) => { const NavIcon = item.icon; const isActive = item.id === 'fees'; return <button type="button" key={item.id} onClick={() => navigate(item.id, item.label)} className={`flex min-w-[54px] flex-col items-center justify-center rounded-xl px-2 py-1.5 transition-all duration-150 active:scale-[0.94] ${isActive ? '-translate-y-3 bg-white px-5 text-[#0060B8] shadow-[0_4px_12px_rgba(0,0,0,0.12)]' : 'text-white hover:bg-white/10'}`} aria-current={isActive ? 'page' : undefined}><NavIcon size={21} strokeWidth={isActive ? 2.75 : 2.2} fill={isActive ? 'currentColor' : 'none'} /><span className="mt-1 text-[11px] font-bold whitespace-nowrap">{item.label}</span></button>; })}</nav></div></div>;
}
