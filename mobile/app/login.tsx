import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AuthPasswordField, AuthPrimaryButton, AuthErrorBox, AuthLink, AuthStatusBox, AuthTextField } from "@/components/auth/auth-ui";
import { AuthShell } from "@/components/auth/auth-shell";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function LoginScreen() {
  const router = useRouter();
  const { issue, isSigningIn, retryProfile, signIn, status } = useDeliveryAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const canRetryProfile = status === "profile-unavailable" || status === "profile-missing";

  const handleSignIn = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return setFormError("أدخل البريد الإلكتروني وكلمة المرور.");
    if (!isValidEmail(normalizedEmail)) return setFormError("أدخل بريداً إلكترونياً صحيحاً.");
    setFormError(null);
    await signIn(normalizedEmail, password);
  };

  return (
    <AuthShell
      title="مرحباً بعودتك"
      subtitle="سجّل الدخول للوصول إلى حسابك"
      visual="delivery-login"
      cardTransition="login"
    >
      {canRetryProfile ? (
        <AuthStatusBox>
          <Text style={styles.statusText}>{issue?.message ?? "تعذر التحقق من ملف الحساب."}</Text>
          <Pressable onPress={() => void retryProfile()} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
            <MaterialIcons name="refresh" size={16} color="#FFFFFF" />
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </Pressable>
        </AuthStatusBox>
      ) : (
        <View style={styles.form}>
          {formError || issue ? <AuthErrorBox title={issue?.title ?? "تحقق من البيانات"} message={formError ?? issue?.message ?? ""} /> : null}
          <AuthTextField label="البريد الإلكتروني" icon="email" value={email} onChangeText={setEmail} placeholder="example.com@" editable={!isSigningIn} keyboardType="email-address" direction="ltr" />
          <AuthPasswordField label="كلمة المرور" value={password} onChangeText={setPassword} placeholder="••••••••" editable={!isSigningIn} visible={visible} onToggleVisibility={() => setVisible((current) => !current)} returnKeyType="done" onSubmitEditing={handleSignIn} />
          <AuthPrimaryButton label={isSigningIn ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"} icon="login" loading={isSigningIn} onPress={handleSignIn} />
          <AuthLink label="تفعيل حساب جديد" onPress={() => router.push("/activate-account" as Href)} disabled={isSigningIn} />
        </View>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: 12 },
  statusText: { color: "#78350F", fontFamily: "Cairo_700Bold", fontSize: 14, lineHeight: 21, textAlign: "center", writingDirection: "rtl" },
  retryButton: { alignItems: "center", alignSelf: "center", backgroundColor: "#0060B8", borderRadius: 12, flexDirection: "row-reverse", gap: 6, height: 40, justifyContent: "center", marginTop: 12, paddingHorizontal: 16 },
  retryText: { color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 12, writingDirection: "rtl" },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
