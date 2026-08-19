/** Design reminder — Corporate Modern Mobile Operations: fixed RTL operational navigation, #0060B8, Cairo typography. */
import { Bike, Home as HomeIcon, Menu, Package, WalletCards } from "lucide-react";
import { useLocation } from "wouter";

type AdminNavKey = "home" | "orders" | "captains" | "wages" | "more";

const navItems = [
  { id: "more", label: "المزيد", icon: Menu, path: "/more" },
  { id: "wages", label: "الأجور", icon: WalletCards, path: "/wages" },
  { id: "home", label: "الرئيسية", icon: HomeIcon, path: "/" },
  { id: "orders", label: "الطلبات", icon: Package, path: "/orders" },
  { id: "captains", label: "الكباتن", icon: Bike, path: "/captains" },
] as const;

export function AdminBottomNav({ active }: { active: AdminNavKey }) {
  const [location, setLocation] = useLocation();

  return (
    <nav aria-label="التنقل الرئيسي" className="fixed right-0 bottom-0 left-0 z-30 mx-auto grid h-[76px] w-full max-w-[453px] grid-cols-5 items-center overflow-hidden rounded-t-[28px] border-t border-x border-[#8ed3ff]/70 bg-[#005babe8] px-2 text-white shadow-[0_-1px_0_rgba(156,222,255,0.95),0_-10px_30px_rgba(0,128,230,0.26),0_-22px_48px_rgba(0,81,170,0.16)] backdrop-blur-2xl before:pointer-events-none before:absolute before:inset-x-7 before:top-0 before:h-px before:bg-[#e3f7ff] before:shadow-[0_0_13px_rgba(151,223,255,1)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === active;
        return <button type="button" key={item.id} disabled={isActive} onClick={() => { if (location !== item.path) setLocation(item.path); }} className={`relative z-10 flex h-14 w-full flex-col items-center justify-center rounded-2xl border px-1 py-1.5 transition-colors duration-150 active:scale-[0.96] disabled:cursor-default ${isActive ? "border-white/80 bg-white/92 text-[#0060B8] shadow-[0_3px_14px_rgba(1,52,109,0.22),0_0_16px_rgba(164,226,255,0.56)]" : "border-transparent text-white hover:border-white/15 hover:bg-white/10"}`} aria-current={isActive ? "page" : undefined}><Icon size={21} strokeWidth={isActive ? 2.75 : 2.2} fill={isActive ? "currentColor" : "none"} /><span className="mt-1 text-[11px] font-bold whitespace-nowrap">{item.label}</span></button>;
      })}
    </nav>
  );
}
