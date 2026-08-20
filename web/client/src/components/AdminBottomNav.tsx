/** Design reminder — Corporate Modern Mobile Operations: fixed RTL operational navigation, #0060B8, Cairo typography. */
/** Design reminder — Delivery Tartous shared navigation: river-blue liquid glass, a slow reflected sheen, fixed five slots, and an active blue gradient capsule. */
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
    <nav aria-label="التنقل الرئيسي" className="fixed right-3 bottom-3 left-3 z-30 mx-auto grid h-[76px] w-auto max-w-[429px] grid-cols-5 items-center overflow-hidden rounded-[28px] border border-white/70 bg-[rgba(239,250,255,0.78)] px-2 pb-1.5 pt-1 text-[#617789] shadow-[0_12px_32px_rgba(0,81,149,0.24),inset_0_1px_0_rgba(255,255,255,0.92)] backdrop-blur-2xl before:pointer-events-none before:absolute before:-top-7 before:-bottom-8 before:left-0 before:z-0 before:w-1/3 before:bg-[linear-gradient(105deg,transparent_15%,rgba(255,255,255,0.56)_50%,transparent_84%)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === active;
        return <button type="button" key={item.id} disabled={isActive} onClick={() => { if (location !== item.path) setLocation(item.path); }} className={`relative z-10 flex h-[64px] w-full flex-col items-center justify-center rounded-[20px] px-1 py-1 transition-colors duration-200 active:scale-[0.96] disabled:cursor-default ${isActive ? "text-white" : "text-[#62798a] hover:bg-white/45 hover:text-[#0060B8]"}`} aria-current={isActive ? "page" : undefined}><span className={`grid h-9 min-w-11 place-items-center rounded-[15px] transition-[background-color,box-shadow,color] duration-300 ${isActive ? "bg-[linear-gradient(135deg,#0060B8_0%,#159ed8_100%)] text-white shadow-[0_6px_14px_rgba(0,96,184,0.27)]" : "text-[#7f94a4]"}`}><Icon size={20} strokeWidth={isActive ? 2.65 : 2.1} fill={isActive ? "currentColor" : "none"} /></span><span className={`mt-1 text-[10px] font-bold whitespace-nowrap transition-colors duration-200 ${isActive ? "text-[#0059ad]" : "text-[#62798a]"}`}>{item.label}</span></button>;
      })}
    </nav>
  );
}
