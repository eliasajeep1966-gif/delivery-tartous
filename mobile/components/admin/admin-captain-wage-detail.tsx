import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import {
  nativeAdminFinanceContract,
  useNativeCaptainWageDetails,
  useNativeAdminWagePeriods,
  type NativeFinancePeriod,
} from "@/features/admin/use-admin-finance";

const BLUE = "#0060B8";
const money = (value: number) =>
  `${new Intl.NumberFormat("en-US").format(value)} ل.س`;
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export function AdminCaptainWageDetail() {
  const router = useRouter();
  const { captainId } = useLocalSearchParams<{ captainId: string }>();
  const details = useNativeCaptainWageDetails(captainId ?? null);
  const periods = useNativeAdminWagePeriods();
  const [period, setPeriod] = useState<NativeFinancePeriod>("daily");
  const [filter, setFilter] = useState<"all" | "remaining" | "paid">("all");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const rows = useMemo(() => details.data ?? [], [details.data]);
  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          filter === "all" ||
          (filter === "paid" ? row.is_fully_paid : !row.is_fully_paid),
      ),
    [filter, rows],
  );
  const summary = periods.data?.find((row) => row.captain_id === captainId);
  const totals = useMemo(
    () => ({
      gross: rows.reduce((sum, row) => sum + row.gross_fee, 0),
      captain: rows.reduce((sum, row) => sum + row.captain_amount, 0),
      company: rows.reduce((sum, row) => sum + row.company_amount, 0),
      unpaid: rows.reduce((sum, row) => sum + row.unpaid_amount, 0),
    }),
    [rows],
  );
  const captainName = summary?.captain_name ?? "الكابتن";

  const payout = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > totals.unpaid) {
      Alert.alert("بيانات الدفعة", "أدخل مبلغاً موجباً لا يتجاوز المتبقي.");
      return;
    }
    setSaving(true);
    try {
      await nativeAdminFinanceContract.actions.recordPartialPayout(
        captainId ?? "",
        value,
      );
      setAmount("");
      await details.refetch();
      await periods.refetch();
      Alert.alert("تم التسجيل", `تم تسجيل دفعة بقيمة ${money(value)}.`);
    } catch (error) {
      Alert.alert(
        "تعذر التسجيل",
        error instanceof Error ? error.message : "تعذر تسجيل الدفعة.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer className="bg-[#F0F7FF]" containerClassName="bg-[#EAF5FF]">
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace("/(tabs)/wages")}
          style={styles.back}
        >
          <MaterialIcons name="arrow-forward" size={22} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>الأجور والدفعات</Text>
          <Text style={styles.headerTitle}>كشف حساب الكابتن</Text>
        </View>
        <View style={styles.headerIcon}>
          <MaterialIcons
            name="account-balance-wallet"
            size={21}
            color="#FFFFFF"
          />
        </View>
      </View>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={details.isRefetching}
            onRefresh={() => void details.refetch()}
            tintColor={BLUE}
          />
        }
        contentContainerStyle={styles.content}
      >
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{captainName.slice(0, 1)}</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.name}>{captainName}</Text>
            <Text style={styles.muted}>
              {summary?.order_count ?? rows.length} طلبات — كشف حي
            </Text>
          </View>
          <Text style={styles.live}>كشف حي</Text>
        </View>
        <View style={styles.summary}>
          {[
            ["إجمالي الأجور", totals.gross, "#1C1B1B"],
            ["صافي الكابتن (70%)", totals.captain, "#047857"],
            ["حصة الشركة (30%)", totals.company, BLUE],
          ].map(([label, value, color]) => (
            <View key={String(label)} style={styles.summaryCell}>
              <Text style={styles.muted}>{String(label)}</Text>
              <Text style={[styles.amount, { color: String(color) }]}>
                {money(Number(value))}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.periods}>
          {(["daily", "weekly", "monthly"] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => {
                setPeriod(value);
                periods.changePeriod(value);
              }}
              style={[styles.period, period === value && styles.periodActive]}
            >
              <Text
                style={[
                  styles.periodText,
                  period === value && styles.periodTextActive,
                ]}
              >
                {value === "daily"
                  ? "يومي"
                  : value === "weekly"
                    ? "أسبوعي"
                    : "شهري"}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.filters}>
          {(
            [
              ["all", "الكل"],
              ["remaining", "المتبقي"],
              ["paid", "تم تسليمه"],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setFilter(id)}
              style={[styles.filter, filter === id && styles.filterActive]}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === id && styles.filterTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.heading}>
          <Text style={styles.sectionTitle}>سجل الطلبات</Text>
          <Text style={styles.badge}>{visibleRows.length} طلبات</Text>
        </View>
        {details.isPending ? (
          <Message text="جارٍ تحميل كشف الحساب..." />
        ) : details.error ? (
          <Message
            text={
              details.error instanceof Error
                ? details.error.message
                : "تعذر تحميل التفاصيل."
            }
          />
        ) : (
          visibleRows.map((row) => (
            <View key={row.financial_ledger_id} style={styles.order}>
              <View style={styles.orderTop}>
                <View>
                  <Text style={styles.name}>طلب #{row.order_number}</Text>
                  <Text style={styles.muted}>
                    {dateLabel(row.completed_at)}
                  </Text>
                </View>
                <View style={styles.alignEnd}>
                  <Text style={styles.amount}>
                    {money(row.captain_amount)} (70%)
                  </Text>
                  <Text style={styles.company}>
                    الشركة: {money(row.company_amount)}
                  </Text>
                  <Text style={row.is_fully_paid ? styles.paid : styles.unpaid}>
                    {row.is_fully_paid
                      ? "تم تسليم الأجر"
                      : `متبقي ${money(row.unpaid_amount)}`}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
        <View style={styles.payout}>
          <Text style={styles.sectionTitle}>تسليم دفعة للكابتن</Text>
          <Text style={styles.muted}>المتبقي: {money(totals.unpaid)}</Text>
          <View style={styles.payoutRow}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="مبلغ الدفعة"
              placeholderTextColor="#8A98A6"
              keyboardType="decimal-pad"
              style={styles.input}
              textAlign="right"
            />
            <Pressable
              disabled={saving || totals.unpaid <= 0}
              onPress={() => void payout()}
              style={[
                styles.button,
                (saving || totals.unpaid <= 0) && styles.disabled,
              ]}
            >
              <Text style={styles.buttonText}>
                {saving ? "جارٍ التسجيل..." : "تسليم الدفعة"}
              </Text>
            </Pressable>
          </View>
        </View>
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
  eyebrow: { color: "#DBEAFF", fontSize: 11 },
  headerTitle: { color: "#FFF", fontSize: 19, fontWeight: "800" },
  headerIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,.15)",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  content: { gap: 12, padding: 18, paddingBottom: 34 },
  profile: {
    alignItems: "center",
    backgroundColor: "#FFF",
    borderColor: "#D3E3F0",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row-reverse",
    padding: 14,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "#E5EDF3",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  avatarText: { color: "#53616F", fontSize: 17, fontWeight: "800" },
  profileText: { flex: 1, marginHorizontal: 10 },
  name: {
    color: "#1C1B1B",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
  },
  muted: { color: "#66727E", fontSize: 10, marginTop: 3, textAlign: "right" },
  live: {
    backgroundColor: "#ECFDF5",
    borderRadius: 8,
    color: "#047857",
    fontSize: 9,
    fontWeight: "800",
    padding: 7,
  },
  summary: { backgroundColor: "#E1EBF3", flexDirection: "row-reverse", gap: 1 },
  summaryCell: { backgroundColor: "#FFF", flex: 1, padding: 11 },
  amount: {
    color: "#1C1B1B",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
    textAlign: "right",
  },
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
  periodActive: { backgroundColor: BLUE },
  periodText: { color: "#5C7C90", fontSize: 11, fontWeight: "700" },
  periodTextActive: { color: "#FFF" },
  filters: {
    backgroundColor: "#FFF",
    borderColor: "#DBE7F2",
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 5,
    padding: 5,
  },
  filter: {
    alignItems: "center",
    borderRadius: 11,
    flex: 1,
    justifyContent: "center",
    minHeight: 38,
  },
  filterActive: { backgroundColor: BLUE },
  filterText: { color: "#5B6A78", fontSize: 10, fontWeight: "700" },
  filterTextActive: { color: "#FFF" },
  heading: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#1C1B1B",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  badge: {
    backgroundColor: "#DBEEFF",
    borderRadius: 14,
    color: BLUE,
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  order: {
    backgroundColor: "#FFF",
    borderColor: "#D3E3F0",
    borderRadius: 15,
    borderWidth: 1,
    padding: 13,
  },
  orderTop: { flexDirection: "row-reverse", justifyContent: "space-between" },
  alignEnd: { alignItems: "flex-end" },
  company: { color: BLUE, fontSize: 10, fontWeight: "700", marginTop: 3 },
  paid: { color: "#047857", fontSize: 10, fontWeight: "800", marginTop: 3 },
  unpaid: { color: "#B91C1C", fontSize: 10, fontWeight: "800", marginTop: 3 },
  payout: {
    backgroundColor: "#FFF",
    borderColor: "#D3E3F0",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  payoutRow: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: 8,
    marginTop: 10,
  },
  input: {
    borderColor: "#C9D9E7",
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    height: 42,
    paddingHorizontal: 10,
  },
  button: {
    alignItems: "center",
    backgroundColor: BLUE,
    borderRadius: 11,
    height: 42,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  buttonText: { color: "#FFF", fontSize: 11, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  message: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
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
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});
