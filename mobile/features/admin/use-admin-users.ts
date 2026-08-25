import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { nativeAdminUsersContract, type NativeAppRole, type NativeUser } from "@/lib/supabase/native-admin-users-contract";

export const adminUsersQueryKey = ["admin", "users"] as const;
export function useAdminUsers() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: adminUsersQueryKey, queryFn: () => nativeAdminUsersContract.list(), staleTime: 5_000 });
  useEffect(() => {
    const unsubscribe = nativeAdminUsersContract.subscribe(() => { void queryClient.invalidateQueries({ queryKey: adminUsersQueryKey }); });
    const polling = setInterval(() => { void queryClient.invalidateQueries({ queryKey: adminUsersQueryKey }); }, 15_000);
    return () => { clearInterval(polling); unsubscribe(); };
  }, [queryClient]);
  const mutation = useMutation({
    mutationFn: (input: { type: "active"; user: NativeUser; value: boolean } | { type: "role"; userId: string; value: NativeAppRole } | { type: "cancel"; pendingId: string } | { type: "create"; email: string; fullName: string; role: NativeAppRole; custodyItemsText?: string }) => input.type === "active" ? nativeAdminUsersContract.setActive(input.user, input.value) : input.type === "role" ? nativeAdminUsersContract.setRole(input.userId, input.value) : input.type === "cancel" ? nativeAdminUsersContract.cancelPending(input.pendingId) : nativeAdminUsersContract.createPending({ email: input.email, fullName: input.fullName, role: input.role, custodyItemsText: input.custodyItemsText }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: adminUsersQueryKey }); },
  });
  return { ...query, users: query.data?.users ?? [], pending: query.data?.pending ?? [], mutate: mutation.mutateAsync, isMutating: mutation.isPending };
}
