import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { goBackOrReplace } from "@/lib/navigation/go-back-or-replace";
import { useState } from "react";
import {
  Pressable,
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
  useNativeOfficeExpensePeriods,
  type NativeFinancePeriod,
} from "@/features/admin/use-admin-finance";

const BLUE = "#0060B8";
const money = (value: number) =>
  `${new Intl.NumberFormat("en-US").format(value)} ل.س`;

export function AdminCompanyWages() {
  const router = useRouter();
  const [period, setPeriod] = useState<NativeFinancePeriod>("daily");
  const history = useNativeCompanyProfitHistory(period);
  const expenseHistory = useNativeOfficeExpensePeriods(period);
  const rows = history.data ?? [];
  const expenseRows = expenseHistory.data ?? [];
  const currentPeriod = rows[0];
  const officeExpenses = Number(
    expenseRows.find((row) => row.period_start === currentPeriod?.period_start)
      ?.expense_total ?? 0,
  );
  const totals = {
    gross: currentPeriod?.gross_total ?? 0,
    company: currentPeriod?.company_total ?? 0,
    captain: currentPeriod?.captain_net_total ?? 0,
    compensation: currentPeriod?.settlement_total ?? 0,
  };
  return (
    <ScreenContainer className="bg-[#F0F7FF]" containerClassName="bg-[#EAF5FF]">
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "العودة إلى أجور الكباتن",
          icon: "arrow-forward",
          onPress: () => goBackOrReplace(router, "/(tabs)/wages"),
        }}
        trailingAction={{ accessibilityLabel: "أجور الشركة", icon: "store" }}
      />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={history.isRefetching || expenseHistory.isRefetching}
            onRefresh={() => {
              void history.refetch();
              void expenseHistory.refetch();
            }}
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
            <Text style={styles.heroTitle}>ملخص أرباح الشركة</Text>
            <Text style={styles.muted}>
              عرض أحدث يوم أو شهر أو سنة، حسب الفترة التي تختارها.
            </Text>
          </View>
        </View>
        <View style={styles.periodHeading}>
          <Text style={styles.periodTitle}>فترة الملخص المالي</Text>
          <Text style={styles.periodHint}>أحدث فترة متاحة</Text>
        </View>
        <View style={styles.periods}>
          {(["daily", "monthly", "annual"] as const).map((value) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: period === value }}
              key={value}
              onPress={() => setPeriod(value)}
              style={({ pressed }) => [
                styles.period,
                period === value && styles.active,
                pressed && styles.periodPressed,
              ]}
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
            </Pressable>
          ))}
        </View>
        {history.isPending || expenseHistory.isPending ? (
          <Message text="جارٍ تحميل ملخص الأرباح والمصاريف..." />
        ) : history.error || expenseHistory.error ? (
          <Message
            text={
              history.error instanceof Error
                ? history.error.message
                : "تعذر تحميل ملخص الأرباح."
            }
          />
        ) : (
          <View style={styles.metrics}>
            {[
              ["إجمالي الأجور", totals.gross, "#1C1B1B"],
              ["نتيجة الشركة", totals.company, "#6D28D9"],
              ["مصاريف المكتب", officeExpenses, "#B54708"],
              ["الصافي", totals.company - officeExpenses, "#047857"],
              ["صافي الكباتن", totals.captain, "#047857"],
              ["تعويض الكباتن", totals.compensation, BLUE],
            ].map(([label, value, color]) => (
              <View key={String(label)} style={styles.metric}>
                <Text style={[styles.metricValue, { color: String(color) }]}>
                  {money(Number(value))}
                </Text>
                <Text style={styles.muted}>{String(label)}</Text>
              </View>
            ))}
          </View>
        )}
        <MotionPressable
          accessibilityLabel="فتح سجل الأرباح حسب التاريخ"
          onPress={() => router.push("/company-profit-history" as never)}
          style={styles.fullHistoryButton}
        >
          <View style={styles.fullHistoryCopy}>
            <Text style={styles.fullHistoryTitle}>سجل الأرباح حسب التاريخ</Text>
            <Text style={styles.fullHistoryText}>
              استعرض جميع الفترات بخمس فترات في كل صفحة.
            </Text>
          </View>
          <View style={styles.fullHistoryIcon}>
            <MaterialIcons name="history" size={19} color={BLUE} />
          </View>
          <MaterialIcons name="arrow-back" size={19} color={BLUE} />
        </MotionPressable>
        <MotionPressable
          accessibilityLabel="فتح سجل مصاريف المكتب"
          onPress={() => router.push("/office-expenses" as never)}
          style={styles.expenseHistoryButton}
        >
          <View style={styles.fullHistoryCopy}>
            <Text style={styles.fullHistoryTitle}>سجل مصاريف المكتب</Text>
            <Text style={styles.fullHistoryText}>عرض كل المصاريف وإضافة مصروف جديد.</Text>
          </View>
          <View style={styles.fullHistoryIcon}>
            <MaterialIcons name="receipt-long" size={19} color="#B54708" />
          </View>
          <MaterialIcons name="arrow-back" size={19} color="#B54708" />
        </MotionPressable>
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
    flexDirection: "row-reverse",
    gap: 8,
  },
  period: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#B9D6ED",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
  },
  periodPressed: { opacity: 0.72 },
  active: { backgroundColor: BLUE, borderColor: BLUE },
  periodText: { color: "#5C7C90", fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" },
  activeText: { color: "#FFF" },
  expenseHistoryButton: {
    alignItems: "center",
    backgroundColor: "#FFF8F1",
    borderColor: "#F6C99E",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 10,
    minHeight: 64,
    paddingHorizontal: 13,
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
