/** Design reminder — Captain routes remain role-isolated and reuse the quiet white-card status treatment. */
import { type PropsWithChildren, useEffect } from 'react';
import { useLocation } from 'wouter';

import { useWebAuth } from '@/contexts/WebAuthContext';

function StatusScreen({ title, message }: { title: string; message: string }) {
  return <main className="grid min-h-[100dvh] place-items-center bg-[#edf8fd] px-5" dir="rtl"><section className="w-full max-w-sm rounded-2xl border border-[#d9eaf4] bg-white p-6 text-center shadow-[0_8px_28px_rgba(0,72,141,0.1)]"><h1 className="text-lg font-bold text-[#174b70]">{title}</h1><p className="mt-2 text-sm leading-6 text-[#58616b]">{message}</p></section></main>;
}

export function CaptainRouteGuard({ children }: PropsWithChildren) {
  const [, setLocation] = useLocation();
  const { status, profile, session, errorMessage, signOut } = useWebAuth();
  const isRejected = status === 'profile-error' || (status === 'authenticated' && profile?.role !== 'captain');

  useEffect(() => {
    if (status === 'unauthenticated') {
      setLocation('/login', { replace: true });
      return;
    }
    if (isRejected && session) {
      void signOut().catch(() => undefined).finally(() => setLocation('/login', { replace: true }));
    }
  }, [isRejected, session, setLocation, signOut, status]);

  if (status === 'initializing') return <StatusScreen title="جارٍ التحقق من الجلسة" message="انتظر لحظة قبل فتح حساب الكابتن." />;
  if (status === 'unauthenticated') return <StatusScreen title="جارٍ تحويلك لتسجيل الدخول" message="يجب تسجيل الدخول للوصول إلى حساب الكابتن." />;
  if (isRejected) return <StatusScreen title="لا تملك صلاحية حساب الكابتن" message={errorMessage ?? 'هذا الحساب لا يملك دور الكابتن في النظام.'} />;
  return <>{children}</>;
}
