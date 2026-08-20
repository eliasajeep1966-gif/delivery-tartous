/** Design reminder — Corporate Modern Mobile Operations: RTL operational menu, grouped white cards, #0060B8 hierarchy, Cairo typography, no gradients. */
import { useState } from "react";
import { useLocation } from "wouter";
import { BarChart3, ChevronLeft, ClipboardList, Info, LogOut, Menu, PackageCheck, PackageOpen, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { AdminBottomNav } from "@/components/AdminBottomNav";
import { useWebAuth } from "@/contexts/WebAuthContext";

type MoreItem = { id: string; title: string; description: string; icon: typeof ClipboardList; tone: string; action: () => void };

export default function More() {
  const [, setLocation] = useLocation();
  const { signOut } = useWebAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
      toast.success("تم تسجيل الخروج بنجاح.");
      setLocation("/login", { replace: true });
    } catch {
      toast.error("تعذر تسجيل الخروج. حاول مرة أخرى.");
    } finally {
      setIsSigningOut(false);
    }
  };
  const operations: MoreItem[] = [
    { id: "users", title: "إدارة المستخدمين", description: "الحسابات المفعّلة والحسابات بانتظار التفعيل", icon: UsersRound, tone: "bg-[#eaf4ff] text-[#0060B8]", action: () => setLocation("/users") },
    { id: "activity", title: "سجل الحركات", description: "تابع كل العمليات ومن قام بها", icon: ClipboardList, tone: "bg-[#eaf4ff] text-[#0060B8]", action: () => setLocation("/logs") },
    { id: "custody", title: "إدارة الأمانات", description: "استلام وتسليم أمانات الكباتن", icon: PackageCheck, tone: "bg-amber-50 text-amber-700", action: () => setLocation("/custody") },
    { id: "reports", title: "التقارير", description: "ملخصات الطلبات والأجور حسب الفترة", icon: BarChart3, tone: "bg-violet-50 text-violet-700", action: () => setLocation("/reports") },
  ];
  const system: MoreItem[] = [
    { id: "settings", title: "إعدادات المكتب", description: "بيانات المكتب ونسب التقسيم", icon: Settings2, tone: "bg-slate-100 text-slate-700", action: () => setLocation("/office-settings") },
    { id: "help", title: "المساعدة والدعم", description: "معلومات الاستخدام وطلب المساعدة", icon: Info, tone: "bg-cyan-50 text-cyan-700", action: () => setLocation("/help") },
  ];
  const renderItem = (item: MoreItem) => { const Icon = item.icon; return <button type="button" key={item.id} onClick={item.action} className="flex w-full items-center gap-3 rounded-2xl border border-[#dbe7f2] bg-white p-3.5 text-right shadow-[0_2px_8px_rgba(0,72,141,0.05)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_5px_12px_rgba(0,72,141,0.08)] active:scale-[0.99]"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${item.tone}`}><Icon size={21} /></span><span className="min-w-0 flex-1"><strong className="block text-[15px]">{item.title}</strong><span className="mt-1 block truncate text-xs text-[#66727e]">{item.description}</span></span><ChevronLeft className="shrink-0 text-[#75818e]" size={20} /></button>; };
  return <div className="min-h-screen bg-[#eaf5ff] text-[#1c1b1b]" dir="rtl"><div className="relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[#f0f7ff] shadow-[0_0_40px_rgba(0,72,141,0.08)]"><header className="fixed top-0 right-0 left-0 z-30 mx-auto flex h-16 w-full max-w-[453px] items-center justify-between bg-[#0060B8] px-5 text-white shadow-[0_4px_18px_rgba(0,96,184,0.28)]"><button type="button" aria-label="العودة إلى الرئيسية" onClick={() => setLocation("/")} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 active:scale-[0.96]"><ChevronLeft className="rotate-180" size={22} /></button><div className="flex items-center gap-2"><div className="text-left"><p className="text-[11px] leading-4 text-[#dbeaff]">لوحة الأدمن</p><h1 className="text-[19px] font-bold leading-6">المزيد</h1></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><Menu size={21} /></span></div></header><main className="px-5 pt-[84px] pb-24"><section className="rounded-2xl border border-[#d3e3f0] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eaf4ff] text-[#0060B8]"><ShieldCheck size={25} /></span><div><h2 className="text-[17px] font-bold">إدارة النظام والمتابعة</h2><p className="mt-1 text-xs text-[#66727e]">وحدات إدارية خارج تبويبات التشغيل اليومية.</p></div></div></section><section className="mt-6"><h2 className="mb-3 text-base font-bold">الإدارة والمتابعة</h2><div className="space-y-3">{operations.map(renderItem)}</div></section><section className="mt-6"><h2 className="mb-3 text-base font-bold">إعدادات النظام</h2><div className="space-y-3">{system.map(renderItem)}</div></section><section className="mt-6"><h2 className="mb-3 text-base font-bold">الحساب</h2><button type="button" onClick={handleSignOut} disabled={isSigningOut} className="flex w-full items-center gap-3 rounded-2xl border border-red-100 bg-white p-3.5 text-right shadow-[0_2px_8px_rgba(0,72,141,0.05)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-red-50 text-[#ba1a1a]"><LogOut size={21} /></span><span className="flex-1"><strong className="block text-[15px] text-[#ba1a1a]">{isSigningOut ? "جارٍ تسجيل الخروج..." : "تسجيل الخروج"}</strong><span className="mt-1 block text-xs text-[#66727e]">إنهاء جلسة الأدمن الحالية</span></span><ChevronLeft className="text-[#ba1a1a]" size={20} /></button></section><div className="mt-6 flex items-center justify-center gap-1.5 pb-2 text-[11px] text-[#75818e]"><PackageOpen size={14} />دليفري طرطوس — لوحة الأدمن</div></main><AdminBottomNav active="more" /></div></div>;
}
