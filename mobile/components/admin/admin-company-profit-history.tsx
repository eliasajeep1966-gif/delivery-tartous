import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
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
  return new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    month: "long",
    year: "numeric",
  }).format(start);
}

function periodButtonLabel(period: NativeFinancePeriod) {
  if (period === "daily") return "يومي";
  if (period === "weekly") return "أسبوعي";
  return "شهري";
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
        {(["daily", "weekly", "monthly"] as const).map((period) => (
          <Pressable
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
          </Pressable>
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
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="العودة إلى أرباح الشركة"
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace("/company-wages" as never)
          }
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <MaterialIcons name="arrow-forward" size={22} color="#FFF" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>الأجور وحساب الشركة</Text>
          <Text style={styles.headerTitle}>السجل الكامل</Text>
        </View>
        <View style={styles.icon}>
          <MaterialIcons name="account-balance-wallet" size={21} color="#FFF" />
        </View>
      </View>

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
                <Pressable
                  onPress={history.loadMore}
                  style={({ pressed }) => [
                    styles.loadMore,
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialIcons name="expand-more" size={19} color={BLUE} />
                  <Text style={styles.loadMoreText}>تحميل فترات أقدم</Text>
                </Pressable>
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
        <Pressable onPress={onAction} style={styles.retryButton}>
          <Text style={styles.retryText}>{actionLabel}</Text>
        </Pressable>
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
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  headerText: { alignItems: "flex-end", flex: 1, marginHorizontal: 12 },
  eyebrow: { color: "#DBEAFF", fontSize: 11 },
  headerTitle: { color: "#FFF", fontSize: 19, fontWeight: "800" },
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
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
  },
  muted: { color: "#66727E", fontSize: 10, marginTop: 3, textAlign: "right" },
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
  metricValue: { fontSize: 15, fontWeight: "800", textAlign: "right" },
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
  periodText: { color: "#5C7C90", fontSize: 11, fontWeight: "700" },
  activePeriodText: { color: "#FFF" },
  heading: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 4,
  },
  title: { color: "#1C1B1B", fontSize: 15, fontWeight: "800" },
  badge: {
    backgroundColor: "#EAE8FF",
    borderRadius: 14,
    color: VIOLET,
    fontSize: 10,
    fontWeight: "800",
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
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  rowEnd: { alignItems: "flex-end" },
  company: { color: VIOLET, fontSize: 13, fontWeight: "800" },
  rowCaption: { color: "#66727E", fontSize: 10, marginTop: 3 },
  amount: { color: "#1C1B1B", fontSize: 11, fontWeight: "700", marginTop: 3 },
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
  loadingMoreText: { color: BLUE, fontSize: 11, fontWeight: "700" },
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
  loadMoreText: { color: BLUE, fontSize: 12, fontWeight: "800" },
  endText: { color: "#75818E", fontSize: 11, textAlign: "center" },
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
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#EAF4FF",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  retryText: { color: BLUE, fontSize: 11, fontWeight: "800" },
});
