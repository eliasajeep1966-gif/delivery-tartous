/**
 * Design reminder — Corporate Modern Mobile Operations:
 * RTL custody tracking, amber asset distinction, operational white cards, Cairo typography.
 */
import { useMemo, useState } from "react";
import { CheckCheck, PackageCheck, PackageOpen, Truck } from "lucide-react";
import { toast } from "sonner";
import { MorePageLayout } from "@/components/MorePageLayout";

type CustodyStatus = "مع الكابتن" | "تم التسليم";
type CaptainCustody = { id: string; name: string; initial: string; items: string[]; status: CustodyStatus };
const initialCustodies: CaptainCustody[] = [
  { id: "c1", name: "محمد علي", initial: "م", items: ["حقيبة حرارية", "هاتف العمل", "وصلة شحن"], status: "مع الكابتن" },
  { id: "c2", name: "حسن يوسف", initial: "ح", items: ["حقيبة حرارية", "سترة دليفري"], status: "مع الكابتن" },
  { id: "c3", name: "رامي إبراهيم", initial: "ر", items: ["حقيبة حرارية"], status: "تم التسليم" },
];

export default function Custody() {
  const [custodies, setCustodies] = useState(initialCustodies);
  const [filter, setFilter] = useState<"الكل" | CustodyStatus>("الكل");
  const visible = useMemo(() => custodies.filter((captain) => filter === "الكل" || captain.status === filter), [custodies, filter]);
  const returnCustody = (id: string, name: string) => { setCustodies((current) => current.map((captain) => captain.id === id ? { ...captain, status: "تم التسليم" } : captain)); toast.success(`تم تسجيل تسليم أمانات ${name}.`); };
  const heldCount = custodies.filter((captain) => captain.status === "مع الكابتن").length;
  return <MorePageLayout title="إدارة الأمانات" subtitle="" Icon={PackageCheck}>
    <section className="rounded-2xl border border-[#ecd6a5] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="flex items-start justify-between gap-3"><div><h2 className="text-[18px] font-bold">أمانات الكباتن</h2><p className="mt-1 text-xs leading-5 text-[#756447]">تابع ما استلمه كل كابتن وسجل تسليمه عند إعادته.</p></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-700"><PackageOpen size={23} /></span></div><div className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">يوجد <strong>{heldCount}</strong> كباتن لديهم أمانات حالياً.</div></section>
    <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{(["الكل", "مع الكابتن", "تم التسليم"] as const).map((item) => <button type="button" key={item} onClick={() => setFilter(item)} className={`h-9 shrink-0 rounded-full px-4 text-xs font-bold active:scale-[0.96] ${filter === item ? "bg-[#0060B8] text-white" : "border border-[#d4e2ec] bg-white text-[#58616b]"}`}>{item}</button>)}</div>
    <section className="mt-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold">سجل الأمانات</h2><span className="rounded-full bg-[#fff3dc] px-2.5 py-1 text-xs font-bold text-amber-700">{visible.length} سجلات</span></div><div className="space-y-3">{visible.map((captain) => <article key={captain.id} className="rounded-2xl border border-[#dbe7f2] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#e7edf2] text-sm font-bold text-[#52606d]">{captain.initial}</span><div><h3 className="font-bold">{captain.name}</h3><span className={`mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${captain.status === "مع الكابتن" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{captain.status === "مع الكابتن" ? <Truck size={12} /> : <CheckCheck size={12} />}{captain.status}</span></div></div><span className="text-xs text-[#75818e]">{captain.items.length} أغراض</span></div><div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#eef3f7] pt-3">{captain.items.map((item) => <span key={item} className="rounded-lg bg-[#f4f8fb] px-2.5 py-1.5 text-[11px] font-bold text-[#4f5d6b]">{item}</span>)}</div>{captain.status === "مع الكابتن" && <button type="button" onClick={() => returnCustody(captain.id, captain.name)} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700 active:scale-[0.98]"><CheckCheck size={17} />تسجيل تسليم الأمانات</button>}</article>)}</div></section>
  </MorePageLayout>;
}
