import { useEffect, useRef } from 'react';

import { getWebSupabaseClient } from '@/data/supabase/webSupabaseClient';

type RealtimeTable = 'orders' | 'captain_status' | 'profiles' | 'audit_logs';
type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export type RealtimeRefreshTarget = Readonly<{
  table: RealtimeTable;
  event?: RealtimeEvent;
  filter?: string;
}>;

type UseRealtimeRefreshOptions = Readonly<{
  enabled: boolean;
  channelName: string;
  targets: readonly RealtimeRefreshTarget[];
  onRefresh: () => void | Promise<void>;
  fallbackMs?: number;
  debounceMs?: number;
}>;

/**
 * Refreshes a mounted operational screen from trusted reads after database events.
 * Events are deliberately coalesced: one business action can write orders, captain
 * status and audit records, while the screen only needs one reload of its summary.
 */
export function useRealtimeRefresh({
  enabled,
  channelName,
  targets,
  onRefresh,
  fallbackMs = 60_000,
  debounceMs = 250,
}: UseRealtimeRefreshOptions): void {
  const refreshRef = useRef(onRefresh);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return;

    const client = getWebSupabaseClient();
    let active = true;
    let debounceTimer: number | null = null;

    const refresh = () => {
      if (!active || debounceTimer !== null) return;
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        if (active) void refreshRef.current();
      }, debounceMs);
    };

    const channel = client.channel(`${channelName}:${Date.now()}`);
    for (const target of targets) {
      channel.on(
        'postgres_changes',
        {
          event: target.event ?? '*',
          schema: 'public',
          table: target.table,
          ...(target.filter ? { filter: target.filter } : {}),
        },
        refresh,
      );
    }
    channel.subscribe();

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);

    const fallbackTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, fallbackMs);

    return () => {
      active = false;
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      window.clearInterval(fallbackTimer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      void client.removeChannel(channel);
    };
  }, [channelName, debounceMs, enabled, fallbackMs, targets]);
}
