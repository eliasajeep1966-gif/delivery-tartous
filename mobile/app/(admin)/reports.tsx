import { useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import {
  Building2,
  FileText,
  RefreshCw,
  TrendingUp,
  Truck,
  WalletCards,
} from "lucide-react-native";
import { useRouter } from "expo-router";

import { goBackOrReplace } from "@/lib/navigation/go-back-or-replace";
import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import { AdminCompanyPdfReports } from "@/components/admin/admin-company-pdf-reports";
import {
  useNativeAdminWagePeriods,
  useNativeCompanyProfitHistory,
  useNativeOfficeExpensePeriods,
  type NativeFinancePeriod,
} from "@/features/admin/use-admin-finance";

const BLUE = "#0878D1";
const CHART_CENTER = 72;
const CHART_RADIUS = 56;
const CHART_CIRCUMFERENCE = 2 * Math.PI * CHART_RADIUS;

type Icon = React.ReactNode;
type FinanceBreakdownSlice = {
  label: string;
  value: number;
  color: string;
};

function Text({ style, ...props }: ComponentProps<typeof NativeText>) {
  const flattened = StyleSheet.flatten(style);
  const isBold =
    flattened?.fontWeight === "700" ||
    flattened?.fontWeight === "800" ||
    flattened?.fontWeight === "bold";
  return (
    <NativeText
      {...props}
      style={[{ fontFamily: isBold ? "Cairo_700Bold" : "Cairo_400Regular" }, style]}
    />
  );
}

const money = (value: number) =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} ل.س`;
const date = (value: string) =>
  new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    dateStyle: "medium",
  }).format(new Date(`${value}T12:00:00Z`));

const periods: { id: NativeFinancePeriod; label: string }[] = [
  { id: "daily", label: "يومي" },
  { id: "weekly", label: "أسبوعي" },
  { id: "monthly", label: "شهري" },
];

export default function AdminReportsScreen() {
  const router = useRouter();
  const { profile } = useDeliveryAuth();
  const [period, setPeriod] = useState<NativeFinancePeriod>("monthly");
  const [showPdfReports, setShowPdfReports] = useState(false);
  const history = useNativeCompanyProfitHistory(period);
  const wages = useNativeAdminWagePeriods(true, "monthly");
  const expenses = useNativeOfficeExpensePeriods(period);
  const isBackOffice = profile?.role === "admin" || profile?.role === "supervisor";
  const rows = useMemo(() => history.data ?? [], [history.data]);
  const expenseByPeriod = useMemo(
    () => new Map((expenses.data ?? []).map((row) => [row.period_start, row.expense_total])),
    [expenses.data],
  );
  const latestRow = rows[0] ?? null;
  const summary = useMemo(() => {
    if (!latestRow) return null;
    const captainCompensation = Math.max(0, latestRow.settlement_total);
    const captainWages = Math.max(0, latestRow.captain_net_total - captainCompensation);
    const expenseTotal = expenseByPeriod.get(latestRow.period_start) ?? 0;
    return {
      captainCompensation,
      captainTotal: latestRow.captain_net_total,
      captainWages,
      companyTotal: latestRow.company_total,
      expenseTotal,
      grossTotal: latestRow.gross_total,
      netCompanyTotal: latestRow.company_total - expenseTotal,
      orderCount: latestRow.order_count,
      periodEnd: latestRow.period_end,
      periodStart: latestRow.period_start,
    };
  }, [expenseByPeriod, latestRow]);
  const chartSlices = useMemo<FinanceBreakdownSlice[]>(
    () =>
      summary
        ? [
            {
              label: "أجور الكباتن العادية",
              value: summary.captainWages,
              color: "#1677C8",
            },
            {
              label: "تعويضات الكباتن",
              value: summary.captainCompensation,
              color: "#8B5CF6",
            },
            {
              label: "مصاريف المكتب",
              value: summary.expenseTotal,
              color: "#F59E0B",
            },
            {
              label: "صافي الشركة",
              value: summary.netCompanyTotal,
              color: summary.netCompanyTotal >= 0 ? "#059669" : "#E05252",
            },
          ]
        : [],
    [summary],
  );
  const wageRows = useMemo(
    () => wages.data.filter((row) => row.period_start === latestRow?.period_start),
    [latestRow?.period_start, wages.data],
  );


  const retry = () => {
    void history.refetch();
    void wages.refetch();
    void expenses.refetch();
  };

  if (!isBackOffice) {
    return (
      <ScreenContainer className="items-center justify-center bg-[#F4F7FB] p-5" containerClassName="bg-[#F4F7FB]">
        <Text style={styles.deniedText}>هذه الشاشة مخصصة للأدمن والمشرف.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer safeBottom className="bg-[#F4F7FB]" containerClassName="bg-[#F4F7FB]">
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "العودة",
          icon: "arrow-forward",
          onPress: () => goBackOrReplace(router),
        }}
        trailingAction={{ accessibilityLabel: "التقارير", icon: "bar-chart" }}
      />
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={history.isRefetching || wages.isRefetching || expenses.isRefetching}
            onRefresh={retry}
            tintColor={BLUE}
          />
        }
      >
        <LinearGradient
          colors={["#EEF7FF", "#FFFFFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroPill}>
              <View style={styles.heroDot} />
              <Text style={styles.heroPillText}>ملخص مالي</Text>
            </View>
            <Text style={styles.heroDate}>
              {periods.find((item) => item.id === period)?.label ?? "شهري"}
            </Text>
          </View>
          <Text style={styles.heroTitle}>تقرير المكتب</Text>
          <Text style={styles.heroSubtitle}>
            تابع نتيجة الشركة، أجور وتعويضات الكباتن، ومصاريف المكتب.
          </Text>
          <View style={styles.periodPicker}>
            {periods.map((item) => {
              const selected = period === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setPeriod(item.id);
                    wages.changePeriod(item.id);
                  }}
                  style={({ pressed }) => [
                    styles.periodChoice,
                    selected && styles.periodChoiceSelected,
                    pressed && styles.smallPressed,
                  ]}
                >
                  <Text style={[styles.periodText, selected && styles.periodTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </LinearGradient>

        <Pressable
          accessibilityRole="button"
          onPress={() => setShowPdfReports(true)}
          style={({ pressed }) => [styles.pdfReportButton, pressed && styles.smallPressed]}
        >
          <View style={styles.pdfReportIcon}>
            <FileText size={21} color="#0878D1" />
          </View>
          <View style={styles.pdfReportText}>
            <Text style={styles.pdfReportTitle}>طباعة تقارير PDF</Text>
            <Text style={styles.pdfReportSubtitle}>
              كشف كابتن محدد أو تقرير مالي للشركة
            </Text>
          </View>
          <Text style={styles.pdfReportAction}>فتح</Text>
        </Pressable>

        {history.isPending || wages.isPending || expenses.isPending ? (
          <LoadingState label="جارٍ تحميل التقارير..." />
        ) : history.error || wages.error || expenses.error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>
              {history.error instanceof Error
                ? history.error.message
                : wages.error instanceof Error
                  ? wages.error.message
                  : expenses.error instanceof Error
                    ? expenses.error.message
                    : "تعذر تحميل التقارير."}
            </Text>
            <Pressable onPress={retry} style={({ pressed }) => [styles.retryButton, pressed && styles.smallPressed]}>
              <RefreshCw size={15} color={BLUE} />
              <Text style={styles.retryText}>إعادة المحاولة</Text>
            </Pressable>
          </View>
        ) : !summary ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>لا توجد بيانات مالية لهذه الفترة.</Text>
          </View>
        ) : (
          <>
            <SectionHeading overline="لقطة مالية" title="آخر فترة مسجلة" />
            <View style={styles.periodSummaryCard}>
              <Text style={styles.periodSummaryTitle}>
                {period === "daily"
                  ? date(summary.periodStart)
                  : `من ${date(summary.periodStart)} إلى ${date(summary.periodEnd)}`}
              </Text>
              <Text style={styles.periodSummarySubtitle}>
                {summary.orderCount} طلبات نهائية · القيمة المرجعية {money(summary.grossTotal)}
              </Text>
            </View>
            <View style={styles.metricGrid}>
              <MetricCard
                icon={<Building2 size={19} color="#FFFFFF" />}
                label="صافي الشركة"
                value={money(summary.netCompanyTotal)}
                highlighted
              />
              <MetricCard
                icon={<WalletCards size={19} color="#A46500" />}
                label="مصاريف المكتب"
                value={money(summary.expenseTotal)}
                tone="orange"
              />
              <MetricCard
                icon={<Truck size={19} color="#126FA7" />}
                label="إجمالي أجر الكباتن"
                value={money(summary.captainTotal)}
              />
              <MetricCard
                icon={<WalletCards size={19} color="#7045C8" />}
                label="تعويضات الكباتن"
                value={money(summary.captainCompensation)}
                tone="purple"
              />
            </View>

            <FinancialBreakdownChart
              animationKey={`${period}:${summary.periodStart}:${summary.periodEnd}`}
              slices={chartSlices}
            />

            <SectionHeading overline="النتائج المسجلة" title="الحصيلة حسب التاريخ" />
            {rows.map((row) => (
              <View key={`${row.period_start}-${row.period_end}`} style={styles.activityCard}>
                <View style={[styles.activityAccent, row.company_total < 0 && styles.activityAccentLoss]} />
                <View style={[styles.activityIcon, row.company_total < 0 && styles.activityIconLoss]}>
                  <TrendingUp size={18} color={row.company_total < 0 ? "#C84A4A" : "#287AAC"} />
                </View>
                <View style={styles.activityContent}>
                  <View style={styles.activityTop}>
                    <Text numberOfLines={1} style={styles.activityTitle}>
                      {period === "daily"
                        ? date(row.period_start)
                        : `من ${date(row.period_start)} إلى ${date(row.period_end)}`}
                    </Text>
                    <View style={styles.ordersBadge}>
                      <Text style={styles.ordersBadgeText}>{row.order_count} طلبات</Text>
                    </View>
                  </View>
                  <Text style={styles.activitySubtitle}>القيمة المرجعية {money(row.gross_total)}</Text>
                  <Text
                    style={[
                      styles.activityProfit,
                      row.company_total - (expenseByPeriod.get(row.period_start) ?? 0) < 0 &&
                        styles.activityLoss,
                    ]}
                  >
                    صافي الشركة {money(row.company_total - (expenseByPeriod.get(row.period_start) ?? 0))}
                  </Text>
                </View>
              </View>
            ))}

            {wageRows.length > 0 ? (
              <>
                <SectionHeading overline="مستحقات الفترة" title="أجور الكباتن" />
                {wageRows.map((row) => (
                  <View key={row.captain_id} style={styles.activityCard}>
                    <View style={[styles.activityAccent, styles.captainAccent]} />
                    <View style={[styles.activityIcon, styles.captainIcon]}>
                      <Truck size={18} color="#0A8A67" />
                    </View>
                    <View style={styles.activityContent}>
                      <View style={styles.activityTop}>
                        <Text style={styles.activityTitle}>{row.captain_name}</Text>
                        <Text style={styles.captainAmount}>{money(row.captain_net_total)}</Text>
                      </View>
                      <Text style={styles.activitySubtitle}>
                        {row.order_count} طلبات نهائية · تعويضات {money(row.settlement_total)}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
      <AdminCompanyPdfReports
        onClose={() => setShowPdfReports(false)}
        userName={profile?.full_name ?? profile?.email ?? null}
        visible={showPdfReports}
      />
    </ScreenContainer>
  );
}

function FinancialBreakdownChart({
  animationKey,
  slices,
}: {
  animationKey: string;
  slices: FinanceBreakdownSlice[];
}) {
  const [rotation] = useState(() => new Animated.Value(0));
  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["-180deg", "180deg"],
  });

  useEffect(() => {
    rotation.setValue(0);
    const animation = Animated.timing(rotation, {
      duration: 850,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [animationKey, rotation]);

  const visibleSlices = slices
    .filter((slice) => Number.isFinite(slice.value) && Math.abs(slice.value) > 0.005)
    .map((slice) => ({ ...slice, magnitude: Math.abs(slice.value) }));
  const total = visibleSlices.reduce((sum, slice) => sum + slice.magnitude, 0);
  const chartSegments = visibleSlices.reduce<
    { slice: (typeof visibleSlices)[number]; length: number; offset: number }[]
  >((segments, slice) => {
    const length = (slice.magnitude / total) * CHART_CIRCUMFERENCE;
    const previous = segments.at(-1);
    return [
      ...segments,
      {
        slice,
        length,
        offset: previous ? previous.offset + previous.length : 0,
      },
    ];
  }, []);

  return (
    <View style={styles.breakdownCard}>
      <View style={styles.breakdownHeader}>
        <Text style={styles.breakdownTitle}>التوزيع المالي</Text>
      </View>
      {!visibleSlices.length || total <= 0 ? (
        <Text style={styles.breakdownEmpty}>لا توجد مبالغ مالية قابلة للعرض ضمن هذه الفترة.</Text>
      ) : (
        <>
          <View style={styles.chartAndLegend}>
            <View style={styles.donutWrap}>
              <Animated.View style={[styles.donutAnimation, { transform: [{ rotate: spin }] }]}>
                <Svg height={144} viewBox="0 0 144 144" width={144}>
                <Circle
                  cx={CHART_CENTER}
                  cy={CHART_CENTER}
                  fill="none"
                  r={CHART_RADIUS}
                  stroke="#E8F0F5"
                  strokeWidth={18}
                />
                {chartSegments.map(({ slice, length, offset }) => (
                  <Circle
                    key={slice.label}
                    cx={CHART_CENTER}
                    cy={CHART_CENTER}
                    fill="none"
                    r={CHART_RADIUS}
                    rotation={-90}
                    origin={`${CHART_CENTER}, ${CHART_CENTER}`}
                    stroke={slice.color}
                    strokeDasharray={`${length} ${CHART_CIRCUMFERENCE}`}
                    strokeDashoffset={-offset}
                    strokeLinecap="butt"
                    strokeWidth={18}
                  />
                ))}
                </Svg>
              </Animated.View>
              <View pointerEvents="none" style={styles.donutCenter}>
                <Text style={styles.donutCenterTitle}>توزيع</Text>
                <Text style={styles.donutCenterSubtitle}>الفترة</Text>
              </View>
            </View>
            <View style={styles.legend}>
              {slices.map((slice) => (
                <View key={slice.label} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
                  <View style={styles.legendText}>
                    <Text numberOfLines={1} style={styles.legendLabel}>{slice.label}</Text>
                    <Text style={styles.legendValue}>{money(slice.value)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function SectionHeading({ overline, title }: { overline: string; title: string }) {
  return (
    <View style={styles.sectionHeading}>
      <View>
        <Text style={styles.overline}>{overline}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
    </View>
  );
}

function MetricCard({
  icon,
  label,
  value,
  highlighted = false,
  tone = "blue",
}: {
  icon: Icon;
  label: string;
  value: string;
  highlighted?: boolean;
  tone?: "blue" | "green" | "purple" | "orange" | "red";
}) {
  const iconBackground = highlighted
    ? "rgba(255,255,255,0.17)"
    : tone === "green"
      ? "#E8F8F2"
      : tone === "purple"
        ? "#F3EEFF"
        : tone === "orange"
          ? "#FFF4DE"
          : tone === "red"
          ? "#FFF0F0"
          : "#EAF5FC";
  return (
    <View style={[styles.metricCard, highlighted && styles.metricCardHighlight]}>
      <View style={styles.metricTop}>
        <View style={[styles.metricIcon, { backgroundColor: iconBackground }]}>{icon}</View>
      </View>
      <Text style={[styles.metricValue, highlighted && styles.metricValueHighlight]}>{value}</Text>
      <Text style={[styles.metricLabel, highlighted && styles.metricLabelHighlight]}>{label}</Text>
    </View>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <View style={styles.loadingCard}>
      <ActivityIndicator color={BLUE} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#F4F7FB", flex: 1 },
  deniedScreen: { alignItems: "center", backgroundColor: "#F4F7FB", flex: 1, justifyContent: "center", padding: 20 },
  deniedText: { color: "#173B59", fontSize: 16, fontWeight: "700", textAlign: "center", writingDirection: "rtl" },
  listContent: { paddingBottom: 34, paddingHorizontal: 16, paddingTop: 12 },
  heroCard: { borderColor: "#D8EBF7", borderRadius: 24, borderWidth: 1, marginBottom: 18, overflow: "hidden", padding: 17, shadowColor: "#0C679D", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 14 },
  heroTopRow: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  heroPill: { alignItems: "center", backgroundColor: "#E4F8EE", borderRadius: 12, flexDirection: "row-reverse", gap: 5, paddingHorizontal: 9, paddingVertical: 5 },
  heroDot: { backgroundColor: "#19A778", borderRadius: 4, height: 7, width: 7 },
  heroPillText: { color: "#08745A", fontSize: 10, fontWeight: "800", writingDirection: "rtl" },
  heroDate: { color: "#6E90A6", fontSize: 11, fontWeight: "700", writingDirection: "rtl" },
  heroTitle: { color: "#123D60", fontSize: 21, fontWeight: "800", marginTop: 17, textAlign: "right", writingDirection: "rtl" },
  heroSubtitle: { color: "#608098", fontSize: 12, lineHeight: 20, marginTop: 5, textAlign: "right", writingDirection: "rtl" },
  periodPicker: { backgroundColor: "rgba(227,240,248,0.8)", borderRadius: 14, flexDirection: "row-reverse", gap: 5, marginTop: 15, padding: 4 },
  pdfReportButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#CDE5F4", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginBottom: 18, padding: 12, shadowColor: "#0C679D", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10 },
  pdfReportIcon: { alignItems: "center", backgroundColor: "#EAF6FF", borderRadius: 12, height: 40, justifyContent: "center", width: 40 },
  pdfReportText: { flex: 1 },
  pdfReportTitle: { color: "#164866", fontSize: 13, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  pdfReportSubtitle: { color: "#6F8CA0", fontSize: 9, marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  pdfReportAction: { color: "#0878D1", fontSize: 10, fontWeight: "800", writingDirection: "rtl" },
  periodChoice: { alignItems: "center", borderRadius: 10, flex: 1, justifyContent: "center", minHeight: 32 },
  periodChoiceSelected: { backgroundColor: "#FFFFFF", shadowColor: "#0C679D", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5 },
  periodText: { color: "#718C9F", fontSize: 10, fontWeight: "700", writingDirection: "rtl" },
  periodTextSelected: { color: "#0878D1", fontWeight: "800" },
  sectionHeading: { alignItems: "flex-end", flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 11, marginTop: 6 },
  overline: { color: "#7B9AAC", fontSize: 10, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  sectionTitle: { color: "#163E5C", fontSize: 17, fontWeight: "800", marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  periodSummaryCard: { backgroundColor: "#FFFFFF", borderColor: "#E2EDF5", borderRadius: 15, borderWidth: 1, marginBottom: 9, paddingHorizontal: 12, paddingVertical: 10 },
  periodSummaryTitle: { color: "#214B67", fontSize: 11, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  periodSummarySubtitle: { color: "#6F8EA3", fontSize: 9, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  metricGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, justifyContent: "space-between", marginBottom: 14 },
  metricCard: { backgroundColor: "#FFFFFF", borderColor: "#E6EEF4", borderRadius: 16, borderWidth: 1, minHeight: 90, overflow: "hidden", padding: 11, shadowColor: "#113D5B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.055, shadowRadius: 9, width: "48.5%" },
  metricCardHighlight: { backgroundColor: "#0878D1", borderColor: "#0878D1", shadowColor: "#0878D1", shadowOpacity: 0.2, shadowRadius: 13 },
  metricTop: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  metricIcon: { alignItems: "center", borderRadius: 10, height: 29, justifyContent: "center", width: 29 },
  metricValue: { color: "#164C70", fontSize: 15, fontWeight: "800", marginTop: 8, textAlign: "right", writingDirection: "rtl" },
  metricValueHighlight: { color: "#FFFFFF" },
  metricLabel: { color: "#6A879A", fontSize: 9, lineHeight: 15, marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  metricLabelHighlight: { color: "rgba(255,255,255,0.82)" },
  breakdownCard: { backgroundColor: "#FFFFFF", borderColor: "#DCEAF3", borderRadius: 20, borderWidth: 1, marginBottom: 18, padding: 14, shadowColor: "#113D5B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.055, shadowRadius: 9 },
  breakdownHeader: { alignItems: "flex-end", flexDirection: "row-reverse" },
  breakdownTitle: { color: "#173F5C", fontSize: 14, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  chartAndLegend: { alignItems: "center", flexDirection: "row-reverse", gap: 12, marginTop: 10 },
  donutWrap: { alignItems: "center", height: 144, justifyContent: "center", width: 144 },
  donutAnimation: { height: 144, width: 144 },
  donutCenter: { alignItems: "center", justifyContent: "center", position: "absolute" },
  donutCenterTitle: { color: "#214B67", fontSize: 12, fontWeight: "800", writingDirection: "rtl" },
  donutCenterSubtitle: { color: "#7390A3", fontSize: 9, marginTop: -2, writingDirection: "rtl" },
  legend: { flex: 1, gap: 1 },
  legendRow: { alignItems: "center", borderBottomColor: "#ECF2F6", borderBottomWidth: 1, flexDirection: "row-reverse", gap: 7, minHeight: 34 },
  legendDot: { borderRadius: 5, height: 10, width: 10 },
  legendText: { flex: 1 },
  legendLabel: { color: "#48687E", fontSize: 9, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  legendValue: { color: "#183F5A", fontSize: 10, fontWeight: "800", marginTop: -1, textAlign: "right", writingDirection: "rtl" },
  breakdownEmpty: { color: "#75818E", fontSize: 11, paddingVertical: 18, textAlign: "center", writingDirection: "rtl" },
  activityCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4EDF3", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginBottom: 9, minHeight: 86, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 11, shadowColor: "#113D5B", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.045, shadowRadius: 8 },
  activityAccent: { backgroundColor: "#4F90BB", bottom: 0, position: "absolute", right: 0, top: 0, width: 4 },
  activityAccentLoss: { backgroundColor: "#D65A5A" },
  captainAccent: { backgroundColor: "#16B384" },
  activityIcon: { alignItems: "center", backgroundColor: "#EAF5FC", borderRadius: 11, height: 35, justifyContent: "center", width: 35 },
  activityIconLoss: { backgroundColor: "#FFF0F0" },
  captainIcon: { backgroundColor: "#E8F8F2" },
  activityContent: { flex: 1 },
  activityTop: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  activityTitle: { color: "#193F5B", flex: 1, fontSize: 12, fontWeight: "800", marginLeft: 8, textAlign: "right", writingDirection: "rtl" },
  activitySubtitle: { color: "#7894A7", fontSize: 10, marginTop: 4, textAlign: "right", writingDirection: "rtl" },
  activityProfit: { color: "#08755C", fontSize: 10, fontWeight: "800", marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  activityLoss: { color: "#B94040" },
  ordersBadge: { backgroundColor: "#EAF4FF", borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3 },
  ordersBadgeText: { color: "#287AAC", fontSize: 9, fontWeight: "800", writingDirection: "rtl" },
  captainAmount: { color: "#08755C", fontSize: 11, fontWeight: "800", writingDirection: "rtl" },
  loadingCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DBE7F2", borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 36 },
  loadingText: { color: "#75818E", fontSize: 12, marginTop: 8, writingDirection: "rtl" },
  errorCard: { alignItems: "center", backgroundColor: "#FFF5F5", borderColor: "#F6D5D8", borderRadius: 16, borderWidth: 1, padding: 14 },
  errorText: { color: "#9C343D", fontSize: 12, fontWeight: "700", textAlign: "center", writingDirection: "rtl" },
  retryButton: { alignItems: "center", flexDirection: "row-reverse", gap: 4, marginTop: 9 },
  retryText: { color: "#0878D1", fontSize: 11, fontWeight: "800", writingDirection: "rtl" },
  emptyCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#C7DAE8", borderRadius: 16, borderStyle: "dashed", borderWidth: 1, paddingHorizontal: 16, paddingVertical: 36 },
  emptyText: { color: "#75818E", fontSize: 12, writingDirection: "rtl" },
  smallPressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
});
