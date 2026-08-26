import { useLocalSearchParams, useRouter } from "expo-router";
import { goBackOrReplace } from "@/lib/navigation/go-back-or-replace";
import { useState } from "react";
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
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { FinancialDatePicker } from "@/components/ui/financial-date-picker";
import { useAppToast } from "@/contexts/app-toast-context";
import {
  nativeAdminFinanceContract,
  useNativeAdminCaptainWageDetailPage,
} from "@/features/admin/use-admin-finance";

const BLUE = "#0878D1";
const DEEP_BLUE = "#063B78";
const NEON = "#16CEFF";
const PAGE_SIZE = 10;
const money = (value: number) =>
  `${new Intl.NumberFormat("en-US").format(value)} ل.س`;
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("ar-SY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Damascus",
  }).format(new Date(value));
const customDateLabel = (value: string) =>
  new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Damascus",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
const damascusDateKey = (value: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Damascus",
    year: "numeric",
  }).formatToParts(value);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
};

export function AdminCaptainWageDetail() {
  const router = useRouter();
  const { showToast } = useAppToast();
  const { captainId, captainName: captainNameParam } = useLocalSearchParams<{
    captainId: string;
    captainName?: string;
  }>();
  const details = useNativeAdminCaptainWageDetailPage(captainId ?? null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const captainName =
    typeof captainNameParam === "string" && captainNameParam.trim()
      ? captainNameParam
      : "الكابتن";
  const firstRowNumber = details.total ? details.page * PAGE_SIZE + 1 : 0;
  const lastRowNumber = Math.min(
    (details.page + 1) * PAGE_SIZE,
    details.total,
  );

  const payout = async () => {
    const value = Number(amount);
    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      value > details.totals.unpaid
    ) {
      Alert.alert("بيانات الدفعة", "أدخل مبلغاً موجباً ضمن صافي أجر الكابتن.");
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
      showToast({ message: `تم تسجيل دفعة بقيمة ${money(value)}.` });
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
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "العودة إلى أجور الكباتن",
          icon: "arrow-forward",
          onPress: () => goBackOrReplace(router, "/(tabs)/wages"),
        }}
        trailingAction={{
          accessibilityLabel: "كشف حساب الكابتن",
          icon: "account-balance-wallet",
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void details.refetch()}
            refreshing={details.isRefetching}
            tintColor={BLUE}
          />
        }
      >
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{captainName.slice(0, 1)}</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.name}>{captainName}</Text>
            <Text style={styles.muted}>{details.total} طلبات في السجل</Text>
          </View>
          <Text style={styles.live}>كشف حي</Text>
        </View>

        <View style={styles.summary}>
          {[
            ["إجمالي الأجور", details.totals.gross, "#1C1B1B"],
            ["صافي الكابتن (70%)", details.totals.captain, "#047857"],
            ["حصة الشركة (30%)", details.totals.company, BLUE],
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
          {(["daily", "weekly", "monthly", "annual", "custom"] as const).map(
            (value) => (
              <Pressable
                key={value}
                onPress={() => {
                  details.selectFilter(value);
                  if (value === "custom") setIsDatePickerOpen(true);
                }}
                style={[
                  styles.period,
                  details.filter === value && styles.periodActive,
                ]}
              >
                <Text
                  style={[
                    styles.periodText,
                    details.filter === value && styles.periodTextActive,
                  ]}
                >
                  {value === "daily"
                    ? "يومي"
                    : value === "weekly"
                      ? "أسبوعي"
                      : value === "monthly"
                        ? "شهري"
                        : value === "annual"
                          ? "سنوي"
                          : "تاريخ"}
                </Text>
              </Pressable>
            ),
          )}
        </View>

        <Pressable
          onPress={() => setIsDatePickerOpen(true)}
          style={styles.dateControl}
        >
          <View>
            <Text style={styles.dateControlKicker}>التاريخ المعروض</Text>
            <Text style={styles.dateControlValue}>
              {details.filter === "custom"
                ? customDateLabel(details.customDate)
                : "اختر تاريخاً مخصصاً"}
            </Text>
          </View>
          <View style={styles.dateIcon}>
            <Text style={styles.dateIconText}>تاريخ</Text>
          </View>
        </Pressable>

        <View style={styles.heading}>
          <Text style={styles.sectionTitle}>سجل الطلبات</Text>
          <Text style={styles.badge}>
            عرض {firstRowNumber}–{lastRowNumber} من {details.total}
          </Text>
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
        ) : details.rows.length ? (
          details.rows.map((row) => (
            <View key={row.financial_ledger_id} style={styles.order}>
              <View style={styles.orderTop}>
                <View>
                  <Text style={styles.name}>طلب #{row.order_number}</Text>
                  <Text style={styles.muted}>{dateLabel(row.completed_at)}</Text>
                </View>
                <View style={styles.alignEnd}>
                  <Text style={styles.amount}>
                    {money(row.captain_amount)} (70%)
                  </Text>
                  <Text style={styles.company}>
                    الشركة: {money(row.company_amount)}
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <Message text="لا توجد أجور ضمن الفترة المحددة." />
        )}

        {details.pageCount > 1 ? (
          <View style={styles.pagination}>
            <Pressable
              disabled={!details.hasPreviousPage}
              onPress={details.previousPage}
              style={[
                styles.paginationButton,
                !details.hasPreviousPage && styles.disabled,
              ]}
            >
              <Text style={styles.paginationButtonText}>السابق</Text>
            </Pressable>
            <Text style={styles.paginationLabel}>
              صفحة {details.page + 1} من {details.pageCount}
            </Text>
            <Pressable
              disabled={!details.hasNextPage}
              onPress={details.nextPage}
              style={[
                styles.paginationButton,
                !details.hasNextPage && styles.disabled,
              ]}
            >
              <Text style={styles.paginationButtonText}>التالي</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.payout}>
          <Text style={styles.sectionTitle}>تسليم دفعة للكابتن</Text>
          <View style={styles.payoutRow}>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setAmount}
              placeholder="مبلغ الدفعة"
              placeholderTextColor="#8A98A6"
              style={styles.input}
              textAlign="right"
              value={amount}
            />
            <Pressable
              disabled={saving || details.totals.unpaid <= 0}
              onPress={() => void payout()}
              style={[
                styles.button,
                (saving || details.totals.unpaid <= 0) && styles.disabled,
              ]}
            >
              <Text style={styles.buttonText}>
                {saving ? "جارٍ التسجيل..." : "تسليم الدفعة"}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {isDatePickerOpen ? (
        <FinancialDatePicker
          onClose={() => setIsDatePickerOpen(false)}
          onSelect={(nextDate) => {
            details.selectCustomDate(damascusDateKey(nextDate));
            setIsDatePickerOpen(false);
          }}
          value={new Date(`${details.customDate}T12:00:00Z`)}
          visible
        />
      ) : null}
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
  alignEnd: { alignItems: "flex-end" },
  amount: {
    color: "#1C1B1B",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    marginTop: 4,
    textAlign: "right",
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "#E5F7FF",
    borderColor: "#BCEBFA",
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  avatarText: { color: DEEP_BLUE, fontFamily: "Cairo_700Bold", fontSize: 17 },
  badge: {
    backgroundColor: "#E6F8FF",
    borderColor: "#BCEBFA",
    borderRadius: 14,
    borderWidth: 1,
    color: DEEP_BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  button: {
    alignItems: "center",
    backgroundColor: BLUE,
    borderColor: NEON,
    borderRadius: 11,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  buttonText: { color: "#FFF", fontFamily: "Cairo_700Bold", fontSize: 11 },
  company: { color: BLUE, fontFamily: "Cairo_700Bold", fontSize: 10, marginTop: 3 },
  content: { gap: 12, padding: 18, paddingBottom: 34 },
  dateControl: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#BCEBFA",
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    minHeight: 62,
    paddingHorizontal: 12,
  },
  dateControlKicker: {
    color: "#7290A1",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    textAlign: "right",
  },
  dateControlValue: {
    color: DEEP_BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
    marginTop: 1,
    textAlign: "right",
  },
  dateIcon: {
    alignItems: "center",
    backgroundColor: "#EAF9FF",
    borderColor: "#BCEBFA",
    borderRadius: 11,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 50,
  },
  dateIconText: { color: BLUE, fontFamily: "Cairo_700Bold", fontSize: 9 },
  disabled: { opacity: 0.5 },
  heading: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  input: {
    backgroundColor: "#FBFEFF",
    borderColor: "#C9D9E7",
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    height: 48,
    paddingHorizontal: 10,
  },
  live: {
    backgroundColor: "#ECFDF5",
    borderRadius: 8,
    color: "#047857",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    padding: 7,
  },
  message: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
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
    fontFamily: "Cairo_600SemiBold",
    fontSize: 12,
    textAlign: "center",
  },
  muted: {
    color: "#66727E",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    marginTop: 3,
    textAlign: "right",
  },
  name: {
    color: "#1C1B1B",
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    textAlign: "right",
  },
  order: {
    backgroundColor: "#FFF",
    borderColor: "#D3E3F0",
    borderRadius: 15,
    borderWidth: 1,
    padding: 13,
  },
  orderTop: { flexDirection: "row-reverse", justifyContent: "space-between" },
  pagination: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: 8,
    justifyContent: "space-between",
  },
  paginationButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#CFEAF5",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 86,
  },
  paginationButtonText: { color: DEEP_BLUE, fontFamily: "Cairo_700Bold", fontSize: 11 },
  paginationLabel: { color: "#58788D", fontFamily: "Cairo_600SemiBold", fontSize: 10 },
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
  period: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D1E7F1",
    borderRadius: 11,
    borderWidth: 1,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: "30%",
    paddingHorizontal: 8,
  },
  periodActive: { backgroundColor: "#E7F8FF", borderColor: NEON },
  periodText: { color: "#55778C", fontFamily: "Cairo_700Bold", fontSize: 10 },
  periodTextActive: { color: DEEP_BLUE },
  periods: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  profile: {
    alignItems: "center",
    backgroundColor: "#FFF",
    borderColor: "#D3E3F0",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row-reverse",
    padding: 14,
  },
  profileText: { flex: 1, marginHorizontal: 10 },
  sectionTitle: {
    color: "#1C1B1B",
    fontFamily: "Cairo_700Bold",
    fontSize: 15,
    textAlign: "right",
  },
  summary: { backgroundColor: "#E1EBF3", flexDirection: "row-reverse", gap: 1 },
  summaryCell: { backgroundColor: "#FFF", flex: 1, padding: 11 },
});
