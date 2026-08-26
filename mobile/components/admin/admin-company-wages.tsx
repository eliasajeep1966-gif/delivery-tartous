import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { MotionPressable } from "@/components/ui/motion-pressable";
import {
  useNativeCompanyProfitHistory,
  type NativeFinancePeriod,
} from "@/features/admin/use-admin-finance";

const BLUE = "#0060B8";
const money = (value: number) =>
  `${new Intl.NumberFormat("en-US").format(value)} ل.س`;
const day = (value: string) =>
  new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    dateStyle: "medium",
  }).format(new Date(`${value}T12:00:00Z`));
const year = (value: string) =>
  new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
function periodLabel(
  period: NativeFinancePeriod,
  periodStart: string,
  periodEnd: string,
) {
  if (period === "daily") return day(periodStart);
  if (period === "annual") return `سنة ${year(periodStart)}`;
  return `من ${day(periodStart)} إلى ${day(periodEnd)}`;
}

export function AdminCompanyWages() {
  const router = useRouter();
  const [period, setPeriod] = useState<NativeFinancePeriod>("daily");
  const history = useNativeCompanyProfitHistory(period);
  const rows = history.data ?? [];
  const totals = rows.reduce(
    (sum, row) => ({
      gross: sum.gross + row.gross_total,
      company: sum.company + row.company_total,
      captain: sum.captain + row.captain_net_total,
      orders: sum.orders + row.order_count,
    }),
    { gross: 0, company: 0, captain: 0, orders: 0 },
  );
  return (
    <ScreenContainer className="bg-[#F0F7FF]" containerClassName="bg-[#EAF5FF]">
      <DeliveryAppHeader
        contextLabel="أجور الشركة"
        leadingAction={{
          accessibilityLabel: "العودة إلى أجور الكباتن",
          icon: "arrow-forward",
          onPress: () => router.replace("/(tabs)/wages"),
        }}
        trailingAction={{ accessibilityLabel: "أجور الشركة", icon: "store" }}
      />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={history.isRefetching}
            onRefresh={() => void history.refetch()}
            tintColor={BLUE}
          />
        }
        contentContainerStyle={styles.content}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MaterialIcons
              name="account-balance-wallet"
              size={24}
              color="#6D28D9"
            />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>سجل أرباح الشركة</Text>
            <Text style={styles.muted}>
              أرباح الشركة المجمّعة من كل الكباتن حسب التاريخ.
            </Text>
          </View>
        </View>
        <View style={styles.metrics}>
          {[
            ["إجمالي الأجور", totals.gross, "#1C1B1B"],
            ["حصة الشركة (30%)", totals.company, "#6D28D9"],
            ["صافي الكباتن", totals.captain, "#047857"],
            ["طلبات الفترة", totals.orders, BLUE],
          ].map(([label, value, color]) => (
            <View key={String(label)} style={styles.metric}>
              <Text style={[styles.metricValue, { color: String(color) }]}>
                {money(Number(value))}
              </Text>
              <Text style={styles.muted}>{String(label)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.periodHeading}>
          <Text style={styles.periodTitle}>عرض حساب الشركة حسب</Text>
          <Text style={styles.periodHint}>اختر الفترة</Text>
        </View>
        <View style={styles.periods}>
          {(["daily", "monthly", "annual"] as const).map((value) => (
            <MotionPressable
              key={value}
              onPress={() => setPeriod(value)}
              style={[styles.period, period === value && styles.active]}
            >
              <Text
                style={[
                  styles.periodText,
                  period === value && styles.activeText,
                ]}
              >
                {value === "daily"
                  ? "يومي"
                  : value === "monthly"
                    ? "شهري"
                    : "سنوي"}
              </Text>
            </MotionPressable>
          ))}
        </View>
        <View style={styles.heading}>
          <Text style={styles.title}>سجل الأرباح حسب التاريخ</Text>
          <Text style={styles.badge}>{rows.length} فترات</Text>
        </View>
        <MotionPressable
          accessibilityLabel="فتح سجل أرباح الشركة الكامل"
          onPress={() => router.push("/company-profit-history" as never)}
          style={styles.fullHistoryButton}
        >
          <View style={styles.fullHistoryCopy}>
            <Text style={styles.fullHistoryTitle}>عرض السجل الكامل</Text>
            <Text style={styles.fullHistoryText}>
              استعرض فترات أقدم مع تحميل متدرج.
            </Text>
          </View>
          <View style={styles.fullHistoryIcon}>
            <MaterialIcons name="history" size={19} color={BLUE} />
          </View>
          <MaterialIcons name="arrow-back" size={19} color={BLUE} />
        </MotionPressable>
        {history.isPending ? (
          <Message text="جارٍ تحميل سجل الأرباح..." />
        ) : history.error ? (
          <Message
            text={
              history.error instanceof Error
                ? history.error.message
                : "تعذر تحميل سجل الأرباح."
            }
          />
        ) : (
          rows.map((row) => (
            <View key={row.period_start} style={styles.row}>
              <View>
                <Text style={styles.rowTitle}>
                  {periodLabel(period, row.period_start, row.period_end)}
                </Text>
                <Text style={styles.muted}>{row.order_count} طلبات</Text>
              </View>
              <View style={styles.end}>
                <Text style={styles.company}>{money(row.company_total)}</Text>
                <Text style={styles.muted}>حصة الشركة</Text>
                <Text style={styles.amount}>{money(row.gross_total)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
function Message({ text }: { text: string }) {
  return (
    <View style={styles.message}>
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    backgroundColor: BLUE,
    flexDirection: "row-reverse",
    height: 64,
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  back: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,.12)",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerText: { alignItems: "flex-end", flex: 1, marginHorizontal: 12 },
  eyebrow: { color: "#DBEAFF", fontFamily: "Cairo_600SemiBold", fontSize: 10, writingDirection: "rtl" },
  headerTitle: { color: "#FFF", fontFamily: "Cairo_700Bold", fontSize: 18, writingDirection: "rtl" },
  icon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,.15)",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  content: { gap: 12, padding: 18, paddingBottom: 34 },
  hero: {
    alignItems: "center",
    backgroundColor: "#FFF",
    borderColor: "#D3E3F0",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row-reverse",
    padding: 16,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "#EAE8FF",
    borderRadius: 16,
    height: 44,
    justifyContent: "center",
    marginLeft: 12,
    width: 44,
  },
  heroText: { flex: 1 },
  heroTitle: {
    color: "#1C1B1B",
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    textAlign: "right",
    writingDirection: "rtl",
  },
  muted: { color: "#66727E", fontFamily: "Cairo_400Regular", fontSize: 10, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  metrics: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 },
  metric: {
    backgroundColor: "#FFF",
    borderColor: "#D3E3F0",
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 84,
    padding: 12,
    width: "48.5%",
  },
  metricValue: { fontFamily: "Cairo_700Bold", fontSize: 14, textAlign: "right", writingDirection: "rtl" },
  periodHeading: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 2 },
  periodTitle: { color: "#27506B", fontFamily: "Cairo_700Bold", fontSize: 11, writingDirection: "rtl" },
  periodHint: { color: "#7A96AA", fontFamily: "Cairo_400Regular", fontSize: 9, writingDirection: "rtl" },
  periods: {
    backgroundColor: "#FFF",
    borderColor: "#D3E3F0",
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 5,
    padding: 5,
  },
  period: {
    alignItems: "center",
    borderRadius: 11,
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
  },
  active: { backgroundColor: BLUE },
  periodText: { color: "#5C7C90", fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" },
  activeText: { color: "#FFF" },
  heading: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  title: { color: "#1C1B1B", fontFamily: "Cairo_700Bold", fontSize: 14, writingDirection: "rtl" },
  badge: {
    backgroundColor: "#EAE8FF",
    borderRadius: 14,
    color: "#6D28D9",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  fullHistoryButton: {
    alignItems: "center",
    backgroundColor: "#EAF6FF",
    borderColor: "#A7D8FF",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 10,
    minHeight: 64,
    paddingHorizontal: 13,
  },
  fullHistoryIcon: {
    alignItems: "center",
    backgroundColor: "#D7EEFF",
    borderRadius: 11,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  fullHistoryCopy: { alignItems: "flex-end", flex: 1 },
  fullHistoryTitle: { color: "#00569F", fontFamily: "Cairo_700Bold", fontSize: 12, writingDirection: "rtl" },
  fullHistoryText: {
    color: "#51728A",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    marginTop: 3,
    textAlign: "right",
    writingDirection: "rtl",
  },
  row: {
    backgroundColor: "#FFF",
    borderColor: "#D3E3F0",
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    padding: 14,
  },
  rowTitle: {
    color: "#1C1B1B",
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
  end: { alignItems: "flex-end" },
  company: { color: "#6D28D9", fontFamily: "Cairo_700Bold", fontSize: 12, writingDirection: "rtl" },
  amount: { color: "#1C1B1B", fontFamily: "Cairo_600SemiBold", fontSize: 10, marginTop: 3, writingDirection: "rtl" },
  message: {
    alignItems: "center",
    backgroundColor: "#FFF",
    borderColor: "#C7DAE8",
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    minHeight: 86,
    justifyContent: "center",
    padding: 16,
  },
  messageText: {
    color: "#58616B",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    textAlign: "center",
    writingDirection: "rtl",
  },
});
