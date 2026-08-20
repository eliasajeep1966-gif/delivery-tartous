import { type FormEvent, useEffect, useState } from 'react';
import { Eye, EyeOff, LogIn, LockKeyhole, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation } from 'wouter';

import { AuthShell } from '@/components/AuthShell';
import { useWebAuth } from '@/contexts/WebAuthContext';
import { webSupabase } from '@/data/supabase/webSupabaseContract';
import { withAuthRequestTimeout } from '@/lib/authRequest';

function hasValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function loginErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';

  if (message.includes('15 ثانية')) return message;
  if (message.startsWith('أدخل')) return message;
  if (/network|fetch|failed to fetch/i.test(message)) {
    return 'تعذر الاتصال بالخادم. تحقق من الإنترنت ثم حاول مرة أخرى.';
  }

  return 'تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.';
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { profile, refresh, status } = useWebAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && profile?.role === 'admin') {
      setLocation('/', { replace: true });
    }
  }, [profile?.role, setLocation, status]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      toast.error('أدخل البريد الإلكتروني وكلمة المرور.');
      return;
    }

    if (!hasValidEmail(normalizedEmail)) {
      toast.error('أدخل بريداً إلكترونياً صحيحاً.');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await withAuthRequestTimeout(
        webSupabase.auth.signInWithPassword(normalizedEmail, password),
        'انتهت مهلة تسجيل الدخول بعد 15 ثانية. حاول مرة أخرى.',
      );

      const currentProfile = await withAuthRequestTimeout(
        webSupabase.reads.myProfile(),
        'انتهت مهلة التحقق من صلاحية الحساب بعد 15 ثانية. حاول مرة أخرى.',
      );

      if (!currentProfile.is_active) {
        await webSupabase.auth.signOut().catch(() => undefined);
        toast.error('هذا الحساب معطّل حالياً. تواصل مع الإدارة.');
        return;
      }

      if (currentProfile.role !== 'admin') {
        await webSupabase.auth.signOut().catch(() => undefined);
        toast.error('هذا الحساب لا يملك صلاحية الدخول إلى لوحة الأدمن.');
        return;
      }

      await refresh();
      setLocation('/', { replace: true });
    } catch (error) {
      toast.error(loginErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="مرحباً بعودتك" subtitle="سجّل الدخول للوصول إلى حسابك">
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
              className="h-14 w-full rounded-xl border border-[#aebbc5] bg-white/95 pr-3 pl-11 text-right text-base text-[#1c2934] shadow-sm placeholder:text-[#9ba8b1] focus:border-[#0060B8] focus:outline-none focus:ring-4 focus:ring-[#0060B8]/10 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>
        </label>

        <label className="block text-right text-xs font-bold text-[#475663]">
          كلمة المرور
          <div className="relative mt-1.5">
            <LockKeyhole className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#60707d]" size={20} />
            <input
              type={visible ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isSubmitting}
              className="h-14 w-full rounded-xl border border-[#aebbc5] bg-white/95 pr-11 pl-11 text-base text-[#1c2934] shadow-sm placeholder:text-[#9ba8b1] focus:border-[#0060B8] focus:outline-none focus:ring-4 focus:ring-[#0060B8]/10 disabled:cursor-not-allowed disabled:opacity-70"
            />
            <button
              type="button"
              onClick={() => setVisible((current) => !current)}
              disabled={isSubmitting}
              aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-[#60707d] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {visible ? <EyeOff size={21} /> : <Eye size={21} />}
            </button>
          </div>
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#0068c6] text-lg font-bold text-white shadow-[0_8px_20px_rgba(0,96,184,0.25)] transition-all duration-150 hover:bg-[#005dab] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <LogIn size={22} />
          {isSubmitting ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}
        </button>

        <button
          type="button"
          onClick={() => setLocation('/activate-account')}
          disabled={isSubmitting}
          className="mx-auto block pt-3 text-sm font-bold text-[#0563b4] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
        >
          تفعيل حساب جديد
        </button>
      </form>
    </AuthShell>
  );
}
