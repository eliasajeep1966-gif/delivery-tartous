import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import type { Database, Json, Tables } from '@delivery-contract/database.types';

import { getWebSupabaseClient } from './webSupabaseClient';

export type WebAppRole = Database['public']['Enums']['app_role'];
export type WebProfile = Tables<'profiles'>;
export type WebCaptainStatus = Tables<'captain_status'>;
export type WebCaptainCustody = Tables<'captain_custody'>;
export type WebCaptainAvailability = Database['public']['Enums']['captain_availability'];
export type WebPendingAccount = Tables<'pending_account_activations'>;
export type WebPermission = Tables<'permissions'>;
export type WebUserPermissionOverride = Tables<'user_permission_overrides'>;
export type WebOrder = Tables<'orders'>;
export type WebOrderStop = Tables<'order_stops'>;
export type WebOrderStatusHistory = Tables<'order_status_history'>;
export type WebAuditLog = Tables<'audit_logs'>;
export type WebOrderStatus = Database['public']['Enums']['order_status'];
export type WebOrderStopType = Database['public']['Enums']['order_stop_type'];

type WebRpcName = keyof Database['public']['Functions'];
type WebRpcReturn<Name extends WebRpcName> = Database['public']['Functions'][Name]['Returns'];
type WebRpcRow<Name extends WebRpcName> = WebRpcReturn<Name> extends Array<infer Row> ? Row : never;

export type WebWageTotals = WebRpcRow<'get_wage_totals'>;
export type WebCaptainWageSummary = WebRpcRow<'get_captain_wage_summary'>;
export type WebCaptainWageDetailV2 = WebRpcRow<'get_captain_wage_details_v2'>;
export type WebCaptainWagePeriodSummaryRow = WebRpcRow<'get_captain_wage_period_summary'>;
export type CaptainWagePeriod = 'daily' | 'weekly' | 'monthly';
export type CaptainWagePeriodSummaryInput = Database['public']['Functions']['get_captain_wage_period_summary']['Args'];
export type WebBackofficeHomeSummary = WebRpcRow<'get_backoffice_home_summary'>;
export type WebCaptainHomeMetrics = WebRpcRow<'get_captain_home_metrics'>;
export type WebCompanyProfitHistoryRow = WebRpcRow<'get_company_profit_history'>;
export type WebCompanyProfitPeriodHistoryRow = WebRpcRow<'get_company_profit_period_history'>;
export type CompanyProfitPeriod = 'daily' | 'weekly' | 'monthly';
export type WebCompanyProfitDayDetailRow = WebRpcRow<'get_company_profit_day_details'>;
export type WebCaptainPayout = WebRpcReturn<'create_captain_partial_payout'>;

export type CompanyProfitHistoryInput = Database['public']['Functions']['get_company_profit_history']['Args'];
export type CompanyProfitDayDetailsInput = Database['public']['Functions']['get_company_profit_day_details']['Args'];
export type CompanyProfitPeriodHistoryInput = Database['public']['Functions']['get_company_profit_period_history']['Args'];

export type CreateCaptainPartialPayoutInput = {
  captainId: string;
  amount: number;
  notes?: string;
};

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
  idempotencyKey?: string;
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

export const WEB_LIST_PAGE_SIZE = 25;

export type WebKeysetCursor = {
  createdAt: string;
  id: string;
};

export type WebListPage<Row> = {
  items: Row[];
  nextCursor: WebKeysetCursor | null;
};

export type WebListPageInput = {
  cursor?: WebKeysetCursor | null;
  limit?: number;
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

function normalizePageLimit(limit?: number): number {
  if (limit === undefined) return WEB_LIST_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > WEB_LIST_PAGE_SIZE) {
    throw new Error(`يجب أن يكون حجم الصفحة بين 1 و${WEB_LIST_PAGE_SIZE}.`);
  }
  return limit;
}

function keysetFilter(cursor?: WebKeysetCursor | null): string | null {
  if (!cursor) return null;
  if (!cursor.createdAt || !cursor.id) throw new Error('مؤشر الصفحة غير صالح. أعد تحميل القائمة.');
  return `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`;
}

function asPage<Row extends { created_at: string; id: string }>(rows: Row[], limit: number): WebListPage<Row> {
  const hasNext = rows.length > limit;
  const items = hasNext ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return { items, nextCursor: hasNext && last ? { createdAt: last.created_at, id: last.id } : null };
}

