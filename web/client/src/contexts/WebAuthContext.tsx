import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { webSupabase, type WebProfile } from '@/data/supabase/webSupabaseContract';

export type WebAuthStatus = 'initializing' | 'unauthenticated' | 'authenticated' | 'profile-error';

type WebAuthState = {
  status: WebAuthStatus;
  session: Session | null;
  profile: WebProfile | null;
  errorMessage: string | null;
};

type WebAuthContextValue = WebAuthState & {
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const initialState: WebAuthState = {
  status: 'initializing',
  session: null,
  profile: null,
  errorMessage: null,
};

const WebAuthContext = createContext<WebAuthContextValue | null>(null);

function profileErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return `تعذر التحقق من صلاحية الحساب: ${error.message}`;
  }

  return 'تعذر التحقق من صلاحية الحساب. حاول مرة أخرى.';
}

export function WebAuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<WebAuthState>(initialState);
  const requestVersion = useRef(0);
  const mounted = useRef(true);

  const syncSession = useCallback(async (session: Session | null) => {
    const version = ++requestVersion.current;

    if (!session) {
      if (mounted.current && version === requestVersion.current) {
        setState({
          status: 'unauthenticated',
          session: null,
          profile: null,
          errorMessage: null,
        });
      }
      return;
    }

    if (mounted.current && version === requestVersion.current) {
      setState({
        status: 'initializing',
        session,
        profile: null,
        errorMessage: null,
      });
    }

    try {
      const profile = await webSupabase.reads.myProfile();
      if (!mounted.current || version !== requestVersion.current) return;

      if (!profile.is_active) {
        setState({
          status: 'profile-error',
          session,
          profile: null,
          errorMessage: 'هذا الحساب معطّل حالياً. تواصل مع الإدارة.',
        });
        return;
      }

      setState({
        status: 'authenticated',
        session,
        profile,
        errorMessage: null,
      });
    } catch (error) {
      if (!mounted.current || version !== requestVersion.current) return;

      setState({
        status: 'profile-error',
        session,
        profile: null,
        errorMessage: profileErrorMessage(error),
      });
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const session = await webSupabase.auth.getSession();
      await syncSession(session);
    } catch (error) {
      if (!mounted.current) return;
      setState({
        status: 'profile-error',
        session: null,
        profile: null,
        errorMessage: profileErrorMessage(error),
      });
    }
  }, [syncSession]);

  const signOut = useCallback(async () => {
    await webSupabase.auth.signOut();
    if (!mounted.current) return;

    ++requestVersion.current;
    setState({
      status: 'unauthenticated',
      session: null,
      profile: null,
      errorMessage: null,
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();

    const subscription = webSupabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session);
    });

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, [refresh, syncSession]);

  const value = useMemo<WebAuthContextValue>(
    () => ({ ...state, refresh, signOut }),
    [refresh, signOut, state],
  );

  return <WebAuthContext.Provider value={value}>{children}</WebAuthContext.Provider>;
}

export function useWebAuth(): WebAuthContextValue {
  const context = useContext(WebAuthContext);
  if (!context) {
    throw new Error('useWebAuth must be used within WebAuthProvider.');
  }

  return context;
}
