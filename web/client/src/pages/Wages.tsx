/** Design reminder — Corporate Modern Mobile Operations: RTL captain wage ledgers, #0060B8 hierarchy, scanable white cards, Cairo typography. */
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, CalendarDays, CircleDollarSign, Clock3, HandCoins, LoaderCircle, Package, RefreshCw, Store, Truck, WalletCards } from 'lucide-react';
import { toast } from 'sonner';

import { WagePeriodControls } from '@/components/WagePeriodControls';
import { AdminBottomNav } from '@/components/AdminBottomNav';
import { formatFinanceMoney } from '@/features/admin/financeMappers';
import { formatFinanceDay, type FinancePeriod } from '@/features/admin/financePeriod';
import { getFinanceErrorMessage } from '@/features/admin/useAdminFinanceData';
import { useAdminFinanceData } from '@/features/admin/useAdminFinanceData';
import { useCaptainWagePeriodSummary } from '@/features/admin/useCaptainWagePeriodSummary';

type WagesProps = { params?: Record<number, string | undefined> };

function formatPeriodLabel(period: FinancePeriod, periodStart: string, periodEnd: string) {
  if (period === 'daily') return formatFinanceDay(periodStart);
  if (period === 'weekly') return `من ${formatFinanceDay(periodStart)} إلى ${formatFinanceDay(periodEnd)}`;
  return new Intl.DateTimeFormat('ar-SY', { timeZone: 'Asia/Damascus', month: 'long', year: 'numeric' }).format(new Date(`${periodStart}T12:00:00Z`));
}


