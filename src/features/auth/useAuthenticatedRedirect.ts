import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from './useAuth';
import { resolveRouteForRole } from './roleRouting';

export function useAuthenticatedRedirect() {
  const { isBootstrapping, session, role } = useAuth();

  useEffect(() => {
    if (isBootstrapping) return;
    if (!session || !role) return;
    router.replace(resolveRouteForRole(role));
  }, [isBootstrapping, session, role]);
}
