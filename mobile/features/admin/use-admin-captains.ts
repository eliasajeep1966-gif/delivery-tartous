import { useCallback, useEffect, useState } from "react";

import {
  nativeCaptainAdminContract,
  type NativeCaptain,
} from "@/lib/supabase/native-captain-admin-contract";

export function useAdminCaptains() {
  const [captains, setCaptains] = useState<NativeCaptain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (background = false) => {
    if (background) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const next = await nativeCaptainAdminContract.list();
      setCaptains(next);
      setError(null);
    } catch (cause) {
      if (!background)
        setError(
          cause instanceof Error ? cause.message : "تعذر تحميل الكباتن.",
        );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(() => void reload(), 0);
    return () => clearTimeout(initialLoad);
  }, [reload]);

  const setActive = useCallback(
    async (captainId: string, isActive: boolean) => {
      await nativeCaptainAdminContract.setActive(captainId, isActive);
      await reload(true);
    },
    [reload],
  );

  const assignCustody = useCallback(
    async (captainId: string, itemName: string) => {
      await nativeCaptainAdminContract.assignCustody(captainId, itemName);
      await reload(true);
    },
    [reload],
  );

  const returnCustody = useCallback(
    async (custodyId: string) => {
      await nativeCaptainAdminContract.returnCustody(custodyId);
      await reload(true);
    },
    [reload],
  );

  return {
    captains,
    isLoading,
    isRefreshing,
    error,
    reload,
    setActive,
    assignCustody,
    returnCustody,
  };
}

/** Compatibility name shared with the web administration data hook. */
export function useAdminCaptainsData() {
  return useAdminCaptains();
}