export default function Wages(_: WagesProps) {
  const [, setLocation] = useLocation();
  const { recordPartialPayout, payoutInFlightCaptainId } = useAdminFinanceData();
  const { period, rows: periodRows, loading: isInitialLoading, error: readError, hasMore, load, loadMore } = useCaptainWagePeriodSummary();
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [selectedPeriodKey, setSelectedPeriodKey] = useState('');

  const periodOptions = useMemo(() => {
    const options = new Map<string, { key: string; label: string }>();
    for (const row of periodRows) {
      if (!options.has(row.periodStart)) options.set(row.periodStart, {
        key: row.periodStart,
        label: formatPeriodLabel(period, row.periodStart, row.periodEnd),
      });
    }
    return Array.from(options.values());
  }, [period, periodRows]);
  const periodKey = periodOptions.some((option) => option.key === selectedPeriodKey) ? selectedPeriodKey : periodOptions[0]?.key ?? '';
  const selectedPeriodRows = useMemo(() => periodRows.filter((row) => row.periodStart === periodKey), [periodKey, periodRows]);
  const periodLabel = periodOptions.find((option) => option.key === periodKey)?.label ?? '';
  const periodTotals = useMemo(() => selectedPeriodRows.reduce((totals, row) => ({
    captainNetTotal: totals.captainNetTotal + row.captainNetTotal,
    paidTotal: totals.paidTotal + row.paidTotal,
    unpaidTotal: totals.unpaidTotal + row.unpaidTotal,
    orderCount: totals.orderCount + row.orderCount,
  }), { captainNetTotal: 0, paidTotal: 0, unpaidTotal: 0, orderCount: 0 }), [selectedPeriodRows]);
  const captainLedgers = selectedPeriodRows;

  useEffect(() => {
    if (periodKey !== selectedPeriodKey) setSelectedPeriodKey(periodKey);
  }, [periodKey, selectedPeriodKey]);

  const changePeriod = (nextPeriod: FinancePeriod) => {
    setSelectedPeriodKey('');
    void load(nextPeriod);
  };

  const registerCaptainPayout = async (captainId: string, unpaidTotal: number) => {
    const rawAmount = paymentInputs[captainId]?.trim() ?? '';
    const amount = Number(rawAmount);
    if (!rawAmount || !Number.isFinite(amount) || amount <= 0) {
      toast.error('أدخل مبلغ دفعة موجباً.');
      return;
    }
    if (amount > unpaidTotal) {
      toast.error('قيمة الدفعة أكبر من صافي الأجر المتبقي.');
      return;
    }

    try {
      const payout = await recordPartialPayout(captainId, amount);
      setPaymentInputs((current) => ({ ...current, [captainId]: '' }));
      toast.success(`تم تسجيل دفعة بقيمة ${formatFinanceMoney(payout.total_amount)}.`);
      void load(period);
    } catch (error) {
      console.error('Captain partial payout failed.', error);
      toast.error(getFinanceErrorMessage(error, 'تعذر تسجيل دفعة الكابتن.'));
    }
  };

  const content = (
    <>
      <section className="mt-4"><WagePeriodControls period={period} periodKey={periodKey} options={periodOptions} onPeriodChange={changePeriod} onPeriodKeyChange={setSelectedPeriodKey} /></section>
      <section className="mt-4 grid grid-cols-2 gap-3">
        <article className="rounded-2xl border border-emerald-100 bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><CircleDollarSign size={19} /></span><p className="mt-3 text-xs font-bold text-[#4f5d6b]">صافي الكباتن</p><strong className="mt-1 block text-[18px] text-emerald-700">{formatFinanceMoney(periodTotals.captainNetTotal)}</strong><span className="mt-1 text-[10px] text-emerald-700">من ملخص {periodLabel || 'الفترة المختارة'}</span></article>
        <article className="rounded-2xl border border-amber-100 bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700"><HandCoins size={19} /></span><p className="mt-3 text-xs font-bold text-[#4f5d6b]">دفعات مسلّمة</p><strong className="mt-1 block text-[18px] text-amber-700">{formatFinanceMoney(periodTotals.paidTotal)}</strong><span className="mt-1 text-[10px] text-amber-700">ضمن الفترة المختارة</span></article>
        <article className="rounded-2xl border border-red-100 bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-red-100 text-red-700"><Clock3 size={19} /></span><p className="mt-3 text-xs font-bold text-[#4f5d6b]">المتبقي للكباتن</p><strong className="mt-1 block text-[18px] text-red-700">{formatFinanceMoney(periodTotals.unpaidTotal)}</strong><span className="mt-1 text-[10px] text-red-700">من ملخص الأجور الحي</span></article>
        <article className="rounded-2xl border border-blue-100 bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-100 text-[#0060B8]"><Package size={19} /></span><p className="mt-3 text-xs font-bold text-[#4f5d6b]">طلبات الفترة</p><strong className="mt-1 block text-[18px] text-[#0060B8]">{periodTotals.orderCount}</strong><span className="mt-1 text-[10px] text-[#0060B8]">{periodLabel || 'لا توجد بيانات'}</span></article>
      </section>
      <button type="button" onClick={() => setLocation('/company-wages')} className="mt-3 flex h-[68px] w-full items-center justify-between rounded-2xl border border-[#a7d8ff] bg-[#eaf6ff] px-4 text-right shadow-[0_3px_12px_rgba(0,96,184,0.12)] transition-transform active:scale-[0.98]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0060B8] text-white"><Store size={21} /></span><span className="min-w-0 flex-1 pr-3"><strong className="block text-[15px] text-[#00569f]">واجهة أجور الشركة</strong><span className="mt-1 block text-[11px] text-[#4f6f88]">كشف كامل بالتاريخ، الأجور الكلية، وصافي الربح</span></span><ArrowRight className="rotate-180 text-[#0060B8]" size={20} /></button>
      <section className="mt-6"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold">سجلات الكباتن — {periodLabel || 'الفترة المختارة'}</h2><span className="rounded-full bg-[#dbeeff] px-2.5 py-1 text-xs font-bold text-[#0060B8]">{captainLedgers.length} كباتن</span></div>{captainLedgers.length === 0 ? <div className="rounded-2xl border border-dashed border-[#c7dae8] bg-white/70 px-4 py-8 text-center text-sm text-[#75818e]">لا توجد أجور مسجلة ضمن {periodLabel || 'الفترة المختارة'}؛ تظهر الإجماليات صفراً.</div> : <div className="space-y-4">{captainLedgers.map((captain) => {
        const isPaying = payoutInFlightCaptainId === captain.captainId;
        return <article key={captain.captainId} className="overflow-hidden rounded-2xl border border-[#d3e3f0] bg-white shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="flex items-center justify-between gap-3 border-b border-[#e1ebf3] bg-[#f8fbfe] p-4"><div className="flex items-center gap-2.5"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#e5edf3] text-sm font-bold text-[#53616f]">{captain.initial}</span><div><h3 className="text-[15px] font-bold">{captain.captainName}</h3><p className="mt-0.5 text-[11px] text-[#66727e]">{captain.orderCount} طلبات في هذه الفترة</p></div></div><span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">صافي حي</span></div><div className="grid grid-cols-2 gap-px bg-[#e1ebf3]"><div className="bg-white p-3"><span className="text-[10px] font-bold text-[#66727e]">مجموع الأجور</span><strong className="mt-1 block text-sm text-[#1c1b1b]">{formatFinanceMoney(captain.grossTotal)}</strong></div><div className="bg-white p-3"><span className="text-[10px] font-bold text-[#66727e]">صافي الكابتن</span><strong className="mt-1 block text-sm text-emerald-700">{formatFinanceMoney(captain.captainNetTotal)}</strong></div></div><div className="grid grid-cols-2 gap-px border-b border-[#e1ebf3] bg-[#e1ebf3]"><div className="bg-white p-3"><span className="text-[10px] font-bold text-[#66727e]">المدفوع</span><strong className="mt-1 block text-sm text-amber-700">{formatFinanceMoney(captain.paidTotal)}</strong></div><div className="bg-white p-3"><span className="text-[10px] font-bold text-[#66727e]">المتبقي</span><strong className={`mt-1 block text-sm ${captain.unpaidTotal > 0 ? 'text-[#ba1a1a]' : 'text-emerald-700'}`}>{formatFinanceMoney(captain.unpaidTotal)}</strong></div></div><button type="button" onClick={() => setLocation(`/wages/captain/${captain.captainId}`)} className="mx-3 my-3 flex h-11 w-[calc(100%-1.5rem)] items-center justify-between rounded-xl border border-[#a7d8ff] bg-[#eaf6ff] px-3.5 text-right text-xs font-extrabold text-[#00569f] shadow-[0_2px_8px_rgba(0,96,184,0.1)] transition-transform hover:bg-[#def1ff] active:scale-[0.98]"><span className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#0060B8] text-white"><WalletCards size={15} /></span><span>فتح كشف الحساب</span></span><ArrowRight className="rotate-180 text-[#0060B8]" size={17} /></button><div className="border-t border-[#e1ebf3] bg-[#fbfdff] p-4"><div className="flex items-end gap-2"><label className="min-w-0 flex-1"><span className="mb-1.5 block text-xs font-bold text-[#4f5d6b]">تسليم دفعة للكابتن</span><input type="number" min="0.01" step="0.01" inputMode="decimal" value={paymentInputs[captain.captainId] ?? ''} onChange={(event) => setPaymentInputs((current) => ({ ...current, [captain.captainId]: event.target.value }))} disabled={isPaying || captain.unpaidTotal <= 0} placeholder="المبلغ المسلّم" className="h-10 w-full rounded-xl border border-[#c9d9e7] bg-white px-3 text-sm text-[#1c1b1b] placeholder:text-[#8a98a6] focus:border-[#0060B8] focus:outline-none focus:ring-2 focus:ring-[#0060B8]/15 disabled:cursor-not-allowed disabled:opacity-60" /></label><button type="button" disabled={isPaying || captain.unpaidTotal <= 0} onClick={() => void registerCaptainPayout(captain.captainId, captain.unpaidTotal)} className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0060B8] px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">{isPaying && <LoaderCircle className="animate-spin" size={15} />}{isPaying ? 'جارٍ التسجيل...' : 'تسليم الدفعة'}</button></div></div></article>;
      })}</div>}{hasMore && <button type="button" disabled={isInitialLoading} onClick={() => void loadMore()} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#b9d6ed] bg-white text-xs font-bold text-[#0060B8] disabled:cursor-not-allowed disabled:opacity-60"><CalendarDays size={15} />تحميل فترات أقدم</button>}</section>
    </>
  );

  return <div className="min-h-screen bg-[#eaf5ff] text-[#1c1b1b]" dir="rtl"><div className="relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[#f0f7ff] shadow-[0_0_40px_rgba(0,72,141,0.08)]"><header className="fixed top-0 right-0 left-0 z-30 mx-auto flex h-16 w-full max-w-[453px] items-center justify-between bg-[#0060B8] px-5 text-white shadow-[0_4px_18px_rgba(0,96,184,0.28)]"><button type="button" aria-label="العودة إلى الرئيسية" onClick={() => setLocation('/')} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 active:scale-[0.96]"><ArrowRight size={22} strokeWidth={2.4} /></button><div className="flex items-center gap-2"><div className="text-left"><p className="text-[11px] leading-4 text-[#dbeaff]">الأجور والدفعات</p><h1 className="text-[19px] font-bold leading-6">أجور الكباتن</h1></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><WalletCards size={21} /></span></div></header><main className="px-5 pt-[84px] pb-24"><section className="rounded-2xl border border-[#d3e3f0] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="flex items-start justify-between gap-3"><div><h2 className="text-[18px] font-bold">سجل أجور الكباتن</h2><p className="mt-1 text-xs leading-5 text-[#58616b]">كل كابتن لديه سجل طلبات مستقل مع التاريخ والوقت وحصيلته الصافية.</p></div><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><Truck size={23} /></span></div></section>{isInitialLoading ? <section className="mt-4 flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-[#dbe7f2] bg-white text-sm font-bold text-[#0060B8]"><LoaderCircle className="animate-spin" size={20} />جارٍ تحميل الأجور...</section> : readError ? <section className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-center"><p className="text-sm text-[#ba1a1a]">{readError}</p><button type="button" onClick={() => void load(period)} className="mx-auto mt-3 flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-xs font-bold text-[#ba1a1a]"><RefreshCw size={15} />إعادة المحاولة</button></section> : content}</main><AdminBottomNav active="wages" /></div></div>;
}
