import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import type { AuthIssue } from "@/lib/auth/auth-errors";

type AuthStateScreenProps = {
  title: string;
  message: string;
  issue?: AuthIssue | null;
  loading?: boolean;
  primaryLabel?: string;
  onPrimaryPress?: () => void;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
};

export function AuthStateScreen({
  title,
  message,
  issue,
  loading = false,
  primaryLabel,
  onPrimaryPress,
  secondaryLabel,
  onSecondaryPress,
}: AuthStateScreenProps) {
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="justify-center p-5">
      <View style={styles.card}>
        {loading ? <ActivityIndicator color="#0060B8" size="large" style={styles.loader} /> : null}
        <Text style={styles.eyebrow}>Delivery Tartous</Text>
        <Text style={styles.title}>{issue?.title ?? title}</Text>
        <Text style={styles.message}>{issue?.message ?? message}</Text>

        {primaryLabel && onPrimaryPress ? (
          <Pressable onPress={onPrimaryPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
            <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
          </Pressable>
        ) : null}

        {secondaryLabel && onSecondaryPress ? (
          <Pressable onPress={onSecondaryPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
            <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 24,
    shadowColor: "#083B70",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 4,
  },
  loader: { marginBottom: 20 },
  eyebrow: { color: "#0060B8", fontSize: 14, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  title: { color: "#14213D", fontSize: 24, fontWeight: "800", lineHeight: 32, marginTop: 12, textAlign: "right", writingDirection: "rtl" },
  message: { color: "#52616B", fontSize: 15, lineHeight: 24, marginTop: 12, textAlign: "right", writingDirection: "rtl" },
  primaryButton: { alignItems: "center", backgroundColor: "#0060B8", borderRadius: 14, justifyContent: "center", minHeight: 52, marginTop: 24 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", writingDirection: "rtl" },
  secondaryButton: { alignItems: "center", borderColor: "#B8CEE5", borderRadius: 14, borderWidth: 1, justifyContent: "center", minHeight: 52, marginTop: 12 },
  secondaryButtonText: { color: "#0060B8", fontSize: 15, fontWeight: "800", writingDirection: "rtl" },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
