/**
 * Design reminder — Corporate Modern Mobile Operations:
 * RTL captain statement with a blue operational header, scan-friendly ledger cards, and the existing finance controls unchanged.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { ArrowRight, CalendarDays, CircleCheckBig, Clock3, HandCoins, LoaderCircle, Package, RefreshCw, WalletCards } from 'lucide-react';
import { toast } from 'sonner';

import { AdminBottomNav } from '@/components/AdminBottomNav';
import { WagePeriodControls } from '@/components/WagePeriodControls';
import { compareFinanceLedgerRows, formatFinanceMoney } from '@/features/admin/financeMappers';
import { filterFinanceRows, firstFinancePeriodKey, getFinancePeriodOptions, type FinancePeriod } from '@/features/admin/financePeriod';
import type { FinanceLedgerRow } from '@/features/admin/financeTypes';
import { getFinanceErrorMessage, useAdminFinanceData } from '@/features/admin/useAdminFinanceData';
import { useCaptainWagePeriodSummary } from '@/features/admin/useCaptainWagePeriodSummary';
import { useCaptainOrderStops } from '@/features/captain/useCaptainOrderStops';

const emptyRows: FinanceLedgerRow[] = [];
type PaymentFilter = 'all' | 'remaining' | 'paid';

function formatDamascusDate(value: string) {
  return new Date(value).toLocaleDateString('ar-SY', {
    timeZone: 'Asia/Damascus',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDamascusTime(value: string) {
  return new Date(value).toLocaleTimeString('ar-SY', {
    timeZone: 'Asia/Damascus',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CaptainWageDetail() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/wages/captain/:captainId');
  const captainId = params?.captainId ?? '';
  const { snapshot, isInitialLoading, readError, reload, loadCaptainDetails, captainDetailsCache, recordPartialPayout, payoutInFlightCaptainId } = useAdminFinanceData();
  const [period, setPeriod] = useState<FinancePeriod>('daily');
  const { rows: periodSummaryRows, loading: periodSummaryLoading, error: periodSummaryError, load: loadPeriodSummary } = useCaptainWagePeriodSummary(captainId);
  const [periodKey, setPeriodKey] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const { cache: orderStopsByOrderId, loading: stopsLoadingByOrderId, errors: stopsErrorByOrderId, toggle: toggleOrderStopsRequest } = useCaptainOrderStops();

  const captain = useMemo(
    () => snapshot.captains.find((item) => item.captainId === captainId),
    [captainId, snapshot.captains],
  );
  const captainDetails = captainDetailsCache.get(captainId);
  const captainRows = captainDetails?.status === 'loaded' ? captainDetails.rows : emptyRows;
  const detailsLoading = captainDetails?.status === 'loading';
  const detailsError = captainDetails?.status === 'error' ? captainDetails.message : null;
  useEffect(() => {
    if (captainId && captain) void loadCaptainDetails(captainId);
  }, [captain, captainId, loadCaptainDetails]);

  const toggleOrderStops = async (orderId: string) => {
    const nextExpandedOrderId = await toggleOrderStopsRequest(orderId, expandedOrderId);
    setExpandedOrderId(nextExpandedOrderId);
  };

  const periodSummary = periodSummaryRows[0];
  const periodOptions = useMemo(() => getFinancePeriodOptions(period, captainRows), [captainRows, period]);

  useEffect(() => {
    const nextKey = periodSummary?.periodStart ?? periodOptions[0]?.key ?? '';
    if (nextKey !== periodKey) setPeriodKey(nextKey);
  }, [periodKey, periodOptions, periodSummary?.periodStart]);

  const rows = useMemo(
    () => [...filterFinanceRows(captainRows, period, periodKey)].sort(compareFinanceLedgerRows),
    [captainRows, period, periodKey],
  );
  const periodLabel = periodOptions.find((option) => option.key === periodKey)?.label ?? '';
  const visibleRows = useMemo(() => rows.filter((row) => paymentFilter === 'all' || (paymentFilter === 'paid' ? row.isFullyPaid : !row.isFullyPaid)), [paymentFilter, rows]);
  const totals = useMemo(() => ({
    orderCount: periodSummary?.orderCount ?? rows.length,
    grossTotal: periodSummary?.grossTotal ?? rows.reduce((sum, row) => sum + row.grossFee, 0),
    captainNetTotal: periodSummary?.captainNetTotal ?? rows.reduce((sum, row) => sum + row.captainAmount, 0),
    paidTotal: periodSummary?.paidTotal ?? rows.reduce((sum, row) => sum + row.paidAmount, 0),
    unpaidTotal: periodSummary?.unpaidTotal ?? rows.reduce((sum, row) => sum + row.unpaidAmount, 0),
  }), [periodSummary, rows]);

  const changePeriod = (nextPeriod: FinancePeriod) => {
    setPeriod(nextPeriod);
    setPeriodKey('');
    void loadPeriodSummary(nextPeriod);
  };

  const registerPayout = async () => {
    const rawAmount = paymentAmount.trim();
    const amount = Number(rawAmount);
    if (!rawAmount || !Number.isFinite(amount) || amount <= 0) {
      toast.error('أدخل مبلغ دفعة موجباً.');
      return;
    }
    if (amount > totals.unpaidTotal) {
      toast.error('قيمة الدفعة أكبر من صافي الأجر المتبقي.');
      return;
    }

    try {
      const payout = await recordPartialPayout(captainId, amount);
      setPaymentAmount('');
      toast.success(`تم تسجيل دفعة بقيمة ${formatFinanceMoney(payout.total_amount)}.`);
    } catch (error) {
      console.error('Captain partial payout failed.', error);
      toast.error(getFinanceErrorMessage(error, 'تعذر تسجيل دفعة الكابتن.'));
    }
  };

  const isPaying = payoutInFlightCaptainId === captainId;
  const detailContent = captain ? <>
    <section className="mt-4 overflow-hidden rounded-2xl border border-[#d3e3f0] bg-white shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="flex items-center gap-3 bg-[#f8fbfe] p-4"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#e5edf3] text-base font-bold text-[#53616f]">{captain.initial}</span><div className="min-w-0 flex-1"><h2 className="truncate text-[17px] font-bold">{captain.captainName}</h2><p className="mt-0.5 text-[11px] text-[#66727e]">{periodLabel || 'الفترة المختارة'} — {visibleRows.length} طلبات</p></div><span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">كشف حي</span></div><div className="grid grid-cols-2 gap-px border-t border-[#e1ebf3] bg-[#e1ebf3]"><div className="bg-white p-3"><span className="text-[10px] font-bold text-[#66727e]">مجموع الأجور</span><strong className="mt-1 block text-sm">{formatFinanceMoney(totals.grossTotal)}</strong></div><div className="bg-white p-3"><span className="text-[10px] font-bold text-[#66727e]">صافي الكابتن</span><strong className="mt-1 block text-sm text-emerald-700">{formatFinanceMoney(totals.captainNetTotal)}</strong></div></div></section>
    <section className="mt-4"><WagePeriodControls period={period} periodKey={periodKey} rows={captainRows} onPeriodChange={changePeriod} onPeriodKeyChange={setPeriodKey} /></section>
    <section className="mt-3 rounded-2xl border border-[#dbe7f2] bg-white p-2.5"><div className="grid grid-cols-3 gap-1.5" aria-label="فلتر حالة الدفع">{([{ id: 'all', label: 'الكل' }, { id: 'remaining', label: 'المتبقي' }, { id: 'paid', label: 'تم تسليمه' }] as const).map((item) => <button type="button" key={item.id} onClick={() => setPaymentFilter(item.id)} className={`h-9 rounded-xl text-[11px] font-bold ${paymentFilter === item.id ? 'bg-[#0060B8] text-white' : 'bg-[#f1f6fa] text-[#5b6a78]'}`}>{item.label}</button>)}</div></section>
    <section className="mt-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold">سجل الطلبات</h2><span className="rounded-full bg-[#dbeeff] px-2.5 py-1 text-xs font-bold text-[#0060B8]">{visibleRows.length} طلبات</span></div>{visibleRows.length ? <div className="overflow-hidden rounded-2xl border border-[#d3e3f0] bg-white shadow-[0_2px_8px_rgba(0,72,141,0.05)]">{visibleRows.map((row) => { const completed = row.status === 'completed'; const paid = row.isFullyPaid; const stops = orderStopsByOrderId.get(row.orderId) ?? []; const pickup = stops.find((stop) => stop.stop_type === 'pickup'); const destination = [...stops].reverse().find((stop) => stop.stop_type === 'delivery'); const expanded = expandedOrderId === row.orderId; const stopsLoading = stopsLoadingByOrderId.has(row.orderId); const stateColor = paid ? 'text-[#ba1a1a]' : 'text-emerald-700'; const stateBg = paid ? 'bg-red-50' : 'bg-emerald-50'; return <article key={row.financialLedgerId} className="border-b border-[#e7eef4] px-3.5 py-3 last:border-b-0"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2.5"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${stateBg} ${stateColor}`}><Package size={17} /></span><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="text-sm font-bold">طلب #{row.orderNumber}</h3><span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${stateBg} ${stateColor}`}>{paid ? 'مدفوع' : completed ? 'مستحق' : 'طلب كاذب'}</span></div><p className="mt-1 text-[10px] text-[#66727e]">{formatDamascusDate(row.completedAt)} · {formatDamascusTime(row.completedAt)}</p></div></div><div className="shrink-0 text-left"><strong className={`block text-xs ${stateColor}`}>{formatFinanceMoney(row.captainAmount)}</strong><span className={`mt-1 block text-[10px] font-bold ${stateColor}`}>{paid ? 'تم تسليمه' : `متبقي ${formatFinanceMoney(row.unpaidAmount)}`}</span></div></div><div className="mt-2 flex items-center justify-between border-t border-[#f0f4f7] pt-2 text-[10px]"><span className="text-[#66727e]">أجرة الطلب: {formatFinanceMoney(row.grossFee)}</span><span className={paid ? 'text-[#ba1a1a]' : 'text-emerald-700'}>{paid ? `مدفوع ${formatFinanceMoney(row.paidAmount)}` : 'غير مدفوع'}</span></div><div className="mt-3"><button type="button" onClick={() => void toggleOrderStops(row.orderId)} className="flex h-9 w-full items-center justify-center rounded-xl border border-[#b9d6ed] bg-[#f8fbfe] text-[10px] font-extrabold text-[#0060B8] active:scale-[0.98]">{expanded ? 'إخفاء المصدر والوجهة' : 'عرض المصدر والوجهة'}</button>{expanded && (stopsLoading ? <div className="mt-2 rounded-xl bg-[#f8fbfe] p-3 text-center text-[10px] font-bold text-[#0060B8]">جارٍ تحميل نقاط الطلب...</div> : stopsErrorByOrderId.get(row.orderId) ? <div className="mt-2 rounded-xl bg-red-50 p-3 text-center text-[10px] font-bold text-red-700">{stopsErrorByOrderId.get(row.orderId)}</div> : <div className="mt-2 grid grid-cols-2 gap-2"><div className="rounded-xl border border-[#dbe7f2] bg-[#f8fbfe] p-2.5"><span className="block text-[10px] font-bold text-[#0060B8]">المصدر</span><strong className="mt-1 block truncate text-[11px]">{pickup?.contact_name || 'غير متاح'}</strong><span className="mt-1 block truncate text-[10px] text-[#66727e]">{pickup?.contact_phone || '—'}</span><span className="mt-1 block line-clamp-2 text-[10px] leading-4 text-[#66727e]">{pickup?.address || '—'}</span></div><div className="rounded-xl border border-[#d7eadf] bg-[#f8fffa] p-2.5"><span className="block text-[10px] font-bold text-emerald-700">الوجهة</span><strong className="mt-1 block truncate text-[11px]">{destination?.contact_name || 'غير متاح'}</strong><span className="mt-1 block truncate text-[10px] text-[#66727e]">{destination?.contact_phone || '—'}</span><span className="mt-1 block line-clamp-2 text-[10px] leading-4 text-[#66727e]">{destination?.address || '—'}</span></div></div>)}</div>{row.latestPaidAt ? <p className="mt-1.5 flex items-center gap-1.5 text-[10px] leading-4 text-[#66727e]"><CalendarDays size={12} className="shrink-0 text-[#ba1a1a]" />دُفعت بتاريخ {formatDamascusDate(row.latestPaidAt)}، {formatDamascusTime(row.latestPaidAt)}</p> : null}</article>; })}</div> : <div className="rounded-2xl border border-dashed border-[#c7dae8] bg-white/70 px-4 py-10 text-center text-sm text-[#75818e]">لا توجد طلبات لهذا الكابتن ضمن الفترة المختارة.</div>}</section>
    <section className="mt-5 rounded-2xl border border-[#d3e3f0] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="mb-3 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-100 text-[#0060B8]"><HandCoins size={18} /></span><div><h2 className="text-sm font-bold">تسليم دفعة للكابتن</h2><p className="text-[11px] text-[#66727e]">المتبقي لهذه الفترة: {formatFinanceMoney(totals.unpaidTotal)}</p></div></div><div className="flex items-end gap-2"><label className="min-w-0 flex-1"><span className="mb-1.5 block text-xs font-bold text-[#4f5d6b]">مبلغ الدفعة</span><input type="number" min="0.01" step="0.01" inputMode="decimal" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} disabled={isPaying || totals.unpaidTotal <= 0} placeholder="المبلغ المسلّم" className="h-10 w-full rounded-xl border border-[#c9d9e7] bg-white px-3 text-sm text-[#1c1b1b] placeholder:text-[#8a98a6] focus:border-[#0060B8] focus:outline-none focus:ring-2 focus:ring-[#0060B8]/15 disabled:cursor-not-allowed disabled:opacity-60" /></label><button type="button" disabled={isPaying || totals.unpaidTotal <= 0} onClick={() => void registerPayout()} className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0060B8] px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">{isPaying && <LoaderCircle className="animate-spin" size={15} />}{isPaying ? 'جارٍ التسجيل...' : 'تسليم الدفعة'}</button></div>{totals.unpaidTotal <= 0 ? <p className="mt-3 text-center text-xs font-bold text-emerald-700">تم تسليم كامل مستحقات هذه الفترة.</p> : null}</section>
  </> : null;

  return <div className="min-h-screen bg-[#eaf5ff] text-[#1c1b1b]" dir="rtl"><div className="relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[#f0f7ff] shadow-[0_0_40px_rgba(0,72,141,0.08)]"><header className="fixed top-0 right-0 left-0 z-30 mx-auto flex h-16 w-full max-w-[453px] items-center justify-between bg-[#0060B8] px-5 text-white shadow-[0_4px_18px_rgba(0,96,184,0.28)]"><button type="button" aria-label="العودة إلى أجور الكباتن" onClick={() => setLocation('/wages')} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 active:scale-[0.96]"><ArrowRight size={22} strokeWidth={2.4} /></button><div className="flex items-center gap-2"><div className="text-left"><p className="text-[11px] leading-4 text-[#dbeaff]">الأجور والدفعات</p><h1 className="text-[19px] font-bold leading-6">كشف حساب الكابتن</h1></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><WalletCards size={21} /></span></div></header><main className="px-5 pt-[84px] pb-24">{isInitialLoading || periodSummaryLoading ? <section className="flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-[#dbe7f2] bg-white text-sm font-bold text-[#0060B8]"><LoaderCircle className="animate-spin" size={20} />جارٍ تحميل كشف الحساب...</section> : readError || periodSummaryError ? <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center"><p className="text-sm text-[#ba1a1a]">{readError}</p><button type="button" onClick={() => { void reload(); void loadPeriodSummary(period); }} className="mx-auto mt-3 flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-xs font-bold text-[#ba1a1a]"><RefreshCw size={15} />إعادة المحاولة</button></section>         : detailsLoading ? <section className="rounded-2xl border border-[#dbe7f2] bg-white px-4 py-10 text-center text-sm font-bold text-[#0060B8]"><LoaderCircle className="mx-auto mb-2 animate-spin" size={22} />جارٍ تحميل كشف حساب الكابتن...</section> : detailsError ? <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm font-bold text-[#ba1a1a]">{detailsError}<button type="button" onClick={() => void loadCaptainDetails(captainId, true)} className="mx-auto mt-3 block rounded-xl border border-red-200 bg-white px-4 py-2 text-xs">إعادة تحميل</button></section> : !captain ? <section className="rounded-2xl border border-dashed border-[#c7dae8] bg-white/70 px-4 py-10 text-center text-sm text-[#75818e]">لم يتم العثور على كشف هذا الكابتن</section> : detailContent}</main><AdminBottomNav active="wages" /></div></div>;
}
