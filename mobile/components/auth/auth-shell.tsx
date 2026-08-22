import { LinearGradient } from "expo-linear-gradient";
import { type PropsWithChildren } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";

type AuthShellProps = PropsWithChildren<{
  title: string;
  subtitle: string;
}>;

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-[#DCEEF9]">
      <LinearGradient colors={["#D8EDF9", "#F5FBFF", "#C9E7F8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient} />
      <View pointerEvents="none" style={styles.topGlow} />
      <View pointerEvents="none" style={styles.topRing} />
      <View pointerEvents="none" style={styles.bottomRing} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.headingGroup}>
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gradient: { ...StyleSheet.absoluteFill },
  topGlow: { backgroundColor: "rgba(255,255,255,0.72)", borderRadius: 180, height: 260, left: -90, position: "absolute", top: -40, width: 260 },
  topRing: { borderColor: "rgba(255,255,255,0.32)", borderRadius: 144, borderWidth: 22, height: 288, position: "absolute", right: -112, top: -72, width: 288 },
  bottomRing: { borderColor: "rgba(0,96,184,0.10)", borderRadius: 170, borderWidth: 30, bottom: -108, height: 340, left: -122, position: "absolute", width: 340 },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 32 },
  card: { backgroundColor: "rgba(255,255,255,0.62)", borderColor: "rgba(255,255,255,0.78)", borderRadius: 32, borderWidth: 1, padding: 20, shadowColor: "#0059A0", shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.18, shadowRadius: 35, elevation: 6 },
  headingGroup: { alignItems: "center" },
  logoFrame: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "rgba(255,255,255,0.85)", borderRadius: 26, borderWidth: 1, height: 112, justifyContent: "center", overflow: "hidden", padding: 6, shadowColor: "#0060B8", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, width: 112 },
  logo: { height: "100%", width: "100%" },
  brand: { color: "#075BA6", fontSize: 25, fontWeight: "700", marginTop: 16, textAlign: "center", writingDirection: "rtl" },
  title: { color: "#1C2934", fontSize: 21, fontWeight: "700", lineHeight: 30, marginTop: 18, textAlign: "center", writingDirection: "rtl" },
  subtitle: { color: "#62717E", fontSize: 14, lineHeight: 22, marginTop: 6, textAlign: "center", writingDirection: "rtl" },
});
