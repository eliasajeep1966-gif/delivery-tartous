import type { RealtimeChannel } from "@supabase/supabase-js";

import { getNativeSupabaseClient } from "@/lib/supabase/native-supabase";
import {
  NativeAdminRequestTimeoutError,
  type NativeAppRole,
  type NativePendingAccount,
  type NativePendingAccountInput,
  type NativeUser,
} from "@/lib/supabase/types/admin-contracts.types";

export type {
  NativeAppRole,
  NativePendingAccount,
  NativePendingAccountInput,
  NativeUser,
} from "@/lib/supabase/types/admin-contracts.types";

const REQUEST_TIMEOUT_MS = 15_000;
function withTimeout<T>(request: PromiseLike<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new NativeAdminRequestTimeoutError(message)), REQUEST_TIMEOUT_MS);
    Promise.resolve(request).then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}
function role(value: unknown): NativeAppRole {
  if (value === "admin" || value === "supervisor" || value === "captain") return value;
  return "captain";
}
function mapUser(value: unknown): NativeUser | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string") return null;
  return { id: row.id, email: typeof row.email === "string" ? row.email : null, fullName: typeof row.full_name === "string" ? row.full_name : null, role: role(row.role), isActive: row.is_active === true, createdAt: typeof row.created_at === "string" ? row.created_at : "" };
}
function mapPending(value: unknown): NativePendingAccount | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.email !== "string") return null;
  return { id: row.id, email: row.email, fullName: typeof row.full_name === "string" ? row.full_name : null, role: role(row.role), createdAt: typeof row.created_at === "string" ? row.created_at : "" };
}
function unwrap<T>(result: { data: T | null; error: { message: string } | null }, fallback: string): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error(fallback);
  return result.data;
}

export const nativeAdminUsersContract = {
  async list(): Promise<{ users: NativeUser[]; pending: NativePendingAccount[] }> {
    const client = getNativeSupabaseClient();
    const [usersResult, pendingResult] = await Promise.all([
      withTimeout(client.rpc("list_visible_profiles", { p_limit: 101, p_before_created_at: undefined, p_before_id: undefined }), "انتهت مهلة تحميل الحسابات المفعلة."),
      withTimeout(client.rpc("list_pending_accounts", { p_limit: 101, p_cursor_created_at: undefined, p_cursor_id: undefined }), "انتهت مهلة تحميل الحسابات المعلقة."),
    ]);
    return {
      users: (unwrap(usersResult, "تعذر تحميل الحسابات المفعلة.") as unknown[]).flatMap((row) => { const item = mapUser(row); return item ? [item] : []; }),
      pending: (unwrap(pendingResult, "تعذر تحميل الحسابات المعلقة.") as unknown[]).flatMap((row) => { const item = mapPending(row); return item ? [item] : []; }),
    };
  },
  async createPending(input: NativePendingAccountInput): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const fullName = input.fullName.trim();
    if (!fullName) throw new Error("أدخل الاسم الكامل للحساب.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("أدخل بريداً إلكترونياً صحيحاً.");
    const result = await withTimeout(
      getNativeSupabaseClient().rpc("create_pending_account", {
        p_email: email,
        p_full_name: fullName,
        p_role: input.role,
        p_custody_items_text:
          input.role === "captain"
            ? input.custodyItemsText?.trim() || undefined
            : undefined,
      }),
      "انتهت مهلة إنشاء الحساب المعلق. راجع القائمة قبل إعادة المحاولة.",
    );
    unwrap(result, "تعذر إنشاء الحساب المعلق.");
  },
  async cancelPending(id: string): Promise<void> {
    const result = await withTimeout(getNativeSupabaseClient().rpc("cancel_pending_account", { p_pending_id: id }), "انتهت مهلة إلغاء الحساب المعلق.");
    unwrap(result, "تعذر إلغاء الحساب المعلق.");
  },
  async setActive(user: NativeUser, isActive: boolean): Promise<void> {
    const rpc = user.role === "captain" ? "set_captain_active" : "set_user_active";
    const args = user.role === "captain" ? { p_captain_id: user.id, p_is_active: isActive } : { p_user_id: user.id, p_is_active: isActive };
    const result = await withTimeout(getNativeSupabaseClient().rpc(rpc, args), "انتهت مهلة تحديث حالة الحساب.");
    unwrap(result, "تعذر تحديث حالة الحساب.");
  },
  async setRole(userId: string, nextRole: NativeAppRole): Promise<void> {
    const result = await withTimeout(getNativeSupabaseClient().rpc("set_user_role", { p_user_id: userId, p_role: nextRole }), "انتهت مهلة تغيير الدور.");
    unwrap(result, "تعذر تغيير دور المستخدم.");
  },
  async deleteManagedUser(userId: string): Promise<void> {
    const result = await withTimeout(
      getNativeSupabaseClient().rpc("delete_managed_user", { p_user_id: userId }),
      "انتهت مهلة حذف الحساب. راجع القائمة قبل إعادة المحاولة.",
    );
    unwrap(result, "تعذر حذف الحساب.");
  },
  subscribe(onChange: () => void): () => void {
    const client = getNativeSupabaseClient();
    let active = true;
    const channel: RealtimeChannel = client.channel(`backoffice-users:${Date.now()}`).on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => { if (active) onChange(); }).on("postgres_changes", { event: "*", schema: "public", table: "pending_account_activations" }, () => { if (active) onChange(); }).subscribe();
    return () => { active = false; void client.removeChannel(channel); };
  },
};
