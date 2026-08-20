/** Design reminder — Shared order details preserve the adopted compact white-card language; cancellation is exposed only while the real order status is pending. */
import { MapPin, Phone, Store, Truck, UserRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { orderStatusPresentation, type AdminOrderDetail } from "@/features/admin/types";

type OrderDetailsDialogProps = {
  order: AdminOrderDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssignCaptain?: (orderId: string) => void;
  onCancelOrder?: (orderId: string) => void;
};

const formatMoney = (amount: number) => `${new Intl.NumberFormat("en-US").format(amount)} ل.س`;

export function OrderDetailsDialog({ order, open, onOpenChange, onAssignCaptain, onCancelOrder }: OrderDetailsDialogProps) {
  if (!order) return null;

  const status = orderStatusPresentation[order.status];
  const canCancel = order.status === "pending";
  const requestAssign = () => onAssignCaptain?.(order.id) ?? toast.info("تعيين الكابتن جاهز للربط مع assign_order_captain.");
  const requestCancel = () => onCancelOrder?.(order.id) ?? toast.info("إلغاء الطلب مع السبب جاهز للربط مع cancel_order.");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="max-h-[88dvh] max-w-[calc(100%-1.25rem)] gap-0 overflow-y-auto rounded-2xl border-[#cfe1f0] bg-[#f0f7ff] p-0 sm:max-w-[430px]" dir="rtl">
        <DialogHeader className="sticky top-0 z-10 border-b border-[#dbe7f2] bg-white px-5 pt-5 pb-4 text-right shadow-[0_2px_7px_rgba(0,72,141,0.04)]">
          <DialogTitle className="pr-7 text-right text-[19px] text-[#1c1b1b]">تفاصيل الطلب #{order.id}</DialogTitle>
          <DialogDescription className="text-right text-xs text-[#58616b]">بيانات عرض تجريبية جاهزة لمصدر البيانات لاحقاً.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 p-4">
          <section className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-[#66727e]">العميل</p>
                <h3 className="mt-1 text-base font-bold">{order.customer}</h3>
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[#58616b]" dir="ltr"><Phone size={14} />{order.customerPhone}</p>
              </div>
              <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${status.className}`}>{status.label}</span>
            </div>
          </section>

          <section className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5">
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold">المصدر والوجهة</h3><strong className="text-sm text-[#0060B8]">{formatMoney(order.fee)}</strong></div>
            <div className="mt-3 space-y-3">
              {order.pickups.map((place, index) => (
                <div key={`pickup-${index}`} className="flex gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-100 text-[#0060B8]"><Store size={16} /></span><div><strong className="text-xs">{place.name}</strong><p className="mt-0.5 text-[11px] text-[#66727e]">{place.address}</p>{place.note && <p className="mt-1 rounded-md bg-[#f4f8fb] px-2 py-1 text-[10px] text-[#58616b]">{place.note}</p>}</div></div>
              ))}
              {order.destinations.map((place, index) => (
                <div key={`destination-${index}`} className="flex gap-2.5 border-t border-dashed border-[#dbe7f2] pt-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><MapPin size={16} /></span><div><strong className="text-xs">{place.name}</strong><p className="mt-0.5 text-[11px] text-[#66727e]">{place.address}</p></div></div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5">
            <h3 className="text-sm font-bold">الكابتن</h3>
            <div className="mt-3 flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#e7edf2] text-[#52606d]"><UserRound size={17} /></span><div><strong className="text-xs">{order.captain?.name ?? "لم يُعيّن كابتن بعد"}</strong><p className="mt-0.5 text-[10px] text-[#75818e]">{order.captain ? "الكابتن المعيّن على الطلب" : "بانتظار التعيين"}</p></div></div>
          </section>

          <section className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5">
            <h3 className="text-sm font-bold">التسلسل الزمني</h3>
            <div className="relative mt-4 space-y-3 before:absolute before:top-3 before:bottom-3 before:right-[13px] before:w-px before:bg-[#d9e7f1]">
              {order.timeline.map((item, index) => {
                const itemStatus = orderStatusPresentation[item.status];
                return <div key={`${item.status}-${index}`} className="relative flex gap-3"><span className={`z-10 mt-0.5 h-7 w-7 shrink-0 rounded-full border-4 border-white ${itemStatus.stripClass}`} /><div><strong className="text-xs">{item.label}</strong><p className="mt-0.5 text-[10px] text-[#66727e]">{item.timestamp} — {item.actor}</p></div></div>;
              })}
            </div>
          </section>

          <div className={`grid gap-2 ${canCancel ? "grid-cols-2" : "grid-cols-1"}`}>
            <button type="button" onClick={requestAssign} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[#a8c8ff] bg-[#eef6ff] text-xs font-bold text-[#0060B8] active:scale-[0.98]"><Truck size={16} />{order.captain ? "تغيير الكابتن" : "تعيين كابتن"}</button>
            {canCancel ? <button type="button" onClick={requestCancel} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-[#ba1a1a] active:scale-[0.98]"><XCircle size={16} />إلغاء مع سبب</button> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
