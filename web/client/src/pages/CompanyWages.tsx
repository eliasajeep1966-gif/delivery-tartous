/** Company profit ledger: summary first, day details on demand, no captain-wide N+1 loading. */
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, Banknote, CalendarDays, CircleDollarSign, LoaderCircle, Package, RefreshCw, Store, WalletCards } from 'lucide-react';

import { AdminBottomNav } from '@/components/AdminBottomNav';
import { formatFinanceMoney } from '@/features/admin/financeMappers';
import { formatFinanceDay } from '@/features/admin/financePeriod';
import type { CompanyProfitHistoryRow } from '@/features/admin/financeTypes';
import { useAdminFinanceData } from '@/features/admin/useAdminFinanceData';
import { useCompanyProfitHistory } from '@/features/admin/useCompanyProfitHistory';

type CompanyProfitPeriod = 'daily' | 'weekly' | 'monthly';

type CompanyProfitPeriodRow = CompanyProfitHistoryRow & { key: string; label: string; days: string[] };

function periodKey(day: string, period: CompanyProfitPeriod): string {
  if (period === 'monthly') return day.slice(0, 7);
  if (period === 'daily') return day;
  const date = new Date(`${day}T00:00:00Z`);
  const dayOfWeek = date.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  date.setUTCDate(date.getUTCDate() + mondayOffset);
  return date.toISOString().slice(0, 10);
}

function periodLabel(key: string, period: CompanyProfitPeriod): string {
  if (period === 'monthly') return new Intl.DateTimeFormat('ar-SY', { month: 'long', year: 'numeric', timeZone: 'Asia/Damascus' }).format(new Date(`${key}-01T00:00:00Z`));
  if (period === 'weekly') return `أسبوع ${formatFinanceDay(key)}`;
  return formatFinanceDay(key);
}

