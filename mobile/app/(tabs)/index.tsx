import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";

export default function HomeScreen() {
  const { profile, signOut, operation } = useDeliveryAuth();

  return (
    <ScreenContainer className="p-5">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.brand}>Delivery Tartous</Text>
          <Text style={styles.title}>تم التحقق من الجلسة</Text>
          <Text style={styles.subtitle}>أهلاً {profile?.full_name || profile?.email || "بك"}، تم تحميل دورك وصلاحيات الدخول من الخادم.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>حالة حساب العمل</Text>
          <SessionRow label="الدور" value={roleLabel(profile?.role)} />
          <SessionRow label="الحساب" value="مفعّل" success />
          <SessionRow label="التخزين" value="SecureStore" />
          <SessionRow label="تجديد الجلسة" value="تلقائي" />
        </View>

        <Pressable
          onPress={() => void signOut()}
          disabled={operation === "signing-out"}
          style={({ pressed }) => [styles.signOutButton, (pressed || operation === "signing-out") && styles.buttonPressed]}
        >
          <Text style={styles.signOutText}>{operation === "signing-out" ? "جارٍ تسجيل الخروج..." : "تسجيل الخروج من هذا الجهاز"}</Text>
        </Pressable>

        <Text style={styles.note}>هذه شاشة تحقق للجلسة فقط. شاشة الأعمال الفعلية ستُبنى في الوحدة التالية بعد اختبار تسجيل الدخول على الحسابات الحقيقية.</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function SessionRow({ label, value, success = false }: { label: string; value: string; success?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, success && styles.rowValueSuccess]}>{value}</Text>
    </View>
  );
}

function roleLabel(role?: string) {
  if (role === "admin") return "مدير";
  if (role === "supervisor") return "مشرف";
  if (role === "captain") return "كابتن";
  return "غير معروف";
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 20, paddingBottom: 16 },
  hero: { backgroundColor: "#0060B8", borderRadius: 24, padding: 24 },
  brand: { color: "#DDEFFF", fontSize: 14, fontWeight: "800", textAlign: "right" },
  title: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", lineHeight: 34, marginTop: 8, textAlign: "right", writingDirection: "rtl" },
  subtitle: { color: "#E7F3FF", fontSize: 15, lineHeight: 23, marginTop: 10, textAlign: "right", writingDirection: "rtl" },
  card: { backgroundColor: "#FFFFFF", borderColor: "#D8E5F1", borderRadius: 20, borderWidth: 1, padding: 18 },
  cardTitle: { color: "#14213D", fontSize: 17, fontWeight: "800", marginBottom: 14, textAlign: "right", writingDirection: "rtl" },
  row: { alignItems: "center", borderTopColor: "#E8F0F7", borderTopWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", minHeight: 46 },
  rowLabel: { color: "#52616B", fontSize: 14, writingDirection: "rtl" },
  rowValue: { color: "#0060B8", fontSize: 14, fontWeight: "800", writingDirection: "rtl" },
  rowValueSuccess: { color: "#138A4B" },
  signOutButton: { alignItems: "center", borderColor: "#B8CEE5", borderRadius: 14, borderWidth: 1, justifyContent: "center", minHeight: 52 },
  signOutText: { color: "#0060B8", fontSize: 15, fontWeight: "800", writingDirection: "rtl" },
  buttonPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  note: { color: "#657786", fontSize: 13, lineHeight: 20, textAlign: "right", writingDirection: "rtl" },
});
