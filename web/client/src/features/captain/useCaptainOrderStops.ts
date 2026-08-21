import { useCallback, useRef, useState } from 'react';

import { webSupabase, type WebOrderStop } from '@/data/supabase/webSupabaseContract';

export function useCaptainOrderStops() {
  const [cache, setCache] = useState<Map<string, WebOrderStop[]>>(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const inFlight = useRef(new Set<string>());

  const toggle = useCallback(async (orderId: string, expandedOrderId: string | null): Promise<string | null> => {
    if (expandedOrderId === orderId) return null;
    if (cache.has(orderId) || inFlight.current.has(orderId)) return orderId;

    inFlight.current.add(orderId);
    setLoading((current) => new Set(current).add(orderId));
    setErrors((current) => { const next = new Map(current); next.delete(orderId); return next; });
    try {
      const stops = await webSupabase.reads.orderStops(orderId);
      setCache((current) => new Map(current).set(orderId, stops));
    } catch (error) {
      const message = error instanceof Error && error.message.trim() ? error.message : 'تعذر تحميل نقاط الطلب.';
      setErrors((current) => new Map(current).set(orderId, message));
    } finally {
      inFlight.current.delete(orderId);
      setLoading((current) => { const next = new Set(current); next.delete(orderId); return next; });
    }
    return orderId;
  }, [cache]);

  return { cache, loading, errors, toggle };
}
