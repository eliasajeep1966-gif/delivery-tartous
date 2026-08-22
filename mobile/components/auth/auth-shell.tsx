import { LinearGradient } from "expo-linear-gradient";
import { type PropsWithChildren, useMemo } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AuthShellProps = PropsWithChildren<{
  title: string;
  subtitle: string;
}>;

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  const { height, width } = useWindowDimensions();
  const cardWidth = Math.min(410, Math.max(width - 32, 0));
  const compact = height < 700;
  const contentStyle = useMemo(() => [styles.content, { paddingVertical: compact ? 16 : 32 }], [compact]);

  return (
    <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.safeArea}>
      <LinearGradient colors={["#D8EDF9", "#F5FBFF", "#C9E7F8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.topGlow} />
      <View pointerEvents="none" style={styles.topRing} />
      <View pointerEvents="none" style={styles.bottomRing} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { width: cardWidth }]}>
            <View style={styles.heading}>
              <View style={styles.logoFrame}>
                <Image source={require("@/assets/images/delivery-tartous-office-logo.jpg")} resizeMode="contain" style={styles.logo} />
              </View>
              <Text style={styles.brand}>دليفري طرطوس</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#DCEEF9", flex: 1 },
  flex: { flex: 1 },
  topGlow: { backgroundColor: "rgba(255,255,255,0.55)", borderRadius: 144, height: 288, left: -96, position: "absolute", top: -96, width: 288 },
  topRing: { borderColor: "rgba(255,255,255,0.25)", borderRadius: 128, borderWidth: 22, height: 256, position: "absolute", right: -80, top: -64, width: 256 },
  bottomRing: { borderColor: "rgba(0,96,184,0.10)", borderRadius: 144, borderWidth: 30, bottom: -96, height: 288, left: -96, position: "absolute", width: 288 },
  content: { alignItems: "center", flexGrow: 1, justifyContent: "center", paddingHorizontal: 16 },
  card: { alignSelf: "center", backgroundColor: "rgba(255,255,255,0.55)", borderColor: "rgba(255,255,255,0.75)", borderRadius: 32, borderWidth: 1, maxWidth: 410, padding: 20, shadowColor: "#0059A0", shadowOffset: { width: 0, height: 25 }, shadowOpacity: 0.18, shadowRadius: 35, elevation: 6 },
  heading: { alignItems: "center" },
  logoFrame: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "rgba(255,255,255,0.80)", borderRadius: 26, borderWidth: 1, height: 112, justifyContent: "center", overflow: "hidden", padding: 6, shadowColor: "#0060B8", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 13, elevation: 3, width: 112 },
  logo: { height: "100%", width: "100%" },
  brand: { color: "#075BA6", fontSize: 25, fontWeight: "700", marginTop: 16, textAlign: "center", writingDirection: "rtl" },
  title: { color: "#1C2934", fontSize: 21, fontWeight: "700", lineHeight: 30, marginTop: 20, textAlign: "center", writingDirection: "rtl" },
  subtitle: { color: "#62717E", fontSize: 14, lineHeight: 22, marginTop: 6, textAlign: "center", writingDirection: "rtl" },
});
