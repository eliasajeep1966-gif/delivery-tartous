import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { MotionPressable } from "@/components/ui/motion-pressable";
import { useAppToast } from "@/contexts/app-toast-context";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import {
  nativeAdminFinanceContract,
  type NativeCaptainWagePeriodRow,
  type NativeFinancePeriod,
} from "@/features/admin/use-admin-finance";
import {
  useNativeAdminWagePeriods,
  useNativeCaptainWageDetails,
} from "@/features/admin/use-admin-finance";

const BLUE = "#0060B8";
const money = (value: number) =>
  `${new Intl.NumberFormat("en-US").format(value)} ل.س`;

function periodLabel(
  period: NativeFinancePeriod,
  row: NativeCaptainWagePeriodRow,
) {
  const start = new Date(`${row.period_start}T12:00:00Z`);
  const end = new Date(`${row.period_end}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (period === "daily") return formatter.format(start);
  if (period === "weekly")
    return `من ${formatter.format(start)} إلى ${formatter.format(end)}`;
  return new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    month: "long",
    year: "numeric",
  }).format(start);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminWages() {
  const { profile } = useDeliveryAuth();
  const { showToast } = useAppToast();
  const router = useRouter();
  const isBackOffice =
    profile?.role === "admin" || profile?.role === "supervisor";
  const wagePeriods = useNativeAdminWagePeriods();
  const [selectedPeriodStart, setSelectedPeriodStart] = useState("");
  const [selectedCaptainId, setSelectedCaptainId] = useState<string | null>(
    null,
  );
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>(
    {},
  );
  const [payingCaptainId, setPayingCaptainId] = useState<string | null>(null);
  const details = useNativeCaptainWageDetails(selectedCaptainId);

  const periodRows = useMemo(() => wagePeriods.data ?? [], [wagePeriods.data]);
  const options = useMemo(() => {
    const seen = new Set<string>();
    return periodRows.filter((row) => {
      if (seen.has(row.period_start)) return false;
      seen.add(row.period_start);
      return true;
    });
  }, [periodRows]);
  const selectedKey = options.some(
    (row) => row.period_start === selectedPeriodStart,
  )
    ? selectedPeriodStart
    : (options[0]?.period_start ?? "");
  const selectedRows = periodRows.filter(
    (row) => row.period_start === selectedKey,
  );
  const selectedLabel = selectedRows[0]
    ? periodLabel(wagePeriods.period, selectedRows[0])
    : "الفترة المختارة";
  const totals = selectedRows.reduce(
    (sum, row) => ({
      gross: sum.gross + row.gross_total,
      captain: sum.captain + row.captain_net_total,
      paid: sum.paid + row.paid_total,
      unpaid: sum.unpaid + row.unpaid_total,
      orders: sum.orders + row.order_count,
    }),
    { gross: 0, captain: 0, paid: 0, unpaid: 0, orders: 0 },
  );
  const selectedCaptain =
    selectedRows.find((row) => row.captain_id === selectedCaptainId) ?? null;

  if (!isBackOffice) {
    return (
      <ScreenContainer className="p-5">
        <View style={styles.roleNotice}>
          <Text style={styles.roleNoticeTitle}>لا تملك صلاحية لوحة العمل</Text>
          <Text style={styles.roleNoticeText}>
            واجهة الأجور الإدارية مخصصة للأدمن والمشرف فقط.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const registerPayout = async (captain: NativeCaptainWagePeriodRow) => {
    const amount = Number(paymentInputs[captain.captain_id] ?? "");
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("بيانات الدفعة", "أدخل مبلغ دفعة موجباً.");
      return;
    }
    if (amount > captain.unpaid_total) {
      Alert.alert("بيانات الدفعة", "قيمة الدفعة أكبر من صافي الأجر المتبقي.");
      return;
    }
    setPayingCaptainId(captain.captain_id);
    try {
      await nativeAdminFinanceContract.actions.recordPartialPayout(
        captain.captain_id,
        amount,
      );
      setPaymentInputs((current) => ({ ...current, [captain.captain_id]: "" }));
      showToast({ message: `تم تسجيل دفعة بقيمة ${money(amount)}.` });
      await wagePeriods.refetch();
    } catch (cause) {
      Alert.alert(
        "تعذر تسجيل الدفعة",
        cause instanceof Error ? cause.message : "تعذر تسجيل دفعة الكابتن.",
      );
    } finally {
      setPayingCaptainId(null);
    }
  };

  return (
    <ScreenContainer className="bg-[#F4F7FB]" containerClassName="bg-[#F4F7FB]">
      <View style={styles.header}>
        <MotionPressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)");
            }
          }}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-forward" size={21} color="#0878D1" />
        </MotionPressable>
        <View style={styles.headerText}>
          <Text style={styles.headerEyebrow}>متابعة الأجور والدفعات</Text>
          <Text style={styles.headerTitle}>أجور الكباتن</Text>
        </View>
        <View style={styles.headerIcon}>
          <MaterialIcons
            name="account-balance-wallet"
            size={21}
            color="#0878D1"
          />
        </View>
      </View>
      <View style={styles.neonDivider} />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={wagePeriods.isRefetching}
            onRefresh={() => void wagePeriods.refetch()}
            tintColor={BLUE}
          />
        }
        contentContainerStyle={styles.content}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="two-wheeler" size={24} color={BLUE} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroKicker}>ملخص مالي مباشر</Text>
            <Text style={styles.heroTitle}>سجل أجور الكباتن</Text>
            <Text style={styles.heroSubtitle}>
              كل كابتن لديه سجل مستقل مع الأجور والمدفوع والمتبقي.
            </Text>
          </View>
        </View>
        <View style={styles.periods}>
          {(["daily", "weekly", "monthly"] as const).map((value) => (
            <MotionPressable
              key={value}
              onPress={() => wagePeriods.changePeriod(value)}
              style={[
                styles.period,
                wagePeriods.period === value && styles.periodActive,
              ]}
            >
              <Text
                style={[
                  styles.periodText,
                  wagePeriods.period === value && styles.periodTextActive,
                ]}
              >
                {value === "daily"
                  ? "يومي"
                  : value === "weekly"
                    ? "أسبوعي"
                    : "شهري"}
              </Text>
            </MotionPressable>
          ))}
        </View>
        {options.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateOptions}
          >
            {options.map((row) => (
              <MotionPressable
                key={row.period_start}
                onPress={() => setSelectedPeriodStart(row.period_start)}
                style={[
                  styles.dateChip,
                  selectedKey === row.period_start && styles.dateChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.dateChipText,
                    selectedKey === row.period_start &&
                      styles.dateChipTextActive,
                  ]}
                >
                  {periodLabel(wagePeriods.period, row)}
                </Text>
              </MotionPressable>
            ))}
          </ScrollView>
        ) : null}
        {wagePeriods.isPending ? <Message text="جارٍ تحميل الأجور..." /> : null}
        {wagePeriods.error ? (
          <Message
            text={
              wagePeriods.error instanceof Error
                ? wagePeriods.error.message
                : "تعذر تحميل بيانات الأجور."
            }
          />
        ) : null}
        <View style={styles.metrics}>
          <Metric
            label="صافي الكباتن"
            value={money(totals.captain)}
            color="#047857"
          />
          <Metric
            label="دفعات مسلّمة"
            value={money(totals.paid)}
            color="#B45309"
          />
          <Metric
            label="المتبقي للكباتن"
            value={money(totals.unpaid)}
            color="#B91C1C"
          />
          <Metric
            label="طلبات الفترة"
            value={String(totals.orders)}
            color={BLUE}
          />
        </View>
        <MotionPressable
          onPress={() => router.push("/company-wages" as never)}
          style={styles.companyCard}
        >
          <View style={styles.companyIcon}>
            <MaterialIcons name="store" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.companyTextBlock}>
            <Text style={styles.companyTitle}>واجهة أجور الشركة</Text>
            <Text style={styles.companySubtitle}>
              كشف كامل بالتاريخ، الأجور الكلية، وصافي الربح
            </Text>
          </View>
          <MaterialIcons name="arrow-back" size={21} color={BLUE} />
        </MotionPressable>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>
            سجلات الكباتن — {selectedLabel}
          </Text>
          <Text style={styles.countBadge}>{selectedRows.length} كباتن</Text>
        </View>
        {selectedRows.length === 0 && !wagePeriods.isPending ? (
          <Message text={`لا توجد أجور مسجلة ضمن ${selectedLabel}.`} />
        ) : null}
        {selectedRows.map((captain) => (
          <View key={captain.captain_id} style={styles.captainCard}>
            <MotionPressable
              onPress={() =>
                router.push({
                  pathname: "/captain-wage-detail" as never,
                  params: { captainId: captain.captain_id },
                } as never)
              }
              style={styles.captainHeader}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {captain.captain_name.trim().slice(0, 1) || "ك"}
                </Text>
              </View>
              <View style={styles.captainIdentity}>
                <Text style={styles.captainName}>{captain.captain_name}</Text>
                <Text style={styles.muted}>
                  {captain.order_count} طلبات في هذه الفترة
                </Text>
              </View>
              <MaterialIcons name="chevron-left" size={22} color="#75818E" />
            </MotionPressable>
            <View style={styles.amountGrid}>
              <Amount label="مجموع الأجور" value={captain.gross_total} />
              <Amount
                label="صافي الكابتن (70%)"
                value={captain.captain_net_total}
                color="#047857"
              />
              <Amount
                label="حصة الشركة (30%)"
                value={captain.gross_total - captain.captain_net_total}
                color={BLUE}
              />
              <Amount
                label="المدفوع"
                value={captain.paid_total}
                color="#B45309"
              />
              <Amount
                label="المتبقي"
                value={captain.unpaid_total}
                color={captain.unpaid_total > 0 ? "#B91C1C" : "#047857"}
              />
            </View>
            <View style={styles.paymentRow}>
              <TextInput
                value={paymentInputs[captain.captain_id] ?? ""}
                onChangeText={(value) =>
                  setPaymentInputs((current) => ({
                    ...current,
                    [captain.captain_id]: value,
                  }))
                }
                placeholder="مبلغ الدفعة"
                placeholderTextColor="#8A98A6"
                keyboardType="decimal-pad"
                editable={
                  captain.unpaid_total > 0 &&
                  payingCaptainId !== captain.captain_id
                }
                style={styles.paymentInput}
                textAlign="right"
              />
              <MotionPressable
                disabled={
                  captain.unpaid_total <= 0 ||
                  payingCaptainId === captain.captain_id
                }
                onPress={() => void registerPayout(captain)}
                style={[
                  styles.paymentButton,
                  (captain.unpaid_total <= 0 ||
                    payingCaptainId === captain.captain_id) &&
                    styles.disabled,
                ]}
              >
                <Text style={styles.paymentButtonText}>
                  {payingCaptainId === captain.captain_id
                    ? "جارٍ التسجيل..."
                    : "تسليم دفعة"}
                </Text>
              </MotionPressable>
            </View>
          </View>
        ))}
        {wagePeriods.hasMore ? (
          <MotionPressable
            onPress={wagePeriods.loadMore}
            disabled={wagePeriods.isFetching}
            style={styles.loadMore}
          >
            <Text style={styles.loadMoreText}>تحميل فترات أقدم</Text>
          </MotionPressable>
        ) : null}
      </ScrollView>
      <WageDetails
        captain={selectedCaptain}
        details={details.data ?? []}
        loading={details.isPending}
        onClose={() => setSelectedCaptainId(null)}
      />
    </ScreenContainer>
  );
}

function WageDetails({
  captain,
  details,
  loading,
  onClose,
}: {
  captain: NativeCaptainWagePeriodRow | null;
  details: {
    order_number: number;
    completed_at: string;
    captain_amount: number;
    company_amount: number;
    unpaid_amount: number;
    is_fully_paid: boolean;
  }[];
  loading: boolean;
  onClose: () => void;
}) {
  if (!captain) return null;
  return (
    <View style={styles.detailPanel}>
      <View style={styles.detailHeading}>
        <Text style={styles.sectionTitle}>كشف {captain.captain_name}</Text>
        <MotionPressable onPress={onClose}>
          <MaterialIcons name="close" size={20} color="#52616B" />
        </MotionPressable>
      </View>
      {loading ? (
        <Text style={styles.muted}>جارٍ تحميل تفاصيل الطلبات...</Text>
      ) : (
        details.map((row) => (
          <View
            key={`${row.order_number}-${row.completed_at}`}
            style={styles.detailRow}
          >
            <View>
              <Text style={styles.captainName}>طلب #{row.order_number}</Text>
              <Text style={styles.muted}>{dateLabel(row.completed_at)}</Text>
            </View>
            <View style={styles.left}>
              <Text style={styles.amountText}>
                {money(row.captain_amount)} (70%)
              </Text>
              <Text style={styles.companyText}>
                الشركة: {money(row.company_amount)}
              </Text>
              <Text style={row.is_fully_paid ? styles.paid : styles.unpaid}>
                {row.is_fully_paid
                  ? "تم تسليم الأجر"
                  : `متبقي ${money(row.unpaid_amount)}`}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}
function Amount({
  label,
  value,
  color = "#1C1B1B",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <View style={styles.amountCell}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={[styles.amountText, { color }]}>{money(value)}</Text>
    </View>
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
    backgroundColor: "#F4F7FB",
    flexDirection: "row-reverse",
    height: 62,
    justifyContent: "space-between",
    paddingHorizontal: 15,
  },
  neonDivider: {
    backgroundColor: "#15C8FF",
    height: 2,
    shadowColor: "#15C8FF",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.55,
    shadowRadius: 4,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D9EBF8",
    borderRadius: 14,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  headerText: { alignItems: "flex-end", flex: 1, marginHorizontal: 12 },
  headerEyebrow: { color: "#6F8A9D", fontFamily: "Cairo_600SemiBold", fontSize: 9, writingDirection: "rtl" },
  headerTitle: {
    color: "#07488D",
    fontFamily: "Cairo_700Bold",
    fontSize: 17,
    lineHeight: 23,
    writingDirection: "rtl",
  },
  headerIcon: {
    alignItems: "center",
    backgroundColor: "#E9F7FF",
    borderColor: "#B7E9FF",
    borderRadius: 13,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  content: { gap: 11, padding: 14, paddingBottom: 34 },
  heroCard: {
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderColor: "#DCECF7",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row-reverse",
    padding: 15,
    shadowColor: "#0C679D",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "#EAF8FF",
    borderColor: "#B8E9FF",
    borderRadius: 15,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    marginLeft: 11,
    width: 42,
  },
  heroText: { flex: 1 },
  heroKicker: { color: "#0878D1", fontFamily: "Cairo_700Bold", fontSize: 9, textAlign: "right", writingDirection: "rtl" },
  heroTitle: {
    color: "#073D70",
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  heroSubtitle: {
    color: "#688499",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    lineHeight: 17,
    marginTop: 3,
    textAlign: "right",
    writingDirection: "rtl",
  },
  periods: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DCEBF5",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 5,
    padding: 5,
  },
  period: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    minHeight: 38,
  },
  periodActive: { backgroundColor: "#0878D1", shadowColor: "#0878D1", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  periodText: { color: "#668498", fontFamily: "Cairo_700Bold", fontSize: 10 },
  periodTextActive: { color: "#FFFFFF" },
  dateOptions: { flexDirection: "row-reverse", gap: 8 },
  dateChip: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DCEAF3",
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateChipActive: { backgroundColor: "#EAF8FF", borderColor: "#0878D1" },
  dateChipText: { color: "#5E7B8E", fontFamily: "Cairo_700Bold", fontSize: 9 },
  dateChipTextActive: { color: "#0878D1" },
  metrics: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 9 },
  metric: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DDEAF2",
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 74,
    padding: 11,
    width: "48.5%",
  },
  metricValue: {
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    textAlign: "right",
    writingDirection: "rtl",
  },
  muted: {
    color: "#70899A",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    textAlign: "right",
    writingDirection: "rtl",
  },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sectionTitle: {
    color: "#073D70",
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    textAlign: "right",
    writingDirection: "rtl",
  },
  countBadge: {
    backgroundColor: "#EAF8FF",
    borderColor: "#B8E9FF",
    borderRadius: 13,
    borderWidth: 1,
    color: "#0878D1",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  captainCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DDEAF2",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  captainHeader: {
    alignItems: "center",
    backgroundColor: "#F9FCFF",
    borderBottomColor: "#E1EDF4",
    borderBottomWidth: 1,
    flexDirection: "row-reverse",
    padding: 13,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "#EAF8FF",
    borderColor: "#B8E9FF",
    borderRadius: 19,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  avatarText: { color: "#0878D1", fontFamily: "Cairo_700Bold", fontSize: 13 },
  captainIdentity: { flex: 1, marginHorizontal: 10 },
  captainName: {
    color: "#073D70",
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
  },
  amountGrid: { flexDirection: "row-reverse", flexWrap: "wrap" },
  amountCell: {
    borderBottomColor: "#E8F0F5",
    borderBottomWidth: 1,
    padding: 10,
    width: "33.33%",
  },
  amountText: {
    color: "#173D59",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    marginTop: 3,
    textAlign: "right",
    writingDirection: "rtl",
  },
  companyText: {
    color: BLUE,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 3,
    textAlign: "right",
    writingDirection: "rtl",
  },
  paymentRow: {
    alignItems: "center",
    backgroundColor: "#F9FCFF",
    flexDirection: "row-reverse",
    gap: 8,
    padding: 11,
  },
  paymentInput: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D5E5F0",
    borderRadius: 12,
    borderWidth: 1,
    color: "#173D59",
    flex: 1,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 11,
    height: 42,
    paddingHorizontal: 10,
  },
  paymentButton: {
    alignItems: "center",
    backgroundColor: "#0878D1",
    borderColor: "#64DFFF",
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    paddingHorizontal: 13,
  },
  paymentButtonText: {
    color: "#FFFFFF",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    writingDirection: "rtl",
  },
  disabled: { opacity: 0.5 },
  loadMore: {
    alignItems: "center",
    borderColor: "#B9D6ED",
    borderRadius: 11,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
  },
  loadMoreText: { color: BLUE, fontSize: 12, fontWeight: "800" },
  companyCard: {
    alignItems: "center",
    backgroundColor: "#EDF9FF",
    borderColor: "#A7E7FF",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row-reverse",
    minHeight: 66,
    paddingHorizontal: 13,
    shadowColor: "#0878D1",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 9,
  },
  companyIcon: {
    alignItems: "center",
    backgroundColor: BLUE,
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  companyTextBlock: { flex: 1, marginHorizontal: 11 },
  companyTitle: {
    color: "#075B9F",
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
  },
  companySubtitle: {
    color: "#52748D",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  detailPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: "#A8C8FF",
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  detailHeading: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  detailRow: {
    borderTopColor: "#E7EEF4",
    borderTopWidth: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingTop: 10,
  },
  left: { alignItems: "flex-end" },
  paid: {
    color: "#047857",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 3,
    textAlign: "right",
    writingDirection: "rtl",
  },
  unpaid: {
    color: "#B91C1C",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 3,
    textAlign: "right",
    writingDirection: "rtl",
  },
  message: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderColor: "#C7DAE8",
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 86,
    padding: 16,
  },
  messageText: {
    color: "#58616B",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    writingDirection: "rtl",
  },
  roleNotice: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D8E5F1",
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
  },
  roleNoticeTitle: {
    color: "#17364D",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
    writingDirection: "rtl",
  },
  roleNoticeText: {
    color: "#52616B",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
