/**
 * Design reminder — Corporate Modern Mobile Operations:
 * RTL modal, stacked white information cards, #0060B8 for primary actions, Cairo Arabic typography.
 */
import { useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { Banknote, FileText, LoaderCircle, MapPin, Phone, Plus, Send, Store, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CaptainOption, CreateOrderFlowDraft, OrderDraft } from '@/features/admin/types';

type LocationEntry = {
  id: string;
  name: string;
  phone: string;
  address: string;
  note: string;
};

type NewOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  captains: CaptainOption[];
  isSubmitting: boolean;
  // Integration calls create_order_with_stops, then assign_order_captain with the returned order id.
  onSubmitCreateOrderFlow: (flow: CreateOrderFlowDraft) => Promise<void>;
};

const createLocationEntry = (id: string): LocationEntry => ({ id, name: '', phone: '', address: '', note: '' });

function LocationFields({
  title,
  description,
  icon,
  locations,
  disabled,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  description: string;
  icon: 'pickup' | 'destination';
  locations: LocationEntry[];
  disabled: boolean;
  onChange: (id: string, field: keyof Omit<LocationEntry, 'id'>, value: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const HeadingIcon = icon === 'pickup' ? Store : MapPin;
  const inputClassName = 'h-10 w-full rounded-lg border border-[#d1dce6] bg-white px-3 text-sm text-[#1c1b1b] placeholder:text-[#89939e] focus:border-[#0060B8] focus:outline-none focus:ring-2 focus:ring-[#0060B8]/15 disabled:cursor-not-allowed disabled:opacity-70';

  return (
    <section className="rounded-2xl border border-[#dbe7f2] bg-[#f7fbff] p-3.5" aria-label={title}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2"><span className={`grid h-9 w-9 place-items-center rounded-xl ${icon === 'pickup' ? 'bg-blue-100 text-[#0060B8]' : 'bg-emerald-100 text-emerald-600'}`}><HeadingIcon size={19} strokeWidth={2.25} /></span><div><h3 className="text-sm font-bold text-[#1c1b1b]">{title}</h3><p className="text-[11px] leading-4 text-[#58616b]">{description}</p></div></div>
        <button type="button" disabled={disabled} onClick={onAdd} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#a8c8ff] bg-white text-[#0060B8] transition-transform duration-150 hover:bg-[#eaf4ff] active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-60" aria-label={`إضافة ${title}`}><Plus size={20} strokeWidth={2.6} /></button>
      </div>
      <div className="space-y-3">
        {locations.map((location, index) => (
          <div key={location.id} className="rounded-xl border border-[#e4edf5] bg-white p-3 shadow-[0_1px_4px_rgba(0,72,141,0.04)]">
            <div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-[#0060B8]">{index + 1}. {icon === 'pickup' ? 'مصدر الاستلام' : 'وجهة التسليم'}</span>{locations.length > 1 && <button type="button" disabled={disabled} onClick={() => onRemove(location.id)} className="grid h-7 w-7 place-items-center rounded-lg text-[#ba1a1a] transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60" aria-label={`حذف ${icon === 'pickup' ? 'مصدر الاستلام' : 'وجهة التسليم'} ${index + 1}`}><Trash2 size={16} /></button>}</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><input value={location.name} disabled={disabled} onChange={(event) => onChange(location.id, 'name', event.target.value)} placeholder={icon === 'pickup' ? 'اسم المحل أو المصدر' : 'اسم المستلم'} className={inputClassName} required /><div className="relative"><Phone className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#66727e]" size={15} /><input value={location.phone} disabled={disabled} onChange={(event) => onChange(location.id, 'phone', event.target.value)} placeholder="رقم الهاتف" inputMode="tel" className={`${inputClassName} pr-9`} required /></div></div>
            <div className="relative mt-2"><MapPin className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#66727e]" size={15} /><input value={location.address} disabled={disabled} onChange={(event) => onChange(location.id, 'address', event.target.value)} placeholder="العنوان التفصيلي" className={`${inputClassName} pr-9`} required /></div>
            {icon === 'pickup' && <label className="mt-2 block"><span className="flex items-center gap-1.5 text-[11px] font-bold text-[#58616b]"><FileText size={14} />ملاحظات المصدر <em className="font-normal text-[#7b8793]">(اختياري)</em></span><textarea value={location.note} disabled={disabled} onChange={(event) => onChange(location.id, 'note', event.target.value)} placeholder="مثال: طلب سريع" className="mt-1.5 min-h-[72px] w-full resize-none rounded-lg border border-[#d1dce6] bg-[#fbfdff] p-3 text-sm text-[#1c1b1b] placeholder:text-[#89939e] focus:border-[#0060B8] focus:outline-none focus:ring-2 focus:ring-[#0060B8]/15 disabled:cursor-not-allowed disabled:opacity-70" /></label>}
          </div>
        ))}
      </div>
    </section>
  );
}

function normalizeLocations(locations: LocationEntry[], kind: string): OrderDraft['pickups'] {
  return locations.map((location, index) => {
    const name = location.name.trim();
    const phone = location.phone.trim();
    const address = location.address.trim();
    if (!name || !phone || !address) throw new Error(`أكمل الاسم والهاتف والعنوان في ${kind} رقم ${index + 1}.`);
    return { name, phone, address, note: location.note.trim() || undefined };
  });
}

export function NewOrderDialog({ open, onOpenChange, captains, isSubmitting, onSubmitCreateOrderFlow }: NewOrderDialogProps) {
  const locationSequence = useRef(0);
  const createDraftLocation = () => createLocationEntry(`location-${locationSequence.current++}`);
  const [pickups, setPickups] = useState<LocationEntry[]>([createDraftLocation()]);
  const [destinations, setDestinations] = useState<LocationEntry[]>([createDraftLocation()]);
  const [feeInput, setFeeInput] = useState('');
  const [captainId, setCaptainId] = useState('');
  const availableCaptains = captains.filter((captain) => captain.availability === 'available');

  const updateLocation = (setter: Dispatch<SetStateAction<LocationEntry[]>>, id: string, field: keyof Omit<LocationEntry, 'id'>, value: string) => {
    setter((locations) => locations.map((location) => (location.id === id ? { ...location, [field]: value } : location)));
  };

  const resetForm = () => {
    setPickups([createDraftLocation()]);
    setDestinations([createDraftLocation()]);
    setFeeInput('');
    setCaptainId('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSubmitting) return;
    onOpenChange(nextOpen);
    if (!nextOpen) resetForm();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const totalFee = Number(feeInput.trim());
    if (!Number.isFinite(totalFee) || totalFee <= 0) {
      toast.error('أدخل أجرة الطلب كاملة كرقم موجب.');
      return;
    }
    if (!availableCaptains.some((captain) => captain.id === captainId)) {
      toast.error('اختر كابتناً مفعّلاً ومتاحاً قبل إرسال الطلب.');
      return;
    }

    try {
      const order: OrderDraft = {
        pickups: normalizeLocations(pickups, 'مصدر الاستلام'),
        destinations: normalizeLocations(destinations, 'وجهة التسليم').map(({ name, phone, address }) => ({ name, phone, address })),
      };
      await onSubmitCreateOrderFlow({ order, totalFee, assignedCaptainId: captainId });
    } catch (error) {
      console.error('Create order form validation or submission failed.', error);
      if (error instanceof Error && error.message) toast.error(error.message);
      else toast.error('تعذر تجهيز الطلب. تحقق من البيانات وحاول مرة أخرى.');
    }
  };

  const addLocation = (setter: Dispatch<SetStateAction<LocationEntry[]>>) => setter((locations) => [...locations, createDraftLocation()]);
  const removeLocation = (setter: Dispatch<SetStateAction<LocationEntry[]>>, id: string) => setter((locations) => (locations.length > 1 ? locations.filter((location) => location.id !== id) : locations));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!isSubmitting} className="max-h-[88dvh] max-w-[calc(100%-1.25rem)] gap-0 overflow-y-auto rounded-2xl border-[#cfe1f0] bg-[#f0f7ff] p-0 sm:max-w-[430px]" dir="rtl">
        <DialogHeader className="sticky top-0 z-10 border-b border-[#dbe7f2] bg-white px-5 pt-5 pb-4 text-right shadow-[0_2px_7px_rgba(0,72,141,0.04)]"><DialogTitle className="pr-7 text-right text-[19px] text-[#1c1b1b]">إنشاء طلب جديد</DialogTitle><DialogDescription className="text-right text-xs text-[#58616b]">أضف مصادر الاستلام ووجهات التسليم، ثم اختر كابتناً متاحاً.</DialogDescription></DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3 p-4">
          <LocationFields title="مصادر الاستلام" description="المكان الذي سيستلم منه الكابتن الطلب" icon="pickup" locations={pickups} disabled={isSubmitting} onChange={(id, field, value) => updateLocation(setPickups, id, field, value)} onAdd={() => addLocation(setPickups)} onRemove={(id) => removeLocation(setPickups, id)} />
          <LocationFields title="وجهات التسليم" description="المكان الذي ستصل إليه الطلبية" icon="destination" locations={destinations} disabled={isSubmitting} onChange={(id, field, value) => updateLocation(setDestinations, id, field, value)} onAdd={() => addLocation(setDestinations)} onRemove={(id) => removeLocation(setDestinations, id)} />
          <section className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5"><div className="mb-2 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700"><Banknote size={19} strokeWidth={2.25} /></span><div><h3 className="text-sm font-bold text-[#1c1b1b]">أجرة الطلب كاملة</h3><p className="text-[11px] leading-4 text-[#58616b]">أدخل الأجرة الإجمالية للطلب بالكامل</p></div></div><div className="relative"><input type="number" min="0.01" step="any" inputMode="decimal" disabled={isSubmitting} value={feeInput} onChange={(event) => { event.currentTarget.setCustomValidity(''); setFeeInput(event.target.value); }} onInvalid={(event) => event.currentTarget.setCustomValidity('أدخل أجرة الطلب كاملة كرقم موجب.')} placeholder="مثال: 25000" className="h-11 w-full rounded-xl border border-[#c9d9e7] bg-[#fbfdff] pr-3 pl-14 text-right text-sm text-[#1c1b1b] placeholder:text-[#8a98a6] focus:border-[#0060B8] focus:outline-none focus:ring-2 focus:ring-[#0060B8]/15 disabled:cursor-not-allowed disabled:opacity-70" required /><span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs font-bold text-[#58616b]">ل.س</span></div></section>
          <section className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5"><div className="mb-2 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-600"><UserRound size={19} strokeWidth={2.25} /></span><div><h3 className="text-sm font-bold text-[#1c1b1b]">اختيار الكابتن</h3><p className="text-[11px] leading-4 text-[#58616b]">تظهر الكباتن المفعّلة والمتاحة فقط</p></div></div>{availableCaptains.length === 0 ? <p className="rounded-xl border border-dashed border-[#bfd6eb] bg-[#f7fbff] p-3 text-center text-xs text-[#58616b]">لا يوجد كابتن متاح حالياً.</p> : <Select value={captainId} onValueChange={setCaptainId} disabled={isSubmitting}><SelectTrigger className="h-11 w-full rounded-xl border-[#c9d9e7] bg-[#fbfdff] text-right" aria-label="اختر كابتناً متاحاً"><SelectValue placeholder="اختر كابتناً متاحاً" /></SelectTrigger><SelectContent dir="rtl" className="border-[#c9d9e7] bg-white">{availableCaptains.map((captain) => <SelectItem key={captain.id} value={captain.id} className="justify-end py-2.5"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />{captain.name}</span></SelectItem>)}</SelectContent></Select>}</section>
          <button type="submit" disabled={isSubmitting || availableCaptains.length === 0} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0060B8] text-sm font-bold text-white shadow-[0_4px_12px_rgba(0,96,184,0.22)] transition-all duration-150 hover:bg-[#0057a7] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting && <LoaderCircle className="animate-spin" size={18} />}<Send size={18} />{isSubmitting ? 'جارٍ إنشاء الطلب...' : 'إرسال الطلبية'}</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
