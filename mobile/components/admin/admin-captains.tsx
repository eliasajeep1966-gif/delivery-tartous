import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { useAppToast } from "@/contexts/app-toast-context";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import { useAdminCaptains } from "@/features/admin/use-admin-captains";
import type { NativeCaptain } from "@/lib/supabase/native-captain-admin-contract";

const filters = [
  { id: "all", label: "الكل" },
  { id: "available", label: "متاح" },
  { id: "unavailable", label: "غير متاح" },
  { id: "active", label: "مفعل" },
  { id: "inactive", label: "معطل" },
] as const;
type CaptainFilter = (typeof filters)[number]["id"];

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  assigned: "تم التعيين",
  received: "تم الاستلام",
  in_delivery: "قيد التوصيل",
  completed: "مكتمل",
  cancelled: "ملغى",
  false_order: "طلب كاذب",
};

function CaptainCard({
  captain,
  onPress,
}: {
  captain: NativeCaptain;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border border-[#DBE7F2] bg-white p-4 shadow-sm"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-[#E7EDF2]">
            <Text className="font-bold text-[#52606D]">{captain.initial}</Text>
          </View>
          <View>
            <Text className="text-right text-[15px] font-bold text-[#1C1B1B]">
              {captain.name}
            </Text>
            <View className="mt-1 flex-row gap-1">
              <Text
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${captain.availability === "available" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}
              >
                {captain.availability === "available" ? "متاح" : "غير متاح"}
              </Text>
              <Text
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${captain.isActive ? "bg-blue-50 text-[#0060B8]" : "bg-red-50 text-red-700"}`}
              >
                {captain.isActive ? "مفعل" : "معطل"}
              </Text>
            </View>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-sm font-bold text-[#1C1B1B]">
            {captain.completedOrders}
          </Text>
          <Text className="text-[11px] text-[#66727E]">مكتمل</Text>
        </View>
      </View>
      <View className="mt-3 flex-row justify-between border-t border-[#EEF3F7] pt-3">
        <Text className="text-[11px] text-[#66727E]">
          {captain.currentOrderId
            ? `الطلب الحالي #${captain.currentOrderId}`
            : "لا يوجد طلب حالي"}
        </Text>
        <Text className="text-[11px] text-[#66727E]">
          {captain.custodyRecords.filter((record) => !record.returnedAt).length}{" "}
          أمانات
        </Text>
      </View>
    </Pressable>
  );
}

