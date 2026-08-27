import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AuthErrorBox, AuthInfoNote, AuthLink, AuthPrimaryButton, AuthTextField } from "@/components/auth/auth-ui";
import { AuthShell } from "@/components/auth/auth-shell";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function ActivateAccountScreen() {
  const router = useRouter();
  const { activatePendingAccount, isActivating, issue } = useDeliveryAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password || !confirmation) return setFormError("أكمل جميع الحقول لتفعيل الحساب.");
    if (!isValidEmail(normalizedEmail)) return setFormError("أدخل بريداً إلكترونياً صحيحاً.");
    if (password.length < 12) return setFormError("يجب أن تتكون كلمة المرور من 12 حرفاً على الأقل.");
    if (password !== confirmation) return setFormError("تأكيد كلمة المرور غير مطابق.");
    setFormError(null);
    await activatePendingAccount(normalizedEmail, password, confirmation);
  };

  return (
    <AuthShell
      title="تفعيل حساب جديد"
      subtitle="أدخل البريد الإلكتروني وكلمة مرور لحسابك"
      visual="delivery-login"
      cardTransition="activation"
    >
      <View style={styles.form}>
        {formError || issue ? <AuthErrorBox title={issue?.title ?? "تحقق من البيانات"} message={formError ?? issue?.message ?? ""} /> : null}
        <AuthTextField label="البريد الإلكتروني" icon="email" value={email} onChangeText={setEmail} placeholder="example.com@" editable={!isActivating} keyboardType="email-address" direction="ltr" />
        <AuthTextField label="كلمة المرور" icon="lock-outline" value={password} onChangeText={setPassword} placeholder="••••••••" editable={!isActivating} secureTextEntry />
        <AuthTextField label="تأكيد كلمة المرور" icon="repeat" value={confirmation} onChangeText={setConfirmation} placeholder="••••••••" editable={!isActivating} secureTextEntry returnKeyType="done" onSubmitEditing={submit} />
        <AuthPrimaryButton label={isActivating ? "جارٍ تفعيل الحساب..." : "تفعيل الحساب"} icon="check-circle-outline" loading={isActivating} onPress={submit} />
        <AuthLink label="العودة إلى تسجيل الدخول" onPress={() => router.replace("/login")} disabled={isActivating} />
        <AuthInfoNote>لا يمكن تفعيل الحساب إلا بالبريد الإلكتروني المضاف مسبقاً.</AuthInfoNote>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: 12 },
});
