import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getNativeSupabaseClient } from "@/lib/supabase/native-supabase";
import { useRealtimeOrders } from "@/lib/supabase/useRealtimeOrders";

export type ActivityLogCategory = "orders" | "users" | "captains" | "system";
export type ActivityLogTone = "blue" | "green" | "red" | "violet" | "slate";
export type ActivityLogIcon =
  | "package"
  | "user-plus"
  | "check"
  | "trash"
  | "truck"
  | "shield"
  | "wallet"
  | "cancel"
  | "clipboard";
export type NativeActivityLog = {
  id: string;
  category: ActivityLogCategory;
  action: string;
  subject: string;
  actor: string;
  time: string;
  details: string;
  icon: ActivityLogIcon;
  tone: ActivityLogTone;
};

type RawAuditLog = {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
type Profile = { id: string; email: string | null; full_name: string | null };
type Order = { id: string; order_number: number };
const PAGE_SIZE = 25;
const DAMASCUS_TIME_ZONE = "Asia/Damascus";

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : null;
}
function name(profile?: Profile) {
  return profile?.full_name?.trim() || profile?.email || "النظام";
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat("ar-SY", {
    timeZone: DAMASCUS_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
function category(log: RawAuditLog): ActivityLogCategory {
  const entity = log.entity_type.toLowerCase();
  if (entity === "order" || log.action.startsWith("order_")) return "orders";
  if (
    entity === "captain_payout" ||
    log.action.includes("payout") ||
    log.action.includes("captain_") ||
    log.action.includes("custody")
  )
    return "captains";
  if (
    ["user", "profile", "pending_account", "user_permission_override"].includes(
      entity,
    ) ||
    /account|user_|profile|permission/.test(log.action)
  )
    return "users";
  return "system";
}
function presentation(
  log: RawAuditLog,
): Pick<NativeActivityLog, "action" | "details" | "icon" | "tone"> {
  const map: Record<
    string,
    Pick<NativeActivityLog, "action" | "details" | "icon" | "tone">
  > = {
    order_created: {
      action: "إنشاء طلب",
      details: "تم إنشاء طلب جديد في النظام.",
      icon: "package",
      tone: "blue",
    },
    order_created_with_stops: {
      action: "إنشاء طلب",
      details: "تم إنشاء طلب جديد في النظام.",
      icon: "package",
      tone: "blue",
    },
    order_assigned: {
      action: "تعيين كابتن",
      details: "تم إسناد الطلب إلى كابتن.",
      icon: "truck",
      tone: "violet",
    },
    order_status_changed: {
      action: "تحديث حالة طلب",
      details: "تم تحديث المرحلة التشغيلية للطلب.",
      icon: "check",
      tone: "green",
    },
    order_cancelled: {
      action: "إلغاء طلب",
      details: "تم إلغاء الطلب وتسجيل السبب.",
      icon: "cancel",
      tone: "red",
    },
    pending_account_created: {
      action: "إنشاء حساب معلّق",
      details: "تمت إضافة حساب بانتظار التفعيل.",
      icon: "user-plus",
      tone: "green",
    },
    pending_account_cancelled: {
      action: "إلغاء حساب معلّق",
      details: "تم إلغاء حساب قبل تفعيله.",
      icon: "trash",
      tone: "red",
    },
    pending_account_activated: {
      action: "تفعيل حساب",
      details: "تم تفعيل الحساب بنجاح.",
      icon: "check",
      tone: "green",
    },
    captain_deactivated: {
      action: "تعطيل كابتن",
      details: "تم إيقاف حساب الكابتن.",
      icon: "truck",
      tone: "red",
    },
    captain_reactivated: {
      action: "تفعيل كابتن",
      details: "تم إعادة تفعيل حساب الكابتن.",
      icon: "truck",
      tone: "violet",
    },
    captain_custody_assigned: {
      action: "إضافة أمانة",
      details: `تم تسجيل أمانة: ${text(log.metadata.item_name) ?? "عنصر جديد"}.`,
      icon: "clipboard",
      tone: "violet",
    },
    captain_custody_returned: {
      action: "إرجاع أمانة",
      details: `تم تسجيل إرجاع أمانة: ${text(log.metadata.item_name) ?? "عنصر"}.`,
      icon: "check",
      tone: "green",
    },
    captain_payout_recorded: {
      action: "تسجيل دفعة كابتن",
      details: "تم تسجيل دفعة أجور لكابتن.",
      icon: "wallet",
      tone: "green",
    },
    captain_partial_payout_recorded: {
      action: "تسجيل دفعة جزئية",
      details: "تم تسجيل دفعة جزئية من أجور كابتن.",
      icon: "wallet",
      tone: "green",
    },
    user_permission_override_set: {
      action: "تعديل تخصيص صلاحية",
      details: "تم تعديل تخصيص صلاحية مستخدم.",
      icon: "shield",
      tone: "slate",
    },
  };
  return (
    map[log.action] ?? {
      action: "نشاط إداري",
      details: "تم تسجيل حركة إدارية في النظام.",
      icon: "clipboard",
      tone: "slate",
    }
  );
}

export function useNativeActivityLogs() {
  const [logs, setLogs] = useState<RawAuditLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isInitialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const cursors = useRef<(string | null)[]>([null]);
  const load = useCallback(async (pageIndex: number, cursor: string | null) => {
    setError(null);
    if (pageIndex === 0) setInitialLoading(true);
    try {
      const client = getNativeSupabaseClient();
      let query = client
        .from("audit_logs")
        .select(
          "id,actor_user_id,action,entity_type,entity_id,metadata,created_at",
        )
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE + 1);
      if (cursor) query = query.lt("created_at", cursor);
      const result = await query;
      if (result.error) throw new Error(result.error.message);
      const rows = (result.data ?? []) as RawAuditLog[];
      setHasNextPage(rows.length > PAGE_SIZE);
      const visible = rows.slice(0, PAGE_SIZE);
      const profileIds = Array.from(
        new Set(
          visible.flatMap((row) =>
            [
              row.actor_user_id,
              row.entity_type === "order" ? null : row.entity_id,
              text(row.metadata.captain_id),
            ].filter((id): id is string => Boolean(id)),
          ),
        ),
      );
      const orderIds = visible
        .map((row) => (row.entity_type === "order" ? row.entity_id : null))
        .filter((id): id is string => Boolean(id));
      const [profileResult, orderResult] = await Promise.all([
        profileIds.length
          ? client
              .from("profiles")
              .select("id,email,full_name")
              .in("id", profileIds)
          : Promise.resolve({ data: [], error: null }),
        orderIds.length
          ? client.from("orders").select("id,order_number").in("id", orderIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (profileResult.error) throw new Error(profileResult.error.message);
      if (orderResult.error) throw new Error(orderResult.error.message);
      setLogs(visible);
      setProfiles((profileResult.data ?? []) as Profile[]);
      setOrders((orderResult.data ?? []) as Order[]);
      setPage(pageIndex);
      cursors.current[pageIndex] = cursor;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "تعذر تحميل سجل الحركات. حاول مرة أخرى.",
      );
    } finally {
      setInitialLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      void load(0, null);
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);
  useRealtimeOrders({ enabled: true, onActivity: () => void load(0, null) });
  const reload = useCallback(
    () => load(page, cursors.current[page] ?? null),
    [load, page],
  );
  const nextPage = useCallback(() => {
    const last = logs.at(-1)?.created_at;
    if (hasNextPage && last) void load(page + 1, last);
  }, [hasNextPage, load, logs, page]);
  const previousPage = useCallback(() => {
    if (page > 0) void load(page - 1, cursors.current[page - 1] ?? null);
  }, [load, page]);
  const activities = useMemo(() => {
    const profileMap = new Map(profiles.map((item) => [item.id, item]));
    const orderMap = new Map(orders.map((item) => [item.id, item]));
    return logs.map((log) => {
      const view = presentation(log);
      const order = log.entity_id ? orderMap.get(log.entity_id) : undefined;
      const subject = order
        ? `الطلب #${order.order_number}`
        : (text(log.metadata.email) ??
          text(log.metadata.item_name) ??
          (log.entity_id ? name(profileMap.get(log.entity_id)) : "النظام"));
      return {
        id: log.id,
        category: category(log),
        ...view,
        subject,
        actor: name(
          log.actor_user_id ? profileMap.get(log.actor_user_id) : undefined,
        ),
        time: formatTime(log.created_at),
      };
    });
  }, [logs, orders, profiles]);
  return {
    activities,
    isInitialLoading,
    error,
    reload,
    pageNumber: page + 1,
    hasNextPage,
    hasPreviousPage: page > 0,
    nextPage,
    previousPage,
  };
}
