/** Design reminder — Corporate Modern Mobile Operations: RTL order list, #0060B8 hierarchy, white cards, Cairo typography. */
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Clock3,
  LoaderCircle,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  Store,
  Truck,
  UserRound,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSearch } from 'wouter';

import { AdminBottomNav } from '@/components/AdminBottomNav';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  type WebOrderStatus,
  type WebProfile,
} from '@/data/supabase/webSupabaseContract';
import {
  type LiveOrderListItem,
  mapLiveOrderListItem,
  mapLiveOrderStops,
  mapLiveOrderTimeline,
} from '@/features/admin/orderMappers';
import { getOrdersErrorMessage, type LiveCaptainOption, useAdminOrdersData } from '@/features/admin/useAdminOrdersData';
import { orderStatusPresentation, type OrderStatus } from '@/features/admin/types';
import { WebRequestTimeoutError } from '@/lib/authRequest';

type StatusFilter = 'all' | OrderStatus | 'delivery_active';
type VisibleStatusFilter = 'all' | OrderStatus;

const filters: VisibleStatusFilter[] = ['all', 'pending', 'assigned', 'received', 'in_delivery', 'completed', 'cancelled', 'false_order'];
const cancellableStatuses: WebOrderStatus[] = ['pending'];

function formatMoney(amount: number): string {
  return `${new Intl.NumberFormat('en-US').format(amount)} ل.س`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'غير متاح';
  return new Intl.DateTimeFormat('ar-SY', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function OrderDetailsDialog({
  order,
  profiles,
  details,
  history,
  isDetailsLoading,
  detailsError,
  availableCaptains,
  assigningOrderId,
  cancellingOrderId,
  onOpenChange,
  onRetryDetails,
  onAssignCaptain,
  onCancelOrder,
}: {
  order: LiveOrderListItem | null;
  profiles: WebProfile[];
  details: ReturnType<typeof mapLiveOrderStops> | null;
  history: ReturnType<typeof mapLiveOrderTimeline> | null;
  isDetailsLoading: boolean;
  detailsError: string | null;
  availableCaptains: LiveCaptainOption[];
  assigningOrderId: string | null;
  cancellingOrderId: string | null;
  onOpenChange: (open: boolean) => void;
  onRetryDetails: (orderId: string) => void;
  onAssignCaptain: (orderId: string, captainId: string) => Promise<boolean>;
  onCancelOrder: (orderId: string, reason: string) => Promise<boolean>;
}) {
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedCaptainId, setSelectedCaptainId] = useState('');
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  if (!order) return null;

  const status = orderStatusPresentation[order.status as OrderStatus];
  const canAssign = order.status === 'pending';
  const canCancel = cancellableStatuses.includes(order.status);
  const isAssigning = assigningOrderId === order.id;
  const isCancelling = cancellingOrderId === order.id;

  const closeDetails = (open: boolean) => {
    if (isAssigning || isCancelling) return;
    onOpenChange(open);
  };

  const submitAssignment = async () => {
    if (!selectedCaptainId) {
      toast.error('اختر كابتناً متاحاً قبل التأكيد.');
      return;
    }

    const success = await onAssignCaptain(order.id, selectedCaptainId);
    if (success) {
      setIsAssignDialogOpen(false);
      setSelectedCaptainId('');
    }
  };

  const submitCancellation = async () => {
    const success = await onCancelOrder(order.id, cancellationReason);
    if (success) {
      setIsCancelDialogOpen(false);
      setCancellationReason('');
    }
  };

  return (
    <>
      <Dialog open={order !== null} onOpenChange={closeDetails}>
        <DialogContent showCloseButton className="max-h-[88dvh] max-w-[calc(100%-1.25rem)] gap-0 overflow-y-auto rounded-2xl border-[#cfe1f0] bg-[#f0f7ff] p-0 sm:max-w-[430px]" dir="rtl">
          <DialogHeader className="sticky top-0 z-10 border-b border-[#dbe7f2] bg-white px-5 pt-5 pb-4 text-right shadow-[0_2px_7px_rgba(0,72,141,0.04)]">
            <DialogTitle className="pr-7 text-right text-[19px] text-[#1c1b1b]">تفاصيل الطلب #{order.orderNumber}</DialogTitle>
            <DialogDescription className="text-right text-xs text-[#58616b]">تفاصيل المصادر والوجهات والتسلسل التشغيلي.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 p-4">
            <section className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold text-[#66727e]">العميل</p>
                  <h3 className="mt-1 text-base font-bold">{order.customerName}</h3>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[#58616b]" dir="ltr"><Phone size={14} />{order.customerPhone}</p>
                </div>
                <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${status.className}`}>{status.label}</span>
              </div>
            </section>

            <section className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5">
              <div className="flex items-center justify-between"><h3 className="text-sm font-bold">المصدر والوجهة</h3><strong className="text-sm text-[#0060B8]">{formatMoney(order.fee)}</strong></div>
              {isDetailsLoading && (
                <div className="flex min-h-28 items-center justify-center gap-2 text-sm font-bold text-[#0060B8]"><LoaderCircle className="animate-spin" size={18} />جارٍ تحميل نقاط الطلب...</div>
              )}
              {!isDetailsLoading && detailsError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-[#ba1a1a]">
                  <p>{detailsError}</p>
                  <button type="button" onClick={() => onRetryDetails(order.id)} className="mt-2 flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-[#ba1a1a]"><RefreshCw size={14} />إعادة محاولة التفاصيل</button>
                </div>
              )}
              {!isDetailsLoading && !detailsError && details && (
                <div className="mt-3 space-y-3">
                  {details.pickups.length === 0 && details.destinations.length === 0 && <p className="text-xs text-[#58616b]">لا توجد نقاط مرئية لهذا الطلب.</p>}
                  {details.pickups.map((place) => <div key={place.id} className="flex gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-100 text-[#0060B8]"><Store size={16} /></span><div><strong className="text-xs">{place.contactName}</strong><p className="mt-0.5 text-[11px] text-[#66727e]">{place.address}</p><p className="mt-0.5 text-[10px] text-[#75818e]" dir="ltr">{place.contactPhone}</p>{place.note && <p className="mt-1 rounded-md bg-[#f4f8fb] px-2 py-1 text-[10px] text-[#58616b]">{place.note}</p>}</div></div>)}
                  {details.destinations.map((place) => <div key={place.id} className="flex gap-2.5 border-t border-dashed border-[#dbe7f2] pt-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><MapPin size={16} /></span><div><strong className="text-xs">{place.contactName}</strong><p className="mt-0.5 text-[11px] text-[#66727e]">{place.address}</p><p className="mt-0.5 text-[10px] text-[#75818e]" dir="ltr">{place.contactPhone}</p></div></div>)}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5">
              <h3 className="text-sm font-bold">الكابتن</h3>
              <div className="mt-3 flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#e7edf2] text-[#52606d]"><UserRound size={17} /></span><div><strong className="text-xs">{order.assignedCaptainName ?? 'لم يُعيّن كابتن بعد'}</strong><p className="mt-0.5 text-[10px] text-[#75818e]">{order.assignedCaptainName ? 'الكابتن المعيّن على الطلب' : 'بانتظار التعيين'}</p></div></div>
            </section>

            <section className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5">
              <h3 className="text-sm font-bold">التسلسل الزمني</h3>
              {isDetailsLoading && <div className="flex min-h-20 items-center justify-center gap-2 text-xs text-[#0060B8]"><LoaderCircle className="animate-spin" size={16} />جارٍ تحميل السجل...</div>}
              {!isDetailsLoading && detailsError && <p className="mt-3 text-xs leading-5 text-[#ba1a1a]">تعذر تحميل السجل. استخدم إعادة محاولة التفاصيل.</p>}
              {!isDetailsLoading && !detailsError && history && <div className="relative mt-4 space-y-3 before:absolute before:top-3 before:bottom-3 before:right-[13px] before:w-px before:bg-[#d9e7f1]">{history.length ? history.map((item) => { const itemStatus = orderStatusPresentation[item.status as OrderStatus]; return <div key={item.id} className="relative flex gap-3"><span className={`z-10 mt-0.5 h-7 w-7 shrink-0 rounded-full border-4 border-white ${itemStatus.stripClass}`} /><div><strong className="text-xs">{itemStatus.label}</strong><p className="mt-0.5 text-[10px] text-[#66727e]">{formatDate(item.timestamp)} — {item.actorName}</p>{item.note && <p className="mt-1 rounded-md bg-[#f4f8fb] px-2 py-1 text-[10px] text-[#58616b]">{item.note}</p>}</div></div>; }) : <p className="text-xs text-[#58616b]">لا يوجد سجل حالات مرئي لهذا الطلب.</p>}</div>}
            </section>

            {(canAssign || canCancel) && <div className={`grid gap-2 ${canAssign && canCancel ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {canAssign && <button type="button" onClick={() => setIsAssignDialogOpen(true)} disabled={isAssigning || isCancelling} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[#a8c8ff] bg-[#eef6ff] text-xs font-bold text-[#0060B8] disabled:cursor-not-allowed disabled:opacity-60"><Truck size={16} />تعيين كابتن</button>}
              {canCancel && <button type="button" onClick={() => setIsCancelDialogOpen(true)} disabled={isAssigning || isCancelling} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-[#ba1a1a] disabled:cursor-not-allowed disabled:opacity-60"><XCircle size={16} />إلغاء مع سبب</button>}
            </div>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignDialogOpen} onOpenChange={(open) => !isAssigning && setIsAssignDialogOpen(open)}>
        <DialogContent showCloseButton className="max-w-[calc(100%-1.25rem)] rounded-2xl border-[#cfe1f0] bg-[#f0f7ff] p-0 sm:max-w-[390px]" dir="rtl">
          <DialogHeader className="border-b border-[#dbe7f2] bg-white px-5 pt-5 pb-4 text-right"><DialogTitle className="pr-7 text-right text-[19px]">تعيين كابتن</DialogTitle><DialogDescription className="text-right text-xs">تظهر الكباتن المفعّلة والمتاحة فقط.</DialogDescription></DialogHeader>
          <div className="space-y-3 p-4">
            {availableCaptains.length === 0 ? <div className="rounded-xl border border-dashed border-[#bfd6eb] bg-white p-4 text-center text-sm text-[#58616b]">لا يوجد كابتن متاح حالياً.</div> : <div className="space-y-2">{availableCaptains.map((captain) => <button key={captain.id} type="button" disabled={isAssigning} onClick={() => setSelectedCaptainId(captain.id)} className={`flex min-h-11 w-full items-center justify-between rounded-xl border px-3 text-right text-sm font-bold disabled:cursor-not-allowed ${selectedCaptainId === captain.id ? 'border-[#0060B8] bg-[#eaf4ff] text-[#0060B8]' : 'border-[#dbe7f2] bg-white text-[#1c1b1b]'}`}><span>{captain.name}</span><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /></button>)}</div>}
            <button type="button" disabled={!selectedCaptainId || isAssigning} onClick={() => void submitAssignment()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0060B8] text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{isAssigning && <LoaderCircle className="animate-spin" size={18} />}<Truck size={18} />{isAssigning ? 'جارٍ التعيين...' : 'تأكيد التعيين'}</button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCancelDialogOpen} onOpenChange={(open) => !isCancelling && setIsCancelDialogOpen(open)}>
        <DialogContent showCloseButton className="max-w-[calc(100%-1.25rem)] rounded-2xl border-[#cfe1f0] bg-[#f0f7ff] p-0 sm:max-w-[390px]" dir="rtl">
          <DialogHeader className="border-b border-[#dbe7f2] bg-white px-5 pt-5 pb-4 text-right"><DialogTitle className="pr-7 text-right text-[19px]">إلغاء الطلب</DialogTitle><DialogDescription className="text-right text-xs">سبب الإلغاء إلزامي وسيظهر في التسلسل الزمني للطلب.</DialogDescription></DialogHeader>
          <div className="space-y-3 p-4"><textarea value={cancellationReason} disabled={isCancelling} onChange={(event) => setCancellationReason(event.target.value)} placeholder="اكتب سبب الإلغاء" className="min-h-28 w-full resize-none rounded-xl border border-[#d1dce6] bg-white p-3 text-sm text-[#1c1b1b] placeholder:text-[#89939e] focus:border-[#0060B8] focus:outline-none focus:ring-2 focus:ring-[#0060B8]/15 disabled:cursor-not-allowed" /><button type="button" disabled={!cancellationReason.trim() || isCancelling} onClick={() => void submitCancellation()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ba1a1a] text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{isCancelling && <LoaderCircle className="animate-spin" size={18} />}<XCircle size={18} />{isCancelling ? 'جارٍ الإلغاء...' : 'تأكيد الإلغاء'}</button></div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Orders() {
  const search = useSearch();
  const requestedFilter = useMemo<StatusFilter>(() => {
    const status = new URLSearchParams(search).get('status');
    if (status === 'delivery_active') return status;
    return filters.includes(status as VisibleStatusFilter) ? status as VisibleStatusFilter : 'all';
  }, [search]);
  const [filter, setFilter] = useState<StatusFilter>(requestedFilter);
  const [query, setQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  useEffect(() => {
    setFilter(requestedFilter);
  }, [requestedFilter]);

  const {
    orders,
    profiles,
    availableCaptains,
    isInitialLoading,
    readError,
    details,
    detailsLoadingOrderId,
    detailsError,
    reload,
    replaceOrder,
    loadOrderDetails,
    assignOrderCaptain,
    cancelOrder,
    pageNumber,
    hasNextPage,
    hasPreviousPage,
    nextPage,
    previousPage,
  } = useAdminOrdersData(filter === 'all' ? undefined : filter);

  const mappedOrders = useMemo(
    () => orders.map((order) => mapLiveOrderListItem(order, profiles)),
    [orders, profiles],
  );

  const selectedOrder = mappedOrders.find((order) => order.id === selectedOrderId) ?? null;
  const visibleOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matchesStatus = (status: OrderStatus) => (
      filter === 'all'
      || (filter === 'delivery_active' ? status === 'received' || status === 'in_delivery' : status === filter)
    );

    return mappedOrders.filter((order) => (
      matchesStatus(order.status as OrderStatus)
      && (!normalized || `${order.orderNumber} ${order.customerName} ${order.customerPhone} ${order.pickupAddress} ${order.deliveryAddress}`.toLowerCase().includes(normalized))
    ));
  }, [filter, mappedOrders, query]);

  const openOrder = (order: LiveOrderListItem) => {
    setSelectedOrderId(order.id);
    void loadOrderDetails(order.id);
  };

  const reportMutationFailure = (label: string, error: unknown, fallbackMessage: string, orderId: string) => {
    console.error(`${label} failed.`, error);
    toast.error(getOrdersErrorMessage(error, fallbackMessage));
    if (error instanceof WebRequestTimeoutError) {
      void reload({ background: true });
      void loadOrderDetails(orderId);
    }
  };

  const handleAssignCaptain = async (orderId: string, captainId: string): Promise<boolean> => {
    if (assigningOrderId) return false;
    const targetOrder = orders.find((order) => order.id === orderId);
    const validCaptain = availableCaptains.some((captain) => captain.id === captainId);
    if (!targetOrder || targetOrder.status !== 'pending') {
      toast.error('يمكن تعيين كابتن للطلب قيد الانتظار فقط.');
      return false;
    }
    if (!validCaptain) {
      toast.error('اختر كابتناً مفعّلاً ومتاحاً.');
      return false;
    }

    setAssigningOrderId(orderId);
    try {
      const assignedOrder = await assignOrderCaptain(orderId, captainId);
      replaceOrder(assignedOrder);
      void loadOrderDetails(orderId);
      toast.success(`تم تعيين الكابتن للطلب #${assignedOrder.order_number}.`);
      return true;
    } catch (error) {
      reportMutationFailure('Assign captain', error, 'تعذر تعيين الكابتن للطلب.', orderId);
      return false;
    } finally {
      setAssigningOrderId(null);
    }
  };

  const handleCancelOrder = async (orderId: string, reason: string): Promise<boolean> => {
    const normalizedReason = reason.trim();
    const targetOrder = orders.find((order) => order.id === orderId);
    if (!normalizedReason) {
      toast.error('أدخل سبب إلغاء الطلب.');
      return false;
    }
    if (!targetOrder || !cancellableStatuses.includes(targetOrder.status)) {
      toast.error('لا يمكن إلغاء هذا الطلب في حالته الحالية.');
      return false;
    }
    if (cancellingOrderId) return false;

    setCancellingOrderId(orderId);
    try {
      const cancelledOrder = await cancelOrder(orderId, normalizedReason);
      replaceOrder(cancelledOrder);
      void loadOrderDetails(orderId);
      toast.success(`تم إلغاء الطلب #${cancelledOrder.order_number}.`);
      return true;
    } catch (error) {
      reportMutationFailure('Cancel order', error, 'تعذر إلغاء الطلب.', orderId);
      return false;
    } finally {
      setCancellingOrderId(null);
    }
  };

  const selectedDetailsRecord = details?.orderId === selectedOrder?.id ? details : null;
  const selectedDetails = selectedDetailsRecord ? mapLiveOrderStops(selectedDetailsRecord.stops) : null;
  const selectedHistory = selectedDetailsRecord && selectedOrder
    ? mapLiveOrderTimeline(selectedDetailsRecord.history, profiles, selectedOrder.cancellationReason)
    : null;

  return (
    <div className="min-h-screen bg-[#eaf5ff] text-[#1c1b1b]" dir="rtl">
      <div className="relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[#f0f7ff] shadow-[0_0_40px_rgba(0,72,141,0.08)]">
        <header className="fixed top-0 right-0 left-0 z-30 mx-auto flex h-16 w-full max-w-[453px] items-center justify-between bg-[#0060B8] px-5 text-white shadow-[0_4px_18px_rgba(0,96,184,0.28)]"><span className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><Package size={21} /></span><div className="flex items-center gap-2"><div className="text-left"><p className="text-[11px] leading-4 text-[#dbeaff]">لوحة الأدمن</p><h1 className="text-[19px] font-bold leading-6">الطلبات</h1></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><Clock3 size={21} /></span></div></header>
        <main className="px-5 pt-[84px] pb-24">
          <section className="rounded-2xl border border-[#d3e3f0] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="flex items-start justify-between gap-3"><div><h2 className="text-[18px] font-bold">قائمة الطلبات</h2><p className="mt-1 text-xs leading-5 text-[#58616b]">ابحث، صفِّ الحالات، ثم اعرض التفاصيل التشغيلية.</p></div><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eaf4ff] text-[#0060B8]"><Package size={23} /></span></div><div className="relative mt-4"><Search className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#75818e]" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث برقم الطلب أو العميل أو العنوان" className="h-11 w-full rounded-xl border border-[#c9d9e7] bg-[#fbfdff] pr-10 pl-3 text-sm placeholder:text-[#8a98a6] focus:border-[#0060B8] focus:outline-none focus:ring-2 focus:ring-[#0060B8]/15" /></div></section>
          <section className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="تصفية حالة الطلب">{filters.map((item) => <button type="button" key={item} onClick={() => setFilter(item)} className={`h-8 shrink-0 rounded-full px-3.5 text-xs font-bold transition-all duration-150 active:scale-[0.96] ${filter === item ? 'bg-[#0060B8] text-white' : 'border border-[#d4e2ec] bg-white text-[#58616b]'}`}>{item === 'all' ? 'الكل' : orderStatusPresentation[item].label}</button>)}</section>
          <section className="mt-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold">الطلبات المعروضة</h2><span className="rounded-full bg-[#dbeeff] px-2.5 py-1 text-xs font-bold text-[#0060B8]">{visibleOrders.length} في الصفحة {pageNumber}</span></div>
            {isInitialLoading && <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-white" />)}</div>}
            {!isInitialLoading && readError && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center"><p className="text-sm leading-6 text-[#ba1a1a]">{readError}</p><button type="button" onClick={() => void reload()} className="mx-auto mt-3 flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-xs font-bold text-[#ba1a1a]"><RefreshCw size={15} />إعادة المحاولة</button></div>}
            {!isInitialLoading && !readError && <div className="space-y-3">{visibleOrders.length ? visibleOrders.map((order) => { const status = orderStatusPresentation[order.status as OrderStatus]; return <button type="button" key={order.id} onClick={() => openOrder(order)} className="relative flex w-full overflow-hidden rounded-2xl border border-[#e0e8ee] bg-white p-4 pr-5 text-right shadow-[0_2px_8px_rgba(0,72,141,0.05)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_5px_12px_rgba(0,72,141,0.08)] active:scale-[0.99]"><span className={`absolute top-0 right-0 h-full w-1.5 ${status.stripClass}`} /><span className="flex min-w-0 flex-1 flex-col gap-1.5"><span className="flex items-center justify-between gap-2"><strong className="text-base leading-5">#{order.orderNumber}</strong><span className={`rounded px-2 py-0.5 text-xs font-bold ${status.className}`}>{status.label}</span></span><span className="flex items-center justify-between gap-3 text-sm"><span>{order.customerName}</span><strong className="shrink-0 text-base">{formatMoney(order.fee)}</strong></span><span className="flex items-center gap-1 text-xs text-[#414752]"><MapPin size={15} />{order.pickupAddress} ← {order.deliveryAddress}</span><time className="text-[10px] text-[#75818e]">{formatDate(order.createdAt)}</time></span><ArrowRight className="my-auto shrink-0 text-[#75818e]" size={20} /></button>; }) : <div className="rounded-2xl border border-dashed border-[#c7dae8] bg-white/70 px-4 py-10 text-center"><Package className="mx-auto text-[#7d9ab0]" size={28} /><p className="mt-2 text-sm font-bold text-[#4f5d6b]">لا توجد طلبات مطابقة</p><p className="mt-1 text-xs text-[#75818e]">جرّب تغيير البحث أو الحالة.</p></div>}</div>}
            {!isInitialLoading && !readError && (hasPreviousPage || hasNextPage) && <nav className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-[#d3e3f0] bg-white p-3" aria-label="تنقل صفحات الطلبات"><button type="button" onClick={() => void previousPage()} disabled={!hasPreviousPage} className="h-10 flex-1 rounded-xl border border-[#c9d9e7] text-xs font-bold text-[#0060B8] disabled:cursor-not-allowed disabled:opacity-45">الصفحة السابقة</button><span className="shrink-0 text-xs font-bold text-[#58616b]">صفحة {pageNumber}</span><button type="button" onClick={() => void nextPage()} disabled={!hasNextPage} className="h-10 flex-1 rounded-xl bg-[#0060B8] text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">الصفحة التالية</button></nav>}
          </section>
        </main>
        <AdminBottomNav active="orders" />
        <OrderDetailsDialog order={selectedOrder} profiles={profiles} details={selectedDetails} history={selectedHistory} isDetailsLoading={detailsLoadingOrderId === selectedOrder?.id} detailsError={selectedOrder ? detailsError : null} availableCaptains={availableCaptains} assigningOrderId={assigningOrderId} cancellingOrderId={cancellingOrderId} onOpenChange={(open) => !open && setSelectedOrderId(null)} onRetryDetails={(orderId) => void loadOrderDetails(orderId)} onAssignCaptain={handleAssignCaptain} onCancelOrder={handleCancelOrder} />
      </div>
    </div>
  );
}
