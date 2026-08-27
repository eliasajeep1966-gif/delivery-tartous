import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { MotionPressable } from "@/components/ui/motion-pressable";

type IconName = ComponentProps<typeof MaterialIcons>["name"];
type KeyboardType = ComponentProps<typeof TextInput>["keyboardType"];

type AuthTextFieldProps = {
  label: string;
  icon: IconName;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  editable: boolean;
  keyboardType?: KeyboardType;
  secureTextEntry?: boolean;
  returnKeyType?: "next" | "done";
  onSubmitEditing?: () => void;
  direction?: "ltr" | "rtl";
};

export function AuthTextField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  editable,
  keyboardType = "default",
  secureTextEntry = false,
  returnKeyType = "next",
  onSubmitEditing,
  direction = "rtl",
}: AuthTextFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.fieldFrame}>
        <MaterialIcons pointerEvents="none" name={icon} size={20} color="#0563B4" style={styles.fieldIcon} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          editable={editable}
          placeholder={placeholder}
          placeholderTextColor="#7AAFD3"
          textAlign="right"
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          style={[styles.field, direction === "ltr" ? styles.ltrField : styles.rtlField]}
          accessibilityLabel={label}
        />
      </View>
    </View>
  );
}

type AuthPasswordFieldProps = Omit<AuthTextFieldProps, "icon" | "secureTextEntry"> & {
  visible: boolean;
  onToggleVisibility: () => void;
};

export function AuthPasswordField({ visible, onToggleVisibility, ...props }: AuthPasswordFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.fieldFrame}>
        <MaterialIcons pointerEvents="none" name="lock-outline" size={20} color="#0563B4" style={styles.fieldIcon} />
        <TextInput
          value={props.value}
          onChangeText={props.onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!visible}
          editable={props.editable}
          placeholder={props.placeholder}
          placeholderTextColor="#7AAFD3"
          textAlign="right"
          returnKeyType={props.returnKeyType ?? "next"}
          onSubmitEditing={props.onSubmitEditing}
          style={[styles.field, styles.rtlField]}
          accessibilityLabel={props.label}
        />
        <MotionPressable
          onPress={onToggleVisibility}
          disabled={!props.editable}
          hitSlop={10}
          haptic="none"
          pressedScale={0.92}
          style={styles.visibilityButton}
          accessibilityRole="button"
          accessibilityLabel={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
        >
          <MaterialIcons name={visible ? "visibility-off" : "visibility"} size={21} color="#0563B4" />
        </MotionPressable>
      </View>
    </View>
  );
}

export function AuthPrimaryButton({ label, icon, loading, onPress }: { label: string; icon: IconName; loading: boolean; onPress: () => void }) {
  return (
    <MotionPressable
      onPress={onPress}
      disabled={loading}
      haptic="medium"
      style={[styles.primaryButton, loading && styles.buttonPressed]}
      accessibilityRole="button"
    >
      {loading ? <ActivityIndicator color="#FFFFFF" /> : <MaterialIcons name={icon} size={22} color="#FFFFFF" />}
      <Text style={styles.primaryText}>{label}</Text>
    </MotionPressable>
  );
}

export function AuthLink({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.linkButton, pressed && styles.linkPressed]} accessibilityRole="link">
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

export function AuthErrorBox({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.errorBox} accessibilityRole="alert">
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorMessage}>{message}</Text>
    </View>
  );
}

export function AuthStatusBox({ children }: { children: ReactNode }) {
  return <View style={styles.statusBox}>{children}</View>;
}

export function AuthInfoNote({ children }: { children: ReactNode }) {
  return <Text style={styles.infoNote}>{children}</Text>;
}

const styles = StyleSheet.create({
  fieldGroup: { marginTop: 16 },
  label: { color: "#0563B4", fontFamily: "Cairo_700Bold", fontSize: 12, textAlign: "right", writingDirection: "rtl" },
  fieldFrame: { justifyContent: "center", marginTop: 6, position: "relative" },
  field: { backgroundColor: "rgba(255,255,255,0.95)", borderColor: "#A8CDE6", borderRadius: 12, borderWidth: 1, color: "#075BA6", fontSize: 16, height: 56, paddingLeft: 48, paddingRight: 48, shadowColor: "#075BA6", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  ltrField: { writingDirection: "ltr" },
  rtlField: { writingDirection: "rtl" },
  fieldIcon: { position: "absolute", right: 12, zIndex: 1 },
  visibilityButton: { alignItems: "center", height: 44, justifyContent: "center", left: 8, position: "absolute", width: 44 },
  primaryButton: { alignItems: "center", backgroundColor: "#0068C6", borderRadius: 12, flexDirection: "row-reverse", gap: 8, height: 56, justifyContent: "center", marginTop: 24, shadowColor: "#0060B8", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 4 },
  primaryText: { color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 18, writingDirection: "rtl" },
  buttonPressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  iconPressed: { opacity: 0.6 },
  linkButton: { alignItems: "center", justifyContent: "center", marginTop: 12, minHeight: 42 },
  linkPressed: { opacity: 0.65 },
  linkText: { color: "#0563B4", fontFamily: "Cairo_700Bold", fontSize: 14, writingDirection: "rtl" },
  errorBox: { backgroundColor: "#FEF2F2", borderColor: "#FECACA", borderRadius: 12, borderWidth: 1, marginTop: 16, padding: 12 },
  errorTitle: { color: "#B42318", fontFamily: "Cairo_700Bold", fontSize: 13, textAlign: "right", writingDirection: "rtl" },
  errorMessage: { color: "#7A271A", fontFamily: "Cairo_400Regular", fontSize: 12, lineHeight: 19, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  statusBox: { backgroundColor: "#FFFBEB", borderColor: "#FDE68A", borderRadius: 12, borderWidth: 1, marginTop: 28, padding: 16 },
  infoNote: { backgroundColor: "rgba(255,255,255,0.60)", borderRadius: 12, color: "#3478A9", fontFamily: "Cairo_400Regular", fontSize: 10, lineHeight: 16, marginTop: 8, padding: 10, textAlign: "center", writingDirection: "rtl" },
});
