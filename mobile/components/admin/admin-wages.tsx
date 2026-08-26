import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  type LayoutChangeEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

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

const BLUE = "#0878D1";
const FILTER_OPTIONS = [
  { id: "daily", label: "اليوم" },
  { id: "weekly", label: "أسبوعي" },
  { id: "monthly", label: "شهري" },
  { id: "custom", label: "تاريخ مخصص" },
] as const;

type WageDashboardFilter = (typeof FILTER_OPTIONS)[number]["id"];

const money = (value: number) =>
  `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)} ل.س`;

function damascusDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Damascus",
    year: "numeric",
  }).formatToParts(value);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function customDateLabel(value: Date) {
  return new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Damascus",
    year: "numeric",
  }).format(value);
}

function nextDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1, 12))
    .toISOString()
    .slice(0, 10);
}

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
  if (period === "weekly") {
    return `من ${formatter.format(start)} إلى ${formatter.format(end)}`;
  }
  if (period === "annual") {
    return new Intl.DateTimeFormat("ar-SY", {
      timeZone: "Asia/Damascus",
      year: "numeric",
    }).format(start);
  }
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
  const [dashboardFilter, setDashboardFilter] =
    useState<WageDashboardFilter>("daily");
  const [selectedPeriodStart, setSelectedPeriodStart] = useState("");
  const [customDate, setCustomDate] = useState(() => new Date());
  const [isCustomDateMenuOpen, setIsCustomDateMenuOpen] = useState(false);
  const [filterTrackWidth, setFilterTrackWidth] = useState(0);
  const [selectedCaptainId, setSelectedCaptainId] = useState<string | null>(
    null,
  );
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>(
    {},
  );
  const [payingCaptainId, setPayingCaptainId] = useState<string | null>(null);
  const details = useNativeCaptainWageDetails(selectedCaptainId);
  const filterOffset = useSharedValue(0);
  const dataOpacity = useSharedValue(1);
  const profitScale = useSharedValue(1.1);
  const profitTranslateY = useSharedValue(-14);
  const customDateKey = damascusDateKey(customDate);
  const customDateRows = useQuery({
    enabled: dashboardFilter === "custom",
    queryKey: ["admin-wage-periods", "custom-date", customDateKey],
    queryFn: async () => {
      const rows =
        await nativeAdminFinanceContract.reads.captainWagePeriodSummary({
          beforeCaptainId: "00000000-0000-0000-0000-000000000000",
          beforePeriodStart: nextDateKey(customDateKey),
          limit: 100,
          period: "daily",
        });
      return rows.filter((row) => row.period_start === customDateKey);
    },
    retry: 1,
    staleTime: 20_000,
  });

  const periodRows = useMemo(() => wagePeriods.data ?? [], [wagePeriods.data]);
  const activeRows = useMemo(
    () =>
      dashboardFilter === "custom" ? (customDateRows.data ?? []) : periodRows,
    [customDateRows.data, dashboardFilter, periodRows],
  );
  const options = useMemo(() => {
    const seen = new Set<string>();
    return activeRows.filter((row) => {
      if (seen.has(row.period_start)) return false;
      seen.add(row.period_start);
      return true;
    });
  }, [activeRows]);
  const availableCustomDates = useMemo(() => {
    const seen = new Set<string>();
    return periodRows.filter((row) => {
      if (seen.has(row.period_start)) return false;
      seen.add(row.period_start);
      return true;
    });
  }, [periodRows]);
  const selectedKey =
    dashboardFilter === "custom"
      ? customDateKey
      : options.some((row) => row.period_start === selectedPeriodStart)
        ? selectedPeriodStart
        : (options[0]?.period_start ?? "");
  const selectedRows =
    dashboardFilter === "custom"
      ? activeRows
      : activeRows.filter((row) => row.period_start === selectedKey);
  const activePeriod: NativeFinancePeriod =
    dashboardFilter === "custom" ? "daily" : dashboardFilter;
  const selectedLabel =
    dashboardFilter === "custom"
      ? customDateLabel(customDate)
      : selectedRows[0]
        ? periodLabel(activePeriod, selectedRows[0])
        : "الفترة المختارة";
  const totals = selectedRows.reduce(
    (sum, row) => ({
      captain: sum.captain + row.captain_net_total,
      company: sum.company + row.settlement_total,
      gross: sum.gross + row.gross_total,
      orders: sum.orders + row.order_count,
      paid: sum.paid + row.paid_total,
      unpaid: sum.unpaid + row.unpaid_total,
    }),
    { captain: 0, company: 0, gross: 0, orders: 0, paid: 0, unpaid: 0 },
  );
  const isPeriodPending =
    dashboardFilter === "custom"
      ? customDateRows.isPending
      : wagePeriods.isPending;
  const periodError =
    dashboardFilter === "custom" ? customDateRows.error : wagePeriods.error;
  const profitTitle =
    dashboardFilter === "daily"
      ? "أرباح الشركة اليوم"
      : dashboardFilter === "weekly"
        ? "أرباح الشركة هذا الأسبوع"
        : dashboardFilter === "monthly"
          ? "أرباح الشركة هذا الشهر"
          : `أرباح الشركة في ${customDateLabel(customDate)}`;
  const filterAnimatedStyle = useAnimatedStyle(() => ({
    opacity: filterTrackWidth ? 1 : 0,
    transform: [{ translateX: filterOffset.value }],
    width: filterTrackWidth / FILTER_OPTIONS.length,
  }));
  const dataAnimatedStyle = useAnimatedStyle(() => ({
    opacity: dataOpacity.value,
  }));
  const profitAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: profitScale.value },
      { translateY: profitTranslateY.value },
    ],
  }));

  useEffect(() => {
    profitScale.set(
      withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }),
    );
    profitTranslateY.set(
      withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) }),
    );
  }, [profitScale, profitTranslateY]);

  useEffect(() => {
    const index = FILTER_OPTIONS.findIndex(
      (option) => option.id === dashboardFilter,
    );
    filterOffset.set(
      withTiming(
        -(filterTrackWidth / FILTER_OPTIONS.length) * Math.max(index, 0),
        { duration: 180, easing: Easing.out(Easing.cubic) },
      ),
    );
  }, [dashboardFilter, filterOffset, filterTrackWidth]);

  useEffect(() => {
    if (!isPeriodPending) {
      dataOpacity.set(
        withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }),
      );
    }
  }, [dataOpacity, isPeriodPending, selectedKey]);

  const chooseFilter = useCallback(
    (next: WageDashboardFilter) => {
      dataOpacity.set(
        withTiming(0.42, { duration: 90, easing: Easing.out(Easing.cubic) }),
      );
      setDashboardFilter(next);
      setSelectedPeriodStart("");
      if (next === "custom") {
        setIsCustomDateMenuOpen(true);
        wagePeriods.changePeriod("daily");
        return;
      }
      wagePeriods.changePeriod(next);
    },
    [dataOpacity, wagePeriods],
  );

  const selectCustomDate = useCallback(
    (dateKey: string) => {
      dataOpacity.set(
        withTiming(0.42, { duration: 90, easing: Easing.out(Easing.cubic) }),
      );
      setCustomDate(new Date(`${dateKey}T12:00:00Z`));
      setIsCustomDateMenuOpen(false);
    },
    [dataOpacity],
  );

  const handleFilterTrackLayout = useCallback((event: LayoutChangeEvent) => {
    setFilterTrackWidth(event.nativeEvent.layout.width - 10);
  }, []);

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
      if (dashboardFilter === "custom") {
        await customDateRows.refetch();
      } else {
        await wagePeriods.refetch();
      }
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
            refreshing={
              dashboardFilter === "custom"
                ? customDateRows.isRefetching
                : wagePeriods.isRefetching
            }
            onRefresh={() => {
              if (dashboardFilter === "custom") {
                void customDateRows.refetch();
              } else {
                void wagePeriods.refetch();
              }
            }}
            tintColor={BLUE}
          />
        }
        contentContainerStyle={styles.content}
      >
        <Animated.View style={[styles.profitHero, profitAnimatedStyle]}>
          <View style={styles.profitHeading}>
            <Text style={styles.profitKicker}>ملخص الشركة للفترة المحددة</Text>
            <MaterialIcons
              name="account-balance-wallet"
              size={21}
              color="#16A9E2"
            />
          </View>
          <Text style={styles.profitTitle}>{profitTitle}</Text>
          <Text style={styles.profitAmount}>
            {isPeriodPending ? "—" : money(totals.company)}
          </Text>
          <View style={styles.profitFooter}>
            <Text style={styles.profitPeriod}>{selectedLabel}</Text>
            <Text style={styles.profitOrders}>
              {totals.orders} طلبات في هذه الفترة
            </Text>
          </View>
        </Animated.View>

        <MotionPressable
          accessibilityLabel="فتح واجهة أرباح الشركة"
          onPress={() => router.push("/company-wages" as never)}
          style={({ pressed }) => [
            styles.companyCard,
            pressed && styles.companyCardPressed,
          ]}
        >
          <View style={styles.companyIcon}>
            <MaterialIcons name="storefront" size={21} color="#FFFFFF" />
          </View>
          <View style={styles.companyTextBlock}>
            <Text style={styles.companyTitle}>واجهة أرباح الشركة</Text>
            <Text style={styles.companySubtitle}>
              استعرض حصة الشركة وسجل الأرباح حسب الفترة
            </Text>
          </View>
          <View style={styles.companyAction}>
            <Text style={styles.companyActionText}>فتح</Text>
            <MaterialIcons name="arrow-back" size={16} color="#FFFFFF" />
          </View>
        </MotionPressable>

        <View style={styles.periodHeading}>
          <Text style={styles.periodTitle}>الفترة المحاسبية</Text>
          <Text style={styles.periodHint}>اختر طريقة العرض</Text>
        </View>
        <View style={styles.periods} onLayout={handleFilterTrackLayout}>
          <Animated.View
            pointerEvents="none"
            style={[styles.periodIndicator, filterAnimatedStyle]}
          />
          {FILTER_OPTIONS.map((option) => (
            <View key={option.id} style={styles.periodSlot}>
              <MotionPressable
                onPress={() => chooseFilter(option.id)}
                style={({ pressed }) => [
                  styles.period,
                  pressed && styles.periodPressed,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.periodText,
                    dashboardFilter === option.id && styles.periodTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </MotionPressable>
            </View>
          ))}
        </View>
        {dashboardFilter === "custom" ? (
          <View style={styles.selectedDateCard}>
            <View style={styles.selectedDateCopy}>
              <Text style={styles.selectedDateTitle}>التاريخ المحدد</Text>
              <Text style={styles.selectedDateValue}>
                {customDateLabel(customDate)}
              </Text>
            </View>
            <MotionPressable
              onPress={() => setIsCustomDateMenuOpen((current) => !current)}
              style={({ pressed }) => [
                styles.datePickerButton,
                pressed && styles.smallPressed,
              ]}
            >
              <MaterialIcons name="calendar-month" size={17} color={BLUE} />
              <Text style={styles.datePickerButtonText}>اختيار يوم</Text>
            </MotionPressable>
          </View>
        ) : null}
        {dashboardFilter === "custom" && isCustomDateMenuOpen ? (
          <View style={styles.datePickerPanel}>
            <View style={styles.datePickerHeading}>
              <Text style={styles.datePickerTitle}>اختر من الأيام المسجلة</Text>
              <Text style={styles.datePickerHint}>تُعرض تواريخ الأجور المتاحة فقط</Text>
            </View>
            {availableCustomDates.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.customDateOptions}
              >
                {availableCustomDates.map((row) => (
                  <MotionPressable
                    key={row.period_start}
                    onPress={() => selectCustomDate(row.period_start)}
                    style={({ pressed }) => [
                      styles.customDateChip,
                      row.period_start === customDateKey && styles.customDateChipActive,
                      pressed && styles.smallPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.customDateChipText,
                        row.period_start === customDateKey && styles.customDateChipTextActive,
                      ]}
                    >
                      {periodLabel("daily", row)}
                    </Text>
                  </MotionPressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.customDateEmpty}>
                لا توجد تواريخ أجور متاحة ضمن السجل المحمّل.
              </Text>
            )}
          </View>
        ) : null}
        {dashboardFilter !== "custom" && options.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateOptions}
          >
            {options.map((row) => (
              <MotionPressable
                key={row.period_start}
                onPress={() => {
                  dataOpacity.set(
                    withTiming(0.42, {
                      duration: 90,
                      easing: Easing.out(Easing.cubic),
                    }),
                  );
                  setSelectedPeriodStart(row.period_start);
                }}
                style={({ pressed }) => [
                  styles.dateChip,
                  selectedKey === row.period_start && styles.dateChipActive,
                  pressed && styles.smallPressed,
                ]}
              >
                <Text
                  style={[
                    styles.dateChipText,
                    selectedKey === row.period_start &&
                      styles.dateChipTextActive,
                  ]}
                >
                  {periodLabel(activePeriod, row)}
                </Text>
              </MotionPressable>
            ))}
          </ScrollView>
        ) : null}
        {isPeriodPending ? <Message text="جارٍ تحميل الأجور..." /> : null}
        {periodError ? (
          <Message
            text={
              periodError instanceof Error
                ? periodError.message
                : "تعذر تحميل بيانات الأجور."
            }
          />
        ) : null}
        <Animated.View style={dataAnimatedStyle}>
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
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>
              سجلات الكباتن — {selectedLabel}
            </Text>
            <Text style={styles.countBadge}>{selectedRows.length} كباتن</Text>
          </View>
          {selectedRows.length === 0 && !isPeriodPending ? (
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
                <Amount
                  label="صافي الكابتن"
                  value={captain.captain_net_total}
                  color="#047857"
                />
                <Amount
                  label="المدفوع"
                  value={captain.paid_total}
                  color="#B45309"
                />
                <Amount
                  label={
                    captain.unpaid_total > 0 ? "المتبقي للتسليم" : "تم التسليم"
                  }
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
          {dashboardFilter !== "custom" && wagePeriods.hasMore ? (
            <MotionPressable
              onPress={wagePeriods.loadMore}
              disabled={wagePeriods.isFetching}
              style={styles.loadMore}
            >
              <Text style={styles.loadMoreText}>تحميل فترات أقدم</Text>
            </MotionPressable>
          ) : null}
        </Animated.View>
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
  headerEyebrow: {
    color: "#6F8A9D",
    fontFamily: "Cairo_600SemiBold",
    fontSize: 9,
    writingDirection: "rtl",
  },
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
  content: { gap: 12, padding: 14, paddingBottom: 34 },
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
  heroKicker: {
    color: "#0878D1",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    textAlign: "right",
    writingDirection: "rtl",
  },
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
  periodHeading: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 2,
  },
  periodTitle: {
    color: "#27506B",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    writingDirection: "rtl",
  },
  periodHint: {
    color: "#7A96AA",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    writingDirection: "rtl",
  },
  periods: {
    backgroundColor: "#EAF2F8",
    borderColor: "#DCEBF5",
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row-reverse",
    minHeight: 46,
    overflow: "hidden",
    padding: 5,
    position: "relative",
  },
  periodIndicator: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    bottom: 5,
    position: "absolute",
    right: 5,
    shadowColor: "#4D79A0",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    top: 5,
  },
  periodSlot: { flex: 1, zIndex: 1 },
  period: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 2,
    zIndex: 1,
  },
  periodPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  periodActive: {
    backgroundColor: "#0878D1",
    shadowColor: "#0878D1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  periodText: {
    color: "#668498",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    writingDirection: "rtl",
  },
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
    shadowColor: "#0C679D",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.045,
    shadowRadius: 8,
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
  amountGrid: {
    backgroundColor: "#FFFFFF",
    flexDirection: "row-reverse",
  },
  amountCell: {
    borderLeftColor: "#E8F0F5",
    borderLeftWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 11,
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
    borderTopColor: "#E8F0F5",
    borderTopWidth: 1,
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
    backgroundColor: "#F4FBFF",
    borderColor: "#A8E5FB",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row-reverse",
    minHeight: 78,
    paddingHorizontal: 13,
    shadowColor: "#0878D1",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 9,
  },
  companyCardPressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
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
  companyAction: {
    alignItems: "center",
    backgroundColor: BLUE,
    borderRadius: 11,
    flexDirection: "row-reverse",
    gap: 4,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 9,
  },
  companyActionText: {
    color: "#FFFFFF",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
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
  profitHero: {
    backgroundColor: "#FFFFFF",
    borderColor: "#CDE9F7",
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    padding: 17,
    shadowColor: "#063B78",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 13,
  },
  profitHeading: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  profitKicker: {
    color: "#5F8196",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  profitTitle: {
    color: "#063B78",
    fontFamily: "Cairo_700Bold",
    fontSize: 15,
    marginTop: 9,
    textAlign: "right",
    writingDirection: "rtl",
  },
  profitAmount: {
    color: "#0878D1",
    fontFamily: "Cairo_700Bold",
    fontSize: 29,
    letterSpacing: -0.5,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "ltr",
  },
  profitFooter: {
    alignItems: "center",
    borderTopColor: "#E7F0F5",
    borderTopWidth: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 9,
  },
  profitPeriod: {
    color: "#52748D",
    fontFamily: "Cairo_600SemiBold",
    fontSize: 10,
    writingDirection: "rtl",
  },
  profitOrders: {
    color: "#7593A6",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    writingDirection: "rtl",
  },
  selectedDateCard: {
    alignItems: "center",
    backgroundColor: "#F8FCFF",
    borderColor: "#D5E9F5",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    padding: 11,
  },
  selectedDateCopy: { flex: 1 },
  selectedDateTitle: {
    color: "#67869A",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    textAlign: "right",
    writingDirection: "rtl",
  },
  selectedDateValue: {
    color: "#063B78",
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  datePickerButton: {
    alignItems: "center",
    backgroundColor: "#E7F6FE",
    borderColor: "#B8E6F8",
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 9,
  },
  datePickerButtonText: {
    color: BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    writingDirection: "rtl",
  },
  datePickerPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D5E9F5",
    borderRadius: 17,
    borderWidth: 1,
    overflow: "hidden",
    padding: 10,
  },
  datePickerHeading: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  datePickerTitle: {
    color: "#073D70",
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
    writingDirection: "rtl",
  },
  datePickerHint: {
    color: "#7694A6",
    fontFamily: "Cairo_400Regular",
    fontSize: 8,
    textAlign: "left",
    writingDirection: "rtl",
  },
  customDateOptions: {
    flexDirection: "row-reverse",
    gap: 7,
    paddingTop: 10,
  },
  customDateChip: {
    alignItems: "center",
    backgroundColor: "#F6FBFE",
    borderColor: "#D4E8F3",
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 35,
    paddingHorizontal: 10,
  },
  customDateChipActive: {
    backgroundColor: "#E2F5FF",
    borderColor: "#0878D1",
  },
  customDateChipText: {
    color: "#54758A",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    writingDirection: "rtl",
  },
  customDateChipTextActive: { color: BLUE },
  customDateEmpty: {
    color: "#718DA0",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    lineHeight: 17,
    marginTop: 9,
    textAlign: "right",
    writingDirection: "rtl",
  },
  smallPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
