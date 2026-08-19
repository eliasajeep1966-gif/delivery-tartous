/**
 * Design reminder — Corporate Modern Mobile Operations:
 * RTL support center, calm white cards, blue hierarchy, concise helpful copy, Cairo typography.
 */
import { useState } from "react";
import { ChevronDown, CircleHelp, Headphones, MessageCircleQuestion, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { MorePageLayout } from "@/components/MorePageLayout";

const questions = [
  { q: "كيف يتم إنشاء طلب جديد؟", a: "من الرئيسية اضغط إنشاء طلب جديد، أضف مصدر الاستلام والوجهة، ثم اختر كابتناً متاحاً وأرسل الطلب." },
  { q: "كيف أسلّم دفعة لكابتن؟", a: "من الأجور افتح أجور الكباتن، اختر الفترة والكابتن، ثم اضغط تسليم دفعة وسجل المبلغ." },
  { q: "أين أجد سجل العمليات؟", a: "من المزيد افتح سجل الحركات. ستظهر عمليات الطلبات والمستخدمين والحالة ومن قام بها." },
];

export default function Help() {
  const [open, setOpen] = useState<number | null>(0);
  return <MorePageLayout title="المساعدة والدعم" subtitle="" Icon={CircleHelp}>
    <section className="rounded-2xl bg-[#0060B8] p-5 text-white shadow-[0_6px_16px_rgba(0,96,184,0.2)]"><Headphones size={28} /><h2 className="mt-3 text-[19px] font-bold">كيف يمكننا مساعدتك؟</h2><p className="mt-1 text-xs leading-5 text-[#dceaff]">اطلع على الإجابات السريعة أو أرسل طلب مساعدة لإدارة المكتب.</p><button type="button" onClick={() => toast.success("تم فتح طلب مساعدة تجريبي.")} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white text-xs font-bold text-[#0060B8] active:scale-[0.98]"><MessageCircleQuestion size={17} />طلب مساعدة</button></section>
    <section className="mt-6"><h2 className="mb-3 text-base font-bold">أسئلة شائعة</h2><div className="space-y-2">{questions.map((item, index) => { const active = open === index; return <article key={item.q} className="overflow-hidden rounded-2xl border border-[#dbe7f2] bg-white shadow-[0_2px_8px_rgba(0,72,141,0.04)]"><button type="button" onClick={() => setOpen(active ? null : index)} className="flex w-full items-center justify-between gap-3 p-3.5 text-right"><strong className="text-sm">{item.q}</strong><ChevronDown className={`shrink-0 text-[#66727e] transition-transform ${active ? "rotate-180" : ""}`} size={19} /></button>{active && <p className="border-t border-[#eef3f7] px-3.5 py-3 text-xs leading-6 text-[#58616b]">{item.a}</p>}</article>; })}</div></section><section className="mt-6 rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.04)]"><div className="flex items-center gap-2 text-emerald-700"><ShieldCheck size={20} /><h2 className="text-sm font-bold">ملاحظة للأدمن</h2></div><p className="mt-2 text-xs leading-5 text-[#58616b]">كل العمليات المهمة تُتابع من سجل الحركات، ويمكنك الرجوع إليه من المزيد.</p></section>
  </MorePageLayout>;
}
