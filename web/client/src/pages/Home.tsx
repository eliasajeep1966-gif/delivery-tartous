/** Design reminder — Compact reference dashboard with live admin operational data, retaining the approved visual hierarchy. */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Bell, Bike, CheckCircle2, ChevronLeft, CirclePlus, CircleUserRound, Clock3, LoaderCircle, MessageCircle, Package, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { AdminBottomNav } from '@/components/AdminBottomNav';
import { NewOrderDialog } from '@/components/NewOrderDialog';
import { orderStatusPresentation, type CreateOrderFlowDraft, type OrderStatus } from '@/features/admin/types';
import type { HomeOrderFilter } from '@/features/admin/homeMappers';
import { useAdminHomeData } from '@/features/admin/useAdminHomeData';
import { WebRequestTimeoutError } from '@/lib/authRequest';

export default function Home() {
  const [, setLocation] = useLocation();
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const {
    metrics,
    activities,
    availableCaptains,
    isInitialLoading,
    readError,
    reload,
    createOrderWithStops,
    assignOrderCaptain,
  } = useAdminHomeData();

  const openOrdersWithFilter = (filter: HomeOrderFilter) => {
    setLocation(`/orders?status=${filter}`);
  };

  const submitCreateOrderFlow = async (flow: CreateOrderFlowDraft): Promise<void> => {
    if (isCreatingOrder) return;
    const selectedCaptain = availableCaptains.find((captain) => captain.id === flow.assignedCaptainId);
    if (!selectedCaptain) {
      toast.error('اختر كابتناً مفعّلاً ومتاحاً قبل إرسال الطلب.');
      return;
    }

    setIsCreatingOrder(true);
    try {
      const stops = [
        ...flow.order.pickups.map((pickup, index) => ({
          stopType: 'pickup' as const,
          sequence: index + 1,
          contactName: pickup.name.trim(),
          contactPhone: pickup.phone.trim(),
          address: pickup.address.trim(),
          note: pickup.note?.trim() || undefined,
        })),
        ...flow.order.destinations.map((destination, index) => ({
          stopType: 'delivery' as const,
          sequence: index + 1,
          contactName: destination.name.trim(),
          contactPhone: destination.phone.trim(),
          address: destination.address.trim(),
          note: undefined,
        })),
      ];
      const idempotencyKey = crypto.randomUUID();
      const createdOrder = await createOrderWithStops({ stops, fee: flow.totalFee, idempotencyKey });
      try {
        const assignedOrder = await assignOrderCaptain(createdOrder.id, flow.assignedCaptainId);
        setIsCreateOrderOpen(false);
        void reload({ background: true });
        toast.success(`تم إنشاء وتعيين الطلب #${assignedOrder.order_number}.`);
      } catch (assignmentError) {
        console.error('Order assignment after creation failed.', assignmentError);
        setIsCreateOrderOpen(false);
        void reload({ background: true });
        if (assignmentError instanceof WebRequestTimeoutError) {
          toast.error('تم إنشاء الطلب، وتعذر تأكيد تعيين الكابتن. افتح تفاصيل الطلب وتحقق من حالته قبل تنفيذ أي إجراء.');
          setLocation('/orders');
          return;
        }
        toast.error(`تم إنشاء الطلب #${createdOrder.order_number}، لكن تعيين الكابتن لم ينجح. عيّنه من تفاصيل الطلب.`);
      }
    } catch (error) {
      console.error('Create multi-stop order failed.', error);
      if (error instanceof WebRequestTimeoutError) {
        setIsCreateOrderOpen(false);
        toast.error('انتهت مهلة تأكيد إنشاء الطلب. قد يكون قد حُفظ؛ افتح قائمة الطلبات وتحقق قبل إنشاء طلب جديد.');
        setLocation('/orders');
        return;
      }
      toast.error(error instanceof Error && error.message ? error.message : 'تعذر إنشاء الطلب. تحقق من البيانات وحاول مرة أخرى.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const openCreateOrder = () => {
    if (isInitialLoading) {
      toast.info('جارٍ تحميل الكباتن المتاحين.');
      return;
    }
    if (readError) {
      toast.error('تعذر تحميل لوحة الإدارة. حاول إعادة المحاولة.');
      return;
    }
    if (availableCaptains.length === 0) {
      toast.error('لا يوجد كابتن متاح حالياً.');
      return;
    }
    setIsCreateOrderOpen(true);
  };

  return (
    <div className="min-h-screen text-[#17364d]" dir="rtl">
      <div className="home-reference-shell relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden shadow-[0_0_40px_rgba(0,72,141,0.08)]">
        <header dir="ltr" className="home-reference-header fixed top-0 right-0 left-0 z-30 mx-auto grid h-14 w-full max-w-[453px] grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex items-center gap-1.5 justify-self-start"><button type="button" aria-label="الحساب" onClick={() => toast.info('بيانات الحساب ستُربط لاحقاً.')} className="grid h-8 w-8 place-items-center rounded-full border border-[#d6e9f4] bg-[#eef8fc] text-[#215f8c]"><CircleUserRound size={19} /></button><button type="button" aria-label="الإشعارات" onClick={() => toast.info('لا توجد إشعارات جديدة.')} className="relative grid h-8 w-8 place-items-center rounded-full border border-[#d6e9f4] bg-[#f6fbfe] text-[#4d7d9f]"><Bell size={16} /><span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#159ed8]" /></button></div>
          <h1 dir="rtl" className="text-[14px] font-extrabold tracking-[-0.25px] text-[#005ba8]">دليفري طرطوس</h1>
          <button type="button" aria-label="دعم الدردشة" onClick={() => toast.info('الدعم سيتوفر بعد ربط النظام.')} className="grid h-8 w-8 justify-self-end place-items-center rounded-lg bg-[#075eae] text-white shadow-[0_3px_7px_rgba(0,96,184,0.18)]"><MessageCircle size={16} /></button>
        </header>

        <main className="relative z-10 px-3 pb-28">
          <section className="mb-3 rounded-2xl border border-[#e0f0f7] bg-white/60 px-3.5 py-3.5 shadow-[0_2px_8px_rgba(0,96,184,0.04)]"><h2 className="text-[15px] font-extrabold text-[#155b8d]">مرحباً، المدير <span aria-hidden="true">👋</span></h2><p className="mt-1 text-[10px] text-[#658096]">إليك نظرة سريعة على حركة الطلبات اليوم</p></section>

          {readError && <section className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-center"><p className="text-xs font-bold text-[#ba1a1a]">{readError}</p><button type="button" onClick={() => void reload()} className="mx-auto mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#0060B8]"><RefreshCw size={13} />إعادة المحاولة</button></section>}

          <section aria-label="ملخص اليوم" className="grid grid-cols-2 gap-2.5">{isInitialLoading ? Array.from({ length: 4 }, (_, index) => <div key={index} className="min-h-[104px] animate-pulse rounded-xl border border-white/90 bg-white/75 p-3.5" />) : metrics.map((metric) => { const isHighlight = metric.id === 'in_delivery'; const MetricIcon = metric.icon === 'package' ? Package : metric.icon === 'bike' ? Bike : metric.icon === 'check' ? CheckCircle2 : XCircle; const accentClass = metric.icon === 'check' ? 'text-emerald-500' : metric.icon === 'cancel' ? 'text-red-400' : 'text-[#1478bf]'; return <button type="button" key={metric.id} onClick={() => openOrdersWithFilter(metric.orderFilter)} className={`min-h-[104px] rounded-xl border p-3.5 text-right shadow-[0_3px_8px_rgba(0,96,184,0.06)] transition-all duration-150 active:scale-[0.98] ${isHighlight ? 'border-[#086fc4] bg-[linear-gradient(135deg,#169fde_0%,#0060b8_100%)] text-white shadow-[0_5px_13px_rgba(0,96,184,0.22)]' : 'border-white/90 bg-white text-[#1b557e]'}`}><span className="flex items-center justify-between"><MetricIcon className={isHighlight ? 'text-white/85' : accentClass} size={18} strokeWidth={2.35} /><strong className="text-[24px] leading-6">{metric.value}</strong></span><span className={`mt-2 block text-[11px] font-bold ${isHighlight ? 'text-white/90' : 'text-[#617b90]'}`}>{metric.label}</span></button>; })}</section>

          <button type="button" onClick={openCreateOrder} disabled={isInitialLoading || Boolean(readError) || availableCaptains.length === 0 || isCreatingOrder} className="relative mt-3.5 flex min-h-[94px] w-full items-center justify-between overflow-hidden rounded-xl bg-[linear-gradient(105deg,#1aa6e0_0%,#0060b8_67%,#07529b_100%)] px-3.5 py-3 text-right text-white shadow-[0_5px_13px_rgba(0,96,184,0.23)] transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"><span className="relative z-10"><span className="block text-[15px] font-extrabold">إنشاء طلب جديد</span><span className="mt-1 block text-[11px] text-white/80">{isInitialLoading ? 'جارٍ تحميل الكباتن...' : readError ? 'تعذر تحميل الكباتن المتاحين' : availableCaptains.length === 0 ? 'لا يوجد كابتن متاح حالياً' : 'أضف طلباً وعيّن كابتناً متاحاً'}</span></span><img src="/assets/new-order-illustration.png" alt="" className="pointer-events-none absolute left-6 top-1/2 h-[84px] w-[116px] -translate-y-1/2 object-contain opacity-25" /><span className="relative z-10 grid h-9 w-9 place-items-center rounded-full bg-white/18"><CirclePlus size={22} /></span></button>

          <section className="mt-4.5" aria-labelledby="recent-orders-title"><div className="mb-2.5 flex items-center justify-between"><h3 id="recent-orders-title" className="text-[13px] font-extrabold text-[#18547e]">آخر النشاطات</h3><button type="button" onClick={() => setLocation('/orders')} className="text-[10px] font-extrabold text-[#0877c2]">عرض الطلبات</button></div><div className="space-y-2">{isInitialLoading ? <div className="min-h-[86px] animate-pulse rounded-xl bg-white/75" /> : activities.length ? activities.map((activity) => { const meta = activity.status ? orderStatusPresentation[activity.status] : null; return <button type="button" key={activity.id} onClick={() => setLocation(activity.href)} className="relative flex min-h-[86px] w-full overflow-hidden rounded-xl border border-white/90 bg-white/95 p-3 pr-3.5 text-right shadow-[0_2px_7px_rgba(0,96,184,0.045)] transition-all duration-150 active:scale-[0.99]"><span className={`absolute top-0 right-0 h-full w-1 ${meta?.stripClass ?? 'bg-[#4f8bb5]'}`} /><span className="flex min-w-0 flex-1 flex-col justify-between pl-6"><span className="flex items-center justify-between gap-2"><strong className="text-[12px] leading-4 text-[#154f79]">{activity.title}</strong>{meta && <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${meta.className}`}>{meta.label}</span>}</span><span className="text-[12px] font-bold text-[#38586f]">{activity.subtitle}</span><span className="inline-flex items-center gap-0.5 text-[9px] text-[#7590a2]"><Clock3 size={10} />{activity.timestamp}</span></span><ChevronLeft className="absolute top-1/2 left-2.5 -translate-y-1/2 text-[#88a0b0]" size={16} /></button>; }) : <div className="rounded-xl border border-dashed border-[#c1dfea] bg-white/70 px-4 py-7 text-center text-sm text-[#587386]">لا توجد نشاطات إدارية حديثة.</div>}</div></section>

          <section className="mt-4" aria-labelledby="available-captains-title"><div className="mb-2 flex items-center justify-between"><h3 id="available-captains-title" className="text-[13px] font-extrabold text-[#18547e]">الكباتن المتاحون الآن</h3><button type="button" onClick={() => setLocation('/captains')} className="text-[10px] font-extrabold text-[#0877c2]">عرض الكل</button></div><div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{isInitialLoading ? <span className="text-xs text-[#638096]">جارٍ التحميل...</span> : availableCaptains.length ? availableCaptains.map((captain) => <button type="button" key={captain.id} onClick={() => toast.info(`${captain.name} متاح حالياً.`)} className="flex min-w-[58px] flex-col items-center gap-0.5 active:scale-[0.96]"><span className="relative grid h-11 w-11 place-items-center rounded-full bg-white text-sm font-bold text-[#477188] shadow-[0_2px_7px_rgba(0,96,184,0.07)]">{captain.initial}<span className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-[#d9eff9] bg-emerald-500" /></span><span className="text-[10px] font-bold text-[#335872]">{captain.name}</span><span className="text-[9px] text-[#55788e]">متاح</span></button>) : <span className="text-xs text-[#638096]">لا يوجد كابتن متاح حالياً.</span>}</div></section>
        </main>
        <AdminBottomNav active="home" />
        <NewOrderDialog open={isCreateOrderOpen} onOpenChange={setIsCreateOrderOpen} captains={availableCaptains} isSubmitting={isCreatingOrder} onSubmitCreateOrderFlow={submitCreateOrderFlow} />
      </div>
    </div>
  );
}
