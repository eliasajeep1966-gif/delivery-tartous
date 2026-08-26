import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  Building2,
  ClipboardList,
  RefreshCw,
  TrendingUp,
  Truck,
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

const BLUE = "#0060B8";
const money = (value: number) =>
  `${new Intl.NumberFormat("en-US").format(value)} ل.س`;
const date = (value: string) =>
  new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    dateStyle: "medium",
  }).format(new Date(`${value}T12:00:00Z`));

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
        className="items-center justify-center bg-[#F8FAFC] p-5"
        containerClassName="bg-[#F8FAFC]"
      >
        <Text className="text-center text-base font-bold text-[#173B59]">
          هذه الشاشة مخصصة للأدمن والمشرف.
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-[#F8FAFC]" containerClassName="bg-[#F8FAFC]">
      <DeliveryAppHeader
        contextLabel="التقارير"
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
        contentContainerClassName="gap-4 p-4 pb-8"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={history.isRefetching || wages.isRefetching}
            onRefresh={retry}
            tintColor={BLUE}
          />
        }
      >
        <View className="rounded-3xl border border-[#E4EEF7] bg-white p-4 shadow-[0_8px_30px_rgba(0,96,184,0.04)]">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 items-end">
              <Text className="text-right text-lg font-bold text-[#1C1B1B]">
                تقرير المكتب
              </Text>
              <Text className="mt-1 text-right text-xs leading-5 text-[#58616B]">
                ملخص الطلبات والأجور حسب الفترة.
              </Text>
            </View>
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF4FF]">
              <TrendingUp size={23} color={BLUE} />
            </View>
          </View>
          <View className="mt-4 flex-row gap-2">
            {(["daily", "weekly", "monthly"] as const).map((value) => (
              <Pressable
                key={value}
                onPress={() => setPeriod(value)}
                className={`h-10 flex-1 items-center justify-center rounded-full active:scale-95 ${period === value ? "bg-[#0060B8]" : "border border-[#D4E2EC] bg-[#FBFDFF]"}`}
              >
                <Text
                  className={`text-xs font-bold ${period === value ? "text-white" : "text-[#58616B]"}`}
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
        </View>
        {history.isPending || wages.isPending ? (
          <View className="items-center rounded-2xl border border-[#DBE7F2] bg-white px-4 py-10">
            <ActivityIndicator color={BLUE} />
            <Text className="mt-2 text-sm text-[#75818E]">
              جارٍ تحميل التقارير...
            </Text>
          </View>
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
              <RefreshCw size={16} color={BLUE} />
              <Text className="text-xs font-bold text-[#0060B8]">
                إعادة المحاولة
              </Text>
            </Pressable>
          </View>
        ) : rows.length === 0 ? (
          <View className="rounded-2xl border border-dashed border-[#C7DAE8] bg-white px-4 py-10">
            <Text className="text-center text-sm text-[#75818E]">
              لا توجد بيانات مالية لهذه الفترة.
            </Text>
          </View>
        ) : (
          <>
            <View className="rounded-3xl bg-[#0060B8] p-4 shadow-[0_8px_30px_rgba(0,96,184,0.04)]">
              <Text className="text-right text-xs text-[#DCEAFF]">
                إجمالي الأجور
              </Text>
              <Text className="mt-1 text-right text-2xl font-bold text-white">
                {money(totals.gross)}
              </Text>
              <View className="mt-4 flex-row gap-2">
                <View className="flex-1 rounded-2xl bg-white/15 p-3">
                  <Text className="text-right text-[10px] text-[#DCEAFF]">
                    حصة الكباتن
                  </Text>
                  <Text className="mt-1 text-right text-sm font-bold text-white">
                    {money(totals.captain)}
                  </Text>
                </View>
                <View className="flex-1 rounded-2xl bg-white/15 p-3">
                  <Text className="text-right text-[10px] text-[#DCEAFF]">
                    صافي المكتب
                  </Text>
                  <Text className="mt-1 text-right text-sm font-bold text-white">
                    {money(totals.company)}
                  </Text>
                </View>
              </View>
            </View>
            <View className="flex-row gap-3">
              <Metric
                icon={<ClipboardList size={20} color={BLUE} />}
                label="طلبات الفترة"
                value={String(totals.orders)}
              />
              <Metric
                icon={<Building2 size={20} color={BLUE} />}
                label="صافي المكتب"
                value={money(totals.company)}
              />
            </View>
            <Text className="mt-1 text-right text-base font-bold text-[#1C1B1B]">
              الحصيلة حسب التاريخ
            </Text>
            {rows.map((row) => (
              <View
                key={`${row.period_start}-${row.period_end}`}
                className="flex-row items-center justify-between rounded-3xl border border-[#E4EEF7] bg-white p-3.5 shadow-[0_8px_30px_rgba(0,96,184,0.04)]"
              >
                <View className="items-end">
                  <Text className="text-right text-sm font-bold text-[#1C1B1B]">
                    {period === "daily"
                      ? date(row.period_start)
                      : `من ${date(row.period_start)} إلى ${date(row.period_end)}`}
                  </Text>
                  <Text className="mt-1 text-[11px] text-[#66727E]">
                    {row.order_count} طلبات
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-sm font-bold text-[#0060B8]">
                    {money(row.gross_total)}
                  </Text>
                  <Text className="mt-1 text-[10px] text-emerald-700">
                    المكتب {money(row.company_total)}
                  </Text>
                </View>
              </View>
            ))}
            {wageRows.length > 0 ? (
              <>
                <Text className="mt-1 text-right text-base font-bold text-[#1C1B1B]">
                  أجور الكباتن
                </Text>
                {wageRows.map((row) => (
                  <View
                    key={row.captain_id}
                    className="flex-row items-center justify-between rounded-3xl border border-[#E4EEF7] bg-white p-3.5 shadow-[0_8px_30px_rgba(0,96,184,0.04)]"
                  >
                    <View className="items-end">
                      <Text className="text-sm font-bold text-[#1C1B1B]">
                        {row.captain_name}
                      </Text>
                      <Text className="mt-1 text-[10px] text-[#66727E]">
                        {row.order_count} طلبات
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Truck size={15} color="#047857" />
                      <Text className="text-sm font-bold text-emerald-700">
                        {money(row.captain_net_total)}
                      </Text>
                    </View>
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

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-1 rounded-3xl border border-[#E4EEF7] bg-white p-3.5 shadow-[0_8px_30px_rgba(0,96,184,0.04)]">
      <View className="h-10 w-10 items-center justify-center rounded-2xl bg-blue-50">{icon}</View>
      <Text className="mt-3 text-right text-xs font-bold text-[#58616B]">
        {label}
      </Text>
      <Text className="mt-1 text-right text-lg font-bold text-[#1C1B1B]">
        {value}
      </Text>
    </View>
  );
}
