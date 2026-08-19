/**
 * Design reminder — Corporate Modern Mobile Operations:
 * RTL wage-order ledger, information-first rows, #0060B8 hierarchy, 70/30 split explicit, Cairo typography.
 */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  Building2,
  CircleDollarSign,
  Filter,
  Home as HomeIcon,
  Menu,
  Package,
  Search,
  Truck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { WagePeriodControls } from "@/components/WagePeriodControls";
import { dayOptions, filterWageOrders, formatMoney, getPeriodOptions, wageOrders, type Period, type WageOrderStatus } from "@/lib/wage-data";

type StatusFilter = "الكل" | WageOrderStatus;

const navItems = [
  { id: "more", label: "المزيد", icon: Menu },
  { id: "orders", label: "الطلبات", icon: Package },
  { id: "home", label: "الرئيسية", icon: HomeIcon },
  { id: "users", label: "المستخدمون", icon: UsersRound },
  { id: "fees", label: "الأجور", icon: WalletCards },
];

const filters: StatusFilter[] = ["الكل", "مكتمل", "طلب كاذب"];

export default function WageOrders() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<StatusFilter>("الكل");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<Period>("daily");
  const [periodKey, setPeriodKey] = useState(dayOptions[0].key);

  const changePeriod = (nextPeriod: Period) => {
    setPeriod(nextPeriod);
    setPeriodKey(getPeriodOptions(nextPeriod)[0].key);
  };
  const timeFilteredOrders = useMemo(() => filterWageOrders(wageOrders, period, periodKey), [period, periodKey]);

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return timeFilteredOrders.filter((order) => {
      const matchesFilter = filter === "الكل" || order.status === filter;
      const searchable = `${order.orderNumber} ${order.customerName} ${order.captainName}`.toLowerCase();
      return matchesFilter && (!normalized || searchable.includes(normalized));
    });
  }, [filter, query, timeFilteredOrders]);

  const totals = useMemo(() => filteredOrders.reduce((sum, order) => ({ gross: sum.gross + order.gross, captainDue: sum.captainDue + order.gross * 0.7, officeNet: sum.officeNet + order.gross * 0.3 }), { gross: 0, captainDue: 0, officeNet: 0 }), [filteredOrders]);

  const navigate = (itemId: string, label: string) => {
    if (itemId === "home") return setLocation("/");
    if (itemId === "more") return setLocation("/more");
    if (itemId === "users") return setLocation("/users");
    if (itemId === "orders") return setLocation("/logs");
    if (itemId !== "fees") toast.info(`واجهة «${label}» ستُبنى عند اختيارك لها.`);
  };

  return (
    <div className="min-h-screen bg-[#eaf5ff] text-[#1c1b1b]" dir="rtl">
      <div className="relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[#f0f7ff] shadow-[0_0_40px_rgba(0,72,141,0.08)]">
        <header className="fixed top-0 right-0 left-0 z-30 mx-auto flex h-16 w-full max-w-[453px] items-center justify-between bg-[#0060B8] px-5 text-white shadow-[0_4px_18px_rgba(0,96,184,0.28)]">
          <button type="button" aria-label="العودة إلى أجور الكباتن" onClick={() => setLocation("/wages")} className="grid h-10 w-10 place-items-center rounded-full transition-transform duration-150 hover:bg-white/10 active:scale-[0.96]"><ArrowRight size={22} strokeWidth={2.4} /></button>
          <div className="flex items-center gap-2"><div className="text-left"><p className="text-[11px] leading-4 text-[#dbeaff]">الأجور والدفعات</p><h1 className="text-[19px] font-bold leading-6">كشف الطلبات</h1></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><Package size={21} /></span></div>
        </header>

        <main className="px-5 pt-[84px] pb-24">
          <section className="rounded-2xl border border-[#d3e3f0] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-[18px] font-bold">كل الطلبات والأجور</h2><p className="mt-1 text-xs leading-5 text-[#58616b]">كل طلب ظاهر مع أجره الكلي وحصة الكابتن والمكتب.</p></div><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eaf4ff] text-[#0060B8]"><CircleDollarSign size={23} /></span></div>
            <button type="button" onClick={() => setLocation("/wages")} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#a8c8ff] bg-[#eef6ff] text-xs font-bold text-[#0060B8] transition-colors hover:bg-[#dfefff]"><Truck size={17} />العودة إلى أجور الكباتن والدفعات</button>
          </section>

          <section className="mt-4"><WagePeriodControls period={period} periodKey={periodKey} onPeriodChange={changePeriod} onPeriodKeyChange={setPeriodKey} /></section>

          <section className="mt-4 rounded-2xl bg-[#0060B8] p-4 text-white shadow-[0_6px_16px_rgba(0,96,184,0.2)]">
            <span className="text-xs text-[#dceaff]">إجمالي الأجور لكل الطلبات المعروضة</span>
            <strong className="mt-1 block text-[25px] leading-8">{formatMoney(totals.gross)}</strong>
            <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white/12 p-2.5"><span className="block text-[10px] text-[#dceaff]">للكباتن 70%</span><strong className="mt-1 block text-sm">{formatMoney(totals.captainDue)}</strong></div><div className="rounded-xl bg-white/12 p-2.5"><span className="block text-[10px] text-[#dceaff]">للمكتب 30%</span><strong className="mt-1 block text-sm">{formatMoney(totals.officeNet)}</strong></div></div>
          </section>

          <section className="mt-5" aria-label="البحث والفلاتر">
            <div className="relative"><Search className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#75818e]" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث برقم الطلب أو الكابتن أو العميل" className="h-11 w-full rounded-xl border border-[#c9d9e7] bg-white pr-10 pl-3 text-sm placeholder:text-[#8a98a6] focus:border-[#0060B8] focus:outline-none focus:ring-2 focus:ring-[#0060B8]/15" /></div>
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[#66727e]"><Filter size={17} /></span>{filters.map((item) => <button type="button" key={item} onClick={() => setFilter(item)} className={`h-8 shrink-0 rounded-full px-3.5 text-xs font-bold transition-all duration-150 active:scale-[0.96] ${filter === item ? "bg-[#0060B8] text-white" : "border border-[#d4e2ec] bg-white text-[#58616b]"}`}>{item}</button>)}</div>
          </section>

          <section className="mt-5" aria-labelledby="orders-ledger-title"><div className="mb-3 flex items-center justify-between"><h2 id="orders-ledger-title" className="text-base font-bold">سجل الطلبات حسب الفترة</h2><span className="rounded-full bg-[#dbeeff] px-2.5 py-1 text-xs font-bold text-[#0060B8]">{filteredOrders.length} طلبات</span></div><div className="space-y-3">{filteredOrders.length ? filteredOrders.map((order) => <article key={order.id} className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm">{order.orderNumber}</strong><span className={`mr-2 rounded-md px-2 py-0.5 text-[10px] font-bold ${order.status === "مكتمل" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{order.status}</span><p className="mt-1.5 text-xs text-[#66727e]">العميل: {order.customerName}</p></div><div className="text-left"><strong className="text-sm">{formatMoney(order.gross)}</strong><p className="mt-1 text-[10px] text-[#75818e]">{order.date}</p></div></div><div className="mt-3 flex items-center justify-between rounded-xl bg-[#f5f9fc] px-3 py-2.5"><span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4f5d6b]"><span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[#0060B8]"><Truck size={13} /></span>{order.captainName}</span><span className="flex items-center gap-2 text-left"><span className="text-[10px] text-emerald-700">كابتن 70%<strong className="mr-1 text-xs">{formatMoney(order.gross * 0.7)}</strong></span><span className="border-r border-[#d7e3ed] pr-2 text-[10px] text-[#0060B8]">مكتب 30%<strong className="mr-1 text-xs">{formatMoney(order.gross * 0.3)}</strong></span></span></div></article>) : <div className="rounded-2xl border border-dashed border-[#c7dae8] bg-white/70 px-4 py-10 text-center"><Package className="mx-auto text-[#7d9ab0]" size={28} /><p className="mt-2 text-sm font-bold text-[#4f5d6b]">لا توجد طلبات مطابقة</p><p className="mt-1 text-xs text-[#75818e]">جرّب تغيير البحث أو الفلتر أو الفترة الزمنية.</p></div>}</div></section>
        </main>

        <nav aria-label="التنقل الرئيسي" className="fixed right-0 bottom-0 left-0 z-30 mx-auto flex h-[72px] w-full max-w-[453px] items-center justify-around rounded-t-2xl border-t-2 border-[#a8c8ff]/60 bg-[#0060B8] px-2 text-white shadow-[0_-4px_18px_rgba(0,96,184,0.2)]">{navItems.map((item) => { const NavIcon = item.icon; const isActive = item.id === "fees"; return <button type="button" key={item.id} onClick={() => navigate(item.id, item.label)} className={`flex min-w-[54px] flex-col items-center justify-center rounded-xl px-2 py-1.5 transition-all duration-150 active:scale-[0.94] ${isActive ? "-translate-y-3 bg-white px-5 text-[#0060B8] shadow-[0_4px_12px_rgba(0,0,0,0.12)]" : "text-white hover:bg-white/10"}`} aria-current={isActive ? "page" : undefined}><NavIcon size={21} strokeWidth={isActive ? 2.75 : 2.2} fill={isActive ? "currentColor" : "none"} /><span className="mt-1 text-[11px] font-bold whitespace-nowrap">{item.label}</span></button>; })}</nav>
      </div>
    </div>
  );
}
