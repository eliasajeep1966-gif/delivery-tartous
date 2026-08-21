/** Design reminder — Captain secondary pages use the same compact white shell, dense cards, and liquid-glass navigation as the captain home. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, ClipboardList, Clock3, LoaderCircle, MapPin, Package, Phone, RefreshCw, ShieldCheck, UserRound, WalletCards } from 'lucide-react';
import { Link } from 'wouter';

import { CaptainBottomNav, type CaptainNavKey } from '@/components/CaptainBottomNav';
import { CaptainTopBar } from '@/components/CaptainTopBar';
import { Button } from '@/components/ui/button';
import { useWebAuth } from '@/contexts/WebAuthContext';
import { orderStatusPresentation, type OrderStatus } from '@/features/admin/types';
import { useCaptainDashboard } from '@/features/captain/useCaptainDashboard';
import { webSupabase, type WebCaptainWageDetailV2 } from '@/data/supabase/webSupabaseContract';
import { withWebRequestTimeout } from '@/lib/authRequest';

const money = (value: number) => `${new Intl.NumberFormat('en-US').format(value)} ل.س`;
const date = (value: string | null | undefined) => value ? new Intl.DateTimeFormat('ar-SY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'غير مسجل';

function PageShell({ active, children, onSignOut, signingOut = false, showSignOut = false }: { active: CaptainNavKey; children: React.ReactNode; onSignOut: () => void; signingOut?: boolean; showSignOut?: boolean }) {
  return <div className="min-h-screen bg-[#edf8fd] text-[#17364d]" dir="rtl"><div className="captain-shell relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[linear-gradient(180deg,#f9fdff_0%,#e7f6fc_100%)] pb-24 shadow-[0_0_40px_rgba(0,72,141,0.08)]"><CaptainTopBar onSignOut={onSignOut} signingOut={signingOut} showSignOut={showSignOut} /><main className="space-y-3 px-3 pt-0 pb-6">{children}</main><CaptainBottomNav active={active} /></div></div>;
}

function BackTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="flex items-center gap-2 rounded-2xl border border-[#dcecf4] bg-white px-3.5 py-3 shadow-[0_2px_8px_rgba(0,96,184,0.05)]"><Link href="/captain" className="grid h-9 w-9 place-items-center rounded-xl bg-[#e8f6ff] text-[#086fc4]" aria-label="العودة للرئيسية"><ArrowRight size={18} /></Link><div><h1 className="text-[15px] font-extrabold text-[#155b8d]">{title}</h1><p className="mt-0.5 text-[10px] text-[#6c899e]">{subtitle}</p></div></div>;
}

function SignOutButton({ signOut, signingOut, setSigningOut }: { signOut: () => Promise<void>; signingOut: boolean; setSigningOut: (value: boolean) => void }) {
  return <Button type="button" variant="outline" disabled={signingOut} onClick={async () => { setSigningOut(true); try { await signOut(); } finally { setSigningOut(false); } }} className="h-11 w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50">تسجيل الخروج</Button>;
}

export function CaptainOrders() {
  const { signOut } = useWebAuth();
  const [signingOut, setSigningOut] = useState(false);
  const { orders, isInitialLoading, readError, reload } = useCaptainDashboard();
  return <PageShell active="orders" onSignOut={() => void signOut()} signingOut={signingOut}><BackTitle title="طلباتي" subtitle="كل الطلبات المسندة إلى حسابك" />{isInitialLoading ? <Loading /> : readError ? <ErrorState message={readError} onRetry={() => void reload()} /> : orders.length === 0 ? <Empty icon={<ClipboardList size={28} />} title="لا توجد طلبات مسندة" body="ستظهر الطلبات هنا بعد إسنادها من المكتب." /> : <div className="space-y-2">{orders.map((order) => { const status = orderStatusPresentation[order.status as OrderStatus]; return <article key={order.id} className="relative overflow-hidden rounded-2xl border border-white bg-white p-3.5 shadow-[0_2px_8px_rgba(0,96,184,0.05)]"><span className={`absolute right-0 top-0 h-full w-1 ${status.stripClass}`} /><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] text-[#748c9d]">الطلب #{order.order_number}</p><h2 className="mt-1 text-[13px] font-extrabold text-[#194b6e]">{order.customer_name}</h2><a href={`tel:${order.customer_phone}`} className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#1478bf]" dir="ltr"><Phone size={12} />{order.customer_phone}</a></div><div className="text-left"><span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${status.className}`}>{status.label}</span><strong className="mt-2 block text-[11px] text-[#075d9f]">{money(order.fee)}</strong></div></div><div className="mt-3 space-y-1 border-t border-dashed border-[#dcebf3] pt-2 text-[10px] text-[#54778d]"><p className="flex items-center gap-1.5"><Package size={13} className="text-[#086fc4]" />{order.pickup_address}</p><p className="flex items-center gap-1.5"><MapPin size={13} className="text-emerald-600" />{order.delivery_address}</p><p className="flex items-center gap-1.5"><Clock3 size={13} />{date(order.updated_at)}</p></div></article>; })}</div>}</PageShell>;
}

export function CaptainWages() {
  const { profile, signOut } = useWebAuth();
  const [rows, setRows] = useState<WebCaptainWageDetailV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const load = useCallback(async () => { if (!profile) return; setLoading(true); setError(null); try { setRows(await withWebRequestTimeout(webSupabase.reads.captainWageDetailsV2(profile.id), 'انتهت مهلة تحميل الأجور.')); } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تحميل أجورك.'); } finally { setLoading(false); } }, [profile]);
  useEffect(() => { void load(); }, [load]);
  const totals = useMemo(() => rows.reduce((acc, row) => ({ gross: acc.gross + row.gross_fee, captain: acc.captain + row.captain_amount, paid: acc.paid + row.paid_amount, unpaid: acc.unpaid + row.unpaid_amount }), { gross: 0, captain: 0, paid: 0, unpaid: 0 }), [rows]);
  return <PageShell active="wages" onSignOut={() => void signOut()} signingOut={signingOut}><BackTitle title="أجوري" subtitle="تفاصيل أجورك وحالتها من السجلات الفعلية" />{loading ? <Loading /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : <><div className="grid grid-cols-2 gap-2.5"><Metric label="إجمالي الطلبات" value={money(totals.gross)} icon={<WalletCards size={16} />} /><Metric label="صافي الكابتن" value={money(totals.captain)} icon={<CheckCircle2 size={16} />} /><Metric label="المسدّد" value={money(totals.paid)} icon={<CheckCircle2 size={16} />} /><Metric label="المتبقي" value={money(totals.unpaid)} icon={<Clock3 size={16} />} /></div>{rows.length === 0 ? <Empty icon={<WalletCards size={28} />} title="لا يوجد سجل أجور" body="ستظهر أجور الطلبات المكتملة هنا." /> : <div className="space-y-2">{rows.map((row) => <article key={row.financial_ledger_id} className="rounded-2xl border border-white bg-white p-3.5 shadow-[0_2px_8px_rgba(0,96,184,0.05)]"><div className="flex items-start justify-between"><div><p className="text-[10px] text-[#748c9d]">الطلب #{row.order_number}</p><p className="mt-1 text-[11px] text-[#59788d]">اكتمل: {date(row.completed_at)}</p></div><span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${row.is_fully_paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{row.is_fully_paid ? 'مسدّد' : 'غير مسدّد'}</span></div><div className="mt-3 grid grid-cols-3 gap-2 border-t border-dashed border-[#dcebf3] pt-2 text-center"><div><p className="text-[9px] text-[#7892a3]">الإجمالي</p><strong className="text-[11px] text-[#18547e]">{money(row.gross_fee)}</strong></div><div><p className="text-[9px] text-[#7892a3]">حصتك</p><strong className="text-[11px] text-[#086fc4]">{money(row.captain_amount)}</strong></div><div><p className="text-[9px] text-[#7892a3]">المتبقي</p><strong className="text-[11px] text-red-600">{money(row.unpaid_amount)}</strong></div></div></article>)}</div>}</>}</PageShell>;
}

export function CaptainCustody() {
  const { signOut } = useWebAuth();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof webSupabase.reads.myCustody>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setRows(await webSupabase.reads.myCustody()); } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تحميل الأمانات.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  return <PageShell active="custody" onSignOut={() => void signOut()} signingOut={signingOut}><BackTitle title="أماناتي" subtitle="الأغراض المسجلة على عهدتك" />{loading ? <Loading /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : rows.length === 0 ? <Empty icon={<ShieldCheck size={28} />} title="لا توجد أمانات مسجلة" body="ستظهر الأمانات هنا عند تسجيلها باسمك." /> : <div className="space-y-2">{rows.map((row) => <article key={row.id} className="rounded-2xl border border-white bg-white p-3.5 shadow-[0_2px_8px_rgba(0,96,184,0.05)]"><div className="flex items-start justify-between"><div><p className="text-[10px] text-[#748c9d]">أمانة #{row.id.slice(0, 8)}</p><h2 className="mt-1 text-[13px] font-extrabold text-[#194b6e]">{row.item_name}</h2></div><span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${row.returned_at ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{row.returned_at ? 'مُرجعة' : 'على العهدة'}</span></div><p className="mt-2 text-[10px] text-[#6c899e]">استلمت بتاريخ: {date(row.assigned_at)}</p></article>)}</div>}</PageShell>;
}

export type CaptainSettingsCallbacks = {
  onUpdateProfile?: (input: { fullName: string }) => Promise<void>;
  onChangePassword?: (input: { password: string }) => Promise<void>;
};

export function CaptainSettings({ onUpdateProfile, onChangePassword }: CaptainSettingsCallbacks = {}) {
  const { profile, signOut } = useWebAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [savedSection, setSavedSection] = useState<string | null>(null);

  const submitName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSavedSection(null);
    if (!onUpdateProfile) return;
    if (!fullName.trim()) { setFormError('اكتب الاسم الجديد أولاً.'); return; }
    await onUpdateProfile({ fullName: fullName.trim() });
    setSavedSection('name');
  };

  const submitPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSavedSection(null);
    if (!onChangePassword) return;
    if (password.length < 12) { setFormError('كلمة السر يجب أن تكون 12 محرفاً على الأقل.'); return; }
    if (password !== passwordConfirmation) { setFormError('تأكيد كلمة السر غير مطابق.'); return; }
    await onChangePassword({ password });
    setPassword('');
    setPasswordConfirmation('');
    setSavedSection('password');
  };

  const contractNote = 'زر الحفظ لا ينفذ أي API من الواجهة وحدها؛ سيعمل فقط بعد تمرير callback العقد الخلفي.';
  return <PageShell active="home" onSignOut={() => void signOut()} signingOut={signingOut}>
    <BackTitle title="إعدادات الحساب" subtitle="تغيير بيانات الكابتن من مكان واحد" />
    <form id="name" onSubmit={submitName} className="space-y-3 rounded-2xl border border-[#dcecf4] bg-white p-3.5 shadow-[0_2px_8px_rgba(0,96,184,0.05)]">
      <div className="flex items-center gap-2 text-[#18547e]"><UserRound size={17} /><h2 className="text-[13px] font-extrabold">تغيير الاسم</h2></div>
      <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="الاسم الكامل" className="h-11 w-full rounded-xl border border-[#dcecf4] bg-[#f8fcfe] px-3 text-right text-sm outline-none focus:border-[#54a8d6]" />
      <Button type="submit" disabled={!onUpdateProfile} className="h-10 w-full rounded-xl bg-[#086fc4] text-xs font-extrabold">حفظ الاسم</Button>
      {!onUpdateProfile && <p className="text-[10px] leading-5 text-[#7892a3]">{contractNote}</p>}
      {savedSection === 'name' && <p className="text-[10px] font-bold text-emerald-700">تم تمرير التعديل إلى callback الربط.</p>}
    </form>
    <form id="password" onSubmit={submitPassword} className="space-y-3 rounded-2xl border border-[#dcecf4] bg-white p-3.5 shadow-[0_2px_8px_rgba(0,96,184,0.05)]">
      <div className="flex items-center gap-2 text-[#18547e]"><ShieldCheck size={17} /><h2 className="text-[13px] font-extrabold">تغيير كلمة السر</h2></div>
      <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="كلمة السر الجديدة" autoComplete="new-password" className="h-11 w-full rounded-xl border border-[#dcecf4] bg-[#f8fcfe] px-3 text-left text-sm outline-none focus:border-[#54a8d6]" />
      <input type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} placeholder="تأكيد كلمة السر" autoComplete="new-password" className="h-11 w-full rounded-xl border border-[#dcecf4] bg-[#f8fcfe] px-3 text-left text-sm outline-none focus:border-[#54a8d6]" />
      <Button type="submit" disabled={!onChangePassword} className="h-10 w-full rounded-xl bg-[#086fc4] text-xs font-extrabold">حفظ كلمة السر</Button>
      {!onChangePassword && <p className="text-[10px] leading-5 text-[#7892a3]">{contractNote}</p>}
    </form>
    <section id="details" className="space-y-2 rounded-2xl border border-[#dcecf4] bg-white p-3.5 shadow-[0_2px_8px_rgba(0,96,184,0.05)]"><div className="flex items-center gap-2 text-[#18547e]"><UserRound size={17} /><h2 className="text-[13px] font-extrabold">تفاصيل الحساب</h2></div><SettingRow icon={<UserRound size={17} />} label="الاسم" value={profile?.full_name || 'غير محدد'} /><SettingRow icon={<Phone size={17} />} label="البريد الإلكتروني" value={profile?.email || 'غير متاح'} /><SettingRow icon={<ShieldCheck size={17} />} label="الدور" value="كابتن" /></section>
    {formError && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] font-bold text-red-700">{formError}</p>}
    <SignOutButton signOut={signOut} signingOut={signingOut} setSigningOut={setSigningOut} />
  </PageShell>;
}

export function CaptainHelp() {
  const { signOut } = useWebAuth();
  const [signingOut, setSigningOut] = useState(false);
  return <PageShell active="home" onSignOut={() => void signOut()} signingOut={signingOut}><BackTitle title="المساعدة" subtitle="دليل استخدام واجهة الكابتن" /><section className="space-y-3 rounded-2xl border border-[#dcecf4] bg-white p-4 text-[11px] leading-6 text-[#56768b] shadow-[0_2px_8px_rgba(0,96,184,0.05)]"><h2 className="text-[14px] font-extrabold text-[#18547e]">كيف أتعامل مع الطلب؟</h2><p>فعّل حالة التوفر من الرئيسية، ثم استخدم زر المرحلة داخل بطاقة الطلب: تم الاستلام، بدء التوصيل، ثم تأكيد التسليم.</p><h2 className="text-[14px] font-extrabold text-[#18547e]">الأمانات والأجور</h2><p>تعرض الأمانات المسجلة باسمك وسجل الأجور القادم من العقد الخلفي حسب هويتك وصلاحيات حسابك.</p></section></PageShell>;
}

function Loading() { return <section className="flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-[#dcecf4] bg-white text-sm font-bold text-[#086fc4]"><LoaderCircle className="animate-spin" size={19} />جارٍ التحميل...</section>; }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) { return <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center"><p className="text-sm font-bold text-[#ba1a1a]">{message}</p><Button type="button" onClick={onRetry} variant="outline" className="mt-3 rounded-xl border-red-200 text-red-600"><RefreshCw size={15} className="ml-2" />إعادة المحاولة</Button></section>; }
function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) { return <section className="rounded-2xl border border-dashed border-[#c1dfea] bg-white/80 px-4 py-8 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e8f6ff] text-[#5a9ac1]">{icon}</span><h2 className="mt-3 text-[13px] font-extrabold text-[#50778f]">{title}</h2><p className="mt-1 text-[10px] text-[#7892a3]">{body}</p></section>; }
function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <article className="rounded-2xl border border-white bg-white p-3 shadow-[0_2px_8px_rgba(0,96,184,0.05)]"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#e8f6ff] text-[#086fc4]">{icon}</span><strong className="mt-2 block text-[12px] text-[#175d8a]">{value}</strong><p className="mt-1 text-[10px] font-bold text-[#708b9d]">{label}</p></article>; }
function SettingRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex items-center gap-3 rounded-xl bg-[#f8fcfe] px-3 py-2.5"><span className="text-[#086fc4]">{icon}</span><div className="min-w-0"><p className="text-[9px] text-[#7892a3]">{label}</p><p className="truncate text-[12px] font-extrabold text-[#194b6e]">{value}</p></div></div>; }
