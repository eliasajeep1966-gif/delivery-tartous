/** Design reminder — Captain home follows the supplied operational reference: a compact white header, prominent current-order card, status control, and dense daily summary. */
import { useState } from 'react';
import { CheckCircle2, Clock3, LoaderCircle, MapPin, PackageCheck, Phone, RefreshCw, Truck, WalletCards } from 'lucide-react';
import { toast } from 'sonner';

import { CaptainBottomNav } from '@/components/CaptainBottomNav';
import { Link } from 'wouter';
import { CaptainTopBar } from '@/components/CaptainTopBar';
import { Switch } from '@/components/ui/switch';
import { useWebAuth } from '@/contexts/WebAuthContext';
import { orderStatusPresentation, type OrderStatus } from '@/features/admin/types';
import { useCaptainDashboard } from '@/features/captain/useCaptainDashboard';

const formatMoney = (amount: number) => `${new Intl.NumberFormat('en-US').format(amount)} ل.س`;
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('ar-SY', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : 'غير متاح';

function nextOrderAction(status: OrderStatus) {
  if (status === 'assigned') return { label: 'تم الاستلام', nextStatus: 'received' as const };
  if (status === 'received') return { label: 'بدء التوصيل', nextStatus: 'in_delivery' as const };
  if (status === 'in_delivery') return { label: 'تأكيد التسليم', nextStatus: 'completed' as const };
  return null;
}

export default function CaptainHome() {
  const { profile, signOut } = useWebAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { availability, currentOrder, recentOrders, completedCount, completedGross, isInitialLoading, readError, updatingAvailability, updatingOrderId, reload, updateAvailability, transitionOrder } = useCaptainDashboard();
  const captainName = profile?.full_name?.trim() || profile?.email || 'الكابتن';
  const isAvailable = availability === 'available';
  const action = currentOrder ? nextOrderAction(currentOrder.status as OrderStatus) : null;

  const toggleAvailability = async (checked: boolean) => {
    const success = await updateAvailability(checked ? 'available' : 'unavailable');
    if (success) toast.success(checked ? 'أصبحت متاحاً لاستقبال الطلبات.' : 'تم إيقاف التوفر مؤقتاً.');
  };

  const advanceOrder = async () => {
    if (!currentOrder || !action) return;
    const success = await transitionOrder(currentOrder.id, action.nextStatus);
    if (success) toast.success(`تم تحديث الطلب إلى: ${orderStatusPresentation[action.nextStatus].label}`);
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
        <section className="overflow-hidden rounded-2xl border border-[#b9ddf1] bg-white shadow-[0_4px_14px_rgba(0,96,184,0.09)]"><div className="flex items-center gap-2 bg-[linear-gradient(110deg,#0f91d1,#0060b8)] px-3.5 py-2.5 text-white"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white/15"><Truck size={16} /></span><div><h2 className="text-[13px] font-extrabold">الطلب الحالي</h2><p className="text-[9px] text-white/80">{currentOrder ? orderStatusPresentation[currentOrder.status as OrderStatus].label : 'لا يوجد طلب نشط الآن'}</p></div></div>{currentOrder ? <div className="space-y-2.5 p-3.5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] text-[#748c9d]">الطلب #{currentOrder.order_number}</p><h3 className="mt-0.5 text-[15px] font-extrabold text-[#194b6e]">{currentOrder.customer_name}</h3><a className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#1478bf]" href={`tel:${currentOrder.customer_phone}`} dir="ltr"><Phone size={13} />{currentOrder.customer_phone}</a></div><strong className="rounded-lg bg-[#e7f6ff] px-2 py-1 text-[12px] text-[#086fc4]">{formatMoney(currentOrder.fee)}</strong></div><div className="space-y-1.5 border-t border-dashed border-[#dcebf3] pt-2.5 text-[11px] text-[#54778d]"><p className="flex items-center gap-1.5"><PackageCheck size={14} className="text-[#086fc4]" />{currentOrder.pickup_address}</p><p className="flex items-center gap-1.5"><MapPin size={14} className="text-emerald-600" />{currentOrder.delivery_address}</p></div>{action ? <button type="button" disabled={updatingOrderId === currentOrder.id} onClick={() => void advanceOrder()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#086fc4] text-xs font-extrabold text-white shadow-[0_5px_12px_rgba(0,96,184,0.22)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">{updatingOrderId === currentOrder.id ? <LoaderCircle className="animate-spin" size={17} /> : <CheckCircle2 size={17} />}{action.label}</button> : null}</div> : <div className="p-6 text-center"><PackageCheck className="mx-auto text-[#8fb2c7]" size={28} /><p className="mt-2 text-sm font-bold text-[#50778f]">لا يوجد طلب مسند إليك حالياً</p><p className="mt-1 text-[11px] text-[#7892a3]">فعّل التوفر ليتمكن المكتب من إسناد الطلبات.</p></div>}</section>
        <section><div className="mb-2 flex items-center justify-between"><h2 className="text-[13px] font-extrabold text-[#18547e]">ملخص اليوم</h2><span className="text-[10px] text-[#69879a]">من طلباتك المسندة</span></div><div className="grid grid-cols-2 gap-2.5"><article className="rounded-2xl border border-white bg-white p-3 shadow-[0_2px_8px_rgba(0,96,184,0.05)]"><span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={16} /></span><strong className="mt-2 block text-[22px] leading-5 text-[#175d8a]">{completedCount}</strong><p className="mt-1 text-[10px] font-bold text-[#708b9d]">طلبات مكتملة</p></article><article className="rounded-2xl border border-white bg-white p-3 shadow-[0_2px_8px_rgba(0,96,184,0.05)]"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#e8f6ff] text-[#086fc4]"><WalletCards size={16} /></span><strong className="mt-2 block text-[15px] leading-5 text-[#175d8a]">{formatMoney(completedGross)}</strong><p className="mt-1 text-[10px] font-bold text-[#708b9d]">قيمة طلبات مكتملة</p></article></div></section>
        <section><div className="mb-2 flex items-center justify-between"><h2 className="text-[13px] font-extrabold text-[#18547e]">آخر طلباتك</h2><Link href="/captain/orders" className="text-[10px] font-extrabold text-[#0877c2]">عرض الكل</Link></div><div className="space-y-2">{recentOrders.length ? recentOrders.map((order) => { const presentation = orderStatusPresentation[order.status as OrderStatus]; return <article key={order.id} className="relative overflow-hidden rounded-xl border border-white bg-white/95 p-3 pr-3.5 shadow-[0_2px_7px_rgba(0,96,184,0.045)]"><span className={`absolute top-0 right-0 h-full w-1 ${presentation.stripClass}`} /><div className="flex items-start justify-between gap-3"><div><strong className="text-[12px] text-[#154f79]">#{order.order_number}</strong><p className="mt-1 text-[12px] font-bold text-[#38586f]">{order.customer_name}</p><p className="mt-1 inline-flex items-center gap-1 text-[9px] text-[#7590a2]"><Clock3 size={10} />{formatDate(order.updated_at)}</p></div><div className="text-left"><span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${presentation.className}`}>{presentation.label}</span><strong className="mt-2 block text-[11px] text-[#075d9f]">{formatMoney(order.fee)}</strong></div></div></article>; }) : <div className="rounded-xl border border-dashed border-[#c1dfea] bg-white/70 px-4 py-7 text-center text-sm text-[#587386]">لا توجد طلبات مسندة لك بعد.</div>}</div></section>
      </>}
    </main>
    <CaptainBottomNav active="home" />
  </div></div>;
}
