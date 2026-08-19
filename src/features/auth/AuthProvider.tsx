import { useState, useEffect, useCallback } from 'react';
import { type Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/data/supabase/supabaseClient';
import { deliverySupabase } from '@/data/supabase/supabaseContract';
import { AuthContext, type AuthContextValue, type Profile } from './useAuth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsActivation, setNeedsActivation] = useState(false);

  const clearSession = useCallback(() => {
    setSession(null);
    setProfile(null);
    setNeedsActivation(false);
  }, []);

  const bootstrap = useCallback(async () => {
    setIsBootstrapping(true);
    setError(null);
    try {
      const currentSession = await deliverySupabase.auth.getSession();
      setSession(currentSession);

      if (currentSession) {
        const profileData = await deliverySupabase.reads.myProfile();
        setProfile(profileData);

        const isInactive = profileData.is_active !== true;
        const notActivated = (profileData as Profile & { account_activated_at: string | null }).account_activated_at === null;

        if (isInactive || notActivated) {
          await deliverySupabase.auth.signOut();
          clearSession();
          setNeedsActivation(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
      clearSession();
    } finally {
      setIsBootstrapping(false);
    }
  }, [clearSession]);

  useEffect(() => {
    bootstrap();

    const client = getSupabaseClient();
    const { data: subscription } = client.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        if (newSession) {
          try {
            const profileData = await deliverySupabase.reads.myProfile();
            setProfile(profileData);

            const isInactive = profileData.is_active !== true;
            const notActivated = (profileData as Profile & { account_activated_at: string | null }).account_activated_at === null;

            if (isInactive || notActivated) {
              await deliverySupabase.auth.signOut();
              clearSession();
              setNeedsActivation(true);
              return;
            }
            setNeedsActivation(false);
          } catch {
            clearSession();
            setNeedsActivation(true);
          }
        } else {
          setProfile(null);
          setNeedsActivation(false);
        }
      }
    );

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [bootstrap, clearSession]);

  const signOut = useCallback(async () => {
    try {
      await deliverySupabase.auth.signOut();
    } catch {
      // ignore sign out errors
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value: AuthContextValue = {
    isBootstrapping,
    session,
    profile,
    role: profile?.role ?? null,
    error,
    needsActivation,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
