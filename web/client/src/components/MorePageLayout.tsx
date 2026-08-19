/**
 * Design reminder — Corporate Modern Mobile Operations:
 * Shared RTL subpage shell, #0060B8 header/navigation, structured white cards, Cairo typography.
 */
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Home as HomeIcon, Menu, Package, UsersRound, WalletCards } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import type { ReactNode } from "react";

const navItems = [
  { id: "more", label: "المزيد", icon: Menu },
  { id: "orders", label: "الطلبات", icon: Package },
  { id: "home", label: "الرئيسية", icon: HomeIcon },
  { id: "users", label: "المستخدمون", icon: UsersRound },
  { id: "fees", label: "الأجور", icon: WalletCards },
];

type MorePageLayoutProps = { title: string; subtitle: string; Icon: LucideIcon; children: ReactNode };

export function MorePageLayout({ title, subtitle, Icon, children }: MorePageLayoutProps) {
  const [, setLocation] = useLocation();
  const navigate = (itemId: string, label: string) => {
    if (itemId === "home") return setLocation("/");
    if (itemId === "more") return setLocation("/more");
    if (itemId === "users") return setLocation("/users");
    if (itemId === "orders") return setLocation("/logs");
    if (itemId === "fees") return setLocation("/wages");
    toast.info(`واجهة «${label}» ستُبنى عند اختيارك لها.`);
  };
  return (
    <div className="min-h-screen bg-[#eaf5ff] text-[#1c1b1b]" dir="rtl"><div className="relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[#f0f7ff] shadow-[0_0_40px_rgba(0,72,141,0.08)]">
      <header className="fixed top-0 right-0 left-0 z-30 mx-auto flex h-16 w-full max-w-[453px] items-center justify-between bg-[#0060B8] px-5 text-white shadow-[0_4px_18px_rgba(0,96,184,0.28)]"><button type="button" aria-label="العودة إلى المزيد" onClick={() => setLocation("/more")} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 active:scale-[0.96]"><ArrowRight size={22} strokeWidth={2.4} /></button><div className="flex items-center gap-2"><div className="text-left"><p className="text-[11px] leading-4 text-[#dbeaff]">لوحة الأدمن</p><h1 className="text-[19px] font-bold leading-6">{title}</h1></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><Icon size={21} /></span></div></header>
      <main className="px-5 pt-[84px] pb-24">{children}</main>
      <nav aria-label="التنقل الرئيسي" className="fixed right-0 bottom-0 left-0 z-30 mx-auto flex h-[72px] w-full max-w-[453px] items-center justify-around rounded-t-2xl border-t-2 border-[#a8c8ff]/60 bg-[#0060B8] px-2 text-white shadow-[0_-4px_18px_rgba(0,96,184,0.2)]">{navItems.map((item) => { const NavIcon = item.icon; const active = item.id === "more"; return <button type="button" key={item.id} onClick={() => navigate(item.id, item.label)} className={`flex min-w-[54px] flex-col items-center justify-center rounded-xl px-2 py-1.5 active:scale-[0.94] ${active ? "-translate-y-3 bg-white px-5 text-[#0060B8] shadow-[0_4px_12px_rgba(0,0,0,0.12)]" : "text-white hover:bg-white/10"}`} aria-current={active ? "page" : undefined}><NavIcon size={21} strokeWidth={active ? 2.75 : 2.2} fill={active ? "currentColor" : "none"} /><span className="mt-1 text-[11px] font-bold whitespace-nowrap">{item.label}</span></button>; })}</nav>
    </div></div>
  );
}
