import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

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
    if (!normalizedEmail || !password) {
      setFormError("أدخل البريد الإلكتروني وكلمة المرور.");
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setFormError("أدخل بريداً إلكترونياً صحيحاً.");
      return;
    }

    setFormError(null);
    await signIn(normalizedEmail, password);
  };

  return (
    <AuthShell title="مرحباً بعودتك" subtitle="سجّل الدخول للوصول إلى حسابك">
      {canRetryProfile ? (
        <View style={styles.profileIssue}>
          <Text style={styles.profileIssueText}>{issue?.message ?? "تعذر التحقق من ملف الحساب."}</Text>
          <Pressable onPress={() => void retryProfile()} style={({ pressed }) => [styles.retryButton, pressed && styles.buttonPressed]}>
            <MaterialIcons name="refresh" size={16} color="#FFFFFF" />
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.form}>
          {formError || issue ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>{issue?.title ?? "تحقق من البيانات"}</Text>
              <Text style={styles.errorMessage}>{formError ?? issue?.message}</Text>
            </View>
          ) : null}

          <FieldLabel text="البريد الإلكتروني" />
          <View style={styles.fieldContainer}>
            <MaterialIcons name="email" size={20} color="#60707D" style={styles.fieldIconRight} />
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" returnKeyType="next" placeholder="example.com@" placeholderTextColor="#9BA8B1" textAlign="right" style={[styles.field, styles.ltrField]} editable={!isSigningIn} accessibilityLabel="البريد الإلكتروني" />
          </View>

          <FieldLabel text="كلمة المرور" style={styles.secondLabel} />
          <View style={styles.fieldContainer}>
            <MaterialIcons name="lock-outline" size={20} color="#60707D" style={styles.fieldIconRight} />
            <TextInput value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} returnKeyType="done" onSubmitEditing={handleSignIn} placeholder="••••••••" placeholderTextColor="#9BA8B1" textAlign="right" style={[styles.field, styles.passwordField]} editable={!isSigningIn} accessibilityLabel="كلمة المرور" />
            <Pressable onPress={() => setVisible((current) => !current)} disabled={isSigningIn} hitSlop={10} style={({ pressed }) => [styles.visibilityButton, pressed && styles.visibilityPressed]} accessibilityLabel={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>
              <MaterialIcons name={visible ? "visibility-off" : "visibility"} size={21} color="#60707D" />
            </Pressable>
          </View>

          <Pressable onPress={handleSignIn} disabled={isSigningIn} style={({ pressed }) => [styles.submitButton, (pressed || isSigningIn) && styles.buttonPressed]} accessibilityRole="button">
            <MaterialIcons name="login" size={22} color="#FFFFFF" />
            <Text style={styles.submitText}>{isSigningIn ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}</Text>
          </Pressable>

          <Pressable onPress={() => router.push("/activate-account" as Href)} disabled={isSigningIn} style={({ pressed }) => [styles.linkButton, pressed && styles.linkPressed]}>
            <Text style={styles.linkText}>تفعيل حساب جديد</Text>
          </Pressable>
        </View>
      )}
    </AuthShell>
  );
}

function FieldLabel({ text, style }: { text: string; style?: object }) {
  return <Text style={[styles.label, style]}>{text}</Text>;
}

const styles = StyleSheet.create({
  form: { marginTop: 28 },
  label: { color: "#475663", fontSize: 12, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  secondLabel: { marginTop: 16 },
  fieldContainer: { justifyContent: "center", marginTop: 6, position: "relative" },
  field: { backgroundColor: "rgba(255,255,255,0.95)", borderColor: "#AEBBC5", borderRadius: 12, borderWidth: 1, color: "#1C2934", fontSize: 16, height: 56, paddingLeft: 44, paddingRight: 14, shadowColor: "#17364D", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  ltrField: { writingDirection: "ltr" },
  passwordField: { paddingRight: 44 },
  fieldIconRight: { position: "absolute", right: 12, zIndex: 1 },
  visibilityButton: { alignItems: "center", height: 44, justifyContent: "center", left: 8, position: "absolute", width: 44 },
  visibilityPressed: { opacity: 0.6 },
  submitButton: { alignItems: "center", backgroundColor: "#0068C6", borderRadius: 12, flexDirection: "row-reverse", gap: 8, height: 56, justifyContent: "center", marginTop: 24, shadowColor: "#0060B8", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 4 },
  submitText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", writingDirection: "rtl" },
  buttonPressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  linkButton: { alignItems: "center", marginTop: 12, minHeight: 42, justifyContent: "center" },
  linkPressed: { opacity: 0.65 },
  linkText: { color: "#0563B4", fontSize: 14, fontWeight: "700", writingDirection: "rtl" },
  errorBox: { backgroundColor: "#FEF2F2", borderColor: "#FECACA", borderRadius: 12, borderWidth: 1, marginBottom: 16, padding: 12 },
  errorTitle: { color: "#B42318", fontSize: 13, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  errorMessage: { color: "#7A271A", fontSize: 12, lineHeight: 19, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  profileIssue: { backgroundColor: "#FFFBEB", borderColor: "#FDE68A", borderRadius: 12, borderWidth: 1, marginTop: 28, padding: 16 },
  profileIssueText: { color: "#78350F", fontSize: 14, fontWeight: "700", lineHeight: 21, textAlign: "center", writingDirection: "rtl" },
  retryButton: { alignItems: "center", alignSelf: "center", backgroundColor: "#0060B8", borderRadius: 12, flexDirection: "row-reverse", gap: 6, height: 40, justifyContent: "center", marginTop: 12, paddingHorizontal: 16 },
  retryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700", writingDirection: "rtl" },
});
