import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { goBackOrReplace } from "@/lib/navigation/go-back-or-replace";
import { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { MotionPressable } from "@/components/ui/motion-pressable";
import {
  type NativeCompanyProfitPeriodRow,
  type NativeFinancePeriod,
  useNativeFullCompanyProfitHistory,
} from "@/features/admin/use-admin-finance";

const BLUE = "#0060B8";
const VIOLET = "#6D28D9";

const money = (value: number) =>
  `${new Intl.NumberFormat("en-US").format(value)} ل.س`;

function periodLabel(
  period: NativeFinancePeriod,
  row: NativeCompanyProfitPeriodRow,
) {
  const formatter = new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const start = new Date(`${row.period_start}T12:00:00Z`);
  const end = new Date(`${row.period_end}T12:00:00Z`);

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

function periodButtonLabel(period: NativeFinancePeriod) {
  if (period === "daily") return "يومي";
  if (period === "monthly") return "شهري";
  if (period === "annual") return "سنوي";
  return "أسبوعي";
}

export function AdminCompanyProfitHistory() {
  const router = useRouter();
  const history = useNativeFullCompanyProfitHistory();
  const rows = history.data;
  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => ({
          gross: sum.gross + row.gross_total,
          company: sum.company + row.company_total,
          orders: sum.orders + row.order_count,
        }),
        { gross: 0, company: 0, orders: 0 },
      ),
    [rows],
  );

  const header = (
    <>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <MaterialIcons name="history" size={24} color={VIOLET} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>سجل أرباح الشركة الكامل</Text>
          <Text style={styles.muted}>
            جميع فترات الأرباح تُحمّل تدريجيًا حسب الفترة المختارة.
          </Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <Metric
          label="إجمالي الأجور المحمّلة"
          value={money(totals.gross)}
          color="#1C1B1B"
        />
        <Metric
          label="حصة الشركة المحمّلة"
          value={money(totals.company)}
          color={VIOLET}
        />
        <Metric
          label="طلبات الفترات المحمّلة"
          value={String(totals.orders)}
          color={BLUE}
        />
      </View>

      <View style={styles.periods}>
        {(["daily", "monthly", "annual"] as const).map((period) => (
          <MotionPressable
            key={period}
            onPress={() => history.changePeriod(period)}
            style={[
              styles.period,
              history.period === period && styles.activePeriod,
            ]}
          >
            <Text
              style={[
                styles.periodText,
                history.period === period && styles.activePeriodText,
              ]}
            >
              {periodButtonLabel(period)}
            </Text>
          </MotionPressable>
        ))}
      </View>

      <View style={styles.heading}>
        <Text style={styles.title}>الفترات المعروضة</Text>
        <Text style={styles.badge}>{rows.length} فترات</Text>
      </View>
    </>
  );

  return (
    <ScreenContainer className="bg-[#F0F7FF]" containerClassName="bg-[#EAF5FF]">
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "العودة إلى أرباح الشركة",
          icon: "arrow-forward",
          onPress: () => goBackOrReplace(router, "/company-wages"),
        }}
        trailingAction={{
          accessibilityLabel: "السجل الكامل",
          icon: "account-balance-wallet",
        }}
      />

      <FlatList
        data={rows}
        keyExtractor={(row) => row.period_start}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowStart}>
              <Text style={styles.rowTitle}>
                {periodLabel(history.period, item)}
              </Text>
              <Text style={styles.muted}>{item.order_count} طلبات مكتملة</Text>
            </View>
            <View style={styles.rowEnd}>
              <Text style={styles.company}>{money(item.company_total)}</Text>
              <Text style={styles.rowCaption}>حصة الشركة</Text>
              <Text style={styles.amount}>{money(item.gross_total)}</Text>
            </View>
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          history.isPending ? (
            <StatusCard loading text="جارٍ تحميل سجل الأرباح الكامل..." />
          ) : history.error ? (
            <StatusCard
              text={
                history.error instanceof Error
                  ? history.error.message
                  : "تعذر تحميل سجل أرباح الشركة."
              }
              actionLabel="إعادة المحاولة"
              onAction={() => void history.refetch()}
            />
          ) : (
            <StatusCard text="لا توجد أرباح شركة مسجلة للفترة المختارة." />
          )
        }
        ListFooterComponent={
          rows.length ? (
            <View style={styles.footer}>
              {history.isFetchingNextPage ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color={BLUE} />
                  <Text style={styles.loadingMoreText}>
                    جارٍ تحميل فترات أقدم...
                  </Text>
                </View>
              ) : null}
              {history.hasMore ? (
                <MotionPressable
                  onPress={history.loadMore}
                  style={styles.loadMore}
                >
                  <MaterialIcons name="expand-more" size={19} color={BLUE} />
                  <Text style={styles.loadMoreText}>تحميل فترات أقدم</Text>
                </MotionPressable>
              ) : (
                <Text style={styles.endText}>
                  وصلت إلى أقدم الفترات المتاحة.
                </Text>
              )}
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={history.isRefetching}
            onRefresh={() => void history.refetch()}
            tintColor={BLUE}
          />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
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

function StatusCard({
  text,
  loading = false,
  actionLabel,
  onAction,
}: {
  text: string;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.statusCard}>
      {loading ? <ActivityIndicator size="small" color={BLUE} /> : null}
      <Text style={styles.statusText}>{text}</Text>
      {actionLabel && onAction ? (
        <MotionPressable onPress={onAction} style={styles.retryButton}>
          <Text style={styles.retryText}>{actionLabel}</Text>
        </MotionPressable>
      ) : null}
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
  content: { flexGrow: 1, gap: 12, padding: 18, paddingBottom: 34 },
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
  activePeriod: { backgroundColor: BLUE },
  periodText: { color: "#5C7C90", fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" },
  activePeriodText: { color: "#FFF" },
  heading: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 4,
  },
  title: { color: "#1C1B1B", fontFamily: "Cairo_700Bold", fontSize: 14, writingDirection: "rtl" },
  badge: {
    backgroundColor: "#EAE8FF",
    borderRadius: 14,
    color: VIOLET,
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
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
  rowStart: { flex: 1, marginLeft: 12 },
  rowTitle: {
    color: "#1C1B1B",
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
  rowEnd: { alignItems: "flex-end" },
  company: { color: VIOLET, fontFamily: "Cairo_700Bold", fontSize: 12, writingDirection: "rtl" },
  rowCaption: { color: "#66727E", fontFamily: "Cairo_400Regular", fontSize: 9, marginTop: 3, writingDirection: "rtl" },
  amount: { color: "#1C1B1B", fontFamily: "Cairo_600SemiBold", fontSize: 10, marginTop: 3, writingDirection: "rtl" },
  footer: { gap: 10, paddingTop: 4 },
  loadingMore: {
    alignItems: "center",
    backgroundColor: "#F8FBFE",
    borderRadius: 12,
    flexDirection: "row-reverse",
    gap: 8,
    justifyContent: "center",
    padding: 12,
  },
  loadingMoreText: { color: BLUE, fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" },
  loadMore: {
    alignItems: "center",
    backgroundColor: "#FFF",
    borderColor: "#B9D6ED",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 7,
    justifyContent: "center",
    minHeight: 44,
  },
  loadMoreText: { color: BLUE, fontFamily: "Cairo_700Bold", fontSize: 11, writingDirection: "rtl" },
  endText: { color: "#75818E", fontFamily: "Cairo_400Regular", fontSize: 10, textAlign: "center", writingDirection: "rtl" },
  statusCard: {
    alignItems: "center",
    backgroundColor: "#FFF",
    borderColor: "#C7DAE8",
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: 10,
    justifyContent: "center",
    minHeight: 130,
    padding: 18,
  },
  statusText: {
    color: "#58616B",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    textAlign: "center",
    writingDirection: "rtl",
  },
  retryButton: {
    backgroundColor: "#EAF4FF",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  retryText: { color: BLUE, fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" },
});
