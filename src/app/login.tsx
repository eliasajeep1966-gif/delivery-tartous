import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack } from 'expo-router';

import { deliverySupabase } from '@/data/supabase/supabaseContract';
import { useAuthenticatedRedirect } from '@/features/auth/useAuthenticatedRedirect';

const logo = require('../../assets/images/delivery-tartous-office-logo.jpg');

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useAuthenticatedRedirect();

  async function handleLogin() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) { setError('أدخل البريد الإلكتروني وكلمة المرور.'); return; }
    if (!validEmail(normalizedEmail)) { setError('أدخل بريداً إلكترونياً صحيحاً.'); return; }
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await deliverySupabase.auth.signInWithPassword(normalizedEmail, password);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(/network|fetch|failed to fetch/i.test(message) ? 'تعذر الاتصال بالخادم. تحقق من الإنترنت ثم حاول مرة أخرى.' : 'تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.');
    } finally { setLoading(false); }
  }

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}><Stack.Screen options={{ headerShown: false }} /><View pointerEvents="none" style={styles.topCircle} /><View pointerEvents="none" style={styles.bottomCircle} /><View style={styles.card}><View style={styles.brand}><View style={styles.logoFrame}><Image source={logo} resizeMode="contain" style={styles.logo} /></View><Text style={styles.brandName}>دليفري طرطوس</Text><Text style={styles.greeting}>مرحباً بعودتك</Text><Text style={styles.subtitle}>سجّل الدخول للوصول إلى حسابك</Text></View><View style={styles.form}><Text style={styles.label}>البريد الإلكتروني</Text><View style={styles.inputShell}><Text style={styles.fieldIcon}>@</Text><TextInput accessibilityLabel="البريد الإلكتروني" autoCapitalize="none" autoComplete="email" editable={!loading} keyboardType="email-address" onChangeText={setEmail} placeholder="example.com@" placeholderTextColor="#9BA8B1" style={styles.input} textAlign="right" value={email} /></View><Text style={styles.label}>كلمة المرور</Text><View style={styles.inputShell}><Text style={styles.fieldIcon}>⌑</Text><TextInput accessibilityLabel="كلمة المرور" autoComplete="current-password" editable={!loading} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor="#9BA8B1" secureTextEntry={!visible} style={styles.passwordInput} textAlign="right" value={password} /><Pressable accessibilityLabel={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} disabled={loading} onPress={() => setVisible((current) => !current)} style={styles.visibility}><Text style={styles.visibilityText}>{visible ? 'إخفاء' : 'إظهار'}</Text></Pressable></View>{error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}<Pressable accessibilityRole="button" disabled={loading} onPress={() => void handleLogin()} style={[styles.loginButton, loading && styles.disabled]}><Text style={styles.loginButtonText}>{loading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}</Text></Pressable><Pressable accessibilityRole="link" disabled={loading} onPress={() => router.push('/activate-account')} style={styles.activate}><Text style={styles.activateText}>تفعيل حساب جديد</Text></Pressable></View></View></KeyboardAvoidingView>;
}

const styles = StyleSheet.create({ screen: { alignItems: 'center', backgroundColor: '#DCEEFE', flex: 1, justifyContent: 'center', overflow: 'hidden', padding: 20 }, topCircle: { borderColor: 'rgba(255,255,255,0.42)', borderRadius: 160, borderWidth: 24, height: 320, position: 'absolute', right: -118, top: -112, width: 320 }, bottomCircle: { borderColor: 'rgba(0,96,184,0.10)', borderRadius: 180, borderWidth: 32, bottom: -150, height: 360, left: -148, position: 'absolute', width: 360 }, card: { backgroundColor: 'rgba(255,255,255,0.84)', borderColor: 'rgba(255,255,255,0.88)', borderRadius: 32, borderWidth: 1, maxWidth: 410, padding: 24, shadowColor: '#0059A0', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.18, shadowRadius: 30, width: '100%' }, brand: { alignItems: 'center' }, logoFrame: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: 'rgba(255,255,255,0.9)', borderRadius: 26, borderWidth: 1, height: 108, justifyContent: 'center', overflow: 'hidden', padding: 6, shadowColor: '#0060B8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 14, width: 108 }, logo: { height: '100%', width: '100%' }, brandName: { color: '#075BA6', fontSize: 25, fontWeight: '800', marginTop: 16 }, greeting: { color: '#1C2934', fontSize: 21, fontWeight: '800', marginTop: 20 }, subtitle: { color: '#62717E', fontSize: 14, marginTop: 6 }, form: { gap: 8, marginTop: 28 }, label: { color: '#475663', fontSize: 12, fontWeight: '800', marginTop: 4, textAlign: 'right' }, inputShell: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#AE BBC5'.replace(' ', ''), borderRadius: 12, borderWidth: 1, flexDirection: 'row-reverse', height: 56, shadowColor: '#1C2934', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2 }, fieldIcon: { color: '#60707D', fontSize: 20, paddingHorizontal: 13 }, input: { color: '#1C2934', flex: 1, fontSize: 16, height: '100%', paddingHorizontal: 4 }, passwordInput: { color: '#1C2934', flex: 1, fontSize: 16, height: '100%', paddingHorizontal: 4 }, visibility: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 }, visibilityText: { color: '#60707D', fontSize: 11, fontWeight: '800' }, errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderRadius: 10, borderWidth: 1, marginTop: 4, padding: 10 }, errorText: { color: '#B91C1C', fontSize: 12, fontWeight: '700', textAlign: 'right' }, loginButton: { alignItems: 'center', backgroundColor: '#0068C6', borderRadius: 12, height: 56, justifyContent: 'center', marginTop: 10, shadowColor: '#0060B8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 14 }, loginButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' }, activate: { alignItems: 'center', marginTop: 10, minHeight: 38, paddingTop: 8 }, activateText: { color: '#0563B4', fontSize: 14, fontWeight: '800' }, disabled: { opacity: 0.65 } });
