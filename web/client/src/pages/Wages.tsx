/**
 * Design reminder — Corporate Modern Mobile Operations:
 * Keep the captain wages screen an RTL, mobile-first summary workspace; detailed ledger rows live only in the captain statement view.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, CircleDollarSign, ClipboardList, HandCoins, LoaderCircle, RefreshCw, Store, Truck, WalletCards } from 'lucide-react';
import { toast } from 'sonner';

import { WagePeriodControls } from '@/components/WagePeriodControls';
import { AdminBottomNav } from '@/components/AdminBottomNav';
import { formatFinanceMoney } from '@/features/admin/financeMappers';
import { filterFinanceRows, firstFinancePeriodKey, getFinancePeriodOptions, type FinancePeriod } from '@/features/admin/financePeriod';
import { useAdminFinanceData, getFinanceErrorMessage } from '@/features/admin/useAdminFinanceData';

type WagesProps = { params?: Record<number, string | undefined> };

export default function Wages(_: WagesProps) {
  const [, setLocation] = useLocation();
  const { snapshot, isInitialLoading, readError, reload, recordPartialPayout, payoutInFlightCaptainId } = useAdminFinanceData();
  const [period, setPeriod] = useState<FinancePeriod>('daily');
  const [periodKey, setPeriodKey] = useState('');
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});

  const periodOptions = useMemo(() => getFinancePeriodOptions(period, snapshot.allRows), [period, snapshot.allRows]);

  useEffect(() => {
    if (!periodOptions.some((option) => option.key === periodKey)) {
      setPeriodKey(periodOptions[0]?.key ?? '');
    }
  }, [periodKey, periodOptions]);

  const periodRows = useMemo(
    () => filterFinanceRows(snapshot.allRows, period, periodKey),
    [period, periodKey, snapshot.allRows],
  );
  const periodLabel = periodOptions.find((option) => option.key === periodKey)?.label ?? '';
  const captainLedgers = useMemo(() => snapshot.captains.map((captain) => {
    const rows = filterFinanceRows(captain.rows, period, periodKey);
    return {
      ...captain,
      rows,
      orderCount: rows.length,
      grossTotal: rows.reduce((sum, row) => sum + row.grossFee, 0),
      captainNetTotal: rows.reduce((sum, row) => sum + row.captainAmount, 0),
      paidTotal: rows.reduce((sum, row) => sum + row.paidAmount, 0),
      unpaidTotal: rows.reduce((sum, row) => sum + row.unpaidAmount, 0),
    };
  }), [period, periodKey, snapshot.captains]);

  const changePeriod = (nextPeriod: FinancePeriod) => {
    setPeriod(nextPeriod);
    setPeriodKey(firstFinancePeriodKey(nextPeriod, snapshot.allRows));
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
    } catch (error) {
      console.error('Captain partial payout failed.', error);
      toast.error(getFinanceErrorMessage(error, 'تعذر تسجيل دفعة الكابتن.'));
    }
  };

  const content = (
    <>
      <section className="mt-4"><WagePeriodControls period={period} periodKey={periodKey} rows={snapshot.allRows} onPeriodChange={changePeriod} onPeriodKeyChange={setPeriodKey} /></section>
      <section className="mt-4 grid grid-cols-2 gap-3">
        <article className="rounded-2xl border border-emerald-100 bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><CircleDollarSign size={19} /></span><p className="mt-3 text-xs font-bold text-[#4f5d6b]">صافي الكباتن</p><strong className="mt-1 block text-[18px] text-emerald-700">{formatFinanceMoney(snapshot.totals.captainNetTotal)}</strong><span className="mt-1 text-[10px] text-emerald-700">من سجل الأجور الحي</span></article>
        <article className="rounded-2xl border border-amber-100 bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700"><HandCoins size={19} /></span><p className="mt-3 text-xs font-bold text-[#4f5d6b]">دفعات مسلّمة</p><strong className="mt-1 block text-[18px] text-amber-700">{formatFinanceMoney(snapshot.totals.paidTotal)}</strong><span className="mt-1 text-[10px] text-amber-700">مسجلة في النظام</span></article>
      </section>
      <button type="button" onClick={() => setLocation('/company-wages')} className="mt-3 flex h-[68px] w-full items-center justify-between rounded-2xl border border-[#a7d8ff] bg-[#eaf6ff] px-4 text-right shadow-[0_3px_12px_rgba(0,96,184,0.12)] transition-transform active:scale-[0.98]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0060B8] text-white"><Store size={21} /></span><span className="min-w-0 flex-1 pr-3"><strong className="block text-[15px] text-[#00569f]">واجهة أجور الشركة</strong><span className="mt-1 block text-[11px] text-[#4f6f88]">كشف كامل بالتاريخ، الأجور الكلية، وصافي الربح</span></span><ArrowRight className="rotate-180 text-[#0060B8]" size={20} /></button>
      <section className="mt-6"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold">ملخصات الكباتن — {periodLabel}</h2><span className="rounded-full bg-[#dbeeff] px-2.5 py-1 text-xs font-bold text-[#0060B8]">{periodRows.length} طلبات</span></div><div className="space-y-4">{captainLedgers.map((captain) => {
        const isPaying = payoutInFlightCaptainId === captain.captainId;
        return <article key={captain.captainId} className="overflow-hidden rounded-2xl border border-[#d3e3f0] bg-white shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="flex items-center justify-between gap-3 border-b border-[#e1ebf3] bg-[#f8fbfe] p-4"><div className="flex items-center gap-2.5"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#e5edf3] text-sm font-bold text-[#53616f]">{captain.initial}</span><div><h3 className="text-[15px] font-bold">{captain.captainName}</h3><p className="mt-0.5 text-[11px] text-[#66727e]">{captain.orderCount} طلبات في هذه الفترة</p></div></div><span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">صافي حي</span></div><div className="grid grid-cols-2 gap-px bg-[#e1ebf3]"><div className="bg-white p-3"><span className="text-[10px] font-bold text-[#66727e]">مجموع الأجور</span><strong className="mt-1 block text-sm text-[#1c1b1b]">{formatFinanceMoney(captain.grossTotal)}</strong></div><div className="bg-white p-3"><span className="text-[10px] font-bold text-[#66727e]">صافي الكابتن</span><strong className="mt-1 block text-sm text-emerald-700">{formatFinanceMoney(captain.captainNetTotal)}</strong></div><div className="bg-white p-3"><span className="text-[10px] font-bold text-[#66727e]">تم تسليمه</span><strong className="mt-1 block text-sm text-[#0060B8]">{formatFinanceMoney(captain.paidTotal)}</strong></div><div className="bg-white p-3"><span className="text-[10px] font-bold text-[#66727e]">المتبقي</span><strong className={`mt-1 block text-sm ${captain.unpaidTotal > 0 ? 'text-[#ba1a1a]' : 'text-emerald-700'}`}>{captain.unpaidTotal > 0 ? formatFinanceMoney(captain.unpaidTotal) : 'مكتمل'}</strong></div></div><div className="border-t border-[#e1ebf3] bg-[#fbfdff] p-4"><button type="button" onClick={() => setLocation(`/wages/captain/${captain.captainId}`)} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#a8c8ff] bg-[#eef6ff] text-xs font-bold text-[#0060B8] transition-colors hover:bg-[#e2f1ff] active:scale-[0.98]"><ClipboardList size={16} />فتح كشف الحساب</button><div className="mt-4 flex items-end gap-2"><label className="min-w-0 flex-1"><span className="mb-1.5 block text-xs font-bold text-[#4f5d6b]">تسليم دفعة للكابتن</span><input type="number" min="0.01" step="0.01" inputMode="decimal" value={paymentInputs[captain.captainId] ?? ''} onChange={(event) => setPaymentInputs((current) => ({ ...current, [captain.captainId]: event.target.value }))} disabled={isPaying || captain.unpaidTotal <= 0} placeholder="المبلغ المسلّم" className="h-10 w-full rounded-xl border border-[#c9d9e7] bg-white px-3 text-sm text-[#1c1b1b] placeholder:text-[#8a98a6] focus:border-[#0060B8] focus:outline-none focus:ring-2 focus:ring-[#0060B8]/15 disabled:cursor-not-allowed disabled:opacity-60" /></label><button type="button" disabled={isPaying || captain.unpaidTotal <= 0} onClick={() => void registerCaptainPayout(captain.captainId, captain.unpaidTotal)} className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0060B8] px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">{isPaying && <LoaderCircle className="animate-spin" size={15} />}{isPaying ? 'جارٍ التسجيل...' : 'تسليم الدفعة'}</button></div></div></article>;
      })}</div></section>
    </>
  );

  return <div className="min-h-screen bg-[#eaf5ff] text-[#1c1b1b]" dir="rtl"><div className="relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[#f0f7ff] shadow-[0_0_40px_rgba(0,72,141,0.08)]"><header className="fixed top-0 right-0 left-0 z-30 mx-auto flex h-16 w-full max-w-[453px] items-center justify-between bg-[#0060B8] px-5 text-white shadow-[0_4px_18px_rgba(0,96,184,0.28)]"><button type="button" aria-label="العودة إلى الرئيسية" onClick={() => setLocation('/')} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 active:scale-[0.96]"><ArrowRight size={22} strokeWidth={2.4} /></button><div className="flex items-center gap-2"><div className="text-left"><p className="text-[11px] leading-4 text-[#dbeaff]">الأجور والدفعات</p><h1 className="text-[19px] font-bold leading-6">أجور الكباتن</h1></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><WalletCards size={21} /></span></div></header><main className="px-5 pt-[84px] pb-24"><section className="rounded-2xl border border-[#d3e3f0] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="flex items-start justify-between gap-3"><div><h2 className="text-[18px] font-bold">سجل أجور الكباتن</h2><p className="mt-1 text-xs leading-5 text-[#58616b]">ملخص لكل كابتن مع وصول مباشر إلى كشف الحساب التفصيلي.</p></div><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><Truck size={23} /></span></div></section>{isInitialLoading ? <section className="mt-4 flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-[#dbe7f2] bg-white text-sm font-bold text-[#0060B8]"><LoaderCircle className="animate-spin" size={20} />جارٍ تحميل الأجور...</section> : readError ? <section className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-center"><p className="text-sm text-[#ba1a1a]">{readError}</p><button type="button" onClick={() => void reload()} className="mx-auto mt-3 flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-xs font-bold text-[#ba1a1a]"><RefreshCw size={15} />إعادة المحاولة</button></section> : snapshot.allRows.length === 0 ? <section className="mt-4 rounded-2xl border border-dashed border-[#c7dae8] bg-white/70 px-4 py-10 text-center text-sm text-[#75818e]">لا توجد أجور مسجلة حالياً.</section> : content}</main><AdminBottomNav active="wages" /></div></div>;
}
