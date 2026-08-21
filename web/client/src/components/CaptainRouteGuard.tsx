/** Design reminder — Captain routes remain role-isolated and reuse the quiet white-card status treatment. */
import { type PropsWithChildren, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useLocation } from 'wouter';

import { useWebAuth } from '@/contexts/WebAuthContext';

function StatusScreen({
  title,
  message,
  retry,
}: {
  title: string;
  message: string;
  retry?: () => void;
}) {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[#edf8fd] px-5" dir="rtl">
      <section className="w-full max-w-sm rounded-2xl border border-[#d9eaf4] bg-white p-6 text-center shadow-[0_8px_28px_rgba(0,72,141,0.1)]">
        <h1 className="text-lg font-bold text-[#174b70]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[#58616b]">{message}</p>
        {retry ? (
          <button
            type="button"
            onClick={retry}
            className="mx-auto mt-4 flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0060B8] px-4 text-xs font-bold text-white active:scale-[0.98]"
          >
            <RefreshCw size={15} />
            إعادة المحاولة
          </button>
        ) : null}
      </section>
    </main>
  );
}

export function CaptainRouteGuard({ children }: PropsWithChildren) {
  const [, setLocation] = useLocation();
  const { status, profile, session, errorMessage, retryProfile } = useWebAuth();
  const needsProfileRetry = status === 'profile-unavailable' || status === 'profile-missing';
  const isRejected = status === 'authenticated' && profile?.role !== 'captain';

  useEffect(() => {
    if (status === 'unauthenticated' || status === 'auth-invalid') {
      setLocation('/login', { replace: true });
    }
  }, [setLocation, status]);

  if (status === 'initializing') return <StatusScreen title="جارٍ التحقق من الجلسة" message="انتظر لحظة قبل فتح حساب الكابتن." />;
  if (status === 'unauthenticated' || status === 'auth-invalid') return <StatusScreen title="جارٍ تحويلك لتسجيل الدخول" message="يجب تسجيل الدخول للوصول إلى حساب الكابتن." />;
  if (status === 'account-disabled') return <StatusScreen title="الحساب معطّل" message={errorMessage ?? 'هذا الحساب معطّل حالياً. تواصل مع الإدارة.'} />;
  if (needsProfileRetry) return <StatusScreen title="تعذر التحقق من الحساب" message={errorMessage ?? 'لا يمكن فتح حساب الكابتن قبل التحقق من ملف الحساب.'} retry={() => void retryProfile()} />;
  if (isRejected || !session || !profile || profile.id !== session.user.id) return <StatusScreen title="لا تملك صلاحية حساب الكابتن" message={errorMessage ?? 'هذا الحساب لا يملك دور الكابتن في النظام.'} />;

  return <>{children}</>;
}
