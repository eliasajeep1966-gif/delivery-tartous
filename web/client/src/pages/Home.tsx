/**
 * Design reminder — Corporate Modern Mobile Operations:
 * RTL, information-first, operational blue #0060B8, flat white cards, no gradients.
 */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Bike,
  CheckCircle2,
  ChevronLeft,
  CirclePlus,
  Home as HomeIcon,
  MapPin,
  Menu,
  Package,
  Settings2,
  UsersRound,
  WalletCards,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { NewOrderDialog } from "@/components/NewOrderDialog";
import {
  availableCaptains,
  recentOrders,
  summaryMetrics,
  type OrderStatus,
} from "@/lib/dashboard-data";
import { useActivity } from "@/contexts/ActivityContext";

type Filter = "all" | OrderStatus;

const statusMeta: Record<OrderStatus, { label: string; className: string; stripClass: string }> = {
  delivered: {
    label: "تم التوصيل",
    className: "bg-emerald-50 text-emerald-600",
    stripClass: "bg-emerald-500",
  },
  waiting: {
    label: "بانتظار استلام الكابتن",
    className: "bg-blue-50 text-[#0060B8]",
    stripClass: "bg-[#0060B8]",
  },
  picked_up: {
    label: "تم الاستلام",
    className: "bg-violet-50 text-violet-600",
    stripClass: "bg-violet-500",
  },
};

