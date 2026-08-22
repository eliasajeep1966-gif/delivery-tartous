/** Captain home: compact operational view with a safe single-step order flow. */
import { useEffect, useState } from 'react';
import { BellRing, CheckCircle2, Clock3, FileText, LoaderCircle, MapPin, PackageCheck, Phone, RefreshCw, Truck, WalletCards } from 'lucide-react';
import { Link } from 'wouter';
import { toast } from 'sonner';

import { CaptainBottomNav } from '@/components/CaptainBottomNav';
import { CaptainTopBar } from '@/components/CaptainTopBar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useWebAuth } from '@/contexts/WebAuthContext';
import { orderStatusPresentation, type OrderStatus } from '@/features/admin/types';
import { useCaptainDashboard } from '@/features/captain/useCaptainDashboard';

const formatMoney = (amount: number) => `${new Intl.NumberFormat('en-US').format(amount)} ل.س`;
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('ar-SY', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : 'غير متاح';

const orderSteps: Array<{ status: OrderStatus; label: string }> = [
  { status: 'assigned', label: 'تم إسناد الطلب' },
  { status: 'received', label: 'تم استلام الطلب' },
  { status: 'in_delivery', label: 'قيد التوصيل' },
  { status: 'completed', label: 'تم التسليم' },
];

function nextOrderAction(status: OrderStatus) {
  if (status === 'assigned') return { label: 'تأكيد استلام الطلب', nextStatus: 'received' as const };
  if (status === 'received') return { label: 'بدء التوصيل', nextStatus: 'in_delivery' as const };
  if (status === 'in_delivery') return { label: 'تأكيد التسليم', nextStatus: 'completed' as const };
  return null;
}

const stepTones = {
  assigned: { dot: 'border-[#087ec4] bg-[#087ec4]', text: 'text-[#0874bd]', connector: 'bg-[#087ec4]' },
  received: { dot: 'border-[#f59e0b] bg-[#f59e0b]', text: 'text-[#c26d00]', connector: 'bg-[#f59e0b]' },
  in_delivery: { dot: 'border-[#8b5cf6] bg-[#8b5cf6]', text: 'text-[#7040c5]', connector: 'bg-[#8b5cf6]' },
  completed: { dot: 'border-[#10b981] bg-[#10b981]', text: 'text-[#07845d]', connector: 'bg-[#10b981]' },
} as const;

function OrderTimeline({ status }: { status: OrderStatus }) {
  const currentIndex = orderSteps.findIndex((step) => step.status === status);
  return <div className="rounded-xl border border-[#dcecf4] bg-[#f8fcfe] p-3"><div className="mb-2 flex items-center justify-between"><h3 className="text-[11px] font-extrabold text-[#18547e]">خطوات الطلب</h3><span className="text-[9px] text-[#7892a3]">تتحدث بعد كل تأكيد</span></div><div className="space-y-2">{orderSteps.map((step, index) => { const done = currentIndex >= index; const current = currentIndex === index; const tone = stepTones[step.status as keyof typeof stepTones]; return <div key={step.status} className="flex items-center gap-2"><span className={`relative grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${done ? `${tone.dot} text-white` : 'border-[#c8dce7] bg-white text-[#9ab0bd]'}`}>{done ? <CheckCircle2 size={13} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}{index < orderSteps.length - 1 && <span className={`absolute top-6 left-1/2 h-2 w-0.5 -translate-x-1/2 ${currentIndex > index ? tone.connector : 'bg-[#d8e7ee]'}`} />}</span><span className={`text-[10px] ${current ? `font-extrabold ${tone.text}` : done ? `font-bold ${tone.text}` : 'text-[#8aa0ad]'}`}>{step.label}</span></div>; })}</div></div>;
}

export default function CaptainHome() {
  const { profile, signOut } = useWebAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isFalseOrderDialogOpen, setIsFalseOrderDialogOpen] = useState(false);
  const { availability, currentOrder, currentOrderStops, recentOrders, completedCount, completedGross, isInitialLoading, readError, transitionError, clearTransitionError, newAssignedOrder, dismissNewAssignedOrder, updatingAvailability, updatingOrderId, reload, updateAvailability, transitionOrder } = useCaptainDashboard();
  const captainName = profile?.full_name?.trim() || profile?.email || 'الكابتن';
  const isAvailable = availability === 'available';
  const currentStatus = currentOrder?.status as OrderStatus | undefined;
  const action = currentStatus ? nextOrderAction(currentStatus) : null;
  const pickupStop = currentOrderStops.find((stop) => stop.stop_type === 'pickup');
  const deliveryStop = currentOrderStops.find((stop) => stop.stop_type === 'delivery');

  useEffect(() => {
    if (!newAssignedOrder) return;
    toast.success(`وصلك طلب جديد #${newAssignedOrder.order_number}`, { duration: 7000 });
  }, [newAssignedOrder]);

  const toggleAvailability = async (checked: boolean) => {
    const success = await updateAvailability(checked ? 'available' : 'unavailable');
    if (success) toast.success(checked ? 'أصبحت متاحاً لاستقبال الطلبات.' : 'تم إيقاف التوفر مؤقتاً.');
  };

  const advanceOrder = async () => {
    if (!currentOrder || !action || isAdvancing || updatingOrderId === currentOrder.id) return;
    setIsAdvancing(true);
    try {
      const success = await transitionOrder(currentOrder.id, action.nextStatus);
      if (success) toast.success(`تم تحديث الطلب إلى: ${orderStatusPresentation[action.nextStatus].label}`);
    } finally {
      setIsAdvancing(false);
    }
  };

  const markFalseOrder = async () => {
    if (!currentOrder || (currentStatus !== 'received' && currentStatus !== 'in_delivery') || isAdvancing || updatingOrderId === currentOrder.id) return;
    setIsAdvancing(true);
    try {
      const success = await transitionOrder(currentOrder.id, 'false_order');
      if (success) {
        toast.success('تم تسجيل الطلب كطلب كاذب.');
        setIsFalseOrderDialogOpen(false);
      }
    } finally {
      setIsAdvancing(false);
    }
  };

  const signOutCaptain = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try { await signOut(); toast.success('تم تسجيل الخروج.'); } catch { toast.error('تعذر تسجيل الخروج.'); } finally { setIsSigningOut(false); }
  };

  return <div className="min-h-screen bg-[#edf8fd] text-[#17364d]" dir="rtl"><div className="captain-shell relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[linear-gradient(180deg,#f9fdff_0%,#e7f6fc_100%)] pb-24 shadow-[0_0_40px_rgba(0,72,141,0.08)]">
    <CaptainTopBar onSignOut={() => void signOutCaptain()} signingOut={isSigningOut} />
    <main className="space-y-3 px-3 pt-0 pb-6">
      <div className="px-1 pt-1"><h1 className="text-[14px] font-extrabold text-[#155b8d]">مرحباً، {captainName}</h1><p className="mt-0.5 text-[10px] text-[#6c899e]">تابع طلبك الحالي وحالة التوفر من مكان واحد.</p></div>
      {isInitialLoading ? <section className="flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-[#dcecf4] bg-white text-sm font-bold text-[#086fc4]"><LoaderCircle className="animate-spin" size={19} />جارٍ تحميل حسابك...</section> : readError ? <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center"><p className="text-sm font-bold text-[#ba1a1a]">{readError}</p><button type="button" onClick={() => void reload()} className="mx-auto mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-xs font-bold text-[#ba1a1a]"><RefreshCw size={15} />إعادة المحاولة</button></section> : <>
        <section className="flex items-center justify-between rounded-2xl border border-[#dcecf4] bg-white px-3 py-2.5 shadow-[0_2px_8px_rgba(0,96,184,0.05)]"><div><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-slate-400'}`} /><h2 className="text-[13px] font-extrabold text-[#184d70]">حالة التوفر</h2></div><p className="mt-1 text-[10px] text-[#6d8799]">{isAvailable ? 'يمكن للمكتب إسناد طلب جديد لك.' : 'لن يصلك طلب جديد حتى تفعّل التوفر.'}</p></div><Switch dir="ltr" checked={isAvailable} disabled={updatingAvailability} onCheckedChange={(checked) => void toggleAvailability(checked)} aria-label="تغيير حالة التوفر" className="h-[1.35rem] w-9 shrink-0 data-[state=checked]:bg-[#087ec4] data-[state=unchecked]:bg-[#dbe9ef]" /></section>
        {newAssignedOrder && <section role="status" className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 shadow-[0_3px_10px_rgba(245,158,11,0.12)]"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><BellRing size={20} /></span><div className="min-w-0 flex-1"><h2 className="text-[13px] font-extrabold text-amber-900">وصلك طلب جديد</h2><p className="mt-0.5 truncate text-[11px] text-amber-800">الطلب #{newAssignedOrder.order_number} · {newAssignedOrder.customer_name}</p></div><button type="button" onClick={dismissNewAssignedOrder} className="h-9 rounded-xl border border-amber-300 bg-white px-3 text-[10px] font-extrabold text-amber-800">تم</button></section>}
        <section className="overflow-hidden rounded-2xl border border-[#b9ddf1] bg-white shadow-[0_4px_14px_rgba(0,96,184,0.09)]"><div className="flex items-center gap-2 bg-[linear-gradient(110deg,#0f91d1,#0060b8)] px-3.5 py-2.5 text-white"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white/15"><Truck size={16} /></span><div><h2 className="text-[13px] font-extrabold">الطلب الحالي</h2><p className="text-[9px] text-white/80">{currentOrder && currentStatus ? `الطلب #${currentOrder.order_number} · ${orderStatusPresentation[currentStatus].label}` : 'لا يوجد طلب نشط الآن'}</p></div></div>{currentOrder && currentStatus ? <div className="space-y-3 p-3.5"><div className="grid grid-cols-2 gap-2"><section className="rounded-xl border border-[#dcecf4] bg-[#f8fcfe] p-2.5"><h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold text-[#285c79]"><PackageCheck size={14} className="text-[#086fc4]" />المصدر</h3><div className="space-y-1 text-[10px] text-[#54778d]"><p><b className="text-[#315f78]">الاسم:</b> {pickupStop?.contact_name || 'غير متاح'}</p><p><b className="text-[#315f78]">الرقم:</b> <a href={pickupStop?.contact_phone ? `tel:${pickupStop.contact_phone}` : undefined} dir="ltr" className="font-bold text-[#1478bf]">{pickupStop?.contact_phone || 'غير متاح'}</a></p><p><b className="text-[#315f78]">العنوان:</b> {pickupStop?.address || currentOrder.pickup_address}</p>{pickupStop?.note?.trim() && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] leading-5 text-amber-800"><b className="mb-0.5 flex items-center gap-1 text-amber-900"><FileText size={12} />تعليمات الطلب:</b>{pickupStop.note}</p>}</div></section><section className="rounded-xl border border-[#dcecf4] bg-[#f8fcfe] p-2.5"><h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold text-[#285c79]"><MapPin size={14} className="text-emerald-600" />الوجهة</h3><div className="space-y-1 text-[10px] text-[#54778d]"><p><b className="text-[#315f78]">الاسم:</b> {deliveryStop?.contact_name || currentOrder.customer_name}</p><p><b className="text-[#315f78]">الرقم:</b> <a href={deliveryStop?.contact_phone || currentOrder.customer_phone ? `tel:${deliveryStop?.contact_phone || currentOrder.customer_phone}` : undefined} dir="ltr" className="font-bold text-[#1478bf]">{deliveryStop?.contact_phone || currentOrder.customer_phone || 'غير متاح'}</a></p><p><b className="text-[#315f78]">العنوان:</b> {deliveryStop?.address || currentOrder.delivery_address}</p></div></section></div><OrderTimeline status={currentStatus} />{action ? <div className="space-y-2"><button type="button" disabled={isAdvancing || updatingOrderId === currentOrder.id} onClick={() => void advanceOrder()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#086fc4] text-xs font-extrabold text-white shadow-[0_5px_12px_rgba(0,96,184,0.22)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">{isAdvancing || updatingOrderId === currentOrder.id ? <LoaderCircle className="animate-spin" size={17} /> : <CheckCircle2 size={17} />}{isAdvancing ? 'جارٍ حفظ المرحلة...' : action.label}</button>{(currentStatus === 'received' || currentStatus === 'in_delivery') && <button type="button" disabled={isAdvancing || updatingOrderId === currentOrder.id} onClick={() => setIsFalseOrderDialogOpen(true)} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-xs font-extrabold text-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"><PackageCheck size={16} />تسجيل كطلب كاذب</button>}</div> : currentStatus === 'false_order' ? <div className="rounded-xl bg-amber-50 px-3 py-2 text-center text-[11px] font-extrabold text-amber-800">تم تسجيل الطلب كطلب كاذب.</div> : <div className="rounded-xl bg-emerald-50 px-3 py-2 text-center text-[11px] font-extrabold text-emerald-700">اكتمل الطلب ولا توجد خطوة إضافية.</div>}</div> : <div className="p-6 text-center"><PackageCheck className="mx-auto text-[#8fb2c7]" size={28} /><p className="mt-2 text-sm font-bold text-[#50778f]">لا يوجد طلب مسند إليك حالياً</p><p className="mt-1 text-[11px] text-[#7892a3]">فعّل التوفر ليتمكن المكتب من إسناد الطلبات.</p></div>}</section>
        <section><div className="mb-2 flex items-center justify-between"><h2 className="text-[13px] font-extrabold text-[#18547e]">ملخص اليوم</h2><span className="text-[10px] text-[#69879a]">من طلباتك المسندة</span></div><div className="grid grid-cols-2 gap-2.5"><article className="rounded-2xl border border-white bg-white p-3 shadow-[0_2px_8px_rgba(0,96,184,0.05)]"><span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={16} /></span><strong className="mt-2 block text-[22px] leading-5 text-[#175d8a]">{completedCount}</strong><p className="mt-1 text-[10px] font-bold text-[#708b9d]">طلبات مكتملة</p></article><article className="rounded-2xl border border-white bg-white p-3 shadow-[0_2px_8px_rgba(0,96,184,0.05)]"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#e8f6ff] text-[#086fc4]"><WalletCards size={16} /></span><strong className="mt-2 block text-[15px] leading-5 text-[#175d8a]">{formatMoney(completedGross)}</strong><p className="mt-1 text-[10px] font-bold text-[#708b9d]">قيمة طلبات مكتملة</p></article></div></section>
        <section><div className="mb-2 flex items-center justify-between"><h2 className="text-[13px] font-extrabold text-[#18547e]">آخر طلبين</h2><Link href="/captain/orders" className="text-[10px] font-extrabold text-[#0877c2]">عرض الكل</Link></div><div className="space-y-1.5">{recentOrders.slice(0, 2).length ? recentOrders.slice(0, 2).map((order) => { const presentation = orderStatusPresentation[order.status as OrderStatus]; return <article key={order.id} className="relative overflow-hidden rounded-xl border border-white bg-white/95 px-3 py-2 shadow-[0_2px_7px_rgba(0,96,184,0.045)]"><span className={`absolute top-0 right-0 h-full w-1 ${presentation.stripClass}`} /><div className="flex items-center justify-between gap-2"><div className="min-w-0"><strong className="text-[11px] text-[#154f79]">#{order.order_number}</strong><p className="truncate text-[11px] font-bold text-[#38586f]">{order.customer_name}</p></div><div className="text-left"><span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${presentation.className}`}>{presentation.label}</span><p className="mt-1 text-[10px] font-extrabold text-[#075d9f]">{formatMoney(order.fee)}</p></div></div><p className="mt-1.5 inline-flex items-center gap-1 text-[9px] text-[#7892a3]"><Clock3 size={10} />{formatDate(order.updated_at)}</p></article>; }) : <div className="rounded-xl border border-dashed border-[#c1dfea] bg-white/70 px-4 py-7 text-center text-sm text-[#587386]">لا توجد طلبات مسندة لك بعد.</div>}</div></section>
      </>}
    </main>
    <CaptainBottomNav active="home" />
    <Dialog open={isFalseOrderDialogOpen} onOpenChange={(open) => { setIsFalseOrderDialogOpen(open); if (open) clearTransitionError(); }}>
      <DialogContent showCloseButton className="max-w-[calc(100%-1.25rem)] rounded-2xl border-red-200 bg-[#fffafa] p-0 sm:max-w-[390px]" dir="rtl">
        <DialogHeader className="border-b border-red-100 bg-white px-5 pt-5 pb-4 text-right"><DialogTitle className="pr-7 text-right text-[19px] text-red-800">تسجيل طلب كاذب</DialogTitle><DialogDescription className="text-right text-xs leading-5 text-[#6f5555]">هل أنت متأكد من أن هذا الطلب كاذب؟ سيتم تغيير حالته ولن يعود ضمن مسار التوصيل العادي.</DialogDescription></DialogHeader>
        <div className="space-y-3 p-4">
          {currentOrder && <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs leading-6 text-red-900"><p><b>الطلب:</b> #{currentOrder.order_number}</p><p><b>العميل:</b> {currentOrder.customer_name}</p></div>}
          {transitionError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-6 text-[#ba1a1a]"><b>تعذر تسجيل الطلب:</b><p className="mt-1">{transitionError}</p></div>}
          <div className="grid grid-cols-2 gap-2"><button type="button" disabled={isAdvancing} onClick={() => setIsFalseOrderDialogOpen(false)} className="flex h-11 items-center justify-center rounded-xl border border-[#d7e2e8] bg-white text-sm font-bold text-[#52606d] disabled:cursor-not-allowed disabled:opacity-60">إلغاء</button><button type="button" disabled={isAdvancing} onClick={() => void markFalseOrder()} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-700 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{isAdvancing && <LoaderCircle className="animate-spin" size={17} />} {isAdvancing ? 'جارٍ التسجيل...' : 'نعم، تسجيل كاذب'}</button></div>
        </div>
      </DialogContent>
    </Dialog>
  </div></div>;
}
