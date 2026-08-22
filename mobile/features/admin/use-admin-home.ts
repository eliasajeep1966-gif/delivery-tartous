import { useQuery } from "@tanstack/react-query";

import { mapAdminHomeActivities, type AdminHomeActivity, type AdminOrderStatus } from "@/lib/admin/admin-home-mappers";
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

export type AdminHomeSnapshot = {
  metrics: AdminHomeMetric[];
  activities: AdminHomeActivity[];
  availableCaptains: AdminHomeCaptain[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

  const availability = new Map(
    (captainStatuses ?? []).flatMap((status) => (
      typeof status.captain_id === "string" && typeof status.availability === "string" ? [[status.captain_id, status.availability] as const] : []
    )),
  );

  const availableCaptains = profiles.flatMap((profile) => {
    if (availability.get(profile.id) !== "available") return [];
    const name = typeof profile.full_name === "string" && profile.full_name.trim()
      ? profile.full_name.trim()
      : typeof profile.email === "string"
        ? profile.email
        : "كابتن";
    return [{ id: profile.id, name, initial: name.slice(0, 1) }];
  });

  return {
    metrics: [
      { id: "pending", label: "قيد الانتظار", value: numberValue(summary.assigned_count), icon: "inventory-2" },
      { id: "in_delivery", label: "قيد التوصيل", value: numberValue(summary.in_delivery_count), icon: "two-wheeler" },
      { id: "completed_today", label: "طلبات مكتملة اليوم", value: numberValue(summary.completed_today_count), icon: "check-circle-outline" },
      { id: "cancelled_today", label: "طلبات ملغاة اليوم", value: numberValue(summary.cancelled_today_count), icon: "cancel" },
    ],
    activities: mapAdminHomeActivities(summary.recent_order_activities),
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
