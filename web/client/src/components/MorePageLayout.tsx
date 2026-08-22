/** Design reminder — Corporate Modern Mobile Operations: shared RTL subpage shell, #0060B8 header/navigation, white cards, Cairo typography. */
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import type { ReactNode } from "react";
import { AdminBottomNav } from "@/components/AdminBottomNav";

type MorePageLayoutProps = { title: string; subtitle: string; Icon: LucideIcon; children: ReactNode };

export function MorePageLayout({ title, subtitle, Icon, children }: MorePageLayoutProps) {
  const [, setLocation] = useLocation();
  return <div className="min-h-screen bg-[#eaf5ff] text-[#1c1b1b]" dir="rtl"><div className="relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[#f0f7ff] shadow-[0_0_40px_rgba(0,72,141,0.08)]"><header className="fixed top-0 right-0 left-0 z-30 mx-auto flex h-16 w-full max-w-[453px] items-center justify-between bg-[#0060B8] px-5 text-white shadow-[0_4px_18px_rgba(0,96,184,0.28)]"><button type="button" aria-label="العودة إلى المزيد" onClick={() => setLocation("/more")} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 active:scale-[0.96]"><ArrowRight size={22} strokeWidth={2.4} /></button><div className="flex items-center gap-2"><div className="text-left"><p className="text-[11px] leading-4 text-[#dbeaff]">Delivery Tartous</p><h1 className="text-[19px] font-bold leading-6">{title}</h1></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><Icon size={21} /></span></div></header><main className="px-5 pt-[84px] pb-24">{subtitle ? <p className="sr-only">{subtitle}</p> : null}{children}</main><AdminBottomNav active="more" /></div></div>;
}
