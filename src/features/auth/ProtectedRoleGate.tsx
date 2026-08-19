import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/features/auth/useAuth';
import { AppRole } from '@/data/supabase/supabaseContract';

interface ProtectedRoleGateProps {
  allowedRoles: AppRole[];
  children: React.ReactNode;
}

export function ProtectedRoleGate({ allowedRoles, children }: ProtectedRoleGateProps) {
  const { role } = useAuth();

  useEffect(() => {
    if (role && !allowedRoles.includes(role)) {
      router.replace('/');
    }
  }, [role, allowedRoles]);

  if (!role || !allowedRoles.includes(role)) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>غير مصرح بالوصول</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F7F9FC',
  },
  text: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#DC2626',
  },
});
