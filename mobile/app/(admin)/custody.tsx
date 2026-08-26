import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
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
  { id: "returned", label: "تم الإرجاع" },
] as const;
type CustodyFilter = (typeof filters)[number]["id"];

type CustodyRow = ReturnType<
  typeof useAdminCaptainsData
>["captains"][number]["custodyRecords"][number] & {
  captainName: string;
  captainInitial: string;
};

function formatDate(value: string) {
  if (!value) return "غير محدد";
  return new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    dateStyle: "medium",
    timeStyle: "short",
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
          count +
          captain.custodyRecords.filter((record) => !record.returnedAt).length,
        0,
      ),
    [data.captains],
  );

  const handleReturn = async (record: CustodyRow) => {
    if (returningId) return;
    setReturningId(record.id);
    try {
      await data.returnCustody(record.id);
      showToast({ message: `تم تسجيل إرجاع الأمانة من ${record.captainName}.` });
    } catch (cause) {
      Alert.alert(
        "تعذر تسجيل الإرجاع",
        cause instanceof Error ? cause.message : "حاول مرة أخرى.",
      );
    } finally {
      setReturningId(null);
    }
  };

  if (profile?.role !== "admin" && profile?.role !== "supervisor") {
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
        contextLabel="إدارة الأمانات"
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
        contentContainerClassName="gap-4 p-4 pb-8"
        refreshControl={
          <RefreshControl
            refreshing={data.isRefreshing}
            onRefresh={() => void data.reload(true)}
            tintColor="#0060B8"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-3xl border border-[#E4EEF7] bg-white p-4 shadow-[0_8px_30px_rgba(0,96,184,0.04)]">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 items-end">
              <Text className="text-right text-lg font-bold text-[#1C1B1B]">
                أمانات الكباتن
              </Text>
              <Text className="mt-1 text-right text-xs leading-5 text-[#66788A]">
                تابع الأمانات المسجلة فعلياً وسجل إرجاعها.
              </Text>
            </View>
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF4FF]">
              <MaterialIcons name="inventory-2" size={23} color="#0060B8" />
            </View>
          </View>
          <View className="mt-4 rounded-2xl bg-[#EAF4FF] px-3 py-2.5">
            <Text className="text-right text-xs text-[#0060B8]">
              يوجد <Text className="font-bold">{heldCount}</Text> أمانات ما زالت
              مع الكباتن.
            </Text>
          </View>
        </View>

        {data.error ? (
          <View className="rounded-xl border border-red-200 bg-red-50 px-3 py-3">
            <Text className="text-center text-xs font-bold text-[#BA1A1A]">
              {data.error}
            </Text>
            <Pressable
              onPress={() => void data.reload()}
              className="mt-2 flex-row items-center justify-center gap-1"
            >
              <MaterialIcons name="refresh" size={16} color="#0060B8" />
              <Text className="text-[11px] font-bold text-[#0060B8]">
                إعادة المحاولة
              </Text>
            </Pressable>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2"
        >
          {filters.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setFilter(item.id)}
              className={`h-10 items-center justify-center rounded-full px-5 active:scale-95 ${filter === item.id ? "bg-[#0060B8]" : "border border-[#D4E2EC] bg-white"}`}
            >
              <Text
                className={`text-xs font-bold ${filter === item.id ? "text-white" : "text-[#58616B]"}`}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View className="flex-row items-center justify-between">
          <View className="rounded-full bg-[#EAF4FF] px-3 py-1">
            <Text className="text-xs font-bold text-[#0060B8]">
              {data.isLoading ? "..." : `${rows.length} سجلات`}
            </Text>
          </View>
          <Text className="text-base font-bold text-[#1C1B1B]">
            سجل الأمانات
          </Text>
        </View>

        {data.isLoading ? (
          <View className="items-center rounded-2xl border border-[#DBE7F2] bg-white px-4 py-10">
            <ActivityIndicator size="small" color="#0060B8" />
            <Text className="mt-2 text-sm text-[#75818E]">
              جارٍ تحميل الأمانات...
            </Text>
          </View>
        ) : rows.length ? (
          rows.map((record) => {
            const held = record.returnedAt === null;
            const isReturning = returningId === record.id;
            return (
              <View
                key={record.id}
                className="rounded-3xl border border-[#E4EEF7] bg-white p-4 shadow-[0_8px_30px_rgba(0,96,184,0.04)]"
              >
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1 items-end">
                    <Text className="text-right text-[10px] text-[#75818E]">
                      {formatDate(record.assignedAt)}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2.5">
                    <View className="items-end">
                      <Text className="text-right text-[15px] font-bold text-[#1C1B1B]">
                        {record.captainName}
                      </Text>
                      <View
                        className={`mt-1 rounded-full px-2 py-0.5 ${held ? "bg-blue-50" : "bg-sky-50"}`}
                      >
                        <Text className="text-[10px] font-bold text-[#0060B8]">
                          {held ? "مع الكابتن" : "تم الإرجاع"}
                        </Text>
                      </View>
                    </View>
                    <View className="h-10 w-10 items-center justify-center rounded-2xl bg-blue-50">
                      <Text className="text-sm font-bold text-[#52606D]">
                        {record.captainInitial}
                      </Text>
                    </View>
                  </View>
                </View>
                <View className="mt-3 rounded-2xl bg-[#F1F7FC] px-3 py-2">
                  <Text className="text-right text-xs font-bold text-[#4F5D6B]">
                    {record.itemName}
                  </Text>
                  {record.itemDetails ? (
                    <Text className="mt-1 text-right text-[10px] leading-5 text-[#75818E]">
                      {record.itemDetails}
                    </Text>
                  ) : null}
                </View>
                {held ? (
                  <Pressable
                    disabled={Boolean(returningId)}
                    onPress={() => void handleReturn(record)}
                    className="mt-3 h-10 flex-row items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 active:scale-95"
                  >
                    {isReturning ? (
                      <ActivityIndicator size="small" color="#0060B8" />
                    ) : (
                      <MaterialIcons
                        name="check-circle"
                        size={18}
                        color="#0060B8"
                      />
                    )}
                    <Text className="text-xs font-bold text-[#0060B8]">
                      تسجيل إرجاع الأمانة
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        ) : (
          <View className="items-center rounded-2xl border border-dashed border-[#C7DAE8] bg-white/70 px-4 py-10">
            <Text className="text-center text-sm text-[#75818E]">
              لا توجد أمانات مطابقة.
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
