import type { AuthChangeEvent, Session, SupabaseClient } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { type AuthIssue, classifyAuthError, withAuthTimeout } from "@/lib/auth/auth-errors";
import {
  type DeliveryProfile,
  getNativeSupabaseClient,
  type DeliveryRole,
} from "@/lib/supabase/native-supabase";

export type DeliveryAuthStatus =
  | "initializing"
  | "unauthenticated"
  | "authenticated"
  | "account-disabled"
  | "profile-unavailable"
  | "profile-missing"
  | "auth-invalid";

type AuthOperation = "idle" | "signing-in" | "activating" | "signing-out" | "retrying";

type DeliveryAuthState = {
  status: DeliveryAuthStatus;
  session: Session | null;
  profile: DeliveryProfile | null;
  issue: AuthIssue | null;
  operation: AuthOperation;
};

type DeliveryAuthContextValue = DeliveryAuthState & {
  isSigningIn: boolean;
  isActivating: boolean;
  refresh: () => Promise<void>;
  retryProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  activatePendingAccount: (email: string, password: string, passwordConfirmation: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetToLogin: () => Promise<void>;
  homePathForRole: (role: DeliveryRole) => "/(tabs)";
};

const initialState: DeliveryAuthState = {
  status: "initializing",
  session: null,
  profile: null,
  issue: null,
  operation: "idle",
};

const DeliveryAuthContext = createContext<DeliveryAuthContextValue | null>(null);

function isDeliveryRole(value: unknown): value is DeliveryRole {
  return value === "admin" || value === "supervisor" || value === "captain";
}

function profileIssue(code: "profile-missing" | "profile-mismatch"): AuthIssue {
  if (code === "profile-mismatch") {
    return {
      code,
      title: "عدم تطابق في الحساب",
      message: "ملف الحساب الذي تم تحميله لا يطابق جلسة الدخول. تم إيقاف الوصول كإجراء حماية؛ سجّل الدخول من جديد.",
      recoverable: true,
    };
  }

  return {
    code,
    title: "ملف الحساب غير موجود",
    message: "تم تسجيل الدخول، لكن لم يتم العثور على ملف الحساب أو صلاحياته. تواصل مع الإدارة ولا تنشئ حساباً جديداً من هنا.",
    recoverable: true,
  };
}

export function DeliveryAuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<DeliveryAuthState>(initialState);
  const stateRef = useRef(initialState);
  const mountedRef = useRef(true);
  const requestVersionRef = useRef(0);
  const loadingProfileForUserRef = useRef<string | null>(null);
  const preserveSignOutIssueRef = useRef(false);

  const applyState = useCallback((next: DeliveryAuthState) => {
    stateRef.current = next;
    if (mountedRef.current) setState(next);
  }, []);

  const getClient = useCallback(() => getNativeSupabaseClient(), []);
  const clearQueryCache = useCallback(() => queryClient.clear(), [queryClient]);

  const signOutLocallyWithIssue = useCallback(
    async (status: Extract<DeliveryAuthStatus, "account-disabled" | "auth-invalid">, issue: AuthIssue) => {
      const version = ++requestVersionRef.current;
      preserveSignOutIssueRef.current = true;
      clearQueryCache();

      try {
        await getClient().auth.signOut({ scope: "local" });
      } catch {
        // SecureStore cleanup is still attempted by Supabase. The explicit issue below remains actionable.
      } finally {
        preserveSignOutIssueRef.current = false;
        if (mountedRef.current && version === requestVersionRef.current) {
          applyState({ status, session: null, profile: null, issue, operation: "idle" });
        }
      }
    },
    [applyState, clearQueryCache, getClient],
  );

  const loadProfile = useCallback(
    async (session: Session) => {
      if (loadingProfileForUserRef.current === session.user.id) return;

      loadingProfileForUserRef.current = session.user.id;
      const version = ++requestVersionRef.current;
      const current = stateRef.current;
      if (current.session?.user.id && current.session.user.id !== session.user.id) clearQueryCache();
      applyState({
        status: "initializing",
        session,
        profile: current.profile?.id === session.user.id ? current.profile : null,
        issue: null,
        operation: current.operation,
      });

      try {
        const client = getClient();
        const { data, error } = await withAuthTimeout(
          Promise.resolve(
            client
              .from("profiles")
              .select("id, email, full_name, is_active, role, account_activated_at, created_at, updated_at")
              .eq("id", session.user.id)
              .maybeSingle(),
          ),
        );

        if (!mountedRef.current || version !== requestVersionRef.current) return;
        if (error) throw error;
        if (!data) {
          applyState({ status: "profile-missing", session, profile: null, issue: profileIssue("profile-missing"), operation: "idle" });
          return;
        }

        const profile = data as DeliveryProfile;
        if (profile.id !== session.user.id) {
          const issue = profileIssue("profile-mismatch");
          await signOutLocallyWithIssue("auth-invalid", issue);
          return;
        }

        if (!isDeliveryRole(profile.role)) {
          applyState({
            status: "profile-unavailable",
            session,
            profile: null,
            issue: {
              code: "unknown",
              title: "دور الحساب غير مدعوم",
              message: "تمت قراءة ملف الحساب، لكن دوره لا يطابق أدوار Delivery Tartous المعتمدة. لا يمكن فتح التطبيق قبل مراجعة الإدارة.",
              recoverable: false,
            },
            operation: "idle",
          });
          return;
        }

        if (!profile.is_active) {
          await signOutLocallyWithIssue("account-disabled", {
            code: "session-invalid",
            title: "الحساب معطّل",
            message: "هذا الحساب معطّل حالياً. تم تسجيل خروجه من الجهاز؛ تواصل مع الإدارة لتفعيله.",
            recoverable: false,
          });
          return;
        }

        applyState({ status: "authenticated", session, profile, issue: null, operation: "idle" });
      } catch (error) {
        if (!mountedRef.current || version !== requestVersionRef.current) return;
        const issue = classifyAuthError(error, "profile");
        if (issue.code === "session-invalid") {
          await signOutLocallyWithIssue("auth-invalid", issue);
          return;
        }
        applyState({ status: "profile-unavailable", session, profile: null, issue, operation: "idle" });
      } finally {
        if (loadingProfileForUserRef.current === session.user.id) loadingProfileForUserRef.current = null;
      }
    },
    [applyState, clearQueryCache, getClient, signOutLocallyWithIssue],
  );

  const refresh = useCallback(async () => {
    const current = stateRef.current;
    applyState({ ...current, status: "initializing", issue: null, operation: "retrying" });

    try {
      const client = getClient();
      const { data, error } = await withAuthTimeout(client.auth.getSession());
      if (error) throw error;
      if (!data.session) {
        clearQueryCache();
        applyState({ status: "unauthenticated", session: null, profile: null, issue: null, operation: "idle" });
        return;
      }
      await loadProfile(data.session);
    } catch (error) {
      const issue = classifyAuthError(error, "session");
      if (issue.code === "session-invalid") {
        await signOutLocallyWithIssue("auth-invalid", issue);
        return;
      }
      applyState({ status: "profile-unavailable", session: current.session, profile: null, issue, operation: "idle" });
    }
  }, [applyState, clearQueryCache, getClient, loadProfile, signOutLocallyWithIssue]);

  const retryProfile = useCallback(async () => {
    const session = stateRef.current.session;
    if (!session) {
      await refresh();
      return;
    }
    applyState({ ...stateRef.current, operation: "retrying", issue: null });
    await loadProfile(session);
  }, [applyState, loadProfile, refresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const normalizedEmail = email.trim().toLowerCase();
      applyState({ status: "unauthenticated", session: null, profile: null, issue: null, operation: "signing-in" });

      try {
        const client = getClient();
        const { data, error } = await withAuthTimeout(
          client.auth.signInWithPassword({ email: normalizedEmail, password }),
        );
        if (error) throw error;
        if (!data.session) {
          throw new Error("لم تُنشأ جلسة دخول بعد التحقق من بيانات الحساب.");
        }
        await loadProfile(data.session);
      } catch (error) {
        const issue = classifyAuthError(error, "sign-in");
        if (issue.code === "session-invalid") {
          await signOutLocallyWithIssue("auth-invalid", issue);
          return;
        }
        applyState({ status: "unauthenticated", session: null, profile: null, issue, operation: "idle" });
      }
    },
    [applyState, getClient, loadProfile, signOutLocallyWithIssue],
  );

  const activatePendingAccount = useCallback(
    async (email: string, password: string, passwordConfirmation: string) => {
      const normalizedEmail = email.trim().toLowerCase();
      applyState({ status: "unauthenticated", session: null, profile: null, issue: null, operation: "activating" });

      try {
        const client = getClient();
        const { error: activationError } = await withAuthTimeout(
          client.functions.invoke("activate-pending-account", {
            body: {
              email: normalizedEmail,
              password,
              passwordConfirmation,
            },
          }),
        );
        if (activationError) throw activationError;

        const { data, error: signInError } = await withAuthTimeout(
          client.auth.signInWithPassword({ email: normalizedEmail, password }),
        );
        if (signInError) throw signInError;
        if (!data.session) throw new Error("تم تفعيل الحساب، لكن تعذر إنشاء جلسة دخول.");
        await loadProfile(data.session);
      } catch (error) {
        const issue = classifyAuthError(error, "activation");
        applyState({ status: "unauthenticated", session: null, profile: null, issue, operation: "idle" });
      }
    },
    [applyState, getClient, loadProfile],
  );

  const signOut = useCallback(async () => {
    const current = stateRef.current;
    applyState({ ...current, operation: "signing-out" });
    clearQueryCache();
    try {
      await getClient().auth.signOut();
      applyState({ status: "unauthenticated", session: null, profile: null, issue: null, operation: "idle" });
    } catch {
      try {
        await getClient().auth.signOut({ scope: "local" });
      } finally {
        applyState({ status: "unauthenticated", session: null, profile: null, issue: null, operation: "idle" });
      }
    }
  }, [applyState, clearQueryCache, getClient]);

  const resetToLogin = useCallback(async () => {
    clearQueryCache();
    try {
      await getClient().auth.signOut({ scope: "local" });
    } catch {
      // The state reset below keeps the user out even if local cleanup reports an error.
    }
    applyState({ status: "unauthenticated", session: null, profile: null, issue: null, operation: "idle" });
  }, [applyState, clearQueryCache, getClient]);

  useEffect(() => {
    mountedRef.current = true;
    let client: SupabaseClient;
    try {
      client = getClient();
    } catch (error) {
      applyState({
        status: "profile-unavailable",
        session: null,
        profile: null,
        issue: classifyAuthError(error, "session"),
        operation: "idle",
      });
      return () => {
        mountedRef.current = false;
      };
    }

    const { data: listener } = client.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      queueMicrotask(() => {
        if (!mountedRef.current) return;
        if (event === "SIGNED_OUT" || !session) {
          const currentStatus = stateRef.current.status;
          const mustKeepIssue = currentStatus === "account-disabled" || currentStatus === "auth-invalid";
          if (!preserveSignOutIssueRef.current && !mustKeepIssue) {
            clearQueryCache();
            applyState({ status: "unauthenticated", session: null, profile: null, issue: null, operation: "idle" });
          }
          return;
        }

        if (event === "TOKEN_REFRESHED" && stateRef.current.profile?.id === session.user.id) {
          applyState({ ...stateRef.current, session, operation: "idle" });
          return;
        }

        if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "USER_UPDATED") {
          void loadProfile(session);
        }
      });
    });

    void refresh();

    return () => {
      mountedRef.current = false;
      listener.subscription.unsubscribe();
    };
  }, [applyState, clearQueryCache, getClient, loadProfile, refresh]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    let client: SupabaseClient;
    try {
      client = getClient();
    } catch {
      return;
    }
    const handleAppState = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        client.auth.startAutoRefresh();
      } else {
        client.auth.stopAutoRefresh();
      }
    };

    handleAppState(AppState.currentState);
    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
  }, [getClient]);

  const value = useMemo<DeliveryAuthContextValue>(
    () => ({
      ...state,
      isSigningIn: state.operation === "signing-in",
      isActivating: state.operation === "activating",
      refresh,
      retryProfile,
      signIn,
      activatePendingAccount,
      signOut,
      resetToLogin,
      homePathForRole: () => "/(tabs)",
    }),
    [activatePendingAccount, refresh, resetToLogin, retryProfile, signIn, signOut, state],
  );

  return <DeliveryAuthContext.Provider value={value}>{children}</DeliveryAuthContext.Provider>;
}

export function useDeliveryAuth(): DeliveryAuthContextValue {
  const context = useContext(DeliveryAuthContext);
  if (!context) throw new Error("useDeliveryAuth must be used within DeliveryAuthProvider.");
  return context;
}
