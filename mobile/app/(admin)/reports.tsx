import { useMemo, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text as NativeText,
  View,
} from "react-native";
import {
  Building2,
  ClipboardList,
  RefreshCw,
  TrendingUp,
  Truck,
  WalletCards,
} from "lucide-react-native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import {
  useNativeAdminWagePeriods,
  useNativeCompanyProfitHistory,
  type NativeFinancePeriod,
} from "@/features/admin/use-admin-finance";

const BLUE = "#0878D1";

function Text({
  style,
  className,
  ...props
}: ComponentProps<typeof NativeText> & { className?: string }) {
  const isBold = className?.includes("font-bold");
  return (
    <NativeText
      {...props}
      className={className}
      style={[style, { fontFamily: isBold ? "Cairo_700Bold" : "Cairo_400Regular" }]}
    />
  );
}

const money = (value: number) =>
  `${new Intl.NumberFormat("en-US").format(value)} ل.س`;
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
  const history = useNativeCompanyProfitHistory(period);
  const wages = useNativeAdminWagePeriods();
  const isBackOffice =
    profile?.role === "admin" || profile?.role === "supervisor";
  const rows = useMemo(() => history.data ?? [], [history.data]);
  const wageRows = useMemo(
    () =>
      wages.data.filter((row) => row.period_start === rows[0]?.period_start),
    [rows, wages.data],
  );
  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => ({
          gross: sum.gross + row.gross_total,
          company: sum.company + row.company_total,
          captain: sum.captain + row.captain_net_total,
          orders: sum.orders + row.order_count,
        }),
        { gross: 0, company: 0, captain: 0, orders: 0 },
      ),
    [rows],
  );
  const retry = () => {
    void history.refetch();
    void wages.refetch();
  };

  if (!isBackOffice) {
    return (
      <ScreenContainer
        className="items-center justify-center bg-[#F4F8FC] p-5"
        containerClassName="bg-[#F4F8FC]"
      >
        <Text className="text-center text-base font-bold text-[#173B59]">
          هذه الشاشة مخصصة للأدمن والمشرف.
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-[#F4F8FC]" containerClassName="bg-[#EAF4FA]">
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "العودة",
          icon: "arrow-forward",
          onPress: () =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)"),
        }}
        trailingAction={{ accessibilityLabel: "التقارير", icon: "bar-chart" }}
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-4 pb-8 pt-3"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={history.isRefetching || wages.isRefetching}
            onRefresh={retry}
            tintColor={BLUE}
          />
        }
      >
        <View className="rounded-2xl border border-[#DCE9F2] bg-white px-4 py-3.5 shadow-[0_5px_16px_rgba(21,70,106,0.04)]">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 items-end">
              <Text className="text-right text-[17px] font-bold text-[#173F5B]">
                تقرير المكتب
              </Text>
              <Text className="mt-0.5 text-right text-[10px] text-[#718A9A]">
                مؤشرات الأجور وحصة المكتب حسب الفترة المختارة.
              </Text>
            </View>
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#EAF5FF]">
              <TrendingUp size={19} color={BLUE} />
            </View>
          </View>
          <View className="mt-3 flex-row rounded-xl bg-[#F1F6FA] p-1">
            {periods.map((item) => {
              const selected = period === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setPeriod(item.id)}
                  className={`h-8 flex-1 items-center justify-center rounded-[10px] ${selected ? "bg-white shadow-[0_2px_6px_rgba(15,65,100,0.10)]" : ""}`}
                >
                  <Text
                    className={`text-[10px] font-bold ${selected ? "text-[#0878D1]" : "text-[#698394]"}`}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {history.isPending || wages.isPending ? (
          <LoadingState label="جارٍ تحميل التقارير..." />
        ) : history.error || wages.error ? (
          <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <Text className="text-center text-sm font-bold text-[#BA1A1A]">
              {history.error instanceof Error
                ? history.error.message
                : wages.error instanceof Error
                  ? wages.error.message
                  : "تعذر تحميل التقارير."}
            </Text>
            <Pressable
              onPress={retry}
              className="mt-3 flex-row items-center justify-center gap-2"
            >
              <RefreshCw size={15} color={BLUE} />
              <Text className="text-[11px] font-bold text-[#0878D1]">
                إعادة المحاولة
              </Text>
            </Pressable>
          </View>
        ) : rows.length === 0 ? (
          <View className="items-center rounded-2xl border border-dashed border-[#C7DAE8] bg-white px-4 py-10">
            <Text className="text-center text-sm text-[#75818E]">
              لا توجد بيانات مالية لهذه الفترة.
            </Text>
          </View>
        ) : (
          <>
            <View className="overflow-hidden rounded-2xl bg-[#063B78] px-4 py-4 shadow-[0_7px_18px_rgba(6,59,120,0.16)]">
              <View className="flex-row items-center justify-between">
                <View className="rounded-lg bg-white/15 px-2 py-1">
                  <Text className="text-[9px] font-bold text-[#CFEFFF]">قرار الفترة</Text>
                </View>
                <Text className="text-right text-[10px] text-[#CFEFFF]">صافي المكتب</Text>
              </View>
              <Text className="mt-1 text-right text-[25px] font-bold text-white">
                {money(totals.company)}
              </Text>
              <View className="mt-3 h-px bg-white/15" />
              <View className="mt-3 flex-row items-center justify-between">
                <Text className="text-[10px] text-[#BBDDF2]">من إجمالي أجور الفترة</Text>
                <Text className="text-[13px] font-bold text-white">{money(totals.gross)}</Text>
              </View>
            </View>

            <View className="flex-row gap-2.5">
              <SummaryMetric
                icon={<WalletCards size={17} color="#0878D1" />}
                label="إجمالي الأجور"
                value={money(totals.gross)}
              />
              <SummaryMetric
                icon={<Truck size={17} color="#0878D1" />}
                label="حصة الكباتن"
                value={money(totals.captain)}
              />
            </View>
            <View className="flex-row gap-2.5">
              <SummaryMetric
                icon={<ClipboardList size={17} color="#0878D1" />}
                label="طلبات الفترة"
                value={`${totals.orders} طلب`}
              />
              <SummaryMetric
                icon={<Building2 size={17} color="#0A8A67" />}
                label="حصيلة المكتب"
                value={money(totals.company)}
                tone="green"
              />
            </View>

            <SectionTitle title="ملخص الفترة" subtitle="النتائج المسجلة حسب التاريخ" />
            {rows.map((row) => (
              <View
                key={`${row.period_start}-${row.period_end}`}
                className="rounded-2xl border border-[#E0EAF1] bg-white px-3.5 py-3 shadow-[0_4px_12px_rgba(21,70,106,0.035)]"
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="items-end">
                    <Text className="text-right text-xs font-bold text-[#21465F]">
                      {period === "daily"
                        ? date(row.period_start)
                        : `من ${date(row.period_start)} إلى ${date(row.period_end)}`}
                    </Text>
                    <Text className="mt-1 text-[10px] text-[#78909F]">
                      {row.order_count} طلبات مكتملة
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[13px] font-bold text-[#0878D1]">
                      {money(row.gross_total)}
                    </Text>
                    <Text className="mt-1 text-[10px] font-bold text-[#0A8A67]">
                      صافي {money(row.company_total)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}

            {wageRows.length > 0 ? (
              <>
                <SectionTitle title="حصة الكباتن" subtitle="للأكثر حداثة ضمن الفترة" />
                {wageRows.map((row) => (
                  <View
                    key={row.captain_id}
                    className="flex-row items-center justify-between rounded-2xl border border-[#E0EAF1] bg-white px-3.5 py-3"
                  >
                    <View className="flex-row items-center gap-2">
                      <View className="h-8 w-8 items-center justify-center rounded-xl bg-[#EAF5FF]">
                        <Truck size={15} color={BLUE} />
                      </View>
                      <View className="items-start">
                        <Text className="text-xs font-bold text-[#21465F]">
                          {row.captain_name}
                        </Text>
                        <Text className="mt-0.5 text-[10px] text-[#78909F]">
                          {row.order_count} طلبات
                        </Text>
                      </View>
                    </View>
                    <Text className="text-[12px] font-bold text-[#08755C]">
                      {money(row.captain_net_total)}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <View className="items-center rounded-2xl border border-[#DBE7F2] bg-white px-4 py-10">
      <ActivityIndicator color={BLUE} />
      <Text className="mt-2 text-sm text-[#75818E]">{label}</Text>
    </View>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View className="mt-1 flex-row items-end justify-between">
      <Text className="text-[10px] text-[#7892A4]">{subtitle}</Text>
      <Text className="text-right text-[15px] font-bold text-[#173F5B]">{title}</Text>
    </View>
  );
}

function SummaryMetric({
  icon,
  label,
  value,
  tone = "blue",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "blue" | "green";
}) {
  return (
    <View className="flex-1 rounded-2xl border border-[#E0EAF1] bg-white p-3 shadow-[0_4px_12px_rgba(21,70,106,0.035)]">
      <View className="flex-row items-center justify-between">
        <View className={`h-7 w-7 items-center justify-center rounded-lg ${tone === "green" ? "bg-[#EAF9F3]" : "bg-[#EAF5FF]"}`}>
          {icon}
        </View>
        <Text className="text-right text-[9px] font-bold text-[#748B9B]">{label}</Text>
      </View>
      <Text className={`mt-2 text-right text-[13px] font-bold ${tone === "green" ? "text-[#08755C]" : "text-[#173F5B]"}`}>
        {value}
      </Text>
    </View>
  );
}
