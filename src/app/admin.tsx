import { useState, useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';
import { deliverySupabase } from '@/data/supabase/supabaseContract';
import { ProtectedRoleGate } from '@/features/auth/ProtectedRoleGate';
import { useAuth } from '@/features/auth/useAuth';
import { AppRole, PendingAccountActivation } from '@/data/supabase/supabaseContract';

type PendingAccount = PendingAccountActivation;

export default function AdminScreen() {
  const { signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AppRole>('captain');
  const [custodyText, setCustodyText] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAccounts, setPendingAccounts] = useState<PendingAccount[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  async function loadPendingAccounts() {
    setLoadingList(true);
    try {
      const accounts = await deliverySupabase.reads.pendingAccounts();
      setPendingAccounts(accounts as PendingAccount[]);
    } catch {
      setError('تعذر تحميل الحسابات المعلّقة.');
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadPendingAccounts();
  }, []);

  async function handleCreate() {
    const normalizedEmail = email.trim().toLowerCase();
    setError(null);

    if (!normalizedEmail) {
      setError('أدخل البريد الإلكتروني أولاً.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('أدخل بريداً إلكترونياً صحيحاً، مثل name@example.com.');
      return;
    }

    setIsCreating(true);
    try {
      const created = await deliverySupabase.actions.createPendingAccount({
        email: normalizedEmail,
        fullName: fullName || undefined,
        role,
        custodyItemsText: role === 'captain' ? custodyText : undefined,
      });
      setPendingAccounts((current) => [created as PendingAccount, ...current.filter((item) => item.id !== created.id)]);
      setEmail('');
      setFullName('');
      setRole('captain');
      setCustodyText('');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'تعذر إنشاء الحساب المعلّق.';
      setError(message);
      Alert.alert('تعذر إنشاء الحساب', message);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCancel(id: string) {
    Alert.alert('إلغاء الحساب', 'هل تريد إلغاء هذا الحساب المعلّق؟', [
      { text: 'لا', style: 'cancel' },
      {
        text: 'نعم',
        style: 'destructive',
        onPress: async () => {
          setCancellingId(id);
          try {
            await deliverySupabase.actions.cancelPendingAccount(id);
            setPendingAccounts((current) => current.filter((item) => item.id !== id));
          } catch (cause) {
            const message = cause instanceof Error ? cause.message : 'تعذر إلغاء الحساب.';
            setError(message);
            Alert.alert('تعذر إلغاء الحساب', message);
          } finally {
            setCancellingId(null);
          }
        },
      },
    ]);
  }

  const isAccountClosed = (account: PendingAccount) => account.activated_at !== null || account.cancelled_at !== null;

  return (
    <ProtectedRoleGate allowedRoles={['admin']}>
      <ScrollView style={styles.container}>
        <Stack.Screen options={{ title: 'إدارة الحسابات المعلّقة' }} />

        <Text style={styles.sectionTitle}>إضافة مستخدم</Text>
        <TextInput
          style={styles.input}
          placeholder="البريد الإلكتروني"
          placeholderTextColor="#64748B"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (error) setError(null);
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          textAlign="right"
        />
        <TextInput
          style={styles.input}
          placeholder="الاسم الكامل (اختياري)"
          placeholderTextColor="#64748B"
          value={fullName}
          onChangeText={setFullName}
          textAlign="right"
        />
        <View style={styles.row}>
          <View style={styles.picker}>
            {(['admin', 'supervisor', 'captain'] as AppRole[]).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.option, role === r && styles.optionActive]}
                onPress={() => setRole(r)}
              >
                <Text style={[styles.optionText, role === r && styles.optionTextActive]}>
                  {r === 'admin' ? 'أدمن' : r === 'supervisor' ? 'مشرف' : 'كابتن'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {role === 'captain' && (
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="الأمانات المستلمة (كل سطر غرض واحد)"
            placeholderTextColor="#64748B"
            value={custodyText}
            onChangeText={setCustodyText}
            textAlign="right"
            multiline
            numberOfLines={4}
          />
        )}
        {error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity
          style={[styles.button, isCreating && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={isCreating}
        >
          <Text style={styles.buttonText}>{isCreating ? 'جارٍ الإنشاء...' : 'إنشاء الحساب المعلّق'}</Text>
        </TouchableOpacity>

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>حسابات بانتظار التفعيل</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadPendingAccounts}>
          <Text style={styles.refreshText}>تحديث القائمة</Text>
        </TouchableOpacity>

        {loadingList ? (
          <Text style={styles.statusText}>جارٍ التحميل...</Text>
        ) : pendingAccounts.length === 0 ? (
          <Text style={styles.statusText}>لا توجد حسابات بانتظار التفعيل</Text>
        ) : (
          pendingAccounts.map((account) => (
            <View key={account.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardEmail}>{account.email}</Text>
                <Text style={styles.cardRole}>
                  {account.role === 'admin' ? 'أدمن' : account.role === 'supervisor' ? 'مشرف' : 'كابتن'}
                </Text>
              </View>
              <Text style={styles.cardMeta}>
                {account.full_name || '—'} • {new Date(account.created_at).toLocaleDateString('ar-SY')}
              </Text>
              {!isAccountClosed(account) && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => handleCancel(account.id)}
                  disabled={cancellingId === account.id}
                >
                  <Text style={styles.cancelButtonText}>
                    {cancellingId === account.id ? 'جارٍ الإلغاء...' : 'إلغاء'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}

        <View style={styles.footer}>
          <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
            <Text style={styles.logoutText}>تسجيل الخروج</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ProtectedRoleGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 12,
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
  textArea: {
    height: 120,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  row: {
    marginBottom: 16,
  },
  picker: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  option: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E1E6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionActive: {
    backgroundColor: '#0060B8',
    borderColor: '#0060B8',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  optionTextActive: {
    color: '#FFFFFF',
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
  divider: {
    height: 1,
    backgroundColor: '#E0E1E6',
    marginVertical: 24,
  },
  refreshButton: {
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  refreshText: {
    color: '#0060B8',
    fontSize: 14,
    fontWeight: '600',
  },
  statusText: {
    textAlign: 'center',
    color: '#64748B',
    marginVertical: 24,
    fontSize: 15,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E1E6',
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardEmail: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14213D',
    textAlign: 'right',
    flex: 1,
  },
  cardRole: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0060B8',
    backgroundColor: '#EAF4FC',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cardMeta: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 12,
  },
  cancelButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelButtonText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    marginTop: 24,
    marginBottom: 32,
    alignItems: 'center',
  },
  logoutButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E1E6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoutText: {
    color: '#14213D',
    fontSize: 15,
    fontWeight: '700',
  },
});
