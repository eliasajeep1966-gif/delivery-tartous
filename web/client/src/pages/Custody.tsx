import { useMemo, useState } from 'react';
import { CheckCheck, LoaderCircle, PackageCheck, PackageOpen, RefreshCw, Truck } from 'lucide-react';
import { toast } from 'sonner';

import { MorePageLayout } from '@/components/MorePageLayout';
import { type AdminLiveCaptain, useAdminCaptainsData } from '@/features/admin/useAdminCaptainsData';

 type CustodyFilter = 'all' | 'held' | 'returned';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ar-SY', {
    timeZone: 'Asia/Damascus',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function captainCustodyRows(captains: AdminLiveCaptain[]) {
  return captains.flatMap((captain) => captain.custodyRecords.map((record) => ({ captain, record })));
}

export default function Custody() {
  const [filter, setFilter] = useState<CustodyFilter>('all');
  const [returningId, setReturningId] = useState<string | null>(null);
  const {
    captains,
    isInitialLoading,
    readError,
    reload,
    returnCustody,
  } = useAdminCaptainsData();

  const rows = useMemo(() => {
    const allRows = captainCustodyRows(captains);
    return allRows.filter(({ record }) => (
      filter === 'all'
      || (filter === 'held' && record.returned_at === null)
      || (filter === 'returned' && record.returned_at !== null)
    ));
  }, [captains, filter]);

  const heldCount = useMemo(
    () => captainCustodyRows(captains).filter(({ record }) => record.returned_at === null).length,
    [captains],
  );

  const handleReturn = async (custodyId: string, captainName: string) => {
    if (returningId) return;
    setReturningId(custodyId);
    try {
      await returnCustody(custodyId);
      toast.success(`تم تسجيل إرجاع الأمانة من ${captainName}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر تسجيل إرجاع الأمانة.');
    } finally {
      setReturningId(null);
    }
  };

  return (
    <MorePageLayout title="إدارة الأمانات" subtitle="" Icon={PackageCheck}>
      <section className="rounded-2xl border border-[#ecd6a5] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold">أمانات الكباتن</h2>
            <p className="mt-1 text-xs leading-5 text-[#756447]">تابع الأمانات المسجلة فعلياً وسجل إرجاعها.</p>
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-700"><PackageOpen size={23} /></span>
        </div>
        <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">يوجد <strong>{heldCount}</strong> أمانات ما زالت مع الكباتن.</div>
      </section>

      {readError && (
        <section className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-center">
          <p className="text-xs font-bold text-[#ba1a1a]">{readError}</p>
          <button type="button" onClick={() => void reload()} className="mx-auto mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#0060B8]"><RefreshCw size={13} />إعادة المحاولة</button>
        </section>
      )}

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {([
          ['all', 'الكل'],
          ['held', 'مع الكابتن'],
          ['returned', 'تم الإرجاع'],
        ] as const).map(([id, label]) => (
          <button type="button" key={id} onClick={() => setFilter(id)} className={`h-9 shrink-0 rounded-full px-4 text-xs font-bold active:scale-[0.96] ${filter === id ? 'bg-[#0060B8] text-white' : 'border border-[#d4e2ec] bg-white text-[#58616b]'}`}>{label}</button>
        ))}
      </div>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold">سجل الأمانات</h2><span className="rounded-full bg-[#fff3dc] px-2.5 py-1 text-xs font-bold text-amber-700">{isInitialLoading ? '...' : `${rows.length} سجلات`}</span></div>
        {isInitialLoading ? (
          <div className="rounded-2xl border border-[#dbe7f2] bg-white px-4 py-10 text-center text-sm text-[#75818e]"><LoaderCircle className="mx-auto animate-spin" size={24} /><p className="mt-2">جارٍ تحميل الأمانات...</p></div>
        ) : rows.length ? (
          <div className="space-y-3">
            {rows.map(({ captain, record }) => {
              const held = record.returned_at === null;
              const isReturning = returningId === record.id;
              return (
                <article key={record.id} className="rounded-2xl border border-[#dbe7f2] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e7edf2] text-sm font-bold text-[#52606d]">{captain.initial}</span><div className="min-w-0"><h3 className="truncate font-bold">{captain.name}</h3><span className={`mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${held ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{held ? <Truck size={12} /> : <CheckCheck size={12} />}{held ? 'مع الكابتن' : 'تم الإرجاع'}</span></div></div><span className="text-left text-[10px] text-[#75818e]">{formatDate(record.assigned_at)}</span>
                  </div>
                  <div className="mt-3 rounded-xl bg-[#f4f8fb] px-3 py-2"><p className="text-xs font-bold text-[#4f5d6b]">{record.item_name}</p>{record.item_details && <p className="mt-1 text-[10px] leading-5 text-[#75818e]">{record.item_details}</p>}</div>
                  {held && <button type="button" disabled={isReturning} onClick={() => void handleReturn(record.id, captain.name)} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">{isReturning ? <LoaderCircle className="animate-spin" size={17} /> : <CheckCheck size={17} />}تسجيل إرجاع الأمانة</button>}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#c7dae8] bg-white/70 px-4 py-10 text-center text-sm text-[#75818e]">لا توجد أمانات مطابقة.</div>
        )}
      </section>
    </MorePageLayout>
  );
}
