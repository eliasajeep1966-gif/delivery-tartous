import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { goBackOrReplace } from "@/lib/navigation/go-back-or-replace";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Line,
  Path,
  Polyline,
  Text as SvgText,
} from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { MotionPressable } from "@/components/ui/motion-pressable";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import {
  useRefreshOnScreenResume,
  useScreenLiveUpdates,
} from "@/hooks/use-screen-live-updates";
import {
  nativeAdminFinanceContract,
  type NativeCaptainWagePeriodRow,
  type NativeFinancePeriod,
} from "@/features/admin/use-admin-finance";
import {
  useNativeAdminWagePeriods,
  useNativeCaptainWageDetails,
  useNativeCompanyProfitHistory,
  useNativeOfficeExpensePeriods,
} from "@/features/admin/use-admin-finance";

const BLUE = "#0878D1";
const FILTER_OPTIONS = [
  { id: "daily", label: "اليوم", icon: "today" },
  { id: "weekly", label: "أسبوعي", icon: "date-range" },
  { id: "monthly", label: "شهري", icon: "calendar-view-month" },
  { id: "custom", label: "مخصص", icon: "event" },
] as const;

type WageDashboardFilter = (typeof FILTER_OPTIONS)[number]["id"];

type ProductivityPoint = {
  periodStart: string;
  value: number;
};

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

const WEEKDAY_LABELS = ["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];

function nextDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1, 12))
    .toISOString()
    .slice(0, 10);
}

function monthStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1, 12));
}

function shiftMonth(value: Date, amount: number) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + amount, 1, 12),
  );
}

function calendarDays(value: Date) {
  const firstDay = monthStart(value);
  const leadingEmptyDays = firstDay.getUTCDay();
  const dayCount = new Date(
    Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();
  return [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...Array.from(
      { length: dayCount },
      (_, index) =>
        new Date(
          Date.UTC(
            firstDay.getUTCFullYear(),
            firstDay.getUTCMonth(),
            index + 1,
            12,
          ),
        ),
    ),
  ];
}

function calendarMonthLabel(value: Date) {
  return new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
    month: "long",
    timeZone: "Asia/Damascus",
    year: "numeric",
  }).format(value);
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

