/** Design reminder — Corporate Modern Mobile Operations: RTL captain operations, #0060B8 hierarchy, white cards, Cairo typography. */
import { useMemo, useState } from 'react';
import {
  CheckCheck,
  CircleOff,
  LoaderCircle,
  PackageCheck,
  Search,
  ShieldCheck,
  Truck,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';

import { AdminBottomNav } from '@/components/AdminBottomNav';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { orderStatusPresentation, type OrderStatus } from '@/features/admin/types';
import { type AdminLiveCaptain, useAdminCaptainsData } from '@/features/admin/useAdminCaptainsData';

type CaptainFilter = 'all' | 'available' | 'unavailable' | 'active' | 'inactive';

const filters: { id: CaptainFilter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'available', label: 'متاح' },
  { id: 'unavailable', label: 'غير متاح' },
  { id: 'active', label: 'مفعل' },
  { id: 'inactive', label: 'معطل' },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ar-SY', {
    timeZone: 'Asia/Damascus',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function CaptainDetailsDrawer({
  captain,
  open,
  onOpenChange,
  onSetCaptainActive,
  onAssignCustody,
  onReturnCustody,
  updatingCaptainId,
  updatingCustodyId,
}: {
  captain: AdminLiveCaptain | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetCaptainActive: (captainId: string, isActive: boolean) => Promise<unknown>;
  onAssignCustody: (captainId: string, itemName: string) => Promise<unknown>;
  onReturnCustody: (custodyId: string) => Promise<unknown>;
  updatingCaptainId: string | null;
  updatingCustodyId: string | null;
}) {
  const [newCustodyName, setNewCustodyName] = useState('');

  if (!captain) return null;

  const requestActivation = async () => {
    const nextIsActive = captain.activation !== 'active';
    try {
      await onSetCaptainActive(captain.id, nextIsActive);
      toast.success(nextIsActive ? 'تم تفعيل الكابتن.' : 'تم تعطيل الكابتن.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر تحديث حالة الكابتن.');
    }
  };

  const requestCustodyAssignment = async () => {
    const itemName = newCustodyName.trim();
    if (!itemName) {
      toast.error('اكتب اسم الأمانة أولاً.');
      return;
    }

    try {
      await onAssignCustody(captain.id, itemName);
      setNewCustodyName('');
      toast.success('تمت إضافة الأمانة للكابتن.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر إضافة الأمانة.');
    }
  };

  const requestCustodyReturn = async (custodyId: string) => {
    try {
      await onReturnCustody(custodyId);
      toast.success('تم تسجيل إرجاع الأمانة.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر تسجيل إرجاع الأمانة.');
    }
  };

  const isUpdatingCaptain = updatingCaptainId === captain.id;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="h-full w-[92%] max-w-[430px] overflow-y-auto border-l-[#cfe1f0] bg-[#f0f7ff]" dir="rtl">
        <DrawerHeader className="border-b border-[#dbe7f2] bg-white text-right">
          <DrawerTitle className="text-right text-[19px] text-[#1c1b1b]">تفاصيل الكابتن</DrawerTitle>
          <DrawerDescription className="text-right text-xs text-[#58616b]">بيانات التوفر والطلبات والأمانات الحية.</DrawerDescription>
        </DrawerHeader>

        <div className="p-4">
          <section className="rounded-2xl border border-[#dbe7f2] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-[#e7edf2] text-lg font-bold text-[#52606d]">{captain.initial}</span>
                <div>
                  <h2 className="text-[17px] font-bold">{captain.name}</h2>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${captain.availability === 'available' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                      {captain.availability === 'available' ? 'متاح' : 'غير متاح'}
                    </span>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${captain.activation === 'active' ? 'bg-blue-50 text-[#0060B8]' : 'bg-red-50 text-[#ba1a1a]'}`}>
                      {captain.activation === 'active' ? 'مفعل' : 'معطل'}
                    </span>
                  </div>
                </div>
              </div>
              <Truck className="text-[#0060B8]" size={22} />
            </div>
            <button
              type="button"
              disabled={isUpdatingCaptain}
              onClick={() => void requestActivation()}
              className={`mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${captain.activation === 'active' ? 'border border-red-200 bg-red-50 text-[#ba1a1a]' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}
            >
              {isUpdatingCaptain ? <LoaderCircle className="animate-spin" size={16} /> : captain.activation === 'active' ? <CircleOff size={16} /> : <ShieldCheck size={16} />}
              {captain.activation === 'active' ? 'تعطيل الكابتن' : 'تفعيل الكابتن'}
            </button>
          </section>

          <Tabs defaultValue="summary" className="mt-4">
            <TabsList className="w-full bg-white p-1 shadow-[0_1px_4px_rgba(0,72,141,0.05)]">
              <TabsTrigger value="summary" className="text-xs">ملخص</TabsTrigger>
              <TabsTrigger value="orders" className="text-xs">الطلبات</TabsTrigger>
              <TabsTrigger value="custody" className="text-xs">الأمانات</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="mt-3">
              <section className="grid grid-cols-2 gap-3">
                <article className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf4ff] text-[#0060B8]"><CheckCheck size={18} /></span>
                  <p className="mt-3 text-[11px] text-[#66727e]">طلبات مكتملة</p>
                  <strong className="mt-1 block text-lg">{captain.completedOrders}</strong>
                </article>
                <article className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700"><PackageCheck size={18} /></span>
                  <p className="mt-3 text-[11px] text-[#66727e]">الأمانات الحالية</p>
                  <strong className="mt-1 block text-lg">{captain.custodyItems.filter((item) => item.status === 'held').length}</strong>
                </article>
              </section>
              {captain.currentOrderId && <div className="mt-3 rounded-2xl border border-[#dbe7f2] bg-white p-3.5 text-xs text-[#58616b]">الطلب الحالي: <strong className="text-[#0060B8]">#{captain.currentOrderId}</strong></div>}
            </TabsContent>

            <TabsContent value="orders" className="mt-3">
              <section className="space-y-2">
                {captain.orders.length ? captain.orders.map((order) => {
                  const status = orderStatusPresentation[order.status as OrderStatus];
                  return (
                    <article key={order.id} className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm">#{order.order_number}</strong>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${status.className}`}>{status.label}</span>
                      </div>
                      <p className="mt-1 text-xs">{order.customer_name} — {order.pickup_address} ← {order.delivery_address}</p>
                      <p className="mt-1 text-[10px] text-[#66727e]">{formatDate(order.updated_at)}</p>
                    </article>
                  );
                }) : <div className="rounded-2xl border border-dashed border-[#c7dae8] bg-white/70 px-4 py-8 text-center text-xs text-[#75818e]">لا توجد طلبات مرتبطة بهذا الكابتن.</div>}
              </section>
            </TabsContent>

            <TabsContent value="custody" className="mt-3">
              <section className="rounded-2xl border border-[#ecd6a5] bg-white p-3.5">
                <div className="space-y-2">
                  {captain.custodyRecords.length ? captain.custodyRecords.map((item) => {
                    const held = item.returned_at === null;
                    const isReturning = updatingCustodyId === item.id;
                    return (
                      <div key={item.id} className="rounded-xl bg-[#f5f9fc] px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold">{item.item_name}</span>
                          <span className={`text-[10px] font-bold ${held ? 'text-amber-700' : 'text-emerald-700'}`}>{held ? 'مع الكابتن' : 'تم الإرجاع'}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-[#75818e]">
                          <span>{formatDate(item.assigned_at)}</span>
                          {held && <button type="button" disabled={isReturning} onClick={() => void requestCustodyReturn(item.id)} className="font-bold text-emerald-700 disabled:opacity-60">{isReturning ? 'جارٍ التسجيل...' : 'تسجيل الإرجاع'}</button>}
                        </div>
                      </div>
                    );
                  }) : <p className="py-3 text-center text-xs text-[#75818e]">لا توجد أمانات مسجلة لهذا الكابتن.</p>}
                </div>
                <div className="mt-3 border-t border-[#f1e2bd] pt-3">
                  <label className="mb-1 block text-[10px] font-bold text-[#66727e]">إضافة أمانة جديدة</label>
                  <div className="flex gap-2">
                    <input value={newCustodyName} onChange={(event) => setNewCustodyName(event.target.value)} placeholder="اسم الأمانة" className="h-10 min-w-0 flex-1 rounded-xl border border-[#dbe7f2] bg-[#fbfdff] px-3 text-xs outline-none focus:border-[#0060B8]" />
                    <button type="button" disabled={isUpdatingCaptain} onClick={() => void requestCustodyAssignment()} className="h-10 shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-700 disabled:opacity-60">إضافة</button>
                  </div>
                </div>
              </section>
            </TabsContent>
          </Tabs>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default function Captains() {
  const [filter, setFilter] = useState<CaptainFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedCaptainId, setSelectedCaptainId] = useState<string | null>(null);
  const {
    captains,
    isInitialLoading,
    readError,
    updatingCaptainId,
    updatingCustodyId,
    reload,
    setCaptainActive,
    assignCustody,
    returnCustody,
  } = useAdminCaptainsData();

  const visibleCaptains = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return captains.filter((captain) => (
      (filter === 'all' || captain.availability === filter || captain.activation === filter)
      && (!normalized || captain.name.toLocaleLowerCase().includes(normalized))
    ));
  }, [captains, filter, query]);

  const selectedCaptain = captains.find((captain) => captain.id === selectedCaptainId) ?? null;

  return (
    <div className="min-h-screen bg-[#eaf5ff] text-[#1c1b1b]" dir="rtl">
      <div className="relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[#f0f7ff] shadow-[0_0_40px_rgba(0,72,141,0.08)]">
        <header className="fixed top-0 right-0 left-0 z-30 mx-auto flex h-16 w-full max-w-[453px] items-center justify-between bg-[#0060B8] px-5 text-white shadow-[0_4px_18px_rgba(0,96,184,0.28)]">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><Truck size={21} /></span>
          <div className="flex items-center gap-2">
            <div className="text-left"><p className="text-[11px] leading-4 text-[#dbeaff]">لوحة الأدمن</p><h1 className="text-[19px] font-bold leading-6">الكباتن</h1></div>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><UserRound size={21} /></span>
          </div>
        </header>

        <main className="px-5 pt-[84px] pb-24">
          <section className="rounded-2xl border border-[#d3e3f0] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="text-[18px] font-bold">إدارة الكباتن</h2><p className="mt-1 text-xs leading-5 text-[#58616b]">تابع التوفر والتفعيل والأمانات والطلبات.</p></div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eaf4ff] text-[#0060B8]"><Truck size={23} /></span>
            </div>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#75818e]" size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث باسم الكابتن" className="h-11 w-full rounded-xl border border-[#c9d9e7] bg-[#fbfdff] pr-10 pl-3 text-sm placeholder:text-[#8a98a6] focus:border-[#0060B8] focus:outline-none focus:ring-2 focus:ring-[#0060B8]/15" />
            </div>
          </section>

          <section className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filters.map((item) => <button type="button" key={item.id} onClick={() => setFilter(item.id)} className={`h-8 shrink-0 rounded-full px-3.5 text-xs font-bold active:scale-[0.96] ${filter === item.id ? 'bg-[#0060B8] text-white' : 'border border-[#d4e2ec] bg-white text-[#58616b]'}`}>{item.label}</button>)}
          </section>

          <section className="mt-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold">الكباتن المعروضون</h2><span className="rounded-full bg-[#dbeeff] px-2.5 py-1 text-xs font-bold text-[#0060B8]">{isInitialLoading ? '...' : `${visibleCaptains.length} كباتن`}</span></div>
            {isInitialLoading ? <div className="min-h-40 animate-pulse rounded-2xl border border-[#dbe7f2] bg-white" /> : readError ? <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center"><p className="text-sm font-bold text-[#ba1a1a]">{readError}</p><button type="button" onClick={() => void reload()} className="mt-3 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-[#ba1a1a]">إعادة المحاولة</button></section> : <div className="space-y-3">
              {visibleCaptains.length ? visibleCaptains.map((captain) => <button type="button" key={captain.id} onClick={() => setSelectedCaptainId(captain.id)} className="w-full rounded-2xl border border-[#dbe7f2] bg-white p-4 text-right shadow-[0_2px_8px_rgba(0,72,141,0.05)] transition-all hover:-translate-y-px hover:shadow-[0_5px_12px_rgba(0,72,141,0.08)] active:scale-[0.99]">
                <span className="flex items-start justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-[#e7edf2] text-base font-bold text-[#52606d]">{captain.initial}</span>
                    <span><strong className="block text-[15px]">{captain.name}</strong><span className="mt-1 flex gap-1.5"><span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${captain.availability === 'available' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{captain.availability === 'available' ? 'متاح' : 'غير متاح'}</span><span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${captain.activation === 'active' ? 'bg-blue-50 text-[#0060B8]' : 'bg-red-50 text-[#ba1a1a]'}`}>{captain.activation === 'active' ? 'مفعل' : 'معطل'}</span></span></span>
                  </span>
                  <span className="text-left text-[11px] text-[#66727e]"><strong className="block text-sm text-[#1c1b1b]">{captain.completedOrders}</strong>مكتمل</span>
                </span>
                <span className="mt-3 flex items-center justify-between border-t border-[#eef3f7] pt-3 text-[11px] text-[#66727e]"><span>{captain.currentOrderId ? `الطلب الحالي #${captain.currentOrderId}` : 'لا يوجد طلب حالي'}</span><span>{captain.custodyItems.filter((item) => item.status === 'held').length} أمانات</span></span>
              </button>) : <div className="rounded-2xl border border-dashed border-[#c7dae8] bg-white/70 px-4 py-10 text-center text-sm text-[#75818e]">لا توجد كباتن مطابقة للفلتر.</div>}
            </div>}
          </section>
        </main>

        <AdminBottomNav active="captains" />
        <CaptainDetailsDrawer
          captain={selectedCaptain}
          open={selectedCaptain !== null}
          onOpenChange={(open) => !open && setSelectedCaptainId(null)}
          onSetCaptainActive={setCaptainActive}
          onAssignCustody={assignCustody}
          onReturnCustody={returnCustody}
          updatingCaptainId={updatingCaptainId}
          updatingCustodyId={updatingCustodyId}
        />
      </div>
    </div>
  );
}
