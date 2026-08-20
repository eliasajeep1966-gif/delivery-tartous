import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import type { Database, Tables } from '@delivery-contract/database.types';

import { getWebSupabaseClient } from './webSupabaseClient';

export type WebAppRole = Database['public']['Enums']['app_role'];
export type WebProfile = Tables<'profiles'>;

export type ActivatePendingAccountInput = {
  email: string;
  password: string;
  passwordConfirmation: string;
};

export type ActivatePendingAccountResult = {
  message: string;
  profile: Pick<WebProfile, 'id' | 'role'>;
};

type HasMessage = { message: string } | null;

function unwrap<T>(data: T | null, error: HasMessage, fallbackMessage: string): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error(fallbackMessage);
  return data;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validateEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('أدخل بريداً إلكترونياً صحيحاً.');
  }
}

function validatePendingActivation(input: ActivatePendingAccountInput): string {
  const email = normalizeEmail(input.email);
  validateEmail(email);

  if (input.password.length < 12) {
    throw new Error('يجب أن تتكون كلمة المرور من 12 حرفاً على الأقل.');
  }

  if (input.password !== input.passwordConfirmation) {
    throw new Error('تأكيد كلمة المرور غير مطابق.');
  }

  return email;
}

/**
 * The only permitted Supabase interface for web pages and hooks in this task.
 * It intentionally exposes Auth plus the caller's own profile only.
 */
export const webSupabase = {
  auth: {
    async getSession(): Promise<Session | null> {
      const { data, error } = await getWebSupabaseClient().auth.getSession();
      if (error) throw new Error(error.message);
      return data.session;
    },

    async signInWithPassword(email: string, password: string): Promise<Session> {
      const normalizedEmail = normalizeEmail(email);
      validateEmail(normalizedEmail);

      if (!password) {
        throw new Error('أدخل كلمة المرور.');
      }

      const { data, error } = await getWebSupabaseClient().auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      return unwrap(data.session, error, 'لم تنشأ جلسة دخول صالحة.');
    },

    async signOut(): Promise<void> {
      const { error } = await getWebSupabaseClient().auth.signOut();
      if (error) throw new Error(error.message);
    },

    async activatePendingAccount(input: ActivatePendingAccountInput): Promise<ActivatePendingAccountResult> {
      const email = validatePendingActivation(input);
      const { data, error } = await getWebSupabaseClient().functions.invoke<ActivatePendingAccountResult>(
        'activate-pending-account',
        {
          body: {
            email,
            password: input.password,
            passwordConfirmation: input.passwordConfirmation,
          },
        },
      );

      return unwrap(data, error, 'تعذر تفعيل الحساب. تحقق من البيانات وتواصل مع الإدارة.');
    },

    onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
      return getWebSupabaseClient().auth.onAuthStateChange(callback).data.subscription;
    },
  },

  reads: {
    async myProfile(): Promise<WebProfile> {
      const { data, error } = await getWebSupabaseClient().from('profiles').select('*').single();
      return unwrap(data, error, 'تعذر العثور على ملف الحساب.');
    },
  },
} as const;
