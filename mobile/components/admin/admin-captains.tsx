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
  { id: "active", label: "مفعل" },
  { id: "inactive", label: "معطل" },
  { id: "custody", label: "أمانات" },
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

function openCustodyCount(captain: NativeCaptain) {
  return captain.custodyRecords.filter((record) => !record.returnedAt).length;
}

function CaptainSummaryMetric({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  tone: "blue" | "green" | "amber";
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
}) {
  const tones = {
    blue: { icon: "bg-[#E7F6FE]", value: "text-[#0878D1]" },
    green: { icon: "bg-emerald-50", value: "text-emerald-700" },
    amber: { icon: "bg-amber-50", value: "text-amber-700" },
  } as const;
  const palette = tones[tone];
  return (
    <View className="min-h-[76px] flex-1 rounded-2xl border border-[#DCEAF3] bg-white p-3">
      <View className="flex-row-reverse items-center justify-between">
        <View className={`rounded-xl p-1.5 ${palette.icon}`}>
          <MaterialIcons
            name={icon}
            size={15}
            color={
              tone === "blue"
                ? "#0878D1"
                : tone === "green"
                  ? "#047857"
                  : "#B45309"
            }
          />
        </View>
        <Text className={`text-base font-bold ${palette.value}`}>{value}</Text>
      </View>
      <Text className="mt-2 text-right text-[9px] font-medium text-[#6E899B]">
        {label}
      </Text>
    </View>
  );
}

