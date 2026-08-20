import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import type { Database, Json, Tables } from '@delivery-contract/database.types';

import { getWebSupabaseClient } from './webSupabaseClient';

export type WebAppRole = Database['public']['Enums']['app_role'];
export type WebProfile = Tables<'profiles'>;
export type WebCaptainStatus = Tables<'captain_status'>;
export type WebPendingAccount = Tables<'pending_account_activations'>;
export type WebPermission = Tables<'permissions'>;
export type WebUserPermissionOverride = Tables<'user_permission_overrides'>;
export type WebOrder = Tables<'orders'>;
export type WebOrderStop = Tables<'order_stops'>;
export type WebOrderStatusHistory = Tables<'order_status_history'>;
export type WebOrderStatus = Database['public']['Enums']['order_status'];
export type WebOrderStopType = Database['public']['Enums']['order_stop_type'];

export type WebOrderStopInput = {
  stopType: WebOrderStopType;
  sequence: number;
  contactName: string;
  contactPhone: string;
  address: string;
  note?: string | null;
};

export type CreateOrderWithStopsInput = {
  stops: WebOrderStopInput[];
  fee: number;
};

export type ActivatePendingAccountInput = {
  email: string;
  password: string;
  passwordConfirmation: string;
};

export type ActivatePendingAccountResult = {
  message: string;
  profile: Pick<WebProfile, 'id' | 'role'>;
};

