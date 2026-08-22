import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, LoaderCircle, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { MorePageLayout } from '@/components/MorePageLayout';
import { Button } from '@/components/ui/button';
import { useWebAuth } from '@/contexts/WebAuthContext';
import { webSupabase } from '@/data/supabase/webSupabaseContract';

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export default function AccountSettings() {
  const { profile, session, refresh } = useWebAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [email, setEmail] = useState(profile?.email ?? session?.user.email ?? '');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setEmail(profile?.email ?? session?.user.email ?? '');
  }, [profile?.full_name, profile?.email, session?.user.email]);

  const submitName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSavingName) return;
    setNameError(null);
    if (!fullName.trim()) {
      setNameError('أدخل الاسم الكامل.');
      return;
    }

    setIsSavingName(true);
    try {
      await webSupabase.actions.updateMyProfile(fullName);
      await refresh();
      toast.success('تم تحديث الاسم بنجاح.');
    } catch (error) {
      setNameError(errorText(error, 'تعذر تحديث الاسم.'));
    } finally {
      setIsSavingName(false);
    }
  };

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSavingEmail) return;
    setEmailError(null);
    if (!email.trim()) {
      setEmailError('أدخل البريد الإلكتروني.');
      return;
    }
    if (email.trim().toLowerCase() === (profile?.email ?? '').toLowerCase()) {
      setEmailError('البريد الإلكتروني الجديد يجب أن يختلف عن الحالي.');
      return;
    }

    setIsSavingEmail(true);
    try {
      await webSupabase.auth.updateEmail(email);
      toast.success('تم إرسال رسالة تأكيد إلى البريد الجديد.');
    } catch (error) {
      setEmailError(errorText(error, 'تعذر تحديث البريد الإلكتروني.'));
    } finally {
      setIsSavingEmail(false);
    }
  };

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSavingPassword) return;
    setPasswordError(null);
    if (password.length < 12) {
      setPasswordError('يجب أن تتكون كلمة المرور من 12 حرفاً على الأقل.');
      return;
    }
    if (password !== passwordConfirmation) {
      setPasswordError('تأكيد كلمة المرور غير مطابق.');
      return;
    }

    setIsSavingPassword(true);
    try {
      await webSupabase.auth.updatePassword(password);
      setPassword('');
      setPasswordConfirmation('');
      toast.success('تم تغيير كلمة المرور بنجاح.');
    } catch (error) {
      setPasswordError(errorText(error, 'تعذر تغيير كلمة المرور.'));
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <MorePageLayout title="إدارة الحساب" subtitle="تعديل بيانات الحساب الشخصية" Icon={UserRound}>
      <section className="mb-4 rounded-2xl border border-[#d3e3f0] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eaf4ff] text-[#0060B8]"><UserRound size={24} /></span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-bold">بيانات الحساب</h2>
            <p className="mt-1 truncate text-xs text-[#66727e]">{profile?.role === 'supervisor' ? 'مشرف' : 'مدير'} — يمكنك تعديل بياناتك الشخصية فقط.</p>
          </div>
        </div>
      </section>

      <form onSubmit={submitName} className="space-y-3 rounded-2xl border border-[#dbe7f2] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
        <div className="flex items-center gap-2 text-[#0060B8]"><UserRound size={19} /><h2 className="text-[15px] font-bold">تعديل الاسم</h2></div>
        <input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={120} autoComplete="name" placeholder="الاسم الكامل" className="h-11 w-full rounded-xl border border-[#cfe0ec] bg-[#f8fcff] px-3 text-right text-sm outline-none transition-colors focus:border-[#0060B8]" />
        {nameError && <p className="text-xs font-bold text-[#ba1a1a]">{nameError}</p>}
        <Button type="submit" disabled={isSavingName} className="h-10 w-full rounded-xl bg-[#0060B8] text-xs font-bold hover:bg-[#00539f]">{isSavingName ? <><LoaderCircle size={15} className="ml-2 animate-spin" />جارٍ الحفظ...</> : 'حفظ الاسم'}</Button>
      </form>

      <form onSubmit={submitEmail} className="mt-3 space-y-3 rounded-2xl border border-[#dbe7f2] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
        <div className="flex items-center gap-2 text-[#0060B8]"><Mail size={19} /><h2 className="text-[15px] font-bold">تعديل البريد الإلكتروني المستخدم</h2></div>
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" dir="ltr" autoComplete="email" placeholder="name@example.com" className="h-11 w-full rounded-xl border border-[#cfe0ec] bg-[#f8fcff] px-3 text-left text-sm outline-none transition-colors focus:border-[#0060B8]" />
        <p className="text-[11px] leading-5 text-[#66727e]">قد يطلب Supabase تأكيد البريد الجديد قبل اعتماده لتسجيل الدخول.</p>
        {emailError && <p className="text-xs font-bold text-[#ba1a1a]">{emailError}</p>}
        <Button type="submit" disabled={isSavingEmail} className="h-10 w-full rounded-xl bg-[#0060B8] text-xs font-bold hover:bg-[#00539f]">{isSavingEmail ? <><LoaderCircle size={15} className="ml-2 animate-spin" />جارٍ الإرسال...</> : 'حفظ البريد الإلكتروني'}</Button>
      </form>

      <form onSubmit={submitPassword} className="mt-3 space-y-3 rounded-2xl border border-[#dbe7f2] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
        <div className="flex items-center gap-2 text-[#0060B8]"><KeyRound size={19} /><h2 className="text-[15px] font-bold">تغيير كلمة المرور</h2></div>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={12} autoComplete="new-password" placeholder="كلمة المرور الجديدة" className="h-11 w-full rounded-xl border border-[#cfe0ec] bg-[#f8fcff] px-3 text-left text-sm outline-none transition-colors focus:border-[#0060B8]" />
        <input value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} type="password" minLength={12} autoComplete="new-password" placeholder="تأكيد كلمة المرور" className="h-11 w-full rounded-xl border border-[#cfe0ec] bg-[#f8fcff] px-3 text-left text-sm outline-none transition-colors focus:border-[#0060B8]" />
        <p className="text-[11px] leading-5 text-[#66727e]">يجب أن تكون كلمة المرور الجديدة بطول 12 حرفاً على الأقل.</p>
        {passwordError && <p className="text-xs font-bold text-[#ba1a1a]">{passwordError}</p>}
        <Button type="submit" disabled={isSavingPassword} className="h-10 w-full rounded-xl bg-[#0060B8] text-xs font-bold hover:bg-[#00539f]">{isSavingPassword ? <><LoaderCircle size={15} className="ml-2 animate-spin" />جارٍ الحفظ...</> : 'حفظ كلمة المرور'}</Button>
      </form>

      <section className="mt-3 space-y-2 rounded-2xl border border-[#dbe7f2] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
        <div className="flex items-center gap-2 text-[#0060B8]"><ShieldCheck size={19} /><h2 className="text-[15px] font-bold">تفاصيل الحساب</h2></div>
        <div className="flex items-center gap-3 rounded-xl bg-[#f8fcff] px-3 py-2.5"><Mail size={17} className="text-[#0060B8]" /><div className="min-w-0"><p className="text-[10px] text-[#74818c]">البريد الحالي</p><p className="truncate text-xs font-bold text-[#274b65]" dir="ltr">{profile?.email ?? session?.user.email ?? 'غير متاح'}</p></div></div>
        <div className="flex items-center gap-3 rounded-xl bg-[#f8fcff] px-3 py-2.5"><ShieldCheck size={17} className="text-[#0060B8]" /><div><p className="text-[10px] text-[#74818c]">نوع الحساب</p><p className="text-xs font-bold text-[#274b65]">{profile?.role === 'supervisor' ? 'مشرف' : 'مدير'}</p></div></div>
      </section>
    </MorePageLayout>
  );
}

