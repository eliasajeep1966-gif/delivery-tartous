import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { webSupabase, type WebProfile } from '@/data/supabase/webSupabaseContract';
import { withAuthRequestTimeout } from '@/lib/authRequest';

export type WebAuthStatus =
  | 'initializing'
  | 'unauthenticated'
  | 'authenticated'
  | 'account-disabled'
  | 'profile-unavailable'
  | 'profile-missing'
  | 'auth-invalid';

type WebAuthState = {
  status: WebAuthStatus;
  session: Session | null;
  profile: WebProfile | null;
  errorMessage: string | null;
};

type WebAuthContextValue = WebAuthState & {
  refresh: () => Promise<void>;
  retryProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const PROFILE_TIMEOUT_MESSAGE = 'انتهت مهلة التحقق من صلاحية الحساب بعد 15 ثانية. تحقق من الاتصال ثم حاول مرة أخرى.';
const SESSION_TIMEOUT_MESSAGE = 'انتهت مهلة التحقق من الجلسة بعد 15 ثانية. تحقق من الاتصال ثم حاول مرة أخرى.';
const PROFILE_MISSING_MESSAGE = 'تعذر العثور على ملف الحساب.';

const initialState: WebAuthState = {
  status: 'initializing',
  session: null,
  profile: null,
  errorMessage: null,
};

const WebAuthContext = createContext<WebAuthContextValue | null>(null);

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message.trim() : '';
}

function isNetworkOrTimeoutError(error: unknown): boolean {
  const message = errorMessage(error);
  return /15 ثانية|network|fetch|timeout|timed out|temporarily|offline/i.test(message);
}

function isAuthInvalidError(error: unknown): boolean {
  const message = errorMessage(error);
  return /invalid.*(token|session)|jwt|refresh token|not authenticated|session.*invalid/i.test(message);
}

function isTrustedProfileForSession(state: WebAuthState, session: Session): boolean {
  return state.profile?.id === session.user.id;
}

function profileErrorState(error: unknown): Pick<WebAuthState, 'status' | 'errorMessage'> {
  const message = errorMessage(error);
  if (message.includes(PROFILE_MISSING_MESSAGE)) {
    return {
      status: 'profile-missing',
      errorMessage: 'تم تسجيل الدخول، لكن ملف الحساب غير موجود. أعد المحاولة بعد التأكد من إنشاء الملف.',
    };
  }
  return {
    status: 'profile-unavailable',
    errorMessage: isNetworkOrTimeoutError(error)
      ? 'تعذر الوصول إلى ملف الحساب مؤقتاً. تحقق من الاتصال ثم أعد المحاولة.'
      : `تعذر التحقق من ملف الحساب${message ? `: ${message}` : ''}. أعد المحاولة دون تسجيل الخروج.`,
  };
}

