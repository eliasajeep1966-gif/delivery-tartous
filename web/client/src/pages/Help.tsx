import { useState, type FormEvent } from "react";
import { ChevronDown, CircleHelp, Headphones, Mail, MessageCircle, Send, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { MorePageLayout } from "@/components/MorePageLayout";

const questions = [
  { q: "كيف يتم إنشاء طلب جديد؟", a: "من الرئيسية اضغط إنشاء طلب جديد، أضف مصدر الاستلام والوجهة، ثم اختر كابتناً متاحاً وأرسل الطلب." },
  { q: "كيف أسلّم دفعة لكابتن؟", a: "من الأجور افتح أجور الكباتن، اختر الفترة والكابتن، ثم اضغط تسليم دفعة وسجل المبلغ." },
  { q: "أين أجد سجل العمليات؟", a: "من المزيد افتح سجل الحركات. ستظهر عمليات الطلبات والمستخدمين والحالة ومن قام بها." },
];

type ContactChannel = "email" | "whatsapp" | "telegram";

const categoryLabels: Record<string, string> = {
  order: "مشكلة في طلب",
  captain: "مشكلة في كابتن",
  finance: "الأجور أو الأمانات",
  login: "تسجيل الدخول",
  suggestion: "اقتراح أو ملاحظة",
  other: "موضوع آخر",
};

function buildReportMessage(name: string, category: string, orderNumber: string, description: string): string {
  return [
    "مرحباً، أريد الإبلاغ عن مشكلة في تطبيق Delivery Tartous.",
    "",
    `الاسم: ${name.trim() || "غير مذكور"}`,
    `نوع البلاغ: ${categoryLabels[category] ?? category}`,
    `رقم الطلب: ${orderNumber.trim() || "غير مرتبط بطلب"}`,
    "",
    "تفاصيل البلاغ:",
    description.trim(),
  ].join("\n");
}

export default function Help() {
  const [open, setOpen] = useState<number | null>(0);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("order");
  const [orderNumber, setOrderNumber] = useState("");
  const [description, setDescription] = useState("");
  const [channel, setChannel] = useState<ContactChannel>("email");
  const [formError, setFormError] = useState<string | null>(null);

  const submitReport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const cleanDescription = description.trim();
    if (cleanDescription.length < 10) {
      setFormError("اكتب تفاصيل البلاغ بعشر كلمات أو أحرف على الأقل.");
      return;
    }

    const message = buildReportMessage(name, category, orderNumber, cleanDescription);
    const subject = `بلاغ دعم — ${categoryLabels[category] ?? "Delivery Tartous"}`;
    const encodedMessage = encodeURIComponent(message);

    if (channel === "email") {
      window.location.href = `mailto:eliasajeep1966@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodedMessage}`;
    } else if (channel === "whatsapp") {
      window.open(`https://wa.me/96399658677?text=${encodedMessage}`, "_blank", "noopener,noreferrer");
    } else {
      window.open("https://t.me/Eliasajeep", "_blank", "noopener,noreferrer");
    }

    toast.success(channel === "email" ? "تم تجهيز رسالة البلاغ في البريد." : "تم فتح قناة التواصل لإرسال البلاغ.");
  };

  return <MorePageLayout title="المساعدة والدعم" subtitle="قنوات التواصل ونموذج الإبلاغ" Icon={CircleHelp}>
    <section className="rounded-2xl bg-[#0060B8] p-5 text-white shadow-[0_6px_16px_rgba(0,96,184,0.2)]"><Headphones size={28} /><h2 className="mt-3 text-[19px] font-bold">كيف يمكننا مساعدتك؟</h2><p className="mt-1 text-xs leading-5 text-[#dceaff]">فريق دعم Delivery Tartous متاح عبر القنوات التالية. اختر القناة المناسبة أو أرسل بلاغاً مفصلاً.</p><div className="mt-4 grid grid-cols-3 gap-2"><a href="tel:099658677" className="flex h-10 items-center justify-center gap-1 rounded-xl bg-white text-[11px] font-bold text-[#0060B8]"><Smartphone size={15} />اتصال</a><a href="https://wa.me/96399658677" target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center gap-1 rounded-xl bg-white text-[11px] font-bold text-[#0060B8]"><MessageCircle size={15} />واتساب</a><a href="https://t.me/Eliasajeep" target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center gap-1 rounded-xl bg-white text-[11px] font-bold text-[#0060B8]"><Send size={15} />Telegram</a></div><a href="mailto:eliasajeep1966@gmail.com" className="mt-2 flex h-10 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 text-xs font-bold text-white"><Mail size={16} />eliasajeep1966@gmail.com</a></section>

    <form onSubmit={submitReport} className="mt-6 rounded-2xl border border-[#dbe7f2] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.04)]"><div className="flex items-center gap-2 text-[#0060B8]"><MessageCircle size={20} /><h2 className="text-[16px] font-bold">إبلاغ عن مشكلة</h2></div><p className="mt-1 text-xs leading-5 text-[#66727e]">اكتب التفاصيل، ثم اختر الطريقة التي تريد إرسال البلاغ من خلالها.</p><div className="mt-4 space-y-3"><input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="اسمك — اختياري" autoComplete="name" className="h-11 w-full rounded-xl border border-[#cfe0ec] bg-[#f8fcff] px-3 text-right text-sm outline-none transition-colors focus:border-[#0060B8]" /><select value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 w-full rounded-xl border border-[#cfe0ec] bg-[#f8fcff] px-3 text-right text-sm outline-none focus:border-[#0060B8]"><option value="order">مشكلة في طلب</option><option value="captain">مشكلة في كابتن</option><option value="finance">الأجور أو الأمانات</option><option value="login">تسجيل الدخول</option><option value="suggestion">اقتراح أو ملاحظة</option><option value="other">موضوع آخر</option></select><input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} inputMode="numeric" maxLength={20} placeholder="رقم الطلب — اختياري" className="h-11 w-full rounded-xl border border-[#cfe0ec] bg-[#f8fcff] px-3 text-right text-sm outline-none transition-colors focus:border-[#0060B8]" /><textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={4000} rows={4} placeholder="اشرح المشكلة بالتفصيل..." className="w-full resize-none rounded-xl border border-[#cfe0ec] bg-[#f8fcff] px-3 py-3 text-right text-sm leading-6 outline-none transition-colors focus:border-[#0060B8]" /><div><p className="mb-2 text-xs font-bold text-[#274b65]">طريقة إرسال البلاغ</p><div className="grid grid-cols-3 gap-2">{(["email", "whatsapp", "telegram"] as ContactChannel[]).map((item) => <label key={item} className={`flex cursor-pointer items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-bold transition-colors ${channel === item ? "border-[#0060B8] bg-[#eaf4ff] text-[#0060B8]" : "border-[#dbe7f2] bg-[#f8fcff] text-[#66727e]"}`}><input type="radio" name="support-channel" value={item} checked={channel === item} onChange={() => setChannel(item)} className="sr-only" />{item === "email" ? <Mail size={14} /> : item === "whatsapp" ? <MessageCircle size={14} /> : <Send size={14} />}{item === "email" ? "إيميل" : item === "whatsapp" ? "واتساب" : "Telegram"}</label>)}</div></div>{formError && <p className="text-xs font-bold text-[#ba1a1a]">{formError}</p>}<button type="submit" className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0060B8] text-xs font-bold text-white shadow-[0_3px_8px_rgba(0,96,184,0.16)] transition-colors hover:bg-[#00539f] active:scale-[0.99]"><Send size={16} />تجهيز وإرسال البلاغ</button></div></form>

    <section className="mt-6"><h2 className="mb-3 text-base font-bold">أسئلة شائعة</h2><div className="space-y-2">{questions.map((item, index) => { const active = open === index; return <article key={item.q} className="overflow-hidden rounded-2xl border border-[#dbe7f2] bg-white shadow-[0_2px_8px_rgba(0,72,141,0.04)]"><button type="button" onClick={() => setOpen(active ? null : index)} className="flex w-full items-center justify-between gap-3 p-3.5 text-right"><strong className="text-sm">{item.q}</strong><ChevronDown className={`shrink-0 text-[#66727e] transition-transform ${active ? "rotate-180" : ""}`} size={19} /></button>{active && <p className="border-t border-[#eef3f7] px-3.5 py-3 text-xs leading-6 text-[#58616b]">{item.a}</p>}</article>; })}</div></section>

    <section className="mt-6 rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.04)]"><div className="flex items-center gap-2 text-emerald-700"><ShieldCheck size={20} /><h2 className="text-sm font-bold">خصوصية البلاغ</h2></div><p className="mt-2 text-xs leading-5 text-[#58616b]">لا يتم حفظ البلاغ داخل التطبيق حالياً؛ عند الضغط على الإرسال تُفتح قناة التواصل التي اخترتها لتراجع الرسالة وترسلها بنفسك.</p></section>
  </MorePageLayout>;
}