function CaptainCard({
  captain,
  onPress,
}: {
  captain: NativeCaptain;
  onPress: () => void;
}) {
  const custodyCount = openCustodyCount(captain);
  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-[20px] border border-[#D7E8F2] bg-white"
    >
      <View className="flex-row-reverse items-center gap-3 px-4 py-3.5">
        <View className="h-11 w-11 items-center justify-center rounded-2xl border border-[#BCE6F8] bg-[#E4F5FD]">
          <Text className="text-sm font-bold text-[#0878D1]">
            {captain.initial}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-right text-[15px] font-bold text-[#073D70]">
            {captain.name}
          </Text>
          <Text
            numberOfLines={1}
            className="mt-0.5 text-right text-[10px] text-[#7893A4]"
          >
            {captain.email ?? "لا يوجد بريد مسجل"}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-[17px] font-bold text-[#164C70]">
            {captain.completedOrders}
          </Text>
          <Text className="text-[9px] text-[#7893A4]">إجمالي مكتمل</Text>
        </View>
        <MaterialIcons name="chevron-left" size={21} color="#7592A5" />
      </View>

      <View className="flex-row-reverse border-t border-[#E7F0F5] bg-[#FBFDFF] px-4 py-2.5">
        <View className="flex-1 flex-row-reverse items-center gap-1.5">
          <View
            className={`h-2 w-2 rounded-full ${captain.isActive ? "bg-emerald-500" : "bg-slate-400"}`}
          />
          <Text
            className={`text-[10px] font-bold ${captain.isActive ? "text-emerald-700" : "text-slate-600"}`}
          >
            {captain.isActive ? "مفعل" : "معطل"}
          </Text>
        </View>
        <View className="flex-1 flex-row-reverse items-center justify-end gap-1.5">
          <MaterialIcons
            name={custodyCount ? "inventory-2" : "verified"}
            size={14}
            color={custodyCount ? "#B45309" : "#638297"}
          />
          <Text
            className={`text-[10px] font-bold ${custodyCount ? "text-amber-700" : "text-[#638297]"}`}
          >
            {custodyCount
              ? `${custodyCount} أمانات مفتوحة`
              : "لا أمانات مفتوحة"}
          </Text>
        </View>
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
  const custodyCount = openCustodyCount(captain);
  return (
    <View className="flex-1 justify-end bg-black/35">
      <View className="max-h-[90%] rounded-t-[30px] bg-[#F4FAFE] px-5 pb-6 pt-4">
        <View className="mb-4 flex-row-reverse items-center justify-between">
          <Pressable
            onPress={onClose}
            className="h-9 w-9 items-center justify-center rounded-xl bg-white"
          >
            <MaterialIcons name="close" size={20} color="#496B81" />
          </Pressable>
          <Text className="text-base font-bold text-[#073D70]">
            ملف الكابتن
          </Text>
          <View className="h-9 w-9" />
        </View>
        <FlatList
          data={captain.orders}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <View className="rounded-3xl border border-[#D7E8F2] bg-white p-4">
                <View className="flex-row-reverse items-center gap-3">
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#E4F5FD]">
                    <Text className="text-base font-bold text-[#0878D1]">
                      {captain.initial}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-right text-lg font-bold text-[#073D70]">
                      {captain.name}
                    </Text>
                    <Text className="mt-1 text-right text-[10px] text-[#7893A4]">
                      {captain.email ?? "لا يوجد بريد مسجل"}
                    </Text>
                  </View>
                </View>
                <View className="mt-4 flex-row-reverse border-t border-[#E7F0F5] pt-3">
                  <View className="flex-1 items-end">
                    <Text className="text-[9px] text-[#7893A4]">
                      إجمالي مكتمل
                    </Text>
                    <Text className="mt-1 text-sm font-bold text-[#164C70]">
                      {captain.completedOrders} طلبات
                    </Text>
                  </View>
                  <View className="flex-1 items-end">
                    <Text className="text-[9px] text-[#7893A4]">
                      أمانات مفتوحة
                    </Text>
                    <Text className="mt-1 text-sm font-bold text-amber-700">
                      {custodyCount}
                    </Text>
                  </View>
                  <View className="flex-1 items-end">
                    <Text className="text-[9px] text-[#7893A4]">
                      الحالة الإدارية
                    </Text>
                    <Text
                      className={`mt-1 text-sm font-bold ${captain.isActive ? "text-emerald-700" : "text-slate-600"}`}
                    >
                      {captain.isActive ? "مفعل" : "معطل"}
                    </Text>
                  </View>
                </View>
              </View>

              <Text className="mb-2 mt-5 text-right text-sm font-bold text-[#073D70]">
                الأمانات
              </Text>
              <View className="rounded-2xl border border-[#D7E8F2] bg-white p-3">
                <TextInput
                  value={custodyName}
                  onChangeText={setCustodyName}
                  placeholder="اسم الأمانة"
                  placeholderTextColor="#8A98A6"
                  className="rounded-xl border border-[#D4E2EC] p-3 text-right text-xs text-[#173B59]"
                  textAlign="right"
                />
                <Pressable
                  onPress={onAssign}
                  className="mt-2 items-center rounded-xl bg-[#FFF6DF] p-3"
                >
                  <Text className="text-xs font-bold text-amber-700">
                    إضافة أمانة
                  </Text>
                </Pressable>
                {captain.custodyRecords.length ? (
                  captain.custodyRecords.map((record) => (
                    <View
                      key={record.id}
                      className="mt-2 flex-row-reverse items-center rounded-xl bg-[#F6FAFD] p-3"
                    >
                      <View className="flex-1">
                        <Text className="text-right text-xs font-bold text-[#173B59]">
                          {record.itemName}
                        </Text>
                        <Text className="mt-0.5 text-right text-[10px] text-[#667E8E]">
                          {record.returnedAt ? "تم الإرجاع" : "مع الكابتن"}
                        </Text>
                      </View>
                      {!record.returnedAt ? (
                        <Pressable
                          onPress={() => onReturn(record.id)}
                          className="rounded-lg bg-emerald-50 px-2.5 py-2"
                        >
                          <Text className="text-[10px] font-bold text-emerald-700">
                            تسجيل الإرجاع
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))
                ) : (
                  <Text className="pt-3 text-center text-[10px] text-[#7893A4]">
                    لا توجد أمانات مسجلة لهذا الكابتن.
                  </Text>
                )}
              </View>

              <Text className="mb-2 mt-5 text-right text-sm font-bold text-[#073D70]">
                سجل الطلبات المرتبطة
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="mb-2 rounded-2xl border border-[#DCEAF3] bg-white p-3">
              <View className="flex-row-reverse items-center justify-between">
                <Text className="text-sm font-bold text-[#173B59]">
                  طلب #{item.orderNumber}
                </Text>
                <Text className="rounded-lg bg-[#EAF7FD] px-2 py-1 text-[10px] font-bold text-[#0878D1]">
                  {statusLabels[item.status] ?? item.status}
                </Text>
              </View>
              <Text className="mt-2 text-right text-[10px] leading-5 text-[#667E8E]">
                {item.customerName} · {item.pickupAddress} ←{" "}
                {item.deliveryAddress}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text className="rounded-2xl border border-dashed border-[#C7DAE8] bg-white p-5 text-center text-xs text-[#75818E]">
              لا توجد طلبات مرتبطة بهذا الكابتن.
            </Text>
          }
          ListFooterComponent={
            <View className="mb-2 mt-4 rounded-2xl border border-[#D7E8F2] bg-white p-3">
              <Text className="text-right text-[11px] font-bold text-[#526F82]">
                إجراءات الكابتن
              </Text>
              <Pressable
                onPress={onToggle}
                className={`mt-3 items-center rounded-xl p-3 ${captain.isActive ? "bg-red-50" : "bg-emerald-50"}`}
              >
                <Text
                  className={`text-xs font-bold ${captain.isActive ? "text-red-700" : "text-emerald-700"}`}
                >
                  {captain.isActive ? "تعطيل الكابتن" : "تفعيل الكابتن"}
                </Text>
              </Pressable>
            </View>
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
  const snapshot = useMemo(
    () => ({
      active: data.captains.filter((captain) => captain.isActive).length,
      openCustodies: data.captains.reduce(
        (total, captain) => total + openCustodyCount(captain),
        0,
      ),
      total: data.captains.length,
    }),
    [data.captains],
  );
  const visibleCaptains = useMemo(
    () =>
      data.captains.filter((captain) => {
        const matchesFilter =
          filter === "all" ||
          (filter === "active" && captain.isActive) ||
          (filter === "inactive" && !captain.isActive) ||
          (filter === "custody" && openCustodyCount(captain) > 0);
        return (
          matchesFilter &&
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
  const confirmToggle = (captain: NativeCaptain) => {
    const nextActive = !captain.isActive;
    Alert.alert(
      nextActive ? "تفعيل الكابتن" : "تعطيل الكابتن",
      nextActive
        ? `هل تريد تفعيل ${captain.name}؟`
        : `هل تريد تعطيل ${captain.name}؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: nextActive ? "تفعيل" : "تعطيل",
          style: nextActive ? "default" : "destructive",
          onPress: () =>
            void perform(
              () => data.setActive(captain.id, nextActive),
              nextActive ? "تم تفعيل الكابتن." : "تم تعطيل الكابتن.",
            ),
        },
      ],
    );
  };

  if (profile?.role !== "admin" && profile?.role !== "supervisor") {
    return (
      <ScreenContainer className="items-center justify-center p-5">
        <Text className="text-center text-base font-bold text-[#173B59]">
          هذه الشاشة مخصصة للأدمن والمشرف.
        </Text>
      </ScreenContainer>
    );
  }

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
            tintColor="#0878D1"
          />
        }
        contentContainerClassName="gap-3 p-5 pb-8"
        ListHeaderComponent={
          <View className="gap-4">
            <View className="rounded-3xl border border-[#D3E6F2] bg-white p-4">
              <View className="flex-row-reverse items-start justify-between">
                <View className="flex-1 items-end">
                  <Text className="text-lg font-bold text-[#073D70]">
                    إدارة الكباتن
                  </Text>
                  <Text className="mt-1 text-right text-xs leading-5 text-[#688499]">
                    قائمة إدارية تُحدّث عند الدخول أو بالسحب فقط.
                  </Text>
                </View>
                <View className="rounded-2xl bg-[#E7F6FE] p-3">
                  <MaterialIcons name="two-wheeler" size={22} color="#0878D1" />
                </View>
              </View>
              <View className="mt-4 flex-row-reverse gap-2">
                <CaptainSummaryMetric
                  icon="groups"
                  label="إجمالي الكباتن"
                  tone="blue"
                  value={data.isLoading ? "—" : snapshot.total}
                />
                <CaptainSummaryMetric
                  icon="verified"
                  label="كباتن مفعلون"
                  tone="green"
                  value={data.isLoading ? "—" : snapshot.active}
                />
                <CaptainSummaryMetric
                  icon="inventory-2"
                  label="أمانات مفتوحة"
                  tone="amber"
                  value={data.isLoading ? "—" : snapshot.openCustodies}
                />
              </View>
              <View className="mt-4 flex-row-reverse items-center rounded-xl border border-[#C9DDE9] bg-[#FBFDFF] px-3">
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

            <View className="flex-row-reverse gap-2">
              {filters.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setFilter(item.id)}
                  className={`flex-1 items-center rounded-xl border px-2 py-2.5 ${filter === item.id ? "border-[#0878D1] bg-[#0878D1]" : "border-[#D4E2EC] bg-white"}`}
                >
                  <Text
                    numberOfLines={1}
                    className={`text-[10px] font-bold ${filter === item.id ? "text-white" : "text-[#586F80]"}`}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="flex-row-reverse items-center justify-between">
              <View>
                <Text className="text-right text-base font-bold text-[#073D70]">
                  الكباتن المعروضون
                </Text>
                <Text className="mt-0.5 text-right text-[9px] text-[#7893A4]">
                  اسحب للتحديث اليدوي عند الحاجة.
                </Text>
              </View>
              <Text className="rounded-full bg-[#DBEEFF] px-3 py-1 text-xs font-bold text-[#0878D1]">
                {data.isLoading ? "..." : `${visibleCaptains.length} كابتن`}
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
                  <Text className="font-bold text-[#0878D1]">
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
            onToggle={() => confirmToggle(selected)}
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
