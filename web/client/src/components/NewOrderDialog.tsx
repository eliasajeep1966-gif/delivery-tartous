/**
 * Design reminder — Corporate Modern Mobile Operations:
 * RTL modal, stacked white information cards, #0060B8 for primary actions, Cairo Arabic typography.
 */
import { useRef, useState, type FormEvent } from "react";
import { FileText, MapPin, Phone, Plus, Send, Store, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CaptainOption, OrderDraft, OrderDraftSubmission } from "@/features/admin/types";

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
  onSubmitDraft?: (submission: OrderDraftSubmission) => void;
};

const createLocationEntry = (id: string): LocationEntry => ({
  id,
  name: "",
  phone: "",
  address: "",
  note: "",
});

function LocationFields({
  title,
  description,
  icon,
  locations,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  description: string;
  icon: "pickup" | "destination";
  locations: LocationEntry[];
  onChange: (id: string, field: keyof Omit<LocationEntry, "id">, value: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const HeadingIcon = icon === "pickup" ? Store : MapPin;
  const inputClassName =
    "h-10 w-full rounded-lg border border-[#d1dce6] bg-white px-3 text-sm text-[#1c1b1b] placeholder:text-[#89939e] focus:border-[#0060B8] focus:outline-none focus:ring-2 focus:ring-[#0060B8]/15";

  return (
    <section className="rounded-2xl border border-[#dbe7f2] bg-[#f7fbff] p-3.5" aria-label={title}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${icon === "pickup" ? "bg-blue-100 text-[#0060B8]" : "bg-emerald-100 text-emerald-600"}`}>
            <HeadingIcon size={19} strokeWidth={2.25} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#1c1b1b]">{title}</h3>
            <p className="text-[11px] leading-4 text-[#58616b]">{description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#a8c8ff] bg-white text-[#0060B8] transition-transform duration-150 hover:bg-[#eaf4ff] active:scale-[0.95]"
          aria-label={`إضافة ${title}`}
        >
          <Plus size={20} strokeWidth={2.6} />
        </button>
      </div>

      <div className="space-y-3">
        {locations.map((location, index) => (
          <div key={location.id} className="rounded-xl border border-[#e4edf5] bg-white p-3 shadow-[0_1px_4px_rgba(0,72,141,0.04)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-[#0060B8]">{index + 1}. {icon === "pickup" ? "مصدر الاستلام" : "وجهة التسليم"}</span>
              {locations.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(location.id)}
                  className="grid h-7 w-7 place-items-center rounded-lg text-[#ba1a1a] transition-colors hover:bg-red-50"
                  aria-label={`حذف ${icon === "pickup" ? "مصدر الاستلام" : "وجهة التسليم"} ${index + 1}`}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="sr-only" htmlFor={`${icon}-name-${location.id}`}>الاسم</label>
              <input
                id={`${icon}-name-${location.id}`}
                value={location.name}
                onChange={(event) => onChange(location.id, "name", event.target.value)}
                placeholder={icon === "pickup" ? "اسم المحل أو المصدر" : "اسم المستلم"}
                className={inputClassName}
                required
              />
              <label className="sr-only" htmlFor={`${icon}-phone-${location.id}`}>رقم الهاتف</label>
              <div className="relative">
                <Phone className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#66727e]" size={15} />
                <input
                  id={`${icon}-phone-${location.id}`}
                  value={location.phone}
                  onChange={(event) => onChange(location.id, "phone", event.target.value)}
                  placeholder="رقم الهاتف"
                  inputMode="tel"
                  className={`${inputClassName} pr-9`}
                  required
                />
              </div>
            </div>
            <label className="sr-only" htmlFor={`${icon}-address-${location.id}`}>العنوان</label>
            <div className="relative mt-2">
              <MapPin className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#66727e]" size={15} />
              <input
                id={`${icon}-address-${location.id}`}
                value={location.address}
                onChange={(event) => onChange(location.id, "address", event.target.value)}
                placeholder="العنوان التفصيلي"
                className={`${inputClassName} pr-9`}
                required
              />
            </div>
            {icon === "pickup" && (
              <label className="mt-2 block">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#58616b]"><FileText size={14} />ملاحظات المصدر <em className="font-normal text-[#7b8793]">(اختياري)</em></span>
                <textarea
                  value={location.note}
                  onChange={(event) => onChange(location.id, "note", event.target.value)}
                  placeholder="مثال: طلب سريع — تطبّق استثناءات التوزيع المطابقة لهذه الملاحظة"
                  className="mt-1.5 min-h-[72px] w-full resize-none rounded-lg border border-[#d1dce6] bg-[#fbfdff] p-3 text-sm text-[#1c1b1b] placeholder:text-[#89939e] focus:border-[#0060B8] focus:outline-none focus:ring-2 focus:ring-[#0060B8]/15"
                />
              </label>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function NewOrderDialog({ open, onOpenChange, captains, onSubmitDraft }: NewOrderDialogProps) {
  const locationSequence = useRef(0);
  const createDraftLocation = () => createLocationEntry(`location-${locationSequence.current++}`);
  const [pickups, setPickups] = useState<LocationEntry[]>([createDraftLocation()]);
  const [destinations, setDestinations] = useState<LocationEntry[]>([createDraftLocation()]);
  const [captainId, setCaptainId] = useState("");
  const availableOnly = captains.filter((captain) => captain.availability === "available");

  const updateLocation = (
    setter: React.Dispatch<React.SetStateAction<LocationEntry[]>>,
    id: string,
    field: keyof Omit<LocationEntry, "id">,
    value: string,
  ) => {
    setter((locations) => locations.map((location) => (location.id === id ? { ...location, [field]: value } : location)));
  };

  const resetForm = () => {
    setPickups([createDraftLocation()]);
    setDestinations([createDraftLocation()]);
    setCaptainId("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) resetForm();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!captainId) {
      toast.error("اختر كابتناً متاحاً قبل إرسال الطلب.");
      return;
    }

    const draft: OrderDraft = {
      pickups: pickups.map(({ name, phone, address, note }) => ({ name, phone, address, note: note || undefined })),
      destinations: destinations.map(({ name, phone, address }) => ({ name, phone, address })),
    };
    onSubmitDraft?.({ draft, captainId });
    toast.info("تم تجهيز مسودة الطلب للربط. لم يُنشأ طلب أو رقم طلب داخل الواجهة.");
    handleOpenChange(false);
  };

  const addLocation = (setter: React.Dispatch<React.SetStateAction<LocationEntry[]>>) => {
    setter((locations) => [...locations, createDraftLocation()]);
  };

  const removeLocation = (setter: React.Dispatch<React.SetStateAction<LocationEntry[]>>, id: string) => {
    setter((locations) => (locations.length > 1 ? locations.filter((location) => location.id !== id) : locations));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton className="max-h-[88dvh] max-w-[calc(100%-1.25rem)] gap-0 overflow-y-auto rounded-2xl border-[#cfe1f0] bg-[#f0f7ff] p-0 sm:max-w-[430px]" dir="rtl">
        <DialogHeader className="sticky top-0 z-10 border-b border-[#dbe7f2] bg-white px-5 pt-5 pb-4 text-right shadow-[0_2px_7px_rgba(0,72,141,0.04)]">
          <DialogTitle className="pr-7 text-right text-[19px] text-[#1c1b1b]">إنشاء طلب جديد</DialogTitle>
          <DialogDescription className="text-right text-xs text-[#58616b]">أضف مصادر الاستلام ووجهات التسليم، ثم اختر كابتناً متاحاً.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 p-4">
          <LocationFields
            title="مصادر الاستلام"
            description="المكان الذي سيستلم منه الكابتن الطلب"
            icon="pickup"
            locations={pickups}
            onChange={(id, field, value) => updateLocation(setPickups, id, field, value)}
            onAdd={() => addLocation(setPickups)}
            onRemove={(id) => removeLocation(setPickups, id)}
          />

          <LocationFields
            title="وجهات التسليم"
            description="المكان الذي ستصل إليه الطلبية"
            icon="destination"
            locations={destinations}
            onChange={(id, field, value) => updateLocation(setDestinations, id, field, value)}
            onAdd={() => addLocation(setDestinations)}
            onRemove={(id) => removeLocation(setDestinations, id)}
          />

          <section className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-600"><UserRound size={19} strokeWidth={2.25} /></span>
              <div>
                <h3 className="text-sm font-bold text-[#1c1b1b]">اختيار الكابتن</h3>
                <p className="text-[11px] leading-4 text-[#58616b]">تظهر هنا الأسماء ذات الحالة المتاحة فقط</p>
              </div>
            </div>
            <Select value={captainId} onValueChange={setCaptainId} required>
              <SelectTrigger className="h-11 w-full rounded-xl border-[#c9d9e7] bg-[#fbfdff] text-right" aria-label="اختر كابتناً متاحاً">
                <SelectValue placeholder="اختر كابتناً متاحاً" />
              </SelectTrigger>
              <SelectContent dir="rtl" className="border-[#c9d9e7] bg-white">
                {availableOnly.map((captain) => (
                  <SelectItem key={captain.id} value={captain.id} className="justify-end py-2.5">
                    <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />{captain.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0060B8] text-sm font-bold text-white shadow-[0_4px_12px_rgba(0,96,184,0.22)] transition-all duration-150 hover:bg-[#0057a7] active:scale-[0.98]">
            <Send size={18} />
            إرسال الطلبية
          </button>
          <p className="pb-1 text-center text-[10px] leading-4 text-[#66727e]">الإرسال تجريبي حالياً وسيُربط بالخلفية عند بدء مرحلة التطبيق الحقيقي.</p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
