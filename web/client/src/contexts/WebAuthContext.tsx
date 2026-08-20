import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { webSupabase, type WebProfile } from '@/data/supabase/webSupabaseContract';
import { withAuthRequestTimeout } from '@/lib/authRequest';

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

const PROFILE_TIMEOUT_MESSAGE = 'انتهت مهلة التحقق من صلاحية الحساب بعد 15 ثانية. تحقق من الاتصال ثم حاول مرة أخرى.';
const SESSION_TIMEOUT_MESSAGE = 'انتهت مهلة التحقق من الجلسة بعد 15 ثانية. تحقق من الاتصال ثم حاول مرة أخرى.';

const initialState: WebAuthState = {
  status: 'initializing',
  session: null,
  profile: null,
  errorMessage: null,
};

const WebAuthContext = createContext<WebAuthContextValue | null>(null);

function profileErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return `تعذر التحقق من صلاحية الحساب: ${error.message}`;
  return 'تعذر التحقق من صلاحية الحساب. حاول مرة أخرى.';
}

function isTrustedProfileForSession(state: WebAuthState, session: Session): boolean {
  return state.status === 'authenticated' && state.profile?.id === session.user.id;
}

export function WebAuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<WebAuthState>(initialState);
  const stateRef = useRef<WebAuthState>(initialState);
  const requestVersion = useRef(0);
  const mounted = useRef(true);

  const applyState = useCallback((nextState: WebAuthState) => {
    stateRef.current = nextState;
    if (mounted.current) setState(nextState);
  }, []);

  const clearAuthState = useCallback(() => {
    ++requestVersion.current;
    applyState({ status: 'unauthenticated', session: null, profile: null, errorMessage: null });
  }, [applyState]);

  const loadProfile = useCallback(async (session: Session) => {
    const version = ++requestVersion.current;
    const currentState = stateRef.current;
    const hasTrustedProfile = isTrustedProfileForSession(currentState, session);

    // Only a first bootstrap or a real user change blocks the route. Refreshes preserve trusted UI.
    if (!hasTrustedProfile) {
      applyState({ status: 'initializing', session, profile: null, errorMessage: null });
    } else if (currentState.session?.access_token !== session.access_token) {
      applyState({ ...currentState, session });
    }

    try {
      const profile = await withAuthRequestTimeout(webSupabase.reads.myProfile(), PROFILE_TIMEOUT_MESSAGE);
      if (!mounted.current || version !== requestVersion.current) return;

      if (!profile.is_active) {
        applyState({
          status: 'profile-error',
          session,
          profile: null,
          errorMessage: 'هذا الحساب معطّل حالياً. تواصل مع الإدارة.',
        });
        return;
      }

      applyState({ status: 'authenticated', session, profile, errorMessage: null });
    } catch (error) {
      if (!mounted.current || version !== requestVersion.current) return;

      // A slow/failed background check must never blank a last verified profile.
      if (hasTrustedProfile) {
        console.error('Background profile refresh failed.', error);
        return;
      }

      applyState({
        status: 'profile-error',
        session,
        profile: null,
        errorMessage: profileErrorMessage(error),
      });
    }
  }, [applyState]);

  const refresh = useCallback(async () => {
    const currentState = stateRef.current;
    try {
      const session = await withAuthRequestTimeout(webSupabase.auth.getSession(), SESSION_TIMEOUT_MESSAGE);
      if (!session) {
        clearAuthState();
        return;
      }
      await loadProfile(session);
    } catch (error) {
      // Preserve a verified session if a manual/background refresh cannot reach Supabase.
      if (currentState.session && currentState.profile && currentState.status === 'authenticated') {
        console.error('Session refresh failed; preserving trusted profile.', error);
        return;
      }
      applyState({ status: 'profile-error', session: null, profile: null, errorMessage: profileErrorMessage(error) });
    }
  }, [applyState, clearAuthState, loadProfile]);

  const signOut = useCallback(async () => {
    try {
      await webSupabase.auth.signOut();
    } finally {
      if (mounted.current) clearAuthState();
    }
  }, [clearAuthState]);

  const handleAuthEvent = useCallback((event: AuthChangeEvent, session: Session | null) => {
    if (event === 'INITIAL_SESSION') return;

    if (event === 'SIGNED_OUT' || !session) {
      clearAuthState();
      return;
    }

    const currentState = stateRef.current;
    const sameUser = currentState.session?.user.id === session.user.id;

    if (event === 'TOKEN_REFRESHED' && sameUser) {
      // Refresh token updates the session only; the last verified profile remains authoritative in React state.
      applyState({ ...currentState, session });
      return;
    }

    if (event === 'USER_UPDATED' && sameUser && currentState.profile?.id === session.user.id) {
      void loadProfile(session);
      return;
    }

    if (event === 'SIGNED_IN' || !sameUser) {
      void loadProfile(session);
    }
  }, [applyState, clearAuthState, loadProfile]);

  useEffect(() => {
    mounted.current = true;

    // Bootstrap is intentionally sourced from getSession only. INITIAL_SESSION is ignored below.
    void refresh();
    const subscription = webSupabase.auth.onAuthStateChange(handleAuthEvent);

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, [handleAuthEvent, refresh]);

  const value = useMemo<WebAuthContextValue>(() => ({ ...state, refresh, signOut }), [refresh, signOut, state]);

  return <WebAuthContext.Provider value={value}>{children}</WebAuthContext.Provider>;
}

export function useWebAuth(): WebAuthContextValue {
  const context = useContext(WebAuthContext);
  if (!context) throw new Error('useWebAuth must be used within WebAuthProvider.');
  return context;
}
