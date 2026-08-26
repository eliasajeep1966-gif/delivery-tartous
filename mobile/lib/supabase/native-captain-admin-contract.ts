import type { RealtimeChannel } from "@supabase/supabase-js";

import { NativeAdminRequestTimeoutError } from "@/lib/supabase/native-admin-contract";
import { getNativeSupabaseClient } from "@/lib/supabase/native-supabase";

export type NativeCaptainCustody = {
  id: string;
  captainId: string;
  itemName: string;
  itemDetails: string | null;
  assignedAt: string;
  returnedAt: string | null;
};

export type NativeCaptain = {
  id: string;
  email: string | null;
  fullName: string | null;
  isActive: boolean;
  name: string;
  initial: string;
  availability: "available" | "unavailable";
  custodyRecords: NativeCaptainCustody[];
};

const REQUEST_TIMEOUT_MS = 15_000;

function withTimeout<T>(request: PromiseLike<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new NativeAdminRequestTimeoutError(message)),
      REQUEST_TIMEOUT_MS,
    );
    Promise.resolve(request).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function mapCustody(value: unknown): NativeCaptainCustody | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.captain_id !== "string")
    return null;
  return {
    id: row.id,
    captainId: row.captain_id,
    itemName: stringValue(row.item_name, "أمانة"),
    itemDetails: optionalString(row.item_details),
    assignedAt: stringValue(row.assigned_at),
    returnedAt: optionalString(row.returned_at),
  };
}

export const nativeCaptainAdminContract = {
  async list(): Promise<NativeCaptain[]> {
    const client = getNativeSupabaseClient();
    const [profilesResult, statusesResult, custodyResult] = await Promise.all([
      client.rpc("list_visible_profiles", {
        p_limit: 100,
        p_before_created_at: null,
        p_before_id: null,
      }),
      client
        .from("captain_status")
        .select("captain_id,availability")
        .order("updated_at", { ascending: false }),
      client
        .from("captain_custody")
        .select("id,captain_id,item_name,item_details,assigned_at,returned_at")
        .order("assigned_at", { ascending: false }),
    ]);
    if (profilesResult.error) throw new Error(profilesResult.error.message);
    if (statusesResult.error) throw new Error(statusesResult.error.message);
    if (custodyResult.error) throw new Error(custodyResult.error.message);

    const statusByCaptain = new Map(
      (statusesResult.data ?? []).flatMap((row) =>
        typeof row.captain_id === "string"
          ? [[row.captain_id, row.availability] as const]
          : [],
      ),
    );
    const custodyByCaptain = new Map<string, NativeCaptainCustody[]>();
    (custodyResult.data ?? []).forEach((row) => {
      const item = mapCustody(row);
      if (!item) return;
      const list = custodyByCaptain.get(item.captainId) ?? [];
      list.push(item);
      custodyByCaptain.set(item.captainId, list);
    });

    return (profilesResult.data ?? [])
      .flatMap((row: Record<string, unknown>): NativeCaptain[] => {
        if (typeof row.id !== "string") return [];
        const name =
          typeof row.full_name === "string" && row.full_name.trim()
            ? row.full_name.trim()
            : stringValue(row.email, "كابتن بلا اسم");
        return [
          {
            id: row.id,
            email: optionalString(row.email),
            fullName: optionalString(row.full_name),
            isActive: row.is_active === true,
            name,
            initial: name.slice(0, 1),
            availability:
              statusByCaptain.get(row.id) === "available"
                ? ("available" as const)
                : ("unavailable" as const),
            custodyRecords: custodyByCaptain.get(row.id) ?? [],
          },
        ];
      })
      .sort((left: NativeCaptain, right: NativeCaptain) =>
        left.name.localeCompare(right.name, "ar"),
      );
  },
  async setActive(captainId: string, isActive: boolean): Promise<void> {
    const result = await withTimeout(
      getNativeSupabaseClient().rpc("set_captain_active", {
        p_captain_id: captainId,
        p_is_active: isActive,
      }),
      "انتهت مهلة تحديث حالة الكابتن.",
    );
    if (result.error) throw new Error(result.error.message);
  },
  async assignCustody(captainId: string, itemName: string): Promise<void> {
    if (!itemName.trim()) throw new Error("اكتب اسم الأمانة أولاً.");
    const result = await withTimeout(
      getNativeSupabaseClient().rpc("assign_captain_custody", {
        p_captain_id: captainId,
        p_item_name: itemName.trim(),
        p_item_details: undefined,
      }),
      "انتهت مهلة إضافة الأمانة.",
    );
    if (result.error) throw new Error(result.error.message);
  },
  async returnCustody(custodyId: string): Promise<void> {
    const result = await withTimeout(
      getNativeSupabaseClient().rpc("return_captain_custody", {
        p_custody_id: custodyId,
        p_return_notes: undefined,
      }),
      "انتهت مهلة تسجيل إرجاع الأمانة.",
    );
    if (result.error) throw new Error(result.error.message);
  },
  subscribe(onChange: () => void): () => void {
    const client = getNativeSupabaseClient();
    let active = true;
    const channel: RealtimeChannel = client
      .channel(`backoffice-captains:${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          if (active) onChange();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "captain_status" },
        () => {
          if (active) onChange();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          if (active) onChange();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "captain_custody" },
        () => {
          if (active) onChange();
        },
      )
      .subscribe();
    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  },
};
