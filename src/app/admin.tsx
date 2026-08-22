import { Stack } from 'expo-router';

import { BackOfficeWorkspace } from '@/features/operations/BackOfficeWorkspace';
import { ProtectedRoleGate } from '@/features/auth/ProtectedRoleGate';
import { useAuth } from '@/features/auth/useAuth';

export default function AdminScreen() {
  const { signOut } = useAuth();

  return (
    <ProtectedRoleGate allowedRoles={['admin']}>
      <Stack.Screen options={{ headerShown: false }} />
      <BackOfficeWorkspace role="admin" onSignOut={signOut} />
    </ProtectedRoleGate>
  );
}
