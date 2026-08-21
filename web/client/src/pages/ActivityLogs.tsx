/**
 * Design reminder — Corporate Modern Mobile Operations:
 * RTL audit trail, precise scanable records, #0060B8 primary hierarchy, Cairo typography, no gradients.
 */
import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Package,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  UserPlus,
  WalletCards,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import { AdminBottomNav } from '@/components/AdminBottomNav';
import {
  type ActivityLogCategory,
  type ActivityLogIcon,
  type ActivityLogTone,
  useAdminActivityLogsData,
} from '@/features/admin/useAdminActivityLogsData';

type LogCategory = 'all' | ActivityLogCategory;

const categoryTabs: { id: LogCategory; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'orders', label: 'الطلبات' },
  { id: 'users', label: 'المستخدمون' },
  { id: 'captains', label: 'الكباتن' },
  { id: 'system', label: 'النظام' },
];

const toneClasses: Record<ActivityLogTone, { icon: string; chip: string }> = {
  blue: { icon: 'bg-blue-100 text-[#0060B8]', chip: 'bg-blue-50 text-[#0060B8]' },
  green: { icon: 'bg-emerald-100 text-emerald-700', chip: 'bg-emerald-50 text-emerald-700' },
  red: { icon: 'bg-red-100 text-[#ba1a1a]', chip: 'bg-red-50 text-[#ba1a1a]' },
  violet: { icon: 'bg-violet-100 text-violet-700', chip: 'bg-violet-50 text-violet-700' },
  slate: { icon: 'bg-slate-100 text-slate-700', chip: 'bg-slate-100 text-slate-700' },
};

const activityIcons: Record<ActivityLogIcon, LucideIcon> = {
  package: Package,
  'user-plus': UserPlus,
  check: CheckCircle2,
  trash: Trash2,
  truck: Truck,
  shield: ShieldCheck,
  wallet: WalletCards,
  cancel: XCircle,
  clipboard: ClipboardList,
};

export default function ActivityLogs() {
  const [, setLocation] = useLocation();
  const [category, setCategory] = useState<LogCategory>('all');
  const [query, setQuery] = useState('');
  const { activities, isInitialLoading, readError, reload, pageNumber, hasNextPage, hasPreviousPage, nextPage, previousPage } = useAdminActivityLogsData();

  const filteredActivities = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return activities.filter((activity) => {
      const matchesCategory = category === 'all' || activity.category === category;
      const searchable = `${activity.action} ${activity.subject} ${activity.actor} ${activity.details}`.toLocaleLowerCase();
      return matchesCategory && (!normalized || searchable.includes(normalized));
    });
  }, [activities, category, query]);

  return (
    <div className="min-h-screen bg-[#eaf5ff] text-[#1c1b1b]" dir="rtl">
      <div className="relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[#f0f7ff] shadow-[0_0_40px_rgba(0,72,141,0.08)]">
        <header className="fixed top-0 right-0 left-0 z-30 mx-auto flex h-16 w-full max-w-[453px] items-center justify-between bg-[#0060B8] px-5 text-white shadow-[0_4px_18px_rgba(0,96,184,0.28)]">
          <button type="button" aria-label="العودة إلى الرئيسية" onClick={() => setLocation('/')} className="grid h-10 w-10 place-items-center rounded-full transition-transform duration-150 hover:bg-white/10 active:scale-[0.96]">
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
                <h2 className="text-[18px] font-bold">سجل الحركات</h2>
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
                return <button type="button" key={tab.id} onClick={() => setCategory(tab.id)} className={`h-9 shrink-0 rounded-full px-3.5 text-xs font-bold transition-all duration-150 active:scale-[0.96] ${isActive ? 'bg-[#0060B8] text-white shadow-[0_3px_8px_rgba(0,96,184,0.18)]' : 'border border-[#d4e2ec] bg-white text-[#58616b] hover:bg-[#eaf4ff]'}`}>{tab.label}</button>;
              })}
            </div>
          </section>

          <section className="mt-5" aria-labelledby="activity-list-title">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="activity-list-title" className="text-base font-bold">آخر الحركات</h2>
              <span className="rounded-full bg-[#dbeeff] px-2.5 py-1 text-xs font-bold text-[#0060B8]">{isInitialLoading ? '...' : `${filteredActivities.length} حركة`}</span>
            </div>

            {isInitialLoading ? <div className="min-h-48 animate-pulse rounded-2xl border border-[#dbe7f2] bg-white" /> : readError ? <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center"><p className="text-sm font-bold text-[#ba1a1a]">{readError}</p><button type="button" onClick={() => void reload()} className="mt-3 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-[#ba1a1a]">إعادة المحاولة</button></section> : <div className="relative space-y-3 before:absolute before:top-5 before:bottom-5 before:right-[21px] before:w-px before:bg-[#d9e7f1]">
              {filteredActivities.length ? filteredActivities.map((activity) => {
                const Icon = activityIcons[activity.icon];
                const tone = toneClasses[activity.tone];
                return <article key={activity.id} className="relative z-10 flex gap-3 rounded-2xl border border-[#dbe7f2] bg-white p-3.5 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-4 ring-[#f0f7ff] ${tone.icon}`}><Icon size={20} strokeWidth={2.25} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-bold text-[#1c1b1b]">{activity.action}</h3><time className="shrink-0 text-[10px] text-[#75818e]">{activity.time}</time></div>
                    <p className="mt-1 text-xs font-bold text-[#0060B8]">{activity.subject}</p>
                    <p className="mt-1 text-xs leading-5 text-[#58616b]">{activity.details}</p>
                    <div className="mt-2 flex items-center gap-1.5"><span className={`rounded-md px-2 py-1 text-[10px] font-bold ${tone.chip}`}>بواسطة: {activity.actor}</span></div>
                  </div>
                </article>;
              }) : <div className="rounded-2xl border border-dashed border-[#c7dae8] bg-white/70 px-4 py-10 text-center"><ClipboardList className="mx-auto text-[#7d9ab0]" size={28} /><p className="mt-2 text-sm font-bold text-[#4f5d6b]">لا توجد حركات مطابقة</p><p className="mt-1 text-xs text-[#75818e]">جرّب تغيير البحث أو نوع السجل.</p></div>}
            </div>}
            {!isInitialLoading && !readError && <nav className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#d3e3f0] bg-white p-3" aria-label="تنقل سجل الحركات"><button type="button" onClick={() => void previousPage()} disabled={!hasPreviousPage} className="h-10 flex-1 rounded-xl border border-[#c9d9e7] text-xs font-bold text-[#0060B8] disabled:cursor-not-allowed disabled:opacity-45">السابق</button><span className="shrink-0 text-xs font-bold text-[#58616b]">صفحة {pageNumber}</span><button type="button" onClick={() => void nextPage()} disabled={!hasNextPage} className="h-10 flex-1 rounded-xl bg-[#0060B8] text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">التالي</button></nav>}
          </section>
        </main>

        <AdminBottomNav active="more" />
      </div>
    </div>
  );
}
