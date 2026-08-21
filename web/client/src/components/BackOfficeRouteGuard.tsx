import { useEffect, type PropsWithChildren } from 'react';
import { useLocation } from 'wouter';

import { useWebAuth } from '@/contexts/WebAuthContext';

function StatusScreen({ title, message }: { title: string; message: string }) {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[#eaf5ff] px-5" dir="rtl">
      <section className="w-full max-w-sm rounded-2xl border border-[#d3e3f0] bg-white p-6 text-center shadow-[0_8px_28px_rgba(0,72,141,0.1)]">
        <h1 className="text-lg font-bold text-[#14213D]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[#58616b]">{message}</p>
      </section>
    </main>
  );
}

export function BackOfficeRouteGuard({ children }: PropsWithChildren) {
  const [, setLocation] = useLocation();
  const { status, profile, session, errorMessage, signOut } = useWebAuth();
  const isBackOfficeRole = profile?.role === 'admin' || profile?.role === 'supervisor';
  const isRejected = status === 'profile-error' || (status === 'authenticated' && !isBackOfficeRole);

  useEffect(() => {
    if (status === 'unauthenticated') {
      setLocation('/login', { replace: true });
      return;
    }

    if (isRejected && session) {
      void signOut()
        .catch(() => undefined)
        .finally(() => setLocation('/login', { replace: true }));
    }
  }, [isRejected, session, setLocation, signOut, status]);

  if (status === 'initializing') {
    return <StatusScreen title="جارٍ التحقق من الجلسة" message="انتظر لحظة قبل فتح لوحة العمل." />;
  }

  if (status === 'unauthenticated') {
    return <StatusScreen title="جارٍ تحويلك لتسجيل الدخول" message="يجب تسجيل الدخول للوصول إلى لوحة العمل." />;
  }

  if (isRejected) {
    return (
      <StatusScreen
        title="لا تملك صلاحية لوحة العمل"
        message={errorMessage ?? 'هذا الحساب لا يملك صلاحية الوصول إلى لوحة العمل.'}
      />
    );
  }

  return <>{children}</>;
}
