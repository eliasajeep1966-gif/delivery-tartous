import { useQuery } from "@tanstack/react-query";

import { useRealtimeOrders } from "@/lib/supabase/useRealtimeOrders";

import { type AdminOrderStatus } from "@/lib/admin/admin-home-mappers";
import { getNativeSupabaseClient } from "@/lib/supabase/native-supabase";

export type NativeOrderStop = { id: string; type: "pickup" | "delivery"; sequence: number; contactName: string; contactPhone: string; address: string; note: string | null };
export type NativeOrderTimeline = { id: string; status: AdminOrderStatus; timestamp: string; actorName: string; note: string | null };
export type NativeOrderDetails = { stops: NativeOrderStop[]; timeline: NativeOrderTimeline[] };
export type AvailableCaptain = { id: string; name: string };

const statuses: readonly AdminOrderStatus[] = ["pending", "assigned", "received", "in_delivery", "completed", "cancelled", "false_order"];

function stringValue(value: unknown, fallback = ""): string { return typeof value === "string" ? value : fallback; }
function isStatus(value: unknown): value is AdminOrderStatus { return typeof value === "string" && statuses.includes(value as AdminOrderStatus); }

async function loadDetails(orderId: string): Promise<NativeOrderDetails> {
  const client = getNativeSupabaseClient();
  const [stopsResult, historyResult] = await Promise.all([
    client.from("order_stops").select("*").eq("order_id", orderId).order("stop_type", { ascending: true }).order("sequence", { ascending: true }),
    client.from("order_status_history").select("*").eq("order_id", orderId).order("changed_at", { ascending: true }),
  ]);
  if (stopsResult.error) throw new Error(stopsResult.error.message);
  if (historyResult.error) throw new Error(historyResult.error.message);

  const historyRows = Array.isArray(historyResult.data) ? historyResult.data : [];
  const actorIds = Array.from(new Set(historyRows.map((row) => stringValue(row.changed_by_user_id)).filter(Boolean)));
  const { data: actors, error: actorsError } = actorIds.length ? await client.from("profiles").select("id,email,full_name").in("id", actorIds) : { data: [], error: null };
  if (actorsError) throw new Error(actorsError.message);
  const actorNames = new Map((actors ?? []).flatMap((actor) => {
    if (typeof actor.id !== "string") return [];
    return [[actor.id, typeof actor.full_name === "string" && actor.full_name.trim() ? actor.full_name.trim() : stringValue(actor.email, "النظام")] as const];
  }));

  const stops = (Array.isArray(stopsResult.data) ? stopsResult.data : []).flatMap((stop) => {
    const type = stop.stop_type === "pickup" || stop.stop_type === "delivery" ? stop.stop_type : null;
    if (!type || typeof stop.id !== "string" || typeof stop.sequence !== "number") return [];
    return [{ id: stop.id, type, sequence: stop.sequence, contactName: stringValue(stop.contact_name, "غير محدد"), contactPhone: stringValue(stop.contact_phone), address: stringValue(stop.address, "غير محدد"), note: typeof stop.note === "string" && stop.note.trim() ? stop.note.trim() : null }];
  });
  const timeline = historyRows.flatMap((item) => {
    if (typeof item.id !== "string" || !isStatus(item.next_status) || typeof item.changed_at !== "string") return [];
    return [{ id: item.id, status: item.next_status, timestamp: item.changed_at, actorName: actorNames.get(stringValue(item.changed_by_user_id)) ?? "النظام", note: typeof item.note === "string" && item.note.trim() ? item.note.trim() : null }];
  });
  return { stops, timeline };
}

async function loadAvailableCaptains(): Promise<AvailableCaptain[]> {
  const client = getNativeSupabaseClient();
  const { data: profiles, error: profilesError } = await client.from("profiles").select("id,email,full_name").eq("role", "captain").eq("is_active", true).order("created_at", { ascending: false });
  if (profilesError) throw new Error(profilesError.message);
  const ids = (profiles ?? []).map((profile) => profile.id).filter((id): id is string => typeof id === "string");
  const { data: captainStatuses, error: statusesError } = ids.length ? await client.from("captain_status").select("captain_id,availability").in("captain_id", ids) : { data: [], error: null };
  if (statusesError) throw new Error(statusesError.message);
  const availability = new Map((captainStatuses ?? []).flatMap((status) => typeof status.captain_id === "string" ? [[status.captain_id, status.availability] as const] : []));
  return (profiles ?? []).flatMap((profile) => {
    if (availability.get(profile.id) !== "available") return [];
    const name = typeof profile.full_name === "string" && profile.full_name.trim() ? profile.full_name.trim() : stringValue(profile.email, "كابتن");
    return [{ id: profile.id, name }];
  });
}

export function useAdminOrderDetails(orderId: string | null) {
  return useQuery({ queryKey: ["admin-order-details", orderId], queryFn: () => loadDetails(orderId!), enabled: Boolean(orderId), retry: 1 });
}

export function useAvailableCaptains(enabled: boolean) {
  const query = useQuery({
    queryKey: ["admin-available-captains"],
    queryFn: loadAvailableCaptains,
    enabled,
    staleTime: 0,
    refetchOnMount: true,
    retry: 1,
  });

  useRealtimeOrders({
    enabled,
    onCaptain: () => void query.refetch(),
    onProfile: () => void query.refetch(),
  });

  return query;
}