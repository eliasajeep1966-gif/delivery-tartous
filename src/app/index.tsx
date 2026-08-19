import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/features/auth/useAuth';
import { resolveRouteForRole } from '@/features/auth/roleRouting';

export default function HomeScreen() {
  const { isBootstrapping, session, role, needsActivation } = useAuth();

  useEffect(() => {
    if (isBootstrapping) return;

    if (!session || needsActivation) {
      router.replace('/login');
      return;
    }

    if (role) {
      router.replace(resolveRouteForRole(role));
    }
  }, [isBootstrapping, session, role, needsActivation]);

  if (isBootstrapping) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.loadingText}>جارٍ التحميل...</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F9FC',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748B',
  },
});