const navItems = [
  { id: "more", label: "المزيد", icon: Menu },
  { id: "orders", label: "الطلبات", icon: Package },
  { id: "home", label: "الرئيسية", icon: HomeIcon },
  { id: "users", label: "المستخدمون", icon: UsersRound },
  { id: "fees", label: "الأجور", icon: WalletCards },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const [activeNav, setActiveNav] = useState("home");
  const [filter, setFilter] = useState<Filter>("all");
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const { createdOrders } = useActivity();

  const visibleOrders = useMemo(
    () => {
      const allOrders = [...createdOrders, ...recentOrders];
      return filter === "all" ? allOrders : allOrders.filter((order) => order.status === filter);
    },
    [createdOrders, filter],
  );

  const selectMetric = (metricId: string) => {
    const filterByMetric: Record<string, Filter> = {
      waiting: "waiting",
      delivered: "delivered",
    };
    const nextFilter = filterByMetric[metricId];

    if (nextFilter) {
      setFilter(nextFilter);
      toast.info(`يتم عرض الطلبات: ${nextFilter === "waiting" ? "بانتظار استلام الكابتن" : "تم التوصيل"}`);
      return;
    }

    toast.info("سيتم ربط هذا المؤشر ببيانات الخلفية لاحقاً.");
  };

  const onNavClick = (itemId: string, label: string) => {
    setActiveNav(itemId);
    if (itemId === "more") {
      setLocation("/more");
      return;
    }
    if (itemId === "orders") {
      setLocation("/logs");
      return;
    }
    if (itemId === "users") {
      setLocation("/users");
      return;
    }
    if (itemId === "fees") {
      setLocation("/wages");
      return;
    }
    if (itemId !== "home") toast.info(`قسم «${label}» جاهز للربط عند تنفيذ الوحدة الخاصة به.`);
  };

  return (
    <div className="min-h-screen bg-[#eaf5ff] text-[#1c1b1b]" dir="rtl">
      <div className="relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[#f0f7ff] shadow-[0_0_40px_rgba(0,72,141,0.08)]">
        <img
          src="/assets/operations-route-pattern.png"
          alt=""
          className="pointer-events-none absolute top-14 left-0 h-48 w-full object-cover opacity-[0.08]"
        />

        <header className="fixed top-0 right-0 left-0 z-30 mx-auto flex h-16 w-full max-w-[453px] items-center justify-between bg-[#0060B8] px-5 text-white shadow-[0_4px_18px_rgba(0,96,184,0.28)]">
          <button
            type="button"
            aria-label="إعدادات لوحة الإدارة"
            onClick={() => toast.info("الإعدادات ستكون ضمن وحدة الإدارة الخلفية.")}
            className="relative grid h-10 w-10 place-items-center rounded-full transition-transform duration-150 hover:bg-white/10 active:scale-[0.96]"
          >
            <Settings2 size={22} strokeWidth={2.25} />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full border border-[#0060B8] bg-[#ef4444]" />
          </button>

          <div className="flex items-center gap-2.5">
            <h1 className="text-[23px] font-bold tracking-[-0.3px]">دليفري طرطوس</h1>
            <img
              src="/assets/tartous-delivery-mark.png"
              alt="شعار دليفري طرطوس"
              className="h-9 w-9 object-contain"
            />
          </div>
        </header>

        <main className="relative z-10 px-5 pt-[84px] pb-24">
          <section className="mb-6">
            <h2 className="text-[20px] font-semibold leading-7">مرحباً، المدير</h2>
            <p className="mt-0.5 text-sm text-[#414752]">إليك ملخص حركة الطلبات اليوم</p>
          </section>

          <section aria-label="ملخص اليوم" className="grid grid-cols-2 gap-3">
            {summaryMetrics.map((metric) => {
              const MetricIcon =
                metric.icon === "package"
                  ? Package
                  : metric.icon === "bike"
                    ? Bike
                    : metric.icon === "check"
                      ? CheckCircle2
                      : XCircle;
              const iconColor =
                metric.icon === "check"
                  ? "text-emerald-500"
                  : metric.icon === "cancel"
                    ? "text-[#ba1a1a]"
                    : "text-[#0060B8]";

              return (
                <button
                  type="button"
                  key={metric.id}
                  onClick={() => selectMetric(metric.id)}
                  className="min-h-[94px] rounded-2xl border border-[#dbe7f2] bg-white p-4 text-right shadow-[0_2px_8px_rgba(0,72,141,0.06)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(0,72,141,0.11)] active:scale-[0.98]"
                >
                  <span className="flex items-center justify-between">
                    <MetricIcon className={iconColor} size={22} strokeWidth={2.4} />
                    <strong className="text-[24px] leading-8">{metric.value}</strong>
                  </span>
                  <span className="mt-2 block text-sm leading-5 text-[#414752]">{metric.label}</span>
                </button>
              );
            })}
          </section>

          <button
            type="button"
            onClick={() => setIsCreateOrderOpen(true)}
            className="relative mt-6 flex min-h-[86px] w-full items-center justify-between overflow-hidden rounded-2xl border-2 border-[#a8c8ff] bg-[#0060B8] px-4 py-3 text-right text-white shadow-[0_6px_18px_rgba(0,96,184,0.26)] transition-transform duration-150 hover:bg-[#0057a7] active:scale-[0.98]"
          >
            <span className="relative z-10 flex flex-col items-start">
              <span className="text-base font-semibold">إنشاء طلب جديد</span>
              <span className="mt-1 text-sm text-[#dbeaff]">أضف طلباً وعيّن كابتناً متاحاً</span>
            </span>
            <img
              src="/assets/new-order-illustration.png"
              alt=""
              className="pointer-events-none absolute left-2 top-1/2 h-[78px] w-[116px] -translate-y-1/2 object-contain opacity-35"
            />
            <span className="relative z-10 grid h-10 w-10 place-items-center rounded-full bg-white/20">
              <CirclePlus size={25} fill="white" className="text-[#4f99d6]" />
            </span>
          </button>

          <section className="mt-6" aria-labelledby="recent-orders-title">
            <div className="mb-3 flex items-center justify-between">
              <h3 id="recent-orders-title" className="text-base font-semibold">آخر النشاطات</h3>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="text-xs font-bold text-[#0060B8] transition-opacity hover:opacity-70"
              >
                عرض الكل
              </button>
            </div>

            <div className="space-y-2">
              {visibleOrders.length ? (
                visibleOrders.map((order) => {
                  const meta = statusMeta[order.status];
                  return (
                    <button
                      type="button"
                      key={order.id}
                      onClick={() => toast.info(`تفاصيل الطلب #${order.id} ستُعرض بعد ربط الخلفية.`)}
                      className="relative flex w-full overflow-hidden rounded-2xl border border-[#e0e8ee] bg-white p-4 pr-5 text-right shadow-[0_2px_8px_rgba(0,72,141,0.05)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_5px_12px_rgba(0,72,141,0.08)] active:scale-[0.99]"
                    >
                      <span className={`absolute top-0 right-0 h-full w-1.5 ${meta.stripClass}`} />
                      <span className="flex min-w-0 flex-1 flex-col gap-1.5 pl-7">
                        <span className="flex items-center justify-between gap-2">
                          <strong className="text-base leading-5">#{order.id}</strong>
                          <span className={`rounded px-2 py-0.5 text-xs font-bold ${meta.className}`}>{meta.label}</span>
                        </span>
                        <span className="flex items-center justify-between gap-3 text-sm">
                          <span>{order.customer}</span>
                          <strong className="shrink-0 text-base">{order.amount}</strong>
                        </span>
                        <span className="flex items-center gap-1 text-xs text-[#414752]">
                          <MapPin size={15} />
                          {order.location}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-[#75818e]">
                          <Settings2 size={13} />
                          {order.timestamp}
                        </span>
                      </span>
                      <ChevronLeft className="absolute top-1/2 left-3 -translate-y-1/2 text-[#727783]" size={21} />
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-[#c1d7ea] bg-white/70 px-4 py-7 text-center text-sm text-[#414752]">
                  لا توجد طلبات مطابقة للحالة المحددة.
                </div>
              )}
            </div>
          </section>

          <section className="mt-6" aria-labelledby="available-captains-title">
            <div className="mb-3 flex items-center justify-between">
              <h3 id="available-captains-title" className="text-base font-semibold">الكباتن المتاحون الآن</h3>
              <button
                type="button"
                onClick={() => toast.info("قائمة الكباتن الكاملة ستُربط بواجهة المستخدمين.")}
                className="text-xs font-bold text-[#0060B8] transition-opacity hover:opacity-70"
              >
                عرض الكل
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {availableCaptains.map((captain) => (
                <button
                  type="button"
                  key={captain.id}
                  onClick={() => toast.info(`${captain.name} متاح حالياً.`)}
                  className="flex min-w-[70px] flex-col items-center gap-1 transition-transform duration-150 active:scale-[0.96]"
                >
                  <span className="relative grid h-14 w-14 place-items-center rounded-full bg-[#e6e2e0] text-base font-semibold text-[#585f66]">
                    {captain.initial}
                    <span className="absolute right-0 bottom-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                  </span>
                  <span className="text-xs font-bold">{captain.name}</span>
                  <span className="text-[10px] text-[#414752]">{captain.availability}</span>
                </button>
              ))}
            </div>
          </section>
        </main>

        <nav aria-label="التنقل الرئيسي" className="fixed right-0 bottom-0 left-0 z-30 mx-auto flex h-[72px] w-full max-w-[453px] items-center justify-around rounded-t-2xl border-t-2 border-[#a8c8ff]/60 bg-[#0060B8] px-2 text-white shadow-[0_-4px_18px_rgba(0,96,184,0.2)]">
          {navItems.map((item) => {
            const NavIcon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onNavClick(item.id, item.label)}
                className={`flex min-w-[54px] flex-col items-center justify-center rounded-xl px-2 py-1.5 transition-all duration-150 active:scale-[0.94] ${
                  isActive ? "-translate-y-3 bg-white px-5 text-[#0060B8] shadow-[0_4px_12px_rgba(0,0,0,0.12)]" : "text-white hover:bg-white/10"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <NavIcon size={21} strokeWidth={isActive ? 2.75 : 2.2} fill={isActive ? "currentColor" : "none"} />
                <span className="mt-1 text-[11px] font-bold whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <NewOrderDialog open={isCreateOrderOpen} onOpenChange={setIsCreateOrderOpen} captains={availableCaptains} />
      </div>
    </div>
  );
}