function validatePartialPayout(input: CreateCaptainPartialPayoutInput): CreateCaptainPartialPayoutInput {
  const captainId = input.captainId.trim();
  const amount = input.amount;

  if (!captainId) throw new Error('تعذر تحديد الكابتن للدفعة.');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('أدخل مبلغ دفعة موجباً وصحيحاً.');
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
    throw new Error('يمكن تسجيل مبلغ الدفعة بمنزلتين عشريتين كحد أقصى.');
  }

  return { captainId, amount: Number(amount.toFixed(2)), notes: input.notes?.trim() || undefined };
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

    async localSignOut(): Promise<void> {
      const { error } = await getWebSupabaseClient().auth.signOut({ scope: 'local' });
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
    async myProfile(userId: string): Promise<WebProfile> {
      const normalizedUserId = userId.trim();
      if (!normalizedUserId) throw new Error('تعذر تحديد هوية الحساب.');

      const { data, error } = await getWebSupabaseClient()
        .from('profiles')
        .select('*')
        .eq('id', normalizedUserId)
        .maybeSingle();

      return unwrap(data, error, 'تعذر العثور على ملف الحساب.');
    },

    async profiles(): Promise<WebProfile[]> {
      const { data, error } = await getWebSupabaseClient().rpc('list_visible_profiles', {
        p_limit: 100,
        p_before_created_at: null,
        p_before_id: null,
      });
      return unwrap(data, error, 'تعذر تحميل الحسابات المفعّلة.');
    },

    async profilesPage(input: WebListPageInput = {}): Promise<WebListPage<WebProfile>> {
      const limit = normalizePageLimit(input.limit);
      const { data, error } = await getWebSupabaseClient().rpc('list_visible_profiles', {
        p_limit: limit + 1,
        p_before_created_at: input.cursor?.createdAt ?? null,
        p_before_id: input.cursor?.id ?? null,
      });
      return asPage(unwrap(data, error, 'تعذر تحميل الحسابات المفعّلة.'), limit);
    },

    async profilesByIds(profileIds: readonly string[]): Promise<WebProfile[]> {
      const ids = Array.from(new Set(profileIds.map((id) => id.trim()).filter(Boolean)));
      if (ids.length === 0) return [];
      const { data, error } = await getWebSupabaseClient().from('profiles').select('*').in('id', ids);
      return unwrap(data, error, 'تعذر تحميل أسماء الكباتن المرتبطين بالطلبات.');
    },

    async availableCaptainProfiles(): Promise<WebProfile[]> {
      const { data, error } = await getWebSupabaseClient()
        .from('profiles')
        .select('*')
        .eq('role', 'captain')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
      return unwrap(data, error, 'تعذر تحميل الكباتن المفعّلين.');
    },

    async captainStatuses(): Promise<WebCaptainStatus[]> {
      const { data, error } = await getWebSupabaseClient()
        .from('captain_status')
        .select('*')
        .order('updated_at', { ascending: false })
        .order('captain_id', { ascending: false });
      return unwrap(data, error, 'تعذر تحميل حالات الكباتن.');
    },

    async captainStatusesByCaptainIds(captainIds: readonly string[]): Promise<WebCaptainStatus[]> {
      const ids = Array.from(new Set(captainIds.filter(Boolean)));
      if (ids.length === 0) return [];
      const { data, error } = await getWebSupabaseClient().from('captain_status').select('*').in('captain_id', ids);
      return unwrap(data, error, 'تعذر تحميل حالات الكباتن المرتبطة.');
    },

    async myCustody(): Promise<WebCaptainCustody[]> {
      const { data, error } = await getWebSupabaseClient()
        .from('captain_custody')
        .select('*')
        .order('assigned_at', { ascending: false })
        .order('id', { ascending: false });
      return unwrap(data, error, 'تعذر تحميل الأمانات.');
    },

    async captainCustody(): Promise<WebCaptainCustody[]> {
      const { data, error } = await getWebSupabaseClient()
        .from('captain_custody')
        .select('*')
        .order('assigned_at', { ascending: false })
        .order('id', { ascending: false });
      return unwrap(data, error, 'تعذر تحميل أمانات الكباتن.');
    },

    async orders(): Promise<WebOrder[]> {
      const { data, error } = await getWebSupabaseClient()
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
      return unwrap(data, error, 'تعذر تحميل الطلبات.');
    },

    async ordersPage(input: WebListPageInput & { status?: WebOrderStatus; statuses?: readonly WebOrderStatus[] } = {}): Promise<WebListPage<WebOrder>> {
      const limit = normalizePageLimit(input.limit);
      let query = getWebSupabaseClient().from('orders').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1);
      if (input.status) query = query.eq('status', input.status);
      else if (input.statuses?.length) query = query.in('status', input.statuses);
      const cursorFilter = keysetFilter(input.cursor);
      if (cursorFilter) query = query.or(cursorFilter);
      const { data, error } = await query;
      return asPage(unwrap(data, error, 'تعذر تحميل الطلبات.'), limit);
    },

    async ordersByIds(orderIds: readonly string[]): Promise<WebOrder[]> {
      const ids = Array.from(new Set(orderIds.map((id) => id.trim()).filter(Boolean)));
      if (ids.length === 0) return [];
      const { data, error } = await getWebSupabaseClient().from('orders').select('*').in('id', ids);
      return unwrap(data, error, 'تعذر تحميل الطلبات المرتبطة بسجل الحركات.');
    },

    async auditLogs(limit = 6): Promise<WebAuditLog[]> {
      const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
      const { data, error } = await getWebSupabaseClient()
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(safeLimit);
      return unwrap(data, error, 'تعذر تحميل آخر النشاطات.');
    },

    async backofficeHomeSummary(): Promise<WebBackofficeHomeSummary> {
      const { data, error } = await getWebSupabaseClient().rpc('get_backoffice_home_summary');
      const rows = unwrap(data, error, 'تعذر تحميل ملخص لوحة الإدارة.');
      if (!rows[0]) throw new Error('لم يُرجع ملخص لوحة الإدارة نتيجة.');
      return rows[0];
    },

    async captainHomeMetrics(): Promise<WebCaptainHomeMetrics> {
      const { data, error } = await getWebSupabaseClient().rpc('get_captain_home_metrics');
      const rows = unwrap(data, error, 'تعذر تحميل ملخص الكابتن.');
      if (!rows[0]) throw new Error('لم يُرجع ملخص الكابتن نتيجة.');
      return rows[0];
    },

    async auditLogsPage(input: WebListPageInput = {}): Promise<WebListPage<WebAuditLog>> {
      const limit = normalizePageLimit(input.limit);
      let query = getWebSupabaseClient().from('audit_logs').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1);
      const cursorFilter = keysetFilter(input.cursor);
      if (cursorFilter) query = query.or(cursorFilter);
      const { data, error } = await query;
      return asPage(unwrap(data, error, 'تعذر تحميل سجل الحركات.'), limit);
    },

    async captainOrders(captainId: string): Promise<WebOrder[]> {
      const normalizedCaptainId = captainId.trim();
      if (!normalizedCaptainId) throw new Error('تعذر تحديد هوية الكابتن.');

      const { data, error } = await getWebSupabaseClient()
        .from('orders')
        .select('*')
        .eq('assigned_captain_id', normalizedCaptainId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
      return unwrap(data, error, 'تعذر تحميل سجل طلباتك.');
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

    async pendingAccountsPage(input: WebListPageInput = {}): Promise<WebListPage<WebPendingAccount>> {
      const limit = normalizePageLimit(input.limit);
      const { data, error } = await getWebSupabaseClient().rpc('list_pending_accounts', {
        p_limit: limit + 1,
        p_before_created_at: input.cursor?.createdAt ?? null,
        p_before_id: input.cursor?.id ?? null,
      });
      return asPage(unwrap(data, error, 'تعذر تحميل الحسابات المعلّقة.'), limit);
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

    async wageTotals(): Promise<WebWageTotals> {
      const { data, error } = await getWebSupabaseClient().rpc('get_wage_totals');
      const rows = unwrap(data, error, 'تعذر تحميل إجماليات الأجور.');
      if (!rows[0]) throw new Error('لم تُرجع إجماليات الأجور نتيجة.');
      return rows[0];
    },

    async captainWageSummary(captainId?: string): Promise<WebCaptainWageSummary[]> {
      const { data, error } = await getWebSupabaseClient().rpc(
        'get_captain_wage_summary',
        captainId ? { p_captain_id: captainId } : undefined,
      );
      return unwrap(data, error, 'تعذر تحميل ملخص أجور الكباتن.');
    },

    async captainWageDetailsV2(captainId: string): Promise<WebCaptainWageDetailV2[]> {
      const { data, error } = await getWebSupabaseClient().rpc('get_captain_wage_details_v2', {
        p_captain_id: captainId,
      });
      return unwrap(data, error, 'تعذر تحميل تفاصيل أجر الكابتن.');
    },

    async captainWagePeriodSummary(input: CaptainWagePeriodSummaryInput = {}): Promise<WebCaptainWagePeriodSummaryRow[]> {
      const { data, error } = await getWebSupabaseClient().rpc('get_captain_wage_period_summary', input);
      return unwrap(data, error, 'تعذر تحميل ملخص أجور الكباتن للفترة.');
    },

    async companyProfitHistory(input: CompanyProfitHistoryInput = {}): Promise<WebCompanyProfitHistoryRow[]> {
      const { data, error } = await getWebSupabaseClient().rpc('get_company_profit_history', input);
      return unwrap(data, error, 'تعذر تحميل سجل أرباح الشركة.');
    },

    async companyProfitDayDetails(input: CompanyProfitDayDetailsInput): Promise<WebCompanyProfitDayDetailRow[]> {
      const { data, error } = await getWebSupabaseClient().rpc('get_company_profit_day_details', input);
      return unwrap(data, error, 'تعذر تحميل تفاصيل يوم أرباح الشركة.');
    },

    async companyProfitPeriodHistory(input: CompanyProfitPeriodHistoryInput): Promise<WebCompanyProfitPeriodHistoryRow[]> {
      const { data, error } = await getWebSupabaseClient().rpc('get_company_profit_period_history', input);
      return unwrap(data, error, 'تعذر تحميل سجل أرباح الفترة.');
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
        p_idempotency_key: input.idempotencyKey,
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

    async transitionAssignedOrder(orderId: string, nextStatus: Extract<WebOrderStatus, 'received' | 'in_delivery' | 'completed' | 'false_order'>): Promise<WebOrder> {
      const { data, error } = await getWebSupabaseClient().rpc('transition_assigned_order', {
        p_order_id: orderId,
        p_next_status: nextStatus,
      });
      return unwrap(data, error, 'تعذر تحديث مرحلة الطلب.');
    },

    async setCaptainAvailability(availability: WebCaptainAvailability): Promise<WebCaptainStatus> {
      const { data, error } = await getWebSupabaseClient().rpc('set_captain_availability', {
        new_availability: availability,
      });
      return unwrap(data, error, 'تعذر تحديث حالة التوفر.');
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

    async assignCaptainCustody(captainId: string, itemName: string, itemDetails?: string): Promise<WebCaptainCustody> {
      const normalizedCaptainId = captainId.trim();
      const normalizedItemName = itemName.trim();
      if (!normalizedCaptainId) throw new Error('تعذر تحديد الكابتن للأمانة.');
      if (!normalizedItemName) throw new Error('أدخل اسم الأمانة.');

      const { data, error } = await getWebSupabaseClient().rpc('assign_captain_custody', {
        p_captain_id: normalizedCaptainId,
        p_item_name: normalizedItemName,
        p_item_details: itemDetails?.trim() || undefined,
      });
      return unwrap(data, error, 'تعذر إضافة أمانة الكابتن.');
    },

    async returnCaptainCustody(custodyId: string, returnNotes?: string): Promise<WebCaptainCustody> {
      const normalizedCustodyId = custodyId.trim();
      if (!normalizedCustodyId) throw new Error('تعذر تحديد الأمانة المراد إرجاعها.');

      const { data, error } = await getWebSupabaseClient().rpc('return_captain_custody', {
        p_custody_id: normalizedCustodyId,
        p_return_notes: returnNotes?.trim() || undefined,
      });
      return unwrap(data, error, 'تعذر تسجيل إرجاع الأمانة.');
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

    async createCaptainPartialPayout(input: CreateCaptainPartialPayoutInput): Promise<WebCaptainPayout> {
      const normalizedInput = validatePartialPayout(input);
      const { data, error } = await getWebSupabaseClient().rpc('create_captain_partial_payout', {
        p_captain_id: normalizedInput.captainId,
        p_amount: normalizedInput.amount,
        p_notes: normalizedInput.notes,
      });
      return unwrap(data, error, 'تعذر تسجيل دفعة الكابتن.');
    },
  },
} as const;
