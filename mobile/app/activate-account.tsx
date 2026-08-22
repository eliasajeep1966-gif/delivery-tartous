import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

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
    if (!normalizedEmail || !password || !confirmation) {
      setFormError("أكمل جميع الحقول لتفعيل الحساب.");
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setFormError("أدخل بريداً إلكترونياً صحيحاً.");
      return;
    }
    if (password.length < 12) {
      setFormError("يجب أن تتكون كلمة المرور من 12 حرفاً على الأقل.");
      return;
    }
    if (password !== confirmation) {
      setFormError("تأكيد كلمة المرور غير مطابق.");
      return;
    }

    setFormError(null);
    await activatePendingAccount(normalizedEmail, password, confirmation);
  };

  return (
    <AuthShell title="تفعيل حساب جديد" subtitle="أدخل البريد الإلكتروني وكلمة مرور لحسابك">
      <View style={styles.form}>
        {formError || issue ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>{issue?.title ?? "تحقق من البيانات"}</Text>
            <Text style={styles.errorMessage}>{formError ?? issue?.message}</Text>
          </View>
        ) : null}

        <Field label="البريد الإلكتروني" icon="email" value={email} onChangeText={setEmail} placeholder="example.com@" keyboardType="email-address" autoCapitalize="none" editable={!isActivating} />
        <Field label="كلمة المرور" icon="lock-outline" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry editable={!isActivating} labelStyle={styles.fieldSpacing} />
        <Field label="تأكيد كلمة المرور" icon="repeat" value={confirmation} onChangeText={setConfirmation} placeholder="••••••••" secureTextEntry editable={!isActivating} labelStyle={styles.fieldSpacing} returnKeyType="done" onSubmitEditing={submit} />

        <Pressable onPress={submit} disabled={isActivating} style={({ pressed }) => [styles.submitButton, (pressed || isActivating) && styles.buttonPressed]}>
          <MaterialIcons name="check-circle-outline" size={22} color="#FFFFFF" />
          <Text style={styles.submitText}>{isActivating ? "جارٍ تفعيل الحساب..." : "تفعيل الحساب"}</Text>
        </Pressable>

        <Pressable onPress={() => router.replace("/login")} disabled={isActivating} style={({ pressed }) => [styles.linkButton, pressed && styles.linkPressed]}>
          <Text style={styles.linkText}>العودة إلى تسجيل الدخول</Text>
        </Pressable>

        <Text style={styles.note}>لا يمكن تفعيل الحساب إلا بالبريد الإلكتروني المضاف مسبقاً.</Text>
      </View>
    </AuthShell>
  );
}

type FieldProps = {
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address";
  autoCapitalize?: "none";
  secureTextEntry?: boolean;
  editable: boolean;
  labelStyle?: object;
  returnKeyType?: "done";
  onSubmitEditing?: () => void;
};

function Field({ label, icon, value, onChangeText, placeholder, keyboardType = "default", autoCapitalize, secureTextEntry, editable, labelStyle, returnKeyType, onSubmitEditing }: FieldProps) {
  return (
    <View>
      <Text style={[styles.label, labelStyle]}>{label}</Text>
      <View style={styles.fieldContainer}>
        <MaterialIcons name={icon} size={20} color="#60707D" style={styles.fieldIconRight} />
        <TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} autoCapitalize={autoCapitalize} autoCorrect={false} secureTextEntry={secureTextEntry} editable={editable} placeholder={placeholder} placeholderTextColor="#9BA8B1" textAlign="left" returnKeyType={returnKeyType} onSubmitEditing={onSubmitEditing} style={styles.field} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: 28 },
  label: { color: "#475663", fontSize: 12, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  fieldSpacing: { marginTop: 16 },
  fieldContainer: { justifyContent: "center", marginTop: 6, position: "relative" },
  field: { backgroundColor: "rgba(255,255,255,0.95)", borderColor: "#AEBBC5", borderRadius: 12, borderWidth: 1, color: "#1C2934", fontSize: 16, height: 56, paddingLeft: 14, paddingRight: 44, shadowColor: "#17364D", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  fieldIconRight: { position: "absolute", right: 12, zIndex: 1 },
  submitButton: { alignItems: "center", backgroundColor: "#0068C6", borderRadius: 12, flexDirection: "row-reverse", gap: 8, height: 56, justifyContent: "center", marginTop: 24, shadowColor: "#0060B8", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 4 },
  submitText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", writingDirection: "rtl" },
  buttonPressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  linkButton: { alignItems: "center", justifyContent: "center", marginTop: 12, minHeight: 42 },
  linkPressed: { opacity: 0.65 },
  linkText: { color: "#0563B4", fontSize: 14, fontWeight: "700", writingDirection: "rtl" },
  note: { backgroundColor: "rgba(255,255,255,0.62)", borderRadius: 12, color: "#697986", fontSize: 10, lineHeight: 16, marginTop: 8, padding: 10, textAlign: "center", writingDirection: "rtl" },
  errorBox: { backgroundColor: "#FEF2F2", borderColor: "#FECACA", borderRadius: 12, borderWidth: 1, marginBottom: 16, padding: 12 },
  errorTitle: { color: "#B42318", fontSize: 13, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  errorMessage: { color: "#7A271A", fontSize: 12, lineHeight: 19, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
});