export function WebAuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<WebAuthState>(initialState);
  const stateRef = useRef<WebAuthState>(initialState);
  const requestVersion = useRef(0);
  const mounted = useRef(true);
  const initialSessionReceived = useRef(false);
  const profileLoadStarted = useRef(false);
  const fallbackUsed = useRef(false);
  const authInvalidSignOutInFlight = useRef(false);
  const pendingProfileUserId = useRef<string | null>(null);

  const applyState = useCallback((nextState: WebAuthState) => {
    stateRef.current = nextState;
    if (mounted.current) setState(nextState);
  }, []);

  const clearAuthState = useCallback(() => {
    requestVersion.current += 1;
    applyState({ status: 'unauthenticated', session: null, profile: null, errorMessage: null });
  }, [applyState]);

  const markAuthInvalid = useCallback((session: Session | null, message = 'جلسة الدخول غير صالحة. سجّل الدخول مرة أخرى.') => {
    if (authInvalidSignOutInFlight.current) return;
    authInvalidSignOutInFlight.current = true;
    const version = ++requestVersion.current;
    applyState({ status: 'auth-invalid', session, profile: null, errorMessage: message });

    void webSupabase.auth.localSignOut()
      .catch((error) => {
        console.error('Local sign out for invalid auth failed.', error);
      })
      .finally(() => {
        authInvalidSignOutInFlight.current = false;
        if (mounted.current && version === requestVersion.current) clearAuthState();
      });
  }, [applyState, clearAuthState]);

  const handleDisabledAccount = useCallback((session: Session) => {
    const version = ++requestVersion.current;
    applyState({
      status: 'account-disabled',
      session,
      profile: null,
      errorMessage: 'هذا الحساب معطّل حالياً. تواصل مع الإدارة.',
    });

    void webSupabase.auth.localSignOut()
      .catch((error) => {
        console.error('Local sign out for disabled account failed.', error);
      })
      .finally(() => {
        if (mounted.current && version === requestVersion.current) clearAuthState();
      });
  }, [applyState, clearAuthState]);

  const loadProfile = useCallback(async (session: Session) => {
    profileLoadStarted.current = true;
    const version = ++requestVersion.current;
    const currentState = stateRef.current;

    // A user switch always clears the previous profile before the new profile is trusted.
    if (currentState.session?.user.id !== session.user.id || !isTrustedProfileForSession(currentState, session)) {
      applyState({ status: 'initializing', session, profile: null, errorMessage: null });
    } else if (currentState.session?.access_token !== session.access_token) {
      applyState({ ...currentState, session });
    }

    try {
      const profile = await withAuthRequestTimeout(
        webSupabase.reads.myProfile(session.user.id),
        PROFILE_TIMEOUT_MESSAGE,
      );
      if (!mounted.current || version !== requestVersion.current) return;

      if (profile.id !== session.user.id) {
        applyState({
          status: 'profile-missing',
          session,
          profile: null,
          errorMessage: 'ملف الحساب الذي تم تحميله لا يطابق جلسة الدخول.',
        });
        return;
      }

      if (!profile.is_active) {
        handleDisabledAccount(session);
        return;
      }

      applyState({ status: 'authenticated', session, profile, errorMessage: null });
    } catch (error) {
      if (!mounted.current || version !== requestVersion.current) return;
      if (isAuthInvalidError(error)) {
        markAuthInvalid(session);
        return;
      }

      const classified = profileErrorState(error);
      applyState({ status: classified.status, session, profile: null, errorMessage: classified.errorMessage });
    }
  }, [applyState, handleDisabledAccount, markAuthInvalid]);

  const refresh = useCallback(async () => {
    try {
      const session = await withAuthRequestTimeout(webSupabase.auth.getSession(), SESSION_TIMEOUT_MESSAGE);
      if (!session) {
        clearAuthState();
        return;
      }
      await loadProfile(session);
    } catch (error) {
      if (isAuthInvalidError(error)) {
        markAuthInvalid(stateRef.current.session);
        return;
      }
      applyState({
        status: 'profile-unavailable',
        session: stateRef.current.session,
        profile: null,
        errorMessage: isNetworkOrTimeoutError(error)
          ? 'تعذر الوصول إلى الجلسة أو ملف الحساب مؤقتاً. أعد المحاولة دون تسجيل الخروج.'
          : 'تعذر التحقق من الجلسة. أعد المحاولة.',
      });
    }
  }, [applyState, clearAuthState, loadProfile, markAuthInvalid]);

  const retryProfile = useCallback(async () => {
    const session = stateRef.current.session;
    if (!session) {
      await refresh();
      return;
    }
    await loadProfile(session);
  }, [loadProfile, refresh]);

  const signOut = useCallback(async () => {
    try {
      await webSupabase.auth.signOut();
    } finally {
      clearAuthState();
    }
  }, [clearAuthState]);

  const deferProfileLoad = useCallback((session: Session) => {
    // Mark before queueing so INITIAL_SESSION followed by SIGNED_IN cannot schedule two loads.
    if (pendingProfileUserId.current === session.user.id) return;
    profileLoadStarted.current = true;
    pendingProfileUserId.current = session.user.id;
    queueMicrotask(() => {
      if (!mounted.current || pendingProfileUserId.current !== session.user.id) return;
      pendingProfileUserId.current = null;
      void loadProfile(session);
    });
  }, [loadProfile]);

  const handleAuthEvent = useCallback((event: AuthChangeEvent, session: Session | null) => {
    if (event === 'INITIAL_SESSION') {
      initialSessionReceived.current = true;
      if (!session) {
        clearAuthState();
        return;
      }

      const currentState = stateRef.current;
      if (profileLoadStarted.current && currentState.session?.user.id === session.user.id) return;
      deferProfileLoad(session);
      return;
    }

    if (event === 'SIGNED_OUT' || !session) {
      clearAuthState();
      return;
    }

    const currentState = stateRef.current;
    const sameUser = currentState.session?.user.id === session.user.id;

    if (event === 'TOKEN_REFRESHED' && sameUser) {
      // Token refresh updates the session only. It never reloads Profile or shows Loading.
      applyState({ ...currentState, session });
      return;
    }

    if (event === 'USER_UPDATED' && sameUser) {
      deferProfileLoad(session);
      return;
    }

    if (event === 'SIGNED_IN' || !sameUser) {
      if (pendingProfileUserId.current === session.user.id) return;
      deferProfileLoad(session);
    }
  }, [applyState, clearAuthState, deferProfileLoad]);

  useEffect(() => {
    mounted.current = true;
    const subscription = webSupabase.auth.onAuthStateChange(handleAuthEvent);
    const fallbackId = window.setTimeout(() => {
      if (!initialSessionReceived.current && !profileLoadStarted.current && !fallbackUsed.current) {
        fallbackUsed.current = true;
        void refresh();
      }
    }, 2500);

    return () => {
      mounted.current = false;
      window.clearTimeout(fallbackId);
      subscription.unsubscribe();
    };
  }, [handleAuthEvent, refresh]);

  const value = useMemo<WebAuthContextValue>(
    () => ({ ...state, refresh, retryProfile, signOut }),
    [refresh, retryProfile, signOut, state],
  );

  return <WebAuthContext.Provider value={value}>{children}</WebAuthContext.Provider>;
}

export function useWebAuth(): WebAuthContextValue {
  const context = useContext(WebAuthContext);
  if (!context) throw new Error('useWebAuth must be used within WebAuthProvider.');
  return context;
}
