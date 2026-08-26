import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useMemo, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text as NativeText,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { useAppToast } from "@/contexts/app-toast-context";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import { useAdminCaptainsData } from "@/features/admin/use-admin-captains";

const filters = [
  { id: "all", label: "الكل" },
  { id: "held", label: "مع الكابتن" },
  { id: "returned", label: "تم الاستلام" },
] as const;
type CustodyFilter = (typeof filters)[number]["id"];

type CustodyRow = ReturnType<
  typeof useAdminCaptainsData
>["captains"][number]["custodyRecords"][number] & {
  captainName: string;
  captainInitial: string;
};

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

function formatCompactDate(value: string) {
  if (!value) return "غير محدد";
  return new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminCustodyScreen() {
  const router = useRouter();
  const { profile } = useDeliveryAuth();
  const { showToast } = useAppToast();
  const data = useAdminCaptainsData();
  const [filter, setFilter] = useState<CustodyFilter>("all");
  const [returningId, setReturningId] = useState<string | null>(null);

  const rows = useMemo<CustodyRow[]>(
    () =>
      data.captains
        .flatMap((captain) =>
          captain.custodyRecords.map((record) => ({
            ...record,
            captainName: captain.name,
            captainInitial: captain.initial,
          })),
        )
        .filter(
          (record) =>
            filter === "all" ||
            (filter === "held" && record.returnedAt === null) ||
            (filter === "returned" && record.returnedAt !== null),
        ),
    [data.captains, filter],
  );
  const heldCount = useMemo(
    () =>
      data.captains.reduce(
        (count, captain) =>
          count + captain.custodyRecords.filter((record) => !record.returnedAt).length,
        0,
      ),
    [data.captains],
  );

  const handleReturn = async (record: CustodyRow) => {
    if (returningId) return;
    setReturningId(record.id);
    try {
      await data.returnCustody(record.id);
      showToast({ message: `تم تسجيل استلام الأمانة من ${record.captainName}.` });
    } catch (cause) {
      Alert.alert(
        "تعذر تسجيل الاستلام",
        cause instanceof Error ? cause.message : "حاول مرة أخرى.",
      );
    } finally {
      setReturningId(null);
    }
  };

  if (profile?.role !== "admin" && profile?.role !== "supervisor") {
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
        trailingAction={{ accessibilityLabel: "إدارة الأمانات", icon: "inventory-2" }}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-4 pb-8 pt-3"
        refreshControl={
          <RefreshControl
            refreshing={data.isRefreshing}
            onRefresh={() => void data.reload(true)}
            tintColor="#0878D1"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-2xl border border-[#DCE9F2] bg-white px-4 py-3.5 shadow-[0_5px_16px_rgba(21,70,106,0.04)]">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 items-end">
              <Text className="text-right text-[17px] font-bold text-[#173F5B]">
                أمانات الكباتن
              </Text>
              <Text className="mt-0.5 text-right text-[10px] text-[#718A9A]">
                سجل الاستلام والإرجاع المرتبط بكل كابتن.
              </Text>
            </View>
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#EAF5FF]">
              <MaterialIcons name="inventory-2" size={19} color="#0878D1" />
            </View>
          </View>
          <View className="mt-3 flex-row items-center justify-between rounded-xl bg-[#063B78] px-3 py-2.5">
            <View className="flex-row items-center gap-1.5">
              <MaterialIcons name="assignment-late" size={15} color="#AEEAFF" />
              <Text className="text-[10px] text-[#CFEFFF]">بانتظار الاستلام</Text>
            </View>
            <Text className="text-[16px] font-bold text-white">{heldCount}</Text>
          </View>
        </View>

        {data.error ? (
          <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <Text className="text-center text-xs font-bold text-[#BA1A1A]">
              {data.error}
            </Text>
            <Pressable
              onPress={() => void data.reload()}
              className="mt-2 flex-row items-center justify-center gap-1"
            >
              <MaterialIcons name="refresh" size={16} color="#0878D1" />
              <Text className="text-[11px] font-bold text-[#0878D1]">إعادة المحاولة</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="flex-row rounded-xl bg-[#EDF4F8] p-1">
          {filters.map((item) => {
            const selected = filter === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setFilter(item.id)}
                className={`h-8 flex-1 items-center justify-center rounded-[10px] ${selected ? "bg-white shadow-[0_2px_6px_rgba(15,65,100,0.10)]" : ""}`}
              >
                <Text className={`text-[10px] font-bold ${selected ? "text-[#0878D1]" : "text-[#698394]"}`}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="flex-row items-center justify-between pt-1">
          <View className="rounded-lg bg-[#EAF5FF] px-2 py-1">
            <Text className="text-[10px] font-bold text-[#0878D1]">
              {data.isLoading ? "..." : `${rows.length} سجلات`}
            </Text>
          </View>
          <Text className="text-right text-[15px] font-bold text-[#173F5B]">سجل الأمانات</Text>
        </View>

        {data.isLoading ? (
          <View className="items-center rounded-2xl border border-[#DBE7F2] bg-white px-4 py-10">
            <ActivityIndicator size="small" color="#0878D1" />
            <Text className="mt-2 text-sm text-[#75818E]">جارٍ تحميل الأمانات...</Text>
          </View>
        ) : rows.length ? (
          rows.map((record) => {
            const held = record.returnedAt === null;
            const isReturning = returningId === record.id;
            return (
              <View
                key={record.id}
                className={`overflow-hidden rounded-2xl border bg-white shadow-[0_4px_12px_rgba(21,70,106,0.035)] ${held ? "border-[#CFE5F7]" : "border-[#E0EAF1]"}`}
              >
                <View className={`h-[3px] ${held ? "bg-[#0878D1]" : "bg-[#16A879]"}`} />
                <View className="p-3.5">
                  <View className="flex-row items-center justify-between gap-3">
                    <View className="flex-row items-center gap-2.5">
                      <View className={`h-9 w-9 items-center justify-center rounded-xl ${held ? "bg-[#EAF5FF]" : "bg-[#EAF9F3]"}`}>
                        <Text className={`text-[13px] font-bold ${held ? "text-[#0878D1]" : "text-[#08755C]"}`}>
                          {record.captainInitial}
                        </Text>
                      </View>
                      <View className="items-start">
                        <Text className="text-[12px] font-bold text-[#21465F]">
                          {record.captainName}
                        </Text>
                        <Text className="mt-0.5 text-[9px] text-[#78909F]">
                          {held
                            ? `سلّمت للكابتن ${formatCompactDate(record.assignedAt)}`
                            : `تم الاستلام ${formatCompactDate(record.returnedAt ?? "")}`}
                        </Text>
                      </View>
                    </View>
                    <View className={`rounded-lg px-2 py-1 ${held ? "bg-[#EAF5FF]" : "bg-[#EAF9F3]"}`}>
                      <Text className={`text-[9px] font-bold ${held ? "text-[#0878D1]" : "text-[#08755C]"}`}>
                        {held ? "لدى الكابتن" : "مستلمة"}
                      </Text>
                    </View>
                  </View>

                  <View className="mt-3 flex-row items-center rounded-xl bg-[#F4F8FB] px-2.5 py-2">
                    <MaterialIcons name="inventory-2" size={16} color="#4C7A99" />
                    <View className="mr-2 flex-1 items-end">
                      <Text numberOfLines={1} className="text-right text-[12px] font-bold text-[#244A63]">
                        {record.itemName}
                      </Text>
                      {record.itemDetails ? (
                        <Text numberOfLines={1} className="mt-0.5 text-right text-[9px] text-[#78909F]">
                          {record.itemDetails}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {held ? (
                    <Pressable
                      disabled={Boolean(returningId)}
                      onPress={() => void handleReturn(record)}
                      className="mt-3 h-9 flex-row items-center justify-center gap-1.5 rounded-xl bg-[#0878D1]"
                    >
                      {isReturning ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <MaterialIcons name="assignment-return" size={16} color="#FFFFFF" />
                      )}
                      <Text className="text-[11px] font-bold text-white">
                        {isReturning ? "جارٍ تسجيل الاستلام..." : "تأكيد الاستلام"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        ) : (
          <View className="items-center rounded-2xl border border-dashed border-[#C7DAE8] bg-white/70 px-4 py-10">
            <MaterialIcons name="inventory-2" size={24} color="#7D9AB0" />
            <Text className="mt-2 text-center text-sm text-[#75818E]">
              لا توجد أمانات مطابقة.
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
