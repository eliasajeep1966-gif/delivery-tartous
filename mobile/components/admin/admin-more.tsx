import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Href, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import { getNativeSupabaseClient } from "@/lib/supabase/native-supabase";

const items = [
  {
    title: "إدارة المستخدمين",
    description: "الحسابات المفعلة والحسابات بانتظار التفعيل",
    icon: "people-outline" as const,
    color: "#0060B8",
    bg: "#EAF4FF",
    path: "/users",
  },
  {
    title: "سجل الحركات",
    description: "تابع كل العمليات ومن قام بها",
    icon: "assignment" as const,
    color: "#0060B8",
    bg: "#EAF4FF",
    path: "/activity-logs",
  },
  {
    title: "إدارة الأمانات",
    description: "استلام وتسليم أمانات الكباتن",
    icon: "inventory-2" as const,
    color: "#0060B8",
    bg: "#EAF4FF",
    path: "/(admin)/custody",
  },
  {
    title: "التقارير",
    description: "ملخصات الطلبات والأجور حسب الفترة",
    icon: "bar-chart" as const,
    color: "#0060B8",
    bg: "#EAF4FF",
    path: "/(admin)/reports",
  },
  {
    title: "التصحيحات الإدارية",
    description: "إجراءات إدارية قيد التجهيز",
    icon: "report-problem" as const,
    color: "#BE123C",
    bg: "#FFF0F3",
  },
];

export function AdminMore() {
  const router = useRouter();
  const { profile, signOut } = useDeliveryAuth();
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let active = true;
    if (!profile?.id) return () => {
      active = false;
    };

    void Promise.resolve(getNativeSupabaseClient().rpc("is_application_owner"))
      .then(({ data, error }) => {
        if (active) setIsOwner(!error && data === true);
      })
      .catch(() => {
        if (active) setIsOwner(false);
      });

    return () => {
      active = false;
    };
  }, [profile?.id]);

  const open = (path?: string, label?: string) => {
    if (path) {
      router.push(path as Href);
      return;
    }
    Alert.alert(
      label ?? "هذه الوحدة",
      "سيتم نقل هذه الشاشة إلى Native في مرحلة لاحقة.",
    );
  };
  return (
    <ScreenContainer
      edges={["top"]}
      className="bg-[#F8FAFC]"
      containerClassName="bg-[#F8FAFC]"
    >
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "الرئيسية",
          icon: "home",
          onPress: () => router.replace("/(tabs)" as Href),
        }}
        trailingAction={{ accessibilityLabel: "المزيد", icon: "menu" }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <View style={styles.iconBox}>
            <MaterialIcons name="verified-user" size={25} color="#0060B8" />
          </View>
          <View style={styles.introText}>
            <Text style={styles.introTitle}>إدارة النظام والمتابعة</Text>
            <Text style={styles.description}>
              وحدات إدارية خارج تبويبات التشغيل اليومية.
            </Text>
          </View>
        </View>
        <Text style={styles.sectionTitle}>الإدارة والمتابعة</Text>
        {items.slice(0, profile?.role === "admin" ? 5 : 4).map((item) => (
          <MenuItem
            key={item.title}
            {...item}
            onPress={() => open(item.path, item.title)}
          />
        ))}
        <Text style={styles.sectionTitle}>إعدادات النظام</Text>
        <MenuItem
          title="إعدادات المكتب"
          description="بيانات المكتب ونسب التقسيم"
          icon="tune"
          color="#475569"
          bg="#F1F5F9"
          onPress={() => open("/(admin)/settings", "إعدادات المكتب")}
        />
        <MenuItem
          title="المساعدة والدعم"
          description="معلومات الاستخدام وطلب المساعدة"
          icon="info-outline"
          color="#0E7490"
          bg="#ECFEFF"
          onPress={() => open("/(admin)/support", "المساعدة والدعم")}
        />
        {isOwner ? (
          <MenuItem
            title="مسح بيانات التطبيق"
            description="حذف كامل البيانات عبر كلمة مرور المالك"
            icon="delete-forever"
            color="#BA1A1A"
            bg="#FFF0F0"
            onPress={() => open("/owner-data-reset", "مسح بيانات التطبيق")}
          />
        ) : null}
        <Text style={styles.sectionTitle}>الحساب</Text>
        <MenuItem
          title="إعدادات الحساب"
          description="الملف الشخصي وكلمة المرور"
          icon="person-outline"
          color="#0060B8"
          bg="#EAF4FF"
          onPress={() => open("/account-settings", "إعدادات الحساب")}
        />
        <Pressable onPress={() => void signOut()} style={styles.signOut}>
          <MaterialIcons name="logout" size={19} color="#BA1A1A" />
          <Text style={styles.signOutText}>تسجيل الخروج</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
function MenuItem({
  title,
  description,
  icon,
  color,
  bg,
  onPress,
}: {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  color: string;
  bg: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
    >
      <View style={[styles.menuIcon, { backgroundColor: bg }]}>
        <MaterialIcons name={icon} size={21} color={color} />
      </View>
      <View style={styles.menuText}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.description} numberOfLines={1}>
          {description}
        </Text>
      </View>
      <MaterialIcons name="chevron-left" size={22} color="#75818E" />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  header: {
    height: 64,
    backgroundColor: "#0060B8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    shadowColor: "#0060B8",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { alignItems: "flex-end" },
  brand: { color: "#DBEAFF", fontFamily: "Cairo_400Regular", fontSize: 11 },
  title: {
    color: "#FFFFFF",
    fontFamily: "Cairo_700Bold",
    fontSize: 19,
    lineHeight: 24,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 12, paddingBottom: 32 },
  intro: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D3E3F0",
    borderWidth: 1,
    borderRadius: 24,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#EAF4FF",
    alignItems: "center",
    justifyContent: "center",
  },
  introText: { flex: 1, alignItems: "flex-end" },
  introTitle: { color: "#1C1B1B", fontFamily: "Cairo_700Bold", fontSize: 16 },
  sectionTitle: {
    color: "#1C1B1B",
    fontFamily: "Cairo_700Bold",
    fontSize: 15,
    marginTop: 20,
    marginBottom: 9,
    textAlign: "right",
  },
  menuItem: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DBE7F2",
    borderWidth: 1,
    borderRadius: 24,
    minHeight: 70,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 9,
    shadowColor: "#0060B8",
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 1,
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: { flex: 1, alignItems: "flex-end" },
  menuTitle: { color: "#1C1B1B", fontFamily: "Cairo_700Bold", fontSize: 14 },
  description: {
    color: "#66727E",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    marginTop: 2,
  },
  signOut: {
    marginTop: 4,
    height: 46,
    borderRadius: 16,
    borderColor: "#F2B8B5",
    borderWidth: 1,
    backgroundColor: "#FFF5F5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  signOutText: { color: "#BA1A1A", fontFamily: "Cairo_700Bold", fontSize: 13 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
});
