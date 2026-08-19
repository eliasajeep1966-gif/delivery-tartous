/**
 * Design reminder — Corporate Modern Mobile Operations:
 * RTL audit trail, precise scanable records, #0060B8 primary hierarchy, Cairo typography, no gradients.
 */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  CircleUserRound,
  ClipboardList,
  Clock3,
  Home as HomeIcon,
  Menu,
  Package,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  UserPlus,
  UsersRound,
  WalletCards,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useActivity } from "@/contexts/ActivityContext";

type LogCategory = "all" | "orders" | "users" | "captains" | "system";

type ActivityLog = {
  id: string;
  category: Exclude<LogCategory, "all">;
  action: string;
  subject: string;
  actor: string;
  time: string;
  details: string;
  icon: LucideIcon;
  tone: "blue" | "green" | "red" | "violet" | "slate";
};

const activities: ActivityLog[] = [
  { id: "log-1", category: "orders", action: "إنشاء طلب", subject: "الطلب #1049", actor: "هشام علي", time: "الثلاثاء 19 آب، 11:02 ص", details: "تم إنشاء الطلب وتعيين الكابتن محمد علي.", icon: Package, tone: "blue" },
  { id: "log-2", category: "users", action: "إضافة مستخدم", subject: "حسن يوسف", actor: "إيلي جيب", time: "الثلاثاء 19 آب، 10:47 ص", details: "تمت إضافة مستخدم جديد بدور كابتن.", icon: UserPlus, tone: "green" },
  { id: "log-3", category: "orders", action: "تسليم طلب", subject: "الطلب #1042", actor: "محمد علي", time: "الثلاثاء 19 آب، 10:30 ص", details: "تم تأكيد تسليم الطلب للعميل في الرمل الجنوبي.", icon: CheckCircle2, tone: "green" },
  { id: "log-4", category: "users", action: "حذف مستخدم", subject: "مازن سعيد", actor: "إيلي جيب", time: "اليوم، 10:42 ص", details: "تم حذف المستخدم من قائمة المستخدمين.", icon: Trash2, tone: "red" },
  { id: "log-5", category: "captains", action: "تغيير حالة كابتن", subject: "كريم حمود", actor: "كريم حمود", time: "اليوم، 10:15 ص", details: "تم تغيير حالة التوفر من متاح إلى غير متاح.", icon: Truck, tone: "violet" },
  { id: "log-6", category: "orders", action: "إلغاء طلب", subject: "الطلب #1038", actor: "هشام علي", time: "اليوم، 09:30 ص", details: "تم إلغاء الطلب بسبب تعذر التواصل مع العميل.", icon: XCircle, tone: "red" },
  { id: "log-7", category: "system", action: "تحديث صلاحية", subject: "هشام علي", actor: "إيلي جيب", time: "أمس، 06:10 م", details: "تم تعديل صلاحيات المشرف في إدارة الطلبات.", icon: ShieldCheck, tone: "slate" },
];

const categoryTabs: { id: LogCategory; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "orders", label: "الطلبات" },
  { id: "users", label: "المستخدمون" },
  { id: "captains", label: "الكباتن" },
  { id: "system", label: "النظام" },
];

const toneClasses: Record<ActivityLog["tone"], { icon: string; chip: string }> = {
  blue: { icon: "bg-blue-100 text-[#0060B8]", chip: "bg-blue-50 text-[#0060B8]" },
  green: { icon: "bg-emerald-100 text-emerald-700", chip: "bg-emerald-50 text-emerald-700" },
  red: { icon: "bg-red-100 text-[#ba1a1a]", chip: "bg-red-50 text-[#ba1a1a]" },
  violet: { icon: "bg-violet-100 text-violet-700", chip: "bg-violet-50 text-violet-700" },
  slate: { icon: "bg-slate-100 text-slate-700", chip: "bg-slate-100 text-slate-700" },
};

const navItems = [
  { id: "more", label: "المزيد", icon: Menu },
  { id: "orders", label: "الطلبات", icon: Package },
  { id: "home", label: "الرئيسية", icon: HomeIcon },
  { id: "users", label: "المستخدمون", icon: UsersRound },
  { id: "fees", label: "الأجور", icon: WalletCards },
];

