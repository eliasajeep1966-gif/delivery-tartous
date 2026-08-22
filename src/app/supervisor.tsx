import { Stack } from 'expo-router';

import { BackOfficeWorkspace } from '@/features/operations/BackOfficeWorkspace';
import { ProtectedRoleGate } from '@/features/auth/ProtectedRoleGate';
import { useAuth } from '@/features/auth/useAuth';

export default function SupervisorScreen() {
  const { signOut } = useAuth();

  return (
    <ProtectedRoleGate allowedRoles={['supervisor']}>
      <Stack.Screen options={{ headerShown: false }} />
      <BackOfficeWorkspace role="supervisor" onSignOut={signOut} />
    </ProtectedRoleGate>
  );
}