function formatPercentChange(value: number): string {
  const prefix = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${prefix}${new Intl.NumberFormat("ar-SY", {
    maximumFractionDigits: 1,
  }).format(Math.abs(value))}%`;
}

function compactChartPoints(
  points: readonly ProductivityPoint[],
  maximum = 7,
): ProductivityPoint[] {
  if (points.length <= maximum) return [...points];
  return Array.from({ length: maximum }, (_, index) => {
    const sourceIndex = Math.round(
      (index / (maximum - 1)) * (points.length - 1),
    );
    return points[sourceIndex]!;
  });
}

export function AdminWages() {
  const { profile } = useDeliveryAuth();
  const router = useRouter();
  const isBackOffice =
    profile?.role === "admin" || profile?.role === "supervisor";
  const isTabFocused = useScreenLiveUpdates();
  const isLiveUpdatesActive = isBackOffice && isTabFocused;
  const wagePeriods = useNativeAdminWagePeriods(isLiveUpdatesActive);
  const [dashboardFilter, setDashboardFilter] =
    useState<WageDashboardFilter>("daily");
  const [selectedPeriodStart, setSelectedPeriodStart] = useState("");
  const [customDate, setCustomDate] = useState(() => new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedCaptainId, setSelectedCaptainId] = useState<string | null>(
    null,
  );
  const details = useNativeCaptainWageDetails(
    selectedCaptainId,
    isLiveUpdatesActive,
  );
  const expensePeriod: NativeFinancePeriod =
    dashboardFilter === "custom" ? "daily" : dashboardFilter;
  const officeExpenses = useNativeOfficeExpensePeriods(
    expensePeriod,
    isLiveUpdatesActive,
  );
  const companyProfitHistory = useNativeCompanyProfitHistory(
    expensePeriod,
    isLiveUpdatesActive,
  );
  const dailyProductivityHistory = useNativeCompanyProfitHistory(
    "daily",
    isLiveUpdatesActive,
  );
  const dataOpacity = useSharedValue(1);
  const profitScale = useSharedValue(1.1);
  const profitTranslateY = useSharedValue(-14);
  const customDateKey = damascusDateKey(customDate);
  const customDateRows = useQuery({
    enabled: isLiveUpdatesActive && dashboardFilter === "custom",
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
  const refreshOnResume = useCallback(() => {
    void wagePeriods.refetch();
    if (selectedCaptainId) void details.refetch();
    void officeExpenses.refetch();
    void companyProfitHistory.refetch();
    void dailyProductivityHistory.refetch();
       if (dashboardFilter === "custom") void customDateRows.refetch();
  }, [
    companyProfitHistory,
    customDateRows,
    dailyProductivityHistory,
    dashboardFilter,
    details,
    officeExpenses,
    selectedCaptainId,
    wagePeriods,
  ]);

  useRefreshOnScreenResume(isLiveUpdatesActive, refreshOnResume);

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
      company: sum.company + row.company_total,
      gross: sum.gross + row.gross_total,
      orders: sum.orders + row.order_count,
    }),
    { captain: 0, company: 0, gross: 0, orders: 0 },
  );
  const selectedExpenseTotal =
    officeExpenses.data?.find(
      (row) =>
        row.period_start ===
        (dashboardFilter === "custom" ? customDateKey : selectedKey),
    )?.expense_total ?? 0;
  const netCompanyTotal = totals.company - Number(selectedExpenseTotal);
  const chartPeriodStart = selectedRows[0]?.period_start ?? selectedKey;
  const chartPeriodEnd = selectedRows[0]?.period_end ?? selectedKey;
  const productivitySnapshot = (() => {
    const expensesByPeriod = new Map(
      (officeExpenses.data ?? []).map((row) => [
        row.period_start,
        Number(row.expense_total),
      ]),
    );
    const profitTimeline = (companyProfitHistory.data ?? [])
      .map((row) => ({
        net: Number(row.company_total) - (expensesByPeriod.get(row.period_start) ?? 0),
        periodStart: row.period_start,
      }))
      .filter((row) => row.periodStart && Number.isFinite(row.net))
      .sort((left, right) => left.periodStart.localeCompare(right.periodStart));
    const selectedIndex = profitTimeline.findIndex(
      (row) => row.periodStart === selectedKey,
    );
    const currentIndex =
      selectedIndex >= 0 ? selectedIndex : profitTimeline.length - 1;
    const current = currentIndex >= 0 ? profitTimeline[currentIndex] : null;
    const previous = currentIndex > 0 ? profitTimeline[currentIndex - 1] : null;
    const comparison =
      current && previous && previous.net !== 0
        ? ((current.net - previous.net) / Math.abs(previous.net)) * 100
        : null;

    const dailyTimeline = (dailyProductivityHistory.data ?? [])
      .map((row) => ({
        periodStart: row.period_start,
        value: Math.max(0, Number(row.order_count)),
      }))
      .filter((row) => row.periodStart && Number.isFinite(row.value))
      .sort((left, right) => left.periodStart.localeCompare(right.periodStart));
    const pointsInRange = dailyTimeline.filter(
      (row) =>
        row.periodStart >= chartPeriodStart && row.periodStart <= chartPeriodEnd,
    );
    const points =
      dashboardFilter === "daily" || dashboardFilter === "custom"
        ? dailyTimeline
            .filter(
              (row) => !chartPeriodEnd || row.periodStart <= chartPeriodEnd,
            )
            .slice(-5)
        : pointsInRange;

    return { comparison, points: compactChartPoints(points) };
  })();
  const isPeriodPending =
    (dashboardFilter === "custom"
      ? customDateRows.isPending
      : wagePeriods.isPending) || officeExpenses.isPending;
  const periodError =
    dashboardFilter === "custom"
      ? customDateRows.error ?? officeExpenses.error
      : wagePeriods.error ?? officeExpenses.error;
  const profitTitle =
    dashboardFilter === "daily"
      ? "أرباح الشركة اليوم"
      : dashboardFilter === "weekly"
        ? "أرباح الشركة هذا الأسبوع"
        : dashboardFilter === "monthly"
          ? "أرباح الشركة هذا الشهر"
          : `أرباح الشركة في ${customDateLabel(customDate)}`;
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
    if (!isPeriodPending) {
      dataOpacity.set(
        withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }),
      );
    }
  }, [dataOpacity, isPeriodPending, selectedKey]);

  const openCustomDatePicker = useCallback(() => {
    dataOpacity.set(
      withTiming(0.42, { duration: 90, easing: Easing.out(Easing.cubic) }),
    );
    if (dashboardFilter !== "custom") {
      setDashboardFilter("custom");
      setSelectedPeriodStart("");
      wagePeriods.changePeriod("daily");
    }
    setIsDatePickerOpen(true);
  }, [dashboardFilter, dataOpacity, wagePeriods]);

  const chooseFilter = useCallback(
    (next: WageDashboardFilter) => {
      if (next === "custom") {
        openCustomDatePicker();
        return;
      }
      dataOpacity.set(
        withTiming(0.42, { duration: 90, easing: Easing.out(Easing.cubic) }),
      );
      setDashboardFilter(next);
      setSelectedPeriodStart("");
      wagePeriods.changePeriod(next);
    },
    [dataOpacity, openCustomDatePicker, wagePeriods],
  );

  const selectCustomDate = useCallback(
    (dateKey: string) => {
      dataOpacity.set(
        withTiming(0.42, { duration: 90, easing: Easing.out(Easing.cubic) }),
      );
      setCustomDate(new Date(`${dateKey}T12:00:00Z`));
      setIsDatePickerOpen(false);
    },
    [dataOpacity],
  );

  const selectedOptionIndex = options.findIndex(
    (option) => option.period_start === selectedKey,
  );
  const canMoveToOlderRange =
    dashboardFilter === "custom"
      ? true
      : selectedOptionIndex >= 0 && selectedOptionIndex < options.length - 1;
  const canMoveToNewerRange =
    dashboardFilter === "custom"
      ? customDateKey < damascusDateKey(new Date())
      : selectedOptionIndex > 0;
  const navigateRange = useCallback(
    (direction: -1 | 1) => {
      dataOpacity.set(
        withTiming(0.42, { duration: 90, easing: Easing.out(Easing.cubic) }),
      );
      if (dashboardFilter === "custom") {
        const next = new Date(`${customDateKey}T12:00:00Z`);
        next.setUTCDate(next.getUTCDate() + direction);
        if (damascusDateKey(next) <= damascusDateKey(new Date())) {
          setCustomDate(next);
        }
        return;
      }
      const target = options[selectedOptionIndex - direction];
      if (target) setSelectedPeriodStart(target.period_start);
    },
    [customDateKey, dashboardFilter, dataOpacity, options, selectedOptionIndex],
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

  return (
    <ScreenContainer className="bg-[#F4F7FB]" containerClassName="bg-[#F4F7FB]">
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "العودة",
          icon: "arrow-forward",
          onPress: () => goBackOrReplace(router),
        }}
        trailingAction={{
          accessibilityLabel: "أجور الكباتن",
          icon: "account-balance-wallet",
        }}
      />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={
              (dashboardFilter === "custom"
                ? customDateRows.isRefetching
                : wagePeriods.isRefetching) || officeExpenses.isRefetching
            }
            onRefresh={() => {
              void officeExpenses.refetch();
              void companyProfitHistory.refetch();
              void dailyProductivityHistory.refetch();
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
            <Text style={styles.profitKicker}>الصافي</Text>
            <MaterialIcons
              name="account-balance-wallet"
              size={21}
              color="#16A9E2"
            />
          </View>
          <View style={styles.profitMainRow}>
            <View style={styles.profitCopy}>
              <Text style={styles.profitTitle}>{profitTitle}</Text>
              <Text style={styles.profitAmount}>
                {isPeriodPending ? "—" : money(netCompanyTotal)}
              </Text>
              {productivitySnapshot.comparison === null ? (
                <Text style={styles.profitComparisonHint}>
                  ستظهر المقارنة عند توفر فترة سابقة
                </Text>
              ) : (
                <View
                  style={[
                    styles.profitComparison,
                    productivitySnapshot.comparison >= 0
                      ? styles.profitComparisonPositive
                      : styles.profitComparisonNegative,
                  ]}
                >
                  <MaterialIcons
                    name={
                      productivitySnapshot.comparison >= 0
                        ? "trending-up"
                        : "trending-down"
                    }
                    size={13}
                    color={
                      productivitySnapshot.comparison >= 0
                        ? "#07875D"
                        : "#B54708"
                    }
                  />
                  <Text
                    style={[
                      styles.profitComparisonText,
                      productivitySnapshot.comparison >= 0
                        ? styles.profitComparisonTextPositive
                        : styles.profitComparisonTextNegative,
                    ]}
                  >
                    {formatPercentChange(productivitySnapshot.comparison)}
                  </Text>
                  <Text style={styles.profitComparisonCaption}>
                    مقارنة بالفترة السابقة
                  </Text>
                </View>
              )}
            </View>
            <ProductivityChart points={productivitySnapshot.points} />
          </View>
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

        <MotionPressable
          accessibilityLabel="فتح واجهة الصندوق"
          onPress={() => router.push("/treasury" as never)}
          style={({ pressed }) => [
            styles.treasuryCard,
            pressed && styles.companyCardPressed,
          ]}
        >
          <View style={styles.treasuryIcon}>
            <MaterialIcons name="account-balance-wallet" size={21} color="#07875D" />
          </View>
          <View style={styles.companyTextBlock}>
            <Text style={styles.treasuryTitle}>الصندوق</Text>
            <Text style={styles.companySubtitle}>
              رصيد الشركة، أرباح الأجور، الإيداعات، والسحوبات
            </Text>
          </View>
          <View style={styles.treasuryAction}>
            <Text style={styles.treasuryActionText}>فتح</Text>
            <MaterialIcons name="arrow-back" size={16} color="#07875D" />
          </View>
        </MotionPressable>

        <MotionPressable
          accessibilityLabel="فتح واجهة مصاريف المكتب"
          onPress={() => router.push("/office-expenses" as never)}
          style={({ pressed }) => [
            styles.expenseCard,
            pressed && styles.companyCardPressed,
          ]}
        >
          <View style={styles.expenseIcon}>
            <MaterialIcons name="receipt-long" size={21} color="#B54708" />
          </View>
          <View style={styles.companyTextBlock}>
            <Text style={styles.expenseTitle}>مصاريف المكتب</Text>
            <Text style={styles.companySubtitle}>
              سجل المصاريف واطرحها من حصة الشركة يوميًا وأسبوعيًا وشهريًا
            </Text>
          </View>
          <View style={styles.expenseAction}>
            <Text style={styles.expenseActionText}>فتح</Text>
            <MaterialIcons name="arrow-back" size={16} color="#B54708" />
          </View>
        </MotionPressable>

        <View style={styles.periodHeading}>
          <View>
            <Text style={styles.periodTitle}>نطاق كشف الأجور</Text>
            <Text style={styles.periodHint}>تنقّل بين الفترات المسجلة</Text>
          </View>
          <Text style={styles.rangeModeLabel}>
            {
              FILTER_OPTIONS.find((option) => option.id === dashboardFilter)
                ?.label
            }
          </Text>
        </View>
        <View style={styles.rangeControl}>
          <MotionPressable
            accessibilityLabel="الفترة الأقدم"
            disabled={!canMoveToOlderRange}
            onPress={() => navigateRange(-1)}
            style={({ pressed }) => [
              styles.rangeArrow,
              !canMoveToOlderRange && styles.rangeArrowDisabled,
              pressed && styles.smallPressed,
            ]}
          >
            <MaterialIcons name="chevron-right" size={24} color={BLUE} />
          </MotionPressable>
          <MotionPressable
            accessibilityLabel="اختيار نطاق تاريخ مخصص"
            onPress={openCustomDatePicker}
            style={({ pressed }) => [
              styles.rangeValue,
              pressed && styles.rangeValuePressed,
            ]}
          >
            <MaterialIcons name="calendar-month" size={19} color={BLUE} />
            <View style={styles.rangeValueCopy}>
              <Text style={styles.rangeValueKicker}>الفترة المعروضة</Text>
              <Text numberOfLines={1} style={styles.rangeValueText}>
                {selectedLabel}
              </Text>
            </View>
          </MotionPressable>
          <MotionPressable
            accessibilityLabel="الفترة الأحدث"
            disabled={!canMoveToNewerRange}
            onPress={() => navigateRange(1)}
            style={({ pressed }) => [
              styles.rangeArrow,
              !canMoveToNewerRange && styles.rangeArrowDisabled,
              pressed && styles.smallPressed,
            ]}
          >
            <MaterialIcons name="chevron-left" size={24} color={BLUE} />
          </MotionPressable>
        </View>
        <View style={styles.rangeQuickFilters}>
          {FILTER_OPTIONS.map((option) => {
            const selected = dashboardFilter === option.id;
            return (
            <MotionPressable
              key={option.id}
              onPress={() => chooseFilter(option.id)}
              style={({ pressed }) => [
                styles.rangeQuickFilter,
                selected && styles.rangeQuickFilterActive,
                pressed && styles.smallPressed,
              ]}
            >
              <MaterialIcons
                name={option.icon}
                size={15}
                color={selected ? "#FFFFFF" : "#6A8799"}
              />
              <Text
                style={[
                  styles.rangeQuickFilterText,
                  selected && styles.rangeQuickFilterTextActive,
                ]}
              >
                {option.label}
              </Text>
            </MotionPressable>
            );
          })}
        </View>
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.metrics}
          >
            <Metric
              label="الإجمالي"
              value={money(totals.gross)}
              color="#164C70"
            />
            <Metric
              label="صافي أجور الكباتن"
              value={money(totals.captain)}
              color="#047857"
            />
            <Metric
              label="حصة الشركة"
              value={money(totals.company)}
              color={BLUE}
            />
          </ScrollView>
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
                    params: {
                      captainId: captain.captain_id,
                      captainName: captain.captain_name,
                    },
                  } as never)
                }
                style={({ pressed }) => [
                  styles.captainHeader,
                  pressed && styles.captainHeaderPressed,
                ]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {captain.captain_name.trim().slice(0, 1) || "ك"}
                  </Text>
                </View>
                <View style={styles.captainIdentity}>
                  <Text style={styles.captainName}>{captain.captain_name}</Text>
                  <Text style={styles.captainMeta}>
                    {captain.order_count} طلبات في هذه الفترة
                  </Text>
                </View>
                <View style={styles.captainNetSummary}>
                  <Text style={styles.captainNetLabel}>إجمالي الأجور</Text>
                  <Text style={styles.captainNetValue}>
                    {money(captain.gross_total)}
                  </Text>
                </View>
                <MaterialIcons name="chevron-left" size={21} color="#7592A5" />
              </MotionPressable>
              <View style={styles.captainLedgerGrid}>
                <CaptainLedgerCell
                  label="صافي الأجر"
                  value={captain.captain_net_total}
                  color="#047857"
                />
                <CaptainLedgerCell
                  label="حصة الشركة"
                  value={captain.company_total}
                  color={BLUE}
                />
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
      {isDatePickerOpen ? (
        <FinancialDatePicker
          onClose={() => setIsDatePickerOpen(false)}
          onSelect={(date) => selectCustomDate(damascusDateKey(date))}
          value={customDate}
          visible
        />
      ) : null}
      <WageDetails
        captain={selectedCaptain}
        details={details.data ?? []}
        loading={details.isPending}
        onClose={() => setSelectedCaptainId(null)}
      />
    </ScreenContainer>
  );
}

function ProductivityChart({ points }: { points: readonly ProductivityPoint[] }) {
  const pulseScale = useSharedValue(0.78);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.32,
    transform: [{ scale: pulseScale.value }],
  }));
  const chart = useMemo(() => {
    const chartWidth = 120;
    const chartHeight = 62;
    const left = 8;
    const top = 5;
    const bottom = top + chartHeight;
    const maxValue = Math.max(1, ...points.map((point) => point.value));
    const coordinates = points.map((point, index) => {
      const x =
        points.length > 1
          ? left + (index / (points.length - 1)) * chartWidth
          : left + chartWidth;
      const y = bottom - (point.value / maxValue) * chartHeight;
      return { x, y };
    });
    const polyline = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
    const areaPath = coordinates.length
      ? `M ${coordinates[0]!.x} ${bottom} L ${coordinates
          .map((point) => `${point.x} ${point.y}`)
          .join(" L ")} L ${coordinates.at(-1)!.x} ${bottom} Z`
      : "";
    return {
      areaPath,
      bottom,
      chartHeight,
      coordinates,
      maxValue,
      polyline,
    };
  }, [points]);

  useEffect(() => {
    if (chart.coordinates.length < 2) return;
    pulseScale.set(
      withRepeat(
        withSequence(
          withTiming(1.25, { duration: 780, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.72, { duration: 780, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [chart.coordinates.length, pulseScale]);

  if (chart.coordinates.length < 2) {
    return (
      <View style={styles.productivityChartEmpty}>
        <Text style={styles.productivityChartLabel}>الإنتاجية</Text>
        <Text style={styles.productivityChartEmptyText}>
          تتوفر بعد تسجيل فترتين
        </Text>
      </View>
    );
  }

  const endPoint = chart.coordinates.at(-1)!;
  return (
    <View style={styles.productivityChart}>
      <Text style={styles.productivityChartLabel}>الإنتاجية</Text>
      <View style={styles.productivityChartSurface}>
        <Svg height={72} viewBox="0 0 140 72" width={140}>
          <Line
            stroke="#BFDCEB"
            strokeWidth={1}
            x1={8}
            x2={8}
            y1={4}
            y2={chart.bottom}
          />
          <Line
            stroke="#D5E8F2"
            strokeWidth={1}
            x1={8}
            x2={132}
            y1={chart.bottom}
            y2={chart.bottom}
          />
          <Line
            stroke="#E4F0F6"
            strokeDasharray="3 3"
            strokeWidth={1}
            x1={8}
            x2={132}
            y1={chart.bottom - chart.chartHeight / 2}
            y2={chart.bottom - chart.chartHeight / 2}
          />
          <SvgText fill="#7893A4" fontSize={7} x={0} y={9}>
            {chart.maxValue}
          </SvgText>
          <SvgText fill="#7893A4" fontSize={7} x={3} y={chart.bottom}>
            0
          </SvgText>
          <Path d={chart.areaPath} fill="#0878D1" opacity={0.1} />
          <Polyline
            fill="none"
            points={chart.polyline}
            stroke="#0878D1"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
          />
          {chart.coordinates.map((point, index) => (
            <Circle
              cx={point.x}
              cy={point.y}
              fill="#FFFFFF"
              key={`${points[index]!.periodStart}-${point.x}`}
              r={index === chart.coordinates.length - 1 ? 4.2 : 2.5}
              stroke="#0878D1"
              strokeWidth={index === chart.coordinates.length - 1 ? 2.1 : 1.5}
            />
          ))}
        </Svg>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.productivityChartPulse,
            { left: endPoint.x - 11, top: endPoint.y - 11 },
            pulseStyle,
          ]}
        />
      </View>
    </View>
  );
}

function FinancialDatePicker({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}) {
  const [displayMonth, setDisplayMonth] = useState(() => monthStart(value));
  const monthDays = useMemo(() => calendarDays(displayMonth), [displayMonth]);
  const todayKey = damascusDateKey(new Date());
  const latestMonth = monthStart(new Date());
  const canAdvanceMonth = displayMonth.getTime() < latestMonth.getTime();

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.dateModalBackdrop}>
        <View style={styles.dateModalCard}>
          <View style={styles.dateModalHeader}>
            <MotionPressable
              accessibilityLabel="إغلاق التقويم"
              onPress={onClose}
              style={({ pressed }) => [
                styles.dateModalClose,
                pressed && styles.smallPressed,
              ]}
            >
              <MaterialIcons name="close" size={19} color="#496B81" />
            </MotionPressable>
            <Text style={styles.dateModalTitle}>اختيار تاريخ الأجور</Text>
            <View style={styles.dateModalHeaderSpace} />
          </View>
          <View style={styles.calendarMonthRow}>
            <MotionPressable
              accessibilityLabel="الشهر السابق"
              onPress={() =>
                setDisplayMonth((current) => shiftMonth(current, -1))
              }
              style={({ pressed }) => [
                styles.calendarNavigation,
                pressed && styles.smallPressed,
              ]}
            >
              <MaterialIcons name="chevron-right" size={22} color={BLUE} />
            </MotionPressable>
            <Text style={styles.calendarMonthTitle}>
              {calendarMonthLabel(displayMonth)}
            </Text>
            <MotionPressable
              accessibilityLabel="الشهر التالي"
              disabled={!canAdvanceMonth}
              onPress={() =>
                setDisplayMonth((current) => shiftMonth(current, 1))
              }
              style={({ pressed }) => [
                styles.calendarNavigation,
                !canAdvanceMonth && styles.calendarNavigationDisabled,
                pressed && styles.smallPressed,
              ]}
            >
              <MaterialIcons name="chevron-left" size={22} color={BLUE} />
            </MotionPressable>
          </View>
          <View style={styles.calendarWeekdays}>
            {WEEKDAY_LABELS.map((label) => (
              <Text key={label} style={styles.calendarWeekday}>
                {label}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {monthDays.map((day, index) => {
              if (!day)
                return (
                  <View key={`empty-${index}`} style={styles.calendarDaySlot} />
                );
              const dayKey = damascusDateKey(day);
              const isFuture = dayKey > todayKey;
              const selected = dayKey === damascusDateKey(value);
              return (
                <View key={dayKey} style={styles.calendarDaySlot}>
                  <MotionPressable
                    disabled={isFuture}
                    onPress={() => onSelect(day)}
                    style={({ pressed }) => [
                      styles.calendarDay,
                      selected && styles.calendarDaySelected,
                      isFuture && styles.calendarDayDisabled,
                      pressed && styles.calendarDayPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        selected && styles.calendarDayTextSelected,
                        isFuture && styles.calendarDayTextDisabled,
                      ]}
                    >
                      {new Intl.NumberFormat("en-US").format(day.getUTCDate())}
                    </Text>
                  </MotionPressable>
                </View>
              );
            })}
          </View>
          <Text style={styles.dateModalHint}>
            اختر يومًا لتحديث سجل الأجور باستخدام البيانات المسجلة فعليًا.
          </Text>
        </View>
      </View>
    </Modal>
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
function CaptainLedgerCell({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.captainLedgerCell}>
      <Text style={styles.captainLedgerLabel}>{label}</Text>
      <Text style={[styles.captainLedgerValue, { color }]}>{money(value)}</Text>
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
  rangeModeLabel: {
    backgroundColor: "#E7F6FE",
    borderColor: "#C6E8F8",
    borderRadius: 11,
    borderWidth: 1,
    color: BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 4,
    writingDirection: "rtl",
  },
  rangeControl: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#CFE4F0",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row-reverse",
    minHeight: 62,
    padding: 6,
    shadowColor: "#0C679D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  rangeArrow: {
    alignItems: "center",
    backgroundColor: "#EAF7FD",
    borderRadius: 13,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  rangeArrowDisabled: { opacity: 0.3 },
  rangeValue: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row-reverse",
    gap: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 7,
  },
  rangeValuePressed: { opacity: 0.74 },
  rangeValueCopy: { flexShrink: 1 },
  rangeValueKicker: {
    color: "#7895A7",
    fontFamily: "Cairo_700Bold",
    fontSize: 8,
    textAlign: "right",
    writingDirection: "rtl",
  },
  rangeValueText: {
    color: "#063B78",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    marginTop: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  rangeQuickFilters: {
    backgroundColor: "#E9F1F6",
    borderRadius: 16,
    flexDirection: "row-reverse",
    gap: 4,
    padding: 4,
  },
  rangeQuickFilter: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row-reverse",
    gap: 4,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 3,
  },
  rangeQuickFilterActive: {
    backgroundColor: "#0878D1",
    borderColor: "#42C5F5",
    elevation: 2,
    shadowColor: "#0878D1",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 7,
  },
  rangeQuickFilterText: {
    color: "#638297",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    writingDirection: "rtl",
  },
  rangeQuickFilterTextActive: { color: "#FFFFFF" },
  metrics: { flexDirection: "row-reverse", gap: 9, paddingRight: 1 },
  metric: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DDEAF2",
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 82,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: 174,
  },
  metricValue: {
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
  },
  muted: {
    color: "#70899A",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
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
    borderColor: "#D7E8F2",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#0C679D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.065,
    shadowRadius: 11,
  },
  captainHeader: {
    alignItems: "center",
    backgroundColor: "#F8FCFF",
    borderBottomColor: "#E3EFF5",
    borderBottomWidth: 1,
    flexDirection: "row-reverse",
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  captainHeaderPressed: { backgroundColor: "#EEF8FD" },
  avatar: {
    alignItems: "center",
    backgroundColor: "#DFF4FD",
    borderColor: "#B5E4F7",
    borderRadius: 18,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  avatarText: { color: "#0878D1", fontFamily: "Cairo_700Bold", fontSize: 14 },
  captainIdentity: { flex: 1, marginHorizontal: 10 },
  captainName: {
    color: "#073D70",
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
  },
  captainMeta: {
    color: "#7893A4",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    marginTop: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  captainNetSummary: { alignItems: "flex-end", marginLeft: 7 },
  captainNetLabel: {
    color: "#6D8A9C",
    fontFamily: "Cairo_700Bold",
    fontSize: 8,
    writingDirection: "rtl",
  },
  captainNetValue: {
    color: "#08755C",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    marginTop: 1,
    writingDirection: "ltr",
  },
  captainLedgerGrid: {
    backgroundColor: "#FBFDFF",
    borderBottomColor: "#E7F0F5",
    borderTopColor: "#E7F0F5",
    borderBottomWidth: 1,
    borderTopWidth: 1,
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    paddingVertical: 3,
  },
  captainLedgerCell: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    width: "50%",
  },
  captainLedgerLabel: {
    color: "#728FA1",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    textAlign: "right",
    writingDirection: "rtl",
  },
  captainLedgerValue: {
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    marginTop: 1,
    textAlign: "right",
    writingDirection: "ltr",
  },
  captainSettlementState: {
    alignItems: "center",
    borderRadius: 11,
    flexDirection: "row-reverse",
    gap: 5,
    marginHorizontal: 10,
    marginTop: 3,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  captainSettlementPending: { backgroundColor: "#FFF5F5" },
  captainSettlementComplete: { backgroundColor: "#EEF9F4" },
  captainSettlementText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    writingDirection: "rtl",
  },
  captainSettlementPendingText: { color: "#B83C48" },
  captainSettlementCompleteText: { color: "#08755C" },
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
    backgroundColor: "#F8FCFF",
    borderTopColor: "#E5EFF4",
    borderTopWidth: 1,
    flexDirection: "row-reverse",
    gap: 8,
    marginTop: 9,
    padding: 10,
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
  paymentButtonPressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
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
  treasuryCard: {
    alignItems: "center",
    backgroundColor: "#F1FBF7",
    borderColor: "#BFE7D3",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row-reverse",
    minHeight: 66,
    paddingHorizontal: 13,
  },
  treasuryIcon: {
    alignItems: "center",
    backgroundColor: "#DDF5E9",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  treasuryTitle: {
    color: "#08704E",
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
  },
  treasuryAction: {
    alignItems: "center",
    backgroundColor: "#DDF5E9",
    borderRadius: 11,
    flexDirection: "row-reverse",
    gap: 4,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 9,
  },
  treasuryActionText: {
    color: "#08704E",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    writingDirection: "rtl",
  },
  expenseCard: {
    alignItems: "center",
    backgroundColor: "#FFF8F1",
    borderColor: "#F6C99E",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row-reverse",
    minHeight: 66,
    paddingHorizontal: 13,
  },
  expenseIcon: {
    alignItems: "center",
    backgroundColor: "#FFE7D1",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  expenseTitle: {
    color: "#9A4506",
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
  },
  expenseAction: {
    alignItems: "center",
    backgroundColor: "#FFE7D1",
    borderRadius: 11,
    flexDirection: "row-reverse",
    gap: 4,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 9,
  },
  expenseActionText: {
    color: "#9A4506",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    writingDirection: "rtl",
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
  profitMainRow: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: 8,
    marginTop: 4,
  },
  profitCopy: { flex: 1, minWidth: 0 },
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
    width: "100%",
    writingDirection: "rtl",
  },
  profitAmount: {
    color: "#0878D1",
    fontFamily: "Cairo_700Bold",
    fontSize: 25,
    letterSpacing: -0.5,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "ltr",
  },
  profitComparison: {
    alignItems: "center",
    alignSelf: "flex-end",
    borderRadius: 10,
    flexDirection: "row-reverse",
    gap: 4,
    marginRight: 1,
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  profitComparisonPositive: { backgroundColor: "#E6F8EE" },
  profitComparisonNegative: { backgroundColor: "#FFF0E7" },
  profitComparisonText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    writingDirection: "ltr",
  },
  profitComparisonTextPositive: { color: "#07875D" },
  profitComparisonTextNegative: { color: "#B54708" },
  profitComparisonCaption: {
    color: "#66869A",
    fontFamily: "Cairo_400Regular",
    fontSize: 8,
    writingDirection: "rtl",
  },
  profitComparisonHint: {
    color: "#7490A1",
    fontFamily: "Cairo_400Regular",
    fontSize: 8,
    marginTop: 5,
    textAlign: "right",
    writingDirection: "rtl",
  },
  productivityChart: { alignItems: "flex-start", width: 140 },
  productivityChartEmpty: {
    alignItems: "flex-end",
    backgroundColor: "#F8FCFE",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
    width: 140,
  },
  productivityChartLabel: {
    color: "#54778C",
    fontFamily: "Cairo_600SemiBold",
    fontSize: 8,
    textAlign: "left",
    writingDirection: "rtl",
  },
  productivityChartEmptyText: {
    color: "#8AA0AE",
    fontFamily: "Cairo_400Regular",
    fontSize: 7,
    marginTop: 5,
    textAlign: "left",
    writingDirection: "rtl",
  },
  productivityChartSurface: { height: 72, marginTop: 1, width: 140 },
  productivityChartPulse: {
    backgroundColor: "#16CEFF",
    borderRadius: 11,
    height: 22,
    position: "absolute",
    width: 22,
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
  dateModalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(5, 31, 53, 0.42)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  dateModalCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#CBE8F5",
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: 440,
    padding: 16,
    shadowColor: "#05233E",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    width: "100%",
  },
  dateModalHeader: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  dateModalClose: {
    alignItems: "center",
    backgroundColor: "#F0F7FB",
    borderRadius: 11,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  dateModalHeaderSpace: { height: 34, width: 34 },
  dateModalTitle: {
    color: "#063B78",
    fontFamily: "Cairo_700Bold",
    fontSize: 15,
    writingDirection: "rtl",
  },
  calendarMonthRow: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 17,
  },
  calendarNavigation: {
    alignItems: "center",
    backgroundColor: "#EAF7FD",
    borderRadius: 11,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  calendarNavigationDisabled: { opacity: 0.35 },
  calendarMonthTitle: {
    color: "#174B70",
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    writingDirection: "rtl",
  },
  calendarWeekdays: {
    flexDirection: "row-reverse",
    marginTop: 14,
  },
  calendarWeekday: {
    color: "#7A97A8",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    textAlign: "center",
    width: "14.2857%",
    writingDirection: "rtl",
  },
  calendarGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    marginTop: 8,
  },
  calendarDaySlot: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    width: "14.2857%",
  },
  calendarDay: {
    alignItems: "center",
    borderRadius: 12,
    height: 35,
    justifyContent: "center",
    width: 35,
  },
  calendarDaySelected: {
    backgroundColor: "#0878D1",
    shadowColor: "#0878D1",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  calendarDayDisabled: { opacity: 0.28 },
  calendarDayPressed: {
    backgroundColor: "#E3F5FE",
    transform: [{ scale: 0.96 }],
  },
  calendarDayText: {
    color: "#315F7C",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    writingDirection: "ltr",
  },
  calendarDayTextSelected: { color: "#FFFFFF" },
  calendarDayTextDisabled: { color: "#91A6B2" },
  dateModalHint: {
    color: "#6E8C9E",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    lineHeight: 16,
    marginTop: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
  smallPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
