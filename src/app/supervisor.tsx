import { Stack } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProtectedRoleGate } from '@/features/auth/ProtectedRoleGate';
import { useAuth } from '@/features/auth/useAuth';

export default function SupervisorScreen() {
  const { signOut } = useAuth();

  return (
    <ProtectedRoleGate allowedRoles={['supervisor']}>
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'لوحة المشرف' }} />
        <Text style={styles.roleText}>دخولك كمشرف</Text>
        <TouchableOpacity style={styles.button} onPress={signOut}>
          <Text style={styles.buttonText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </View>
    </ProtectedRoleGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F7F9FC',
  },
  roleText: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    color: '#14213D',
  },
  button: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#0060B8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
