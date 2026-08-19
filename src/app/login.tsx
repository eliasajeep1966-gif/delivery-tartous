import { useState } from 'react';
import { router, Stack } from 'expo-router';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { deliverySupabase } from '@/data/supabase/supabaseContract';
import { useAuthenticatedRedirect } from '@/features/auth/useAuthenticatedRedirect';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useAuthenticatedRedirect();

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      await deliverySupabase.auth.signInWithPassword(email, password);
    } catch {
      setError('بيانات الدخول غير صحيحة أو الحساب غير مفعّل.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'تسجيل الدخول' }} />
      <Text style={styles.title}>تسجيل الدخول</Text>
      <TextInput
        style={styles.input}
        placeholder="البريد الإلكتروني"
        placeholderTextColor="#64748B"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        textAlign="right"
      />
      <TextInput
        style={styles.input}
        placeholder="كلمة المرور"
        placeholderTextColor="#64748B"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textAlign="right"
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/activate-account')}>
        <Text style={styles.activateLink}>تفعيل حساب جديد</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F7F9FC',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: 24,
    color: '#14213D',
  },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E1E6',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    color: '#14213D',
  },
  button: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#0060B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  error: {
    color: '#DC2626',
    textAlign: 'right',
    marginBottom: 12,
  },
  activateLink: {
    color: '#0060B8',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 15,
    fontWeight: '600',
  },
});