export type CreatePendingAccountInput = {
  email: string;
  fullName: string;
  role: WebAppRole;
  custodyItemsText?: string;
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

function validatePendingAccountInput(input: CreatePendingAccountInput): CreatePendingAccountInput {
  const email = normalizeEmail(input.email);
  const fullName = input.fullName.trim();

  validateEmail(email);

  if (!fullName) {
    throw new Error('أدخل الاسم الكامل للحساب.');
  }

  if (!['admin', 'supervisor', 'captain'].includes(input.role)) {
    throw new Error('اختر دوراً صحيحاً للحساب.');
  }

  return {
    email,
    fullName,
    role: input.role,
    custodyItemsText: input.role === 'captain' ? input.custodyItemsText?.trim() || undefined : undefined,
  };
}

/**
 * The only permitted Supabase interface for React Web pages and hooks.
 * Data mutations are RPC calls; no page may write directly to protected tables.
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

    async profiles(): Promise<WebProfile[]> {
      const { data, error } = await getWebSupabaseClient()
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      return unwrap(data, error, 'تعذر تحميل الحسابات المفعّلة.');
    },

    async captainStatuses(): Promise<WebCaptainStatus[]> {
      const { data, error } = await getWebSupabaseClient()
        .from('captain_status')
        .select('*')
        .order('updated_at', { ascending: false });
      return unwrap(data, error, 'تعذر تحميل حالات الكباتن.');
    },

    async orders(): Promise<WebOrder[]> {
      const { data, error } = await getWebSupabaseClient()
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      return unwrap(data, error, 'تعذر تحميل الطلبات.');
    },

    async orderStops(orderId: string): Promise<WebOrderStop[]> {
      const { data, error } = await getWebSupabaseClient()
        .from('order_stops')
        .select('*')
        .eq('order_id', orderId)
        .order('stop_type', { ascending: true })
        .order('sequence', { ascending: true });
      return unwrap(data, error, 'تعذر تحميل نقاط الطلب.');
    },

    async orderStatusHistory(orderId: string): Promise<WebOrderStatusHistory[]> {
      const { data, error } = await getWebSupabaseClient()
        .from('order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .order('changed_at', { ascending: true });
      return unwrap(data, error, 'تعذر تحميل تسلسل حالات الطلب.');
    },

    async pendingAccounts(): Promise<WebPendingAccount[]> {
      const { data, error } = await getWebSupabaseClient().rpc('list_pending_accounts');
      return unwrap(data, error, 'تعذر تحميل الحسابات المعلّقة.');
    },

    async permissions(): Promise<WebPermission[]> {
      const { data, error } = await getWebSupabaseClient()
        .from('permissions')
        .select('*')
        .order('code', { ascending: true });
      return unwrap(data, error, 'تعذر تحميل الصلاحيات.');
    },

    async userPermissionOverrides(userId: string): Promise<WebUserPermissionOverride[]> {
      const { data, error } = await getWebSupabaseClient()
        .from('user_permission_overrides')
        .select('*')
        .eq('user_id', userId)
        .order('permission_code', { ascending: true });
      return unwrap(data, error, 'تعذر تحميل التخصيصات الحالية للصلاحيات.');
    },
  },

  actions: {
    async createOrderWithStops(input: CreateOrderWithStopsInput): Promise<WebOrder> {
      const stops: Json = input.stops.map((stop) => ({
        stop_type: stop.stopType,
        sequence: stop.sequence,
        contact_name: stop.contactName,
        contact_phone: stop.contactPhone,
        address: stop.address,
        note: stop.note ?? null,
      }));
      const { data, error } = await getWebSupabaseClient().rpc('create_order_with_stops', {
        p_stops: stops,
        p_fee: input.fee,
      });
      return unwrap(data, error, 'تعذر إنشاء الطلب متعدد النقاط.');
    },

    async assignOrderCaptain(orderId: string, captainId: string): Promise<WebOrder> {
      const { data, error } = await getWebSupabaseClient().rpc('assign_order_captain', {
        p_order_id: orderId,
        p_captain_id: captainId,
      });
      return unwrap(data, error, 'تعذر تعيين الكابتن للطلب.');
    },

    async cancelOrder(orderId: string, reason: string): Promise<WebOrder> {
      const normalizedReason = reason.trim();
      if (!normalizedReason) {
        throw new Error('أدخل سبب إلغاء الطلب.');
      }

      const { data, error } = await getWebSupabaseClient().rpc('cancel_order', {
        p_order_id: orderId,
        p_cancellation_reason: normalizedReason,
      });
      return unwrap(data, error, 'تعذر إلغاء الطلب.');
    },

    async createPendingAccount(input: CreatePendingAccountInput): Promise<WebPendingAccount> {
      const normalizedInput = validatePendingAccountInput(input);
      const { data, error } = await getWebSupabaseClient().rpc('create_pending_account', {
        p_email: normalizedInput.email,
        p_full_name: normalizedInput.fullName,
        p_role: normalizedInput.role,
        p_custody_items_text: normalizedInput.custodyItemsText,
      });
      return unwrap(data, error, 'تعذر إنشاء الحساب المعلّق.');
    },

    async cancelPendingAccount(pendingId: string): Promise<WebPendingAccount> {
      const { data, error } = await getWebSupabaseClient().rpc('cancel_pending_account', {
        p_pending_id: pendingId,
      });
      return unwrap(data, error, 'تعذر إلغاء الحساب المعلّق.');
    },

    async setUserRole(userId: string, role: WebAppRole): Promise<WebProfile> {
      const { data, error } = await getWebSupabaseClient().rpc('set_user_role', {
        p_user_id: userId,
        p_role: role,
      });
      return unwrap(data, error, 'تعذر تغيير دور المستخدم.');
    },

    async setCaptainActive(captainId: string, isActive: boolean): Promise<WebProfile> {
      const { data, error } = await getWebSupabaseClient().rpc('set_captain_active', {
        p_captain_id: captainId,
        p_is_active: isActive,
      });
      return unwrap(data, error, 'تعذر تحديث حالة الكابتن.');
    },

    async setUserPermissionOverride(
      userId: string,
      permissionCode: string,
      isAllowed: boolean,
    ): Promise<WebUserPermissionOverride> {
      const { data, error } = await getWebSupabaseClient().rpc('set_user_permission_override', {
        p_user_id: userId,
        p_permission_code: permissionCode,
        p_is_allowed: isAllowed,
      });
      return unwrap(data, error, 'تعذر حفظ تخصيص الصلاحية.');
    },
  },
} as const;