export default function ActivityLogs() {
  const [, setLocation] = useLocation();
  const [category, setCategory] = useState<LogCategory>("all");
  const [query, setQuery] = useState("");
  const { createdActivities } = useActivity();

  const filteredActivities = useMemo(() => {
    const allActivities: ActivityLog[] = [
      ...createdActivities.map((activity) => ({ ...activity, icon: Package })),
      ...activities,
    ];
    const normalized = query.trim().toLowerCase();
    return allActivities.filter((activity) => {
      const matchesCategory = category === "all" || activity.category === category;
      const searchable = `${activity.action} ${activity.subject} ${activity.actor} ${activity.details}`.toLowerCase();
      return matchesCategory && (!normalized || searchable.includes(normalized));
    });
  }, [category, createdActivities, query]);

  const navigate = (itemId: string, label: string) => {
    if (itemId === "home") {
      setLocation("/");
      return;
    }
    if (itemId === "more") {
      setLocation("/more");
      return;
    }
    if (itemId === "users") {
      setLocation("/logs");
      return;
    }
    if (itemId === "fees") {
      setLocation("/wages");
      return;
    }
    if (itemId !== "orders") toast.info(`واجهة «${label}» ستُبنى عند اختيارك لها.`);
  };

  return (
    <div className="min-h-screen bg-[#eaf5ff] text-[#1c1b1b]" dir="rtl">
      <div className="relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[#f0f7ff] shadow-[0_0_40px_rgba(0,72,141,0.08)]">
        <header className="fixed top-0 right-0 left-0 z-30 mx-auto flex h-16 w-full max-w-[453px] items-center justify-between bg-[#0060B8] px-5 text-white shadow-[0_4px_18px_rgba(0,96,184,0.28)]">
          <button type="button" aria-label="العودة إلى الرئيسية" onClick={() => setLocation("/")} className="grid h-10 w-10 place-items-center rounded-full transition-transform duration-150 hover:bg-white/10 active:scale-[0.96]">
            <ArrowRight size={22} strokeWidth={2.4} />
          </button>
          <div className="flex items-center gap-2">
            <div className="text-left">
              <p className="text-[11px] leading-4 text-[#dbeaff]">لوحة الأدمن</p>
              <h1 className="text-[19px] font-bold leading-6">سجل الحركات</h1>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><ClipboardList size={21} /></span>
          </div>
        </header>

        <main className="px-5 pt-[84px] pb-24">
          <section className="rounded-2xl border border-[#d3e3f0] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-bold">سجل الحركات الكامل</h2>
                <p className="mt-1 text-xs leading-5 text-[#58616b]">كل التغييرات والعمليات في مكان واحد، مع منفّذ الحركة ووقتها.</p>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eaf4ff] text-[#0060B8]"><Clock3 size={23} /></span>
            </div>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#75818e]" size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث باسم، طلب، أو حركة" className="h-11 w-full rounded-xl border border-[#c9d9e7] bg-[#fbfdff] pr-10 pl-3 text-sm placeholder:text-[#8a98a6] focus:border-[#0060B8] focus:outline-none focus:ring-2 focus:ring-[#0060B8]/15" />
            </div>
          </section>

          <section className="mt-5" aria-label="فلاتر سجل الحركات">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categoryTabs.map((tab) => {
                const isActive = tab.id === category;
                return (
                  <button type="button" key={tab.id} onClick={() => setCategory(tab.id)} className={`h-9 shrink-0 rounded-full px-3.5 text-xs font-bold transition-all duration-150 active:scale-[0.96] ${isActive ? "bg-[#0060B8] text-white shadow-[0_3px_8px_rgba(0,96,184,0.18)]" : "border border-[#d4e2ec] bg-white text-[#58616b] hover:bg-[#eaf4ff]"}`}>
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-5" aria-labelledby="activity-list-title">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="activity-list-title" className="text-base font-bold">آخر الحركات</h2>
              <span className="rounded-full bg-[#dbeeff] px-2.5 py-1 text-xs font-bold text-[#0060B8]">{filteredActivities.length} حركة</span>
            </div>

            <div className="relative space-y-3 before:absolute before:top-5 before:bottom-5 before:right-[21px] before:w-px before:bg-[#d9e7f1]">
              {filteredActivities.length ? (
                filteredActivities.map((activity) => {
                  const Icon = activity.icon;
                  const tone = toneClasses[activity.tone];
                  return (
                    <article key={activity.id} className="relative z-10 flex gap-3 rounded-2xl border border-[#dbe7f2] bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-4 ring-[#f0f7ff] ${tone.icon}`}><Icon size={20} strokeWidth={2.25} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-bold text-[#1c1b1b]">{activity.action}</h3>
                          <time className="shrink-0 text-[10px] text-[#75818e]">{activity.time}</time>
                        </div>
                        <p className="mt-1 text-xs font-bold text-[#0060B8]">{activity.subject}</p>
                        <p className="mt-1 text-xs leading-5 text-[#58616b]">{activity.details}</p>
                        <div className="mt-2 flex items-center gap-1.5">
                          <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${tone.chip}`}>بواسطة: {activity.actor}</span>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-[#c7dae8] bg-white/70 px-4 py-10 text-center">
                  <ClipboardList className="mx-auto text-[#7d9ab0]" size={28} />
                  <p className="mt-2 text-sm font-bold text-[#4f5d6b]">لا توجد حركات مطابقة</p>
                  <p className="mt-1 text-xs text-[#75818e]">جرّب تغيير البحث أو نوع السجل.</p>
                </div>
              )}
            </div>
          </section>
        </main>

        <nav aria-label="التنقل الرئيسي" className="fixed right-0 bottom-0 left-0 z-30 mx-auto flex h-[72px] w-full max-w-[453px] items-center justify-around rounded-t-2xl border-t-2 border-[#a8c8ff]/60 bg-[#0060B8] px-2 text-white shadow-[0_-4px_18px_rgba(0,96,184,0.2)]">
          {navItems.map((item) => {
            const NavIcon = item.icon;
            const isActive = item.id === "orders";
            return (
              <button type="button" key={item.id} onClick={() => navigate(item.id, item.label)} className={`flex min-w-[54px] flex-col items-center justify-center rounded-xl px-2 py-1.5 transition-all duration-150 active:scale-[0.94] ${isActive ? "-translate-y-3 bg-white px-5 text-[#0060B8] shadow-[0_4px_12px_rgba(0,0,0,0.12)]" : "text-white hover:bg-white/10"}`} aria-current={isActive ? "page" : undefined}>
                <NavIcon size={21} strokeWidth={isActive ? 2.75 : 2.2} fill={isActive ? "currentColor" : "none"} />
                <span className="mt-1 text-[11px] font-bold whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