function CaptainDetails({
  captain,
  custodyName,
  setCustodyName,
  onClose,
  onToggle,
  onAssign,
  onReturn,
}: {
  captain: NativeCaptain;
  custodyName: string;
  setCustodyName: (value: string) => void;
  onClose: () => void;
  onToggle: () => void;
  onAssign: () => void;
  onReturn: (id: string) => void;
}) {
  return (
    <View className="flex-1 justify-end bg-black/30">
      <View className="max-h-[88%] rounded-t-3xl bg-[#F0F7FF] p-5">
        <View className="mb-4 flex-row items-center justify-between">
          <Pressable onPress={onClose}>
            <MaterialIcons name="close" size={24} color="#173B59" />
          </Pressable>
          <Text className="text-lg font-bold text-[#173B59]">
            تفاصيل الكابتن
          </Text>
        </View>
        <FlatList
          data={captain.orders}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View>
              <View className="rounded-2xl bg-white p-4">
                <Text className="text-right text-lg font-bold">
                  {captain.name}
                </Text>
                <Text className="mt-1 text-right text-xs text-[#66727E]">
                  {captain.availability === "available" ? "متاح" : "غير متاح"} ·{" "}
                  {captain.isActive ? "مفعل" : "معطل"}
                </Text>
                <Pressable
                  onPress={onToggle}
                  className={`mt-4 rounded-xl p-3 ${captain.isActive ? "bg-red-50" : "bg-emerald-50"}`}
                >
                  <Text
                    className={`text-center text-xs font-bold ${captain.isActive ? "text-red-700" : "text-emerald-700"}`}
                  >
                    {captain.isActive ? "تعطيل الكابتن" : "تفعيل الكابتن"}
                  </Text>
                </Pressable>
              </View>
              <Text className="mb-2 mt-4 text-right text-base font-bold">
                الأمانات
              </Text>
              <View className="rounded-2xl bg-white p-3">
                <TextInput
                  value={custodyName}
                  onChangeText={setCustodyName}
                  placeholder="اسم الأمانة"
                  placeholderTextColor="#8A98A6"
                  className="rounded-xl border border-[#D4E2EC] p-3 text-right text-xs"
                  textAlign="right"
                />
                <Pressable
                  onPress={onAssign}
                  className="mt-2 rounded-xl bg-[#FFF6DF] p-3"
                >
                  <Text className="text-center text-xs font-bold text-amber-700">
                    إضافة أمانة
                  </Text>
                </Pressable>
                {captain.custodyRecords.map((record) => (
                  <View
                    key={record.id}
                    className="mt-2 flex-row items-center justify-between rounded-xl bg-[#F5F9FC] p-3"
                  >
                    <View className="flex-1">
                      <Text className="text-right text-xs font-bold">
                        {record.itemName}
                      </Text>
                      <Text className="text-right text-[10px] text-[#66727E]">
                        {record.returnedAt ? "تم الإرجاع" : "مع الكابتن"}
                      </Text>
                    </View>
                    {!record.returnedAt ? (
                      <Pressable onPress={() => onReturn(record.id)}>
                        <Text className="text-[10px] font-bold text-emerald-700">
                          تسجيل الإرجاع
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
              <Text className="mb-2 mt-4 text-right text-base font-bold">
                الطلبات المرتبطة
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="mb-2 rounded-2xl bg-white p-3">
              <View className="flex-row justify-between">
                <Text className="text-sm font-bold">#{item.orderNumber}</Text>
                <Text className="text-[10px] font-bold text-[#0060B8]">
                  {statusLabels[item.status] ?? item.status}
                </Text>
              </View>
              <Text className="mt-1 text-right text-xs">
                {item.customerName} · {item.pickupAddress} ←{" "}
                {item.deliveryAddress}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text className="rounded-2xl bg-white p-5 text-center text-xs text-[#75818E]">
              لا توجد طلبات مرتبطة بهذا الكابتن.
            </Text>
          }
        />
      </View>
    </View>
  );
}

export function AdminCaptainsScreen() {
  const router = useRouter();
  const { profile } = useDeliveryAuth();
  const { showToast } = useAppToast();
  const data = useAdminCaptains();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CaptainFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [custodyName, setCustodyName] = useState("");
  const selected =
    data.captains.find((captain) => captain.id === selectedId) ?? null;
  const visibleCaptains = useMemo(
    () =>
      data.captains.filter((captain) => {
        const matches =
          filter === "all" ||
          captain.availability === filter ||
          (captain.isActive ? "active" : "inactive") === filter;
        return (
          matches &&
          captain.name
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase())
        );
      }),
    [data.captains, filter, query],
  );
  const perform = async (operation: () => Promise<void>, success: string) => {
    try {
      await operation();
      showToast({ message: success });
    } catch (cause) {
      Alert.alert(
        "تعذر تنفيذ العملية",
        cause instanceof Error ? cause.message : "حاول مرة أخرى.",
      );
    }
  };

  if (profile?.role !== "admin" && profile?.role !== "supervisor")
    return (
      <ScreenContainer className="items-center justify-center p-5">
        <Text className="text-center text-base font-bold text-[#173B59]">
          هذه الشاشة مخصصة للأدمن والمشرف.
        </Text>
      </ScreenContainer>
    );
  return (
    <ScreenContainer className="bg-[#F3FBFF]" containerClassName="bg-[#EAF5FF]">
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "العودة للرئيسية",
          icon: "arrow-forward",
          onPress: () => router.replace("/(tabs)"),
        }}
        trailingAction={{ accessibilityLabel: "الكباتن", icon: "two-wheeler" }}
      />
      <FlatList
        data={visibleCaptains}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={data.isRefreshing}
            onRefresh={() => void data.reload(true)}
            tintColor="#0060B8"
          />
        }
        contentContainerClassName="gap-3 p-5 pb-8"
        ListHeaderComponent={
          <View className="gap-4">
            <View className="rounded-2xl border border-[#D3E3F0] bg-white p-4">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 items-end">
                  <Text className="text-lg font-bold text-[#1C1B1B]">
                    إدارة الكباتن
                  </Text>
                  <Text className="mt-1 text-right text-xs leading-5 text-[#58616B]">
                    تابع التوفر والتفعيل والأمانات والطلبات.
                  </Text>
                </View>
                <View className="rounded-2xl bg-[#EAF4FF] p-3">
                  <MaterialIcons
                    name="local-shipping"
                    size={22}
                    color="#0060B8"
                  />
                </View>
              </View>
              <View className="mt-4 flex-row items-center rounded-xl border border-[#C9D9E7] bg-[#FBFDFF] px-3">
                <MaterialIcons name="search" size={19} color="#75818E" />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="ابحث باسم الكابتن"
                  placeholderTextColor="#8A98A6"
                  className="h-11 flex-1 text-right text-sm text-[#1C1B1B]"
                  textAlign="right"
                />
              </View>
            </View>
            <FlatList
              data={filters}
              horizontal
              inverted
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerClassName="gap-2"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setFilter(item.id)}
                  className={`rounded-full px-4 py-2 ${filter === item.id ? "bg-[#0060B8]" : "border border-[#D4E2EC] bg-white"}`}
                >
                  <Text
                    className={`text-xs font-bold ${filter === item.id ? "text-white" : "text-[#58616B]"}`}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-bold text-[#1C1B1B]">
                الكباتن المعروضون
              </Text>
              <Text className="rounded-full bg-[#DBEEFF] px-3 py-1 text-xs font-bold text-[#0060B8]">
                {data.isLoading ? "..." : `${visibleCaptains.length} كباتن`}
              </Text>
            </View>
            {data.error ? (
              <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <Text className="text-center text-sm text-red-700">
                  {data.error}
                </Text>
                <Pressable
                  onPress={() => void data.reload()}
                  className="mt-3 items-center"
                >
                  <Text className="font-bold text-[#0060B8]">
                    إعادة المحاولة
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !data.isLoading ? (
            <View className="rounded-2xl border border-dashed border-[#C7DAE8] bg-white p-8">
              <Text className="text-center text-sm text-[#75818E]">
                لا توجد كباتن مطابقة للفلتر.
              </Text>
            </View>
          ) : (
            <View className="h-40 rounded-2xl bg-white" />
          )
        }
        renderItem={({ item }) => (
          <CaptainCard
            captain={item}
            onPress={() => {
              setSelectedId(item.id);
              setCustodyName("");
            }}
          />
        )}
      />
      <Modal
        visible={selected !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedId(null)}
      >
        {selected ? (
          <CaptainDetails
            captain={selected}
            custodyName={custodyName}
            setCustodyName={setCustodyName}
            onClose={() => setSelectedId(null)}
            onToggle={() =>
              void perform(
                () => data.setActive(selected.id, !selected.isActive),
                selected.isActive ? "تم تعطيل الكابتن." : "تم تفعيل الكابتن.",
              )
            }
            onAssign={() =>
              void perform(async () => {
                await data.assignCustody(selected.id, custodyName);
                setCustodyName("");
              }, "تمت إضافة الأمانة.")
            }
            onReturn={(id) =>
              void perform(
                () => data.returnCustody(id),
                "تم تسجيل إرجاع الأمانة.",
              )
            }
          />
        ) : null}
      </Modal>
    </ScreenContainer>
  );
}