export default function CompanyWages({ fullHistory = false }: { fullHistory?: boolean }) {
  const [, setLocation] = useLocation();
  const { snapshot, isInitialLoading, readError, reload, loadCaptainDetails, captainDetailsCache } = useAdminFinanceData();
  const { history, dayDetails, loadHistory, loadAllHistory, selectDay, loadMoreDay } = useCompanyProfitHistory();
  const [expandedCaptainId, setExpandedCaptainId] = useState<string | null>(null);
  const [period, setPeriod] = useState<CompanyProfitPeriod>('daily');
  const periodRows = useMemo<CompanyProfitPeriodRow[]>(() => {
    const groups = new Map<string, CompanyProfitPeriodRow>();
    history.rows.forEach((day) => {
      const key = periodKey(day.businessDay, period);
      const existing = groups.get(key);
      if (existing) {
        existing.grossTotal += day.grossTotal;
        existing.companyTotal += day.companyTotal;
        existing.captainNetTotal += day.captainNetTotal;
        existing.settlementTotal += day.settlementTotal;
        existing.orderCount += day.orderCount;
        existing.days.push(day.businessDay);
      } else {
        groups.set(key, { ...day, key, label: periodLabel(key, period), days: [day.businessDay] });
      }
    });
    return Array.from(groups.values()).sort((first, second) => second.key.localeCompare(first.key));
  }, [history.rows, period]);

  useEffect(() => {
    if (fullHistory || period !== 'daily') void loadAllHistory();
  }, [fullHistory, loadAllHistory, period]);

  const openCaptainDetails = async (captainId: string) => {
    setExpandedCaptainId(captainId);
    await loadCaptainDetails(captainId);
  };

  const retryAll = async () => {
    await Promise.all([reload(), loadHistory()]);
  };

  const captainDetailsSection = <section className="mt-6"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold">تفاصيل الكباتن</h2><span className="text-[10px] text-[#66727e]">تُحمّل عند الطلب</span></div><div className="space-y-2">{snapshot.captains.map((captain) => { const details = captainDetailsCache.get(captain.captainId); const loaded = details?.status === 'loaded' ? details.rows : []; const expanded = expandedCaptainId === captain.captainId; return <article key={captain.captainId} className="rounded-2xl border border-[#d3e3f0] bg-white p-3 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><button type="button" onClick={() => void openCaptainDetails(captain.captainId)} className="flex w-full items-center justify-between gap-3 text-right"><span><strong className="block text-sm">{captain.captainName}</strong><span className="mt-1 block text-[10px] text-[#66727e]">{captain.orderCount} طلبات · {formatFinanceMoney(captain.grossTotal)}</span></span><span className="rounded-xl bg-[#eaf6ff] px-3 py-2 text-[10px] font-extrabold text-[#0060B8]">{details?.status === 'loading' ? 'جارٍ التحميل...' : expanded && details?.status === 'loaded' ? 'تم التحميل' : 'عرض التفاصيل'}</span></button>{expanded && details?.status === 'error' && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-[10px] font-bold text-red-700">{details.message}</p>}{expanded && details?.status === 'loaded' && <div className="mt-3 grid grid-cols-3 gap-2 border-t border-dashed border-[#dcebf3] pt-3 text-center"><div><span className="block text-[9px] text-[#66727e]">الطلبات</span><strong className="text-xs">{loaded.length}</strong></div><div><span className="block text-[9px] text-[#66727e]">حصة الشركة</span><strong className="text-xs text-violet-700">{formatFinanceMoney(loaded.reduce((sum, row) => sum + row.companyAmount, 0))}</strong></div><div><span className="block text-[9px] text-[#66727e]">آخر طلب</span><strong className="text-xs text-[#0060B8]">{loaded[0] ? formatFinanceDay(loaded[0].completedAt.slice(0, 10)) : 'لا يوجد'}</strong></div></div>}</article>; })}</div></section>;

  const dayDetailsSection = dayDetails.day ? <section className="mt-6 rounded-2xl border border-[#d3e3f0] bg-white shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="flex items-center justify-between border-b border-[#e1ebf3] bg-[#f8fbfe] p-4"><div><h2 className="text-base font-bold">تفاصيل {formatFinanceDay(dayDetails.day)}</h2><p className="mt-1 text-[10px] text-[#66727e]">تفاصيل اليوم تُحمّل عند الاختيار فقط.</p></div><button type="button" onClick={() => void selectDay(dayDetails.day!)} className="rounded-xl border border-[#b9d6ed] bg-white px-3 py-2 text-[10px] font-bold text-[#0060B8]">إعادة التحميل</button></div>{dayDetails.loading && !dayDetails.rows.length ? <div className="flex min-h-28 items-center justify-center gap-2 text-xs font-bold text-[#0060B8]"><LoaderCircle className="animate-spin" size={18} />جارٍ تحميل تفاصيل اليوم...</div> : dayDetails.error && !dayDetails.rows.length ? <div className="p-5 text-center text-xs font-bold text-red-700"><p>{dayDetails.error}</p><button type="button" onClick={() => void selectDay(dayDetails.day!)} className="mt-3 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs">إعادة المحاولة</button></div> : dayDetails.rows.length ? <><div className="divide-y divide-[#edf2f6]">{dayDetails.rows.map((row) => <div key={row.financialLedgerId} className="flex items-center gap-3 p-3.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-[#0060B8]"><Package size={17} /></span><div className="min-w-0 flex-1"><strong className="block text-xs">طلب #{row.orderNumber}</strong><span className="mt-1 flex flex-wrap gap-2 text-[10px] text-[#66727e]"><span>{row.captainName}</span><span>{new Date(row.completedAt).toLocaleTimeString('ar-SY', { timeZone: 'Asia/Damascus', hour: '2-digit', minute: '2-digit' })}</span></span></div><div className="text-left"><strong className="block text-xs">{formatFinanceMoney(row.grossFee)}</strong><span className="mt-1 block text-[10px] font-bold text-violet-700">الشركة: {formatFinanceMoney(row.companyAmount)}</span>{row.settlementAmount > 0 && <span className="mt-1 block text-[10px] text-amber-700">تسوية: {formatFinanceMoney(row.settlementAmount)}</span>}</div></div>)}</div>{dayDetails.hasMore && <button type="button" disabled={dayDetails.loading} onClick={() => void loadMoreDay()} className="m-3 flex h-10 w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-xl border border-[#b9d6ed] bg-white text-xs font-bold text-[#0060B8]">{dayDetails.loading && <LoaderCircle className="animate-spin" size={15} />}تحميل المزيد</button>}</> : <div className="p-6 text-center text-xs text-[#75818e]">لا توجد تفاصيل لهذا اليوم.</div>}</section> : null;

  const content = <>{captainDetailsSection}<section className="mt-6"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-base font-bold">سجل الأرباح حسب التاريخ</h2><p className="mt-1 text-[10px] text-[#66727e]">الفترات تُجمّع محلياً من سجل الأيام.</p></div><span className="rounded-full bg-[#eae8ff] px-2.5 py-1 text-xs font-bold text-violet-700">{periodRows.length} فترات</span></div><div className="mb-3 grid grid-cols-3 gap-2 rounded-2xl border border-[#d3e3f0] bg-white p-1.5"><button type="button" onClick={() => setPeriod('daily')} className={`h-10 rounded-xl text-xs font-extrabold transition-colors ${period === 'daily' ? 'bg-[#0060B8] text-white' : 'text-[#66727e] hover:bg-[#f3f8fc]'}`}>يومي</button><button type="button" onClick={() => setPeriod('weekly')} className={`h-10 rounded-xl text-xs font-extrabold transition-colors ${period === 'weekly' ? 'bg-[#0060B8] text-white' : 'text-[#66727e] hover:bg-[#f3f8fc]'}`}>أسبوعي</button><button type="button" onClick={() => setPeriod('monthly')} className={`h-10 rounded-xl text-xs font-extrabold transition-colors ${period === 'monthly' ? 'bg-[#0060B8] text-white' : 'text-[#66727e] hover:bg-[#f3f8fc]'}`}>شهري</button></div>{history.loading && !history.rows.length ? <div className="flex min-h-28 items-center justify-center gap-2 rounded-2xl border border-dashed border-[#c7dae8] text-xs font-bold text-[#0060B8]"><LoaderCircle className="animate-spin" size={18} />جارٍ تحميل سجل الأرباح...</div> : history.error && !history.rows.length ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-xs font-bold text-red-700"><p>{history.error}</p><button type="button" onClick={() => void loadHistory()} className="mt-3 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs">إعادة المحاولة</button></div> : history.rows.length ? <div className="space-y-2">{periodRows.map((day) => <button type="button" key={day.key} onClick={period === 'daily' ? () => void selectDay(day.days[0]) : undefined} className={`w-full rounded-2xl border bg-white p-3 text-right shadow-[0_2px_8px_rgba(0,72,141,0.05)] transition-colors ${period === 'daily' && dayDetails.day === day.days[0] ? 'border-[#0060B8] bg-[#f4faff]' : 'border-[#d3e3f0] hover:bg-[#f8fbfe]'}`}><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eae8ff] text-violet-700"><CalendarDays size={17} /></span><span><strong className="block text-sm">{day.label}</strong><span className="mt-1 block text-[10px] text-[#66727e]">{day.orderCount} طلبات · {day.days.length} أيام</span></span></span><span className="text-left"><strong className="block text-sm text-[#0060B8]">{formatFinanceMoney(day.grossTotal)}</strong><span className="mt-1 block text-[10px] font-bold text-violet-700">الشركة: {formatFinanceMoney(day.companyTotal)}</span></span></div></button>)}{history.loading && history.rows.length > 0 && period !== 'daily' && <div className="flex items-center justify-center gap-2 rounded-xl bg-[#f8fbfe] px-3 py-2 text-[10px] font-bold text-[#0060B8]"><LoaderCircle className="animate-spin" size={14} />جارٍ تحميل كامل الفترة...</div>}{period === 'daily' && history.hasMore && <button type="button" disabled={history.loading} onClick={() => void loadHistory(true)} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#b9d6ed] bg-white text-xs font-bold text-[#0060B8]">{history.loading && <LoaderCircle className="animate-spin" size={15} />}تحميل أيام أقدم</button>}</div> : <div className="rounded-2xl border border-dashed border-[#c7dae8] bg-white/70 px-4 py-8 text-center text-xs text-[#75818e]">لا توجد أرباح شركة مسجلة حالياً.</div>}</section>{dayDetailsSection}</>;

  return <div className="min-h-screen bg-[#eaf5ff] text-[#1c1b1b]" dir="rtl"><div className="relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[#f0f7ff] shadow-[0_0_40px_rgba(0,72,141,0.08)]"><header className="fixed top-0 right-0 left-0 z-30 mx-auto flex h-16 w-full max-w-[453px] items-center justify-between bg-[#0060B8] px-5 text-white shadow-[0_4px_18px_rgba(0,96,184,0.28)]"><button type="button" aria-label="العودة إلى أجور الكباتن" onClick={() => setLocation('/wages')} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 active:scale-[0.96]"><ArrowRight size={22} strokeWidth={2.4} /></button><div className="flex items-center gap-2"><div className="text-left"><p className="text-[11px] leading-4 text-[#dbeaff]">الأجور وحساب الشركة</p><h1 className="text-[19px] font-bold">{fullHistory ? 'سجل أرباح الشركة الكامل' : 'أجور الشركة'}</h1></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><Store size={21} /></span></div></header><main className="px-5 pt-[84px] pb-24"><section className="rounded-2xl border border-[#d3e3f0] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="flex items-start justify-between gap-3"><div><h2 className="text-[18px] font-bold">{fullHistory ? 'سجل أرباح الشركة الكامل' : 'سجل أرباح الشركة'}</h2><p className="mt-1 text-xs leading-5 text-[#58616b]">أرباح الشركة المجمّعة من كل الكباتن حسب التاريخ.</p></div><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700"><WalletCards size={23} /></span></div></section>{isInitialLoading ? <section className="mt-4 flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-[#dbe7f2] bg-white text-sm font-bold text-[#0060B8]"><LoaderCircle className="animate-spin" size={20} />جارٍ تحميل الملخص...</section> : readError || history.error && !history.rows.length ? <section className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-center"><p className="text-sm text-[#ba1a1a]">{readError || history.error}</p><button type="button" onClick={() => void retryAll()} className="mx-auto mt-3 flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-xs font-bold text-[#ba1a1a]"><RefreshCw size={15} />إعادة المحاولة</button></section> : snapshot.captains.length === 0 && snapshot.totals.grossTotal === 0 ? <section className="mt-4 rounded-2xl border border-dashed border-[#c7dae8] bg-white/70 px-4 py-10 text-center text-sm text-[#75818e]">لا توجد أجور شركة مسجلة حالياً.</section> : <><section className="mt-4 grid grid-cols-2 gap-3"><article className="rounded-2xl border border-blue-100 bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-100 text-[#0060B8]"><Banknote size={19} /></span><p className="mt-3 text-xs font-bold text-[#4f5d6b]">الأجور الكلية</p><strong className="mt-1 block text-[18px] text-[#0060B8]">{formatFinanceMoney(snapshot.totals.grossTotal)}</strong></article><article className="rounded-2xl border border-violet-100 bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-100 text-violet-700"><CircleDollarSign size={19} /></span><p className="mt-3 text-xs font-bold text-[#4f5d6b]">صافي ربح الشركة</p><strong className="mt-1 block text-[18px] text-violet-700">{formatFinanceMoney(snapshot.totals.companyTotal)}</strong></article></section>{content}</>}</main><AdminBottomNav active="wages" /></div></div>;
}
