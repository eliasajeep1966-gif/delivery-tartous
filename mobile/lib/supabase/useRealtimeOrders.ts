import { useEffect, useRef } from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";

import { getNativeSupabaseClient } from "@/lib/supabase/native-supabase";

export type RealtimeTable =
  | "orders"
  | "profiles"
  | "captain_status"
  | "audit_logs";
export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

type Payload = RealtimePostgresChangesPayload<Record<string, unknown>>;
type Listener = (payload: Payload) => void;

type Options = {
  enabled?: boolean;
  captainId?: string | null;
  onOrder?: Listener;
  onCaptain?: Listener;
  onActivity?: Listener;
  onProfile?: Listener;
};

/**
 * One low-overhead channel per screen. Every handler is registered before subscribe,
 * and the returned cleanup always removes the channel.
 */
export function useRealtimeOrders({
  enabled = true,
  captainId,
  onOrder,
  onCaptain,
  onActivity,
  onProfile,
}: Options = {}) {
  const callbacks = useRef({ onOrder, onCaptain, onActivity, onProfile });

  useEffect(() => {
    callbacks.current = { onOrder, onCaptain, onActivity, onProfile };
  });

  useEffect(() => {
    if (!enabled) return;
    const client = getNativeSupabaseClient();
    let active = true;
    const channel = client.channel(
      `ultra-realtime:${captainId ?? "backoffice"}:${Date.now()}`,
    );
    const listen = (
      table: RealtimeTable,
      event: RealtimeEvent,
      callback: (payload: Payload) => void,
      filter?: string,
    ) => {
      channel.on(
        "postgres_changes",
        { event, schema: "public", table, ...(filter ? { filter } : {}) },
        (payload) => {
          if (active) callback(payload as Payload);
        },
      );
    };

    listen(
      "orders",
      "*",
      (payload) => callbacks.current.onOrder?.(payload),
      captainId ? `assigned_captain_id=eq.${captainId}` : undefined,
    );
    listen(
      "captain_status",
      "*",
      (payload) => callbacks.current.onCaptain?.(payload),
      captainId ? `captain_id=eq.${captainId}` : undefined,
    );
    if (!captainId) {
      listen("profiles", "*", (payload) =>
        callbacks.current.onProfile?.(payload),
      );
      listen("audit_logs", "INSERT", (payload) =>
        callbacks.current.onActivity?.(payload),
      );
    }
    channel.subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [captainId, enabled]);
}
