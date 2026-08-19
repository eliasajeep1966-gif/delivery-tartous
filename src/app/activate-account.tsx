import { useState } from 'react';
import { router, Stack } from 'expo-router';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { deliverySupabase } from '@/data/supabase/supabaseContract';

export default function ActivateAccountScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleActivate() {
    setLoading(true);
    setError(null);
    try {
      await deliverySupabase.auth.activatePendingAccount({
        email,
        password,
        passwordConfirmation: confirmPassword,
      });
      await deliverySupabase.auth.signInWithPassword(email, password);
    } catch {
      setError('تعذر تفعيل الحساب. تأكد من البيانات أو راجع الإدارة.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'تفعيل الحساب' }} />
      <Text style={styles.title}>تفعيل الحساب</Text>
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
      <TextInput
        style={styles.input}
        placeholder="تأكيد كلمة المرور"
        placeholderTextColor="#64748B"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        textAlign="right"
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleActivate}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'جارٍ التفعيل...' : 'تفعيل'}</Text>
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
});
