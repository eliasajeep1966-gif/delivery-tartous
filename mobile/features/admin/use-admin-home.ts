import { useQuery } from "@tanstack/react-query";

import { mapAdminHomeActivities, type AdminHomeActivity, type AdminOrderStatus } from "@/lib/admin/admin-home-mappers";
import { deriveDeliveryTiming, type DeliveryTiming } from "@/lib/admin/delivery-duration";
import { getNativeSupabaseClient } from "@/lib/supabase/native-supabase";

export type AdminHomeMetricId = "pending" | "in_delivery" | "completed_today" | "cancelled_today";
export type { AdminHomeActivity, AdminOrderStatus } from "@/lib/admin/admin-home-mappers";

export type AdminHomeMetric = {
  id: AdminHomeMetricId;
  label: string;
  value: number;
  icon: "inventory-2" | "two-wheeler" | "check-circle-outline" | "cancel";
};

export type AdminHomeCaptain = {
  id: string;
  name: string;
  initial: string;
};

export type AdminHomeActivityWithTiming = AdminHomeActivity & {
  deliveryTiming: DeliveryTiming | null;
  currentOrderStatus: AdminOrderStatus | null;
};

export type AdminHomeSnapshot = {
  metrics: AdminHomeMetric[];
  activities: AdminHomeActivityWithTiming[];
  availableCaptains: AdminHomeCaptain[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function canShowDeliveryTiming(status: AdminOrderStatus | null): status is "received" | "in_delivery" | "completed" {
  return status === "received" || status === "in_delivery" || status === "completed";
}

function orderStatusValue(value: unknown): AdminOrderStatus | null {
  return ["pending", "assigned", "received", "in_delivery", "completed", "cancelled", "false_order"].includes(value as string)
    ? value as AdminOrderStatus
    : null;
}

async function enrichActivitiesWithDeliveryTiming(
  activities: AdminHomeActivity[],
): Promise<AdminHomeActivityWithTiming[]> {
  const candidateActivities = activities.filter(
    (activity) => activity.orderId && canShowDeliveryTiming(activity.status),
  );
  const activityOrderIds = Array.from(new Set(
    activities.flatMap((activity) => activity.orderId ? [activity.orderId] : []),
  ));
  const timingOrderIds = Array.from(new Set(
    candidateActivities.flatMap((activity) => activity.orderId ? [activity.orderId] : []),
  ));
  if (!activityOrderIds.length) {
    return activities.map((activity) => ({
      ...activity,
      deliveryTiming: null,
      currentOrderStatus: null,
    }));
  }

  const client = getNativeSupabaseClient();
  const [historyResult, ordersResult] = await Promise.all([
    timingOrderIds.length
      ? client
          .from("order_status_history")
          .select("order_id,next_status,changed_at")
          .in("order_id", timingOrderIds)
          .in("next_status", ["received", "in_delivery", "completed"])
      : Promise.resolve({ data: [], error: null }),
    client
      .from("orders")
      .select("id,status")
      .in("id", activityOrderIds),
  ]);
  if (historyResult.error) throw new Error(historyResult.error.message);
  if (ordersResult.error) throw new Error(ordersResult.error.message);

  const historyByOrder = new Map<string, { status: string; timestamp: string }[]>();
  for (const row of historyResult.data ?? []) {
    if (typeof row.order_id !== "string" || typeof row.next_status !== "string" || typeof row.changed_at !== "string") continue;
    const entries = historyByOrder.get(row.order_id) ?? [];
    entries.push({ status: row.next_status, timestamp: row.changed_at });
    historyByOrder.set(row.order_id, entries);
  }

  const currentStatusByOrder = new Map<string, AdminOrderStatus>();
  for (const order of ordersResult.data ?? []) {
    if (typeof order.id !== "string") continue;
    const status = orderStatusValue(order.status);
    if (status) currentStatusByOrder.set(order.id, status);
  }

  return activities.map((activity) => ({
    ...activity,
    currentOrderStatus: activity.orderId
      ? currentStatusByOrder.get(activity.orderId) ?? null
      : null,
    deliveryTiming:
      activity.orderId && canShowDeliveryTiming(activity.status)
        ? deriveDeliveryTiming(
            activity.status,
            activity.occurredAt,
            historyByOrder.get(activity.orderId) ?? [],
          )
        : null,
  }));
}

async function loadAdminHome(): Promise<AdminHomeSnapshot> {
  const client = getNativeSupabaseClient();
  const { data: summaryRows, error: summaryError } = await client.rpc("get_backoffice_home_summary");
  if (summaryError) throw new Error(summaryError.message);

  const summary = Array.isArray(summaryRows) ? asRecord(summaryRows[0]) : null;
  if (!summary) throw new Error("لم يُرجع ملخص لوحة الإدارة نتيجة.");

  const { data: captainProfiles, error: profilesError } = await client
    .from("profiles")
    .select("id,email,full_name")
    .eq("role", "captain")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (profilesError) throw new Error(profilesError.message);

  const profiles = Array.isArray(captainProfiles) ? captainProfiles : [];
  const captainIds = profiles.map((profile) => profile.id).filter((id): id is string => typeof id === "string" && id.length > 0);
  const { data: captainStatuses, error: statusesError } = captainIds.length
    ? await client.from("captain_status").select("captain_id,availability").in("captain_id", captainIds)
    : { data: [], error: null };
  if (statusesError) throw new Error(statusesError.message);

  const { data: activeOrders, error: activeOrdersError } = captainIds.length
    ? await client
        .from("orders")
        .select("assigned_captain_id")
        .in("assigned_captain_id", captainIds)
        .in("status", ["assigned", "received", "in_delivery"])
    : { data: [], error: null };
  if (activeOrdersError) throw new Error(activeOrdersError.message);
  const busyCaptainIds = new Set(
    (activeOrders ?? []).flatMap((order) =>
      typeof order.assigned_captain_id === "string" ? [order.assigned_captain_id] : [],
    ),
  );

  const availability = new Map(
    (captainStatuses ?? []).flatMap((status) => (
      typeof status.captain_id === "string" && typeof status.availability === "string" ? [[status.captain_id, status.availability] as const] : []
    )),
  );

  const availableCaptains = profiles.flatMap((profile) => {
    if (busyCaptainIds.has(profile.id) || availability.get(profile.id) !== "available") return [];
    const name = typeof profile.full_name === "string" && profile.full_name.trim()
      ? profile.full_name.trim()
      : typeof profile.email === "string"
        ? profile.email
        : "كابتن";
    return [{ id: profile.id, name, initial: name.slice(0, 1) }];
  });

  const activities = await enrichActivitiesWithDeliveryTiming(
    mapAdminHomeActivities(summary.recent_order_activities),
  );

  return {
    metrics: [
      { id: "pending", label: "قيد الانتظار", value: numberValue(summary.assigned_count), icon: "inventory-2" },
      { id: "in_delivery", label: "قيد التوصيل", value: numberValue(summary.in_delivery_count), icon: "two-wheeler" },
      { id: "completed_today", label: "طلبات مكتملة اليوم", value: numberValue(summary.completed_today_count), icon: "check-circle-outline" },
      { id: "cancelled_today", label: "طلبات ملغاة اليوم", value: numberValue(summary.cancelled_today_count), icon: "cancel" },
    ],
    activities,
    availableCaptains,
  };
}

export function useAdminHome(enabled = true) {
  return useQuery({
    queryKey: ["admin-home"],
    queryFn: loadAdminHome,
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
}
