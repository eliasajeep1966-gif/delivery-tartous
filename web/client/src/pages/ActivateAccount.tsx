import { type FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, LockKeyhole, Mail, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation } from 'wouter';

import { AuthShell } from '@/components/AuthShell';
import { useWebAuth } from '@/contexts/WebAuthContext';
import { webSupabase } from '@/data/supabase/webSupabaseContract';
import { withAuthRequestTimeout } from '@/lib/authRequest';

function hasValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function activationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';

  if (message.includes('15 ثانية')) return message;
  if (message.startsWith('أدخل') || message.startsWith('يجب') || message.startsWith('تأكيد')) return message;
  if (/network|fetch|failed to fetch/i.test(message)) {
    return 'تعذر الاتصال بالخادم. تحقق من الإنترنت ثم حاول مرة أخرى.';
  }

  return 'تعذر تفعيل الحساب. تحقق من البيانات وتواصل مع الإدارة.';
}

export default function ActivateAccount() {
  const [, setLocation] = useLocation();
  const { profile, refresh, status } = useWebAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const field = 'h-14 w-full rounded-xl border border-[#aebbc5] bg-white/95 pr-11 pl-3 text-base text-[#1c2934] shadow-sm placeholder:text-[#9ba8b1] focus:border-[#0060B8] focus:outline-none focus:ring-4 focus:ring-[#0060B8]/10 disabled:cursor-not-allowed disabled:opacity-70';

  useEffect(() => {
    if (status === 'authenticated' && profile?.role === 'admin') {
      setLocation('/', { replace: true });
    }
  }, [profile?.role, setLocation, status]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password || !confirmation) {
      toast.error('أكمل جميع الحقول لتفعيل الحساب.');
      return;
    }

    if (!hasValidEmail(normalizedEmail)) {
      toast.error('أدخل بريداً إلكترونياً صحيحاً.');
      return;
    }

    if (password.length < 12) {
      toast.error('يجب أن تتكون كلمة المرور من 12 حرفاً على الأقل.');
      return;
    }

    if (password !== confirmation) {
      toast.error('تأكيد كلمة المرور غير مطابق.');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await withAuthRequestTimeout(
        webSupabase.auth.activatePendingAccount({
          email: normalizedEmail,
          password,
          passwordConfirmation: confirmation,
        }),
        'انتهت مهلة تفعيل الحساب بعد 15 ثانية. حاول مرة أخرى.',
      );

      await withAuthRequestTimeout(
        webSupabase.auth.signInWithPassword(normalizedEmail, password),
        'انتهت مهلة تسجيل الدخول بعد 15 ثانية. حاول مرة أخرى.',
      );

      await refresh();
      toast.success('تم تفعيل الحساب وتسجيل الدخول بنجاح.');
      setLocation('/', { replace: true });
    } catch (error) {
      toast.error(activationErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="تفعيل حساب جديد" subtitle="أدخل البريد الإلكتروني وكلمة مرور لحسابك">
      <form onSubmit={submit} className="mt-7 space-y-4">
        <label className="block text-right text-xs font-bold text-[#475663]">
          البريد الإلكتروني
          <div className="relative mt-1.5">
            <Mail className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#60707d]" size={20} />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="example.com@"
              dir="ltr"
              autoComplete="email"
              disabled={isSubmitting}
              className={field}
            />
          </div>
        </label>

        <label className="block text-right text-xs font-bold text-[#475663]">
          كلمة المرور
          <div className="relative mt-1.5">
            <LockKeyhole className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#60707d]" size={20} />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={isSubmitting}
              className={field}
            />
          </div>
        </label>

        <label className="block text-right text-xs font-bold text-[#475663]">
          تأكيد كلمة المرور
          <div className="relative mt-1.5">
            <RotateCcw className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#60707d]" size={20} />
            <input
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={isSubmitting}
              className={field}
            />
          </div>
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#0068c6] text-lg font-bold text-white shadow-[0_8px_20px_rgba(0,96,184,0.25)] transition-all duration-150 hover:bg-[#005dab] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <CheckCircle2 size={22} />
          {isSubmitting ? 'جارٍ تفعيل الحساب...' : 'تفعيل الحساب'}
        </button>

        <button
          type="button"
          onClick={() => setLocation('/login')}
          disabled={isSubmitting}
          className="mx-auto block pt-3 text-sm font-bold text-[#0563b4] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          العودة إلى تسجيل الدخول
        </button>

        <p className="rounded-xl bg-white/60 p-2.5 text-center text-[10px] leading-4 text-[#697986]">
          لا يمكن تفعيل الحساب إلا بالبريد الإلكتروني المضاف مسبقاً.
        </p>
      </form>
    </AuthShell>
  );
}
