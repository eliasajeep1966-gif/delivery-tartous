import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
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

function openCustodyCount(captain: NativeCaptain) {
  return captain.custodyRecords.filter((record) => !record.returnedAt).length;
}

function CaptainPulseMetric({
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
  const colors = {
    blue: "#FFFFFF",
    green: "#6EE7B7",
    amber: "#FCD34D",
  } as const;
  return (
    <View className="flex-1 items-center px-2">
      <View className="flex-row-reverse items-center gap-1.5">
        <MaterialIcons name={icon} size={16} color={colors[tone]} />
        <Text className="text-[20px] font-bold text-white">{value}</Text>
      </View>
      <Text className="mt-1 text-center text-[9px] font-medium text-[#C6DEED]">
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
  const enabled = captain.isActive;
  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-[25px] border border-[#E1EEF5] bg-white shadow-sm"
    >
      <View className="flex-row-reverse items-stretch">
        <View className="w-[31%] items-center justify-center bg-[#063B78] py-4">
          <View className="h-[102px] w-[82px] items-center justify-center rounded-bl-[31px] rounded-tr-[31px] border-2 border-[#62D9FF] bg-[#0A4F95] shadow-sm">
            <MaterialIcons name="person-outline" size={38} color="#D9F5FF" />
            <Text className="mt-1 text-[22px] font-bold text-white">
              {captain.initial}
            </Text>
          </View>
          <Text className="mt-2 text-center text-[8px] font-bold text-[#A9E9FF]">
            ملف الكابتن
          </Text>
        </View>

        <View className="flex-1 px-4 pb-3 pt-4">
          <View className="flex-row-reverse items-center">
            <View
              className={`ml-2 h-2.5 w-2.5 rounded-full ${enabled ? "bg-[#22C55E]" : "bg-[#EF4444]"}`}
            />
            <Text className="flex-1 text-right text-[17px] font-bold text-[#063B78]">
              {captain.name}
            </Text>
            <MaterialIcons name="chevron-left" size={20} color="#7D9AAE" />
          </View>
          <Text
            numberOfLines={1}
            className="mt-1 text-right text-[10px] text-[#8097A7]"
          >
            {captain.email ?? "لا يوجد بريد مسجل"}
          </Text>

          <View className="mt-3 flex-row-reverse items-center justify-between border-t border-[#E6EFF4] pt-3">
            <View className="flex-row-reverse items-center gap-1.5">
              <View className="rounded-xl bg-[#E9F6FF] p-2">
                <MaterialIcons name="badge" size={16} color="#0878D1" />
              </View>
              <Text className="text-[10px] font-bold text-[#547489]">
                ملف فريق التوصيل
              </Text>
            </View>
            <View className="flex-row-reverse items-center gap-1.5">
              <View
                className={`h-2 w-2 rounded-full ${enabled ? "bg-[#22C55E]" : "bg-[#EF4444]"}`}
              />
              <Text
                className={`text-[11px] font-bold ${enabled ? "text-emerald-700" : "text-red-600"}`}
              >
                {enabled ? "مفعل" : "معطل"}
              </Text>
            </View>
          </View>

          {custodyCount ? (
            <View className="mt-3 flex-row-reverse items-center gap-1.5 rounded-xl border border-[#F7DEB2] bg-[#FFF8EB] px-2.5 py-2">
              <MaterialIcons name="inventory-2" size={14} color="#B87916" />
              <Text className="flex-1 text-right text-[10px] font-bold text-[#A06411]">
                {custodyCount === 1
                  ? "أمانة مفتوحة واحدة"
                  : `${custodyCount} أمانات مفتوحة`}
              </Text>
            </View>
          ) : null}
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
    <View className="flex-1 justify-end bg-black/45">
      <View className="max-h-[91%] overflow-hidden rounded-t-[34px] bg-[#F4FAFE]">
        <View className="h-1.5 w-12 self-center rounded-full bg-[#C9DCE7]" />
        <ScrollView
          contentContainerClassName="px-5 pb-7 pt-4"
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-4 flex-row-reverse items-center justify-between">
            <Pressable
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-2xl border border-[#D7E8F2] bg-white"
            >
              <MaterialIcons name="close" size={21} color="#496B81" />
            </Pressable>
            <Text className="text-base font-bold text-[#073D70]">
              ملف الكابتن
            </Text>
            <View className="h-10 w-10" />
          </View>

          <View className="overflow-hidden rounded-[28px] bg-[#063B78] p-4">
            <View className="absolute -right-16 top-5 h-20 w-[110%] rounded-full border border-[#2CCFFB] opacity-30" />
            <View className="flex-row-reverse items-center gap-3">
              <View className="h-[76px] w-[66px] items-center justify-center rounded-bl-[25px] rounded-tr-[25px] border-2 border-[#62D9FF] bg-[#0A4F95]">
                <MaterialIcons
                  name="person-outline"
                  size={29}
                  color="#D9F5FF"
                />
                <Text className="mt-0.5 text-lg font-bold text-white">
                  {captain.initial}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-right text-[20px] font-bold text-white">
                  {captain.name}
                </Text>
                <Text className="mt-1 text-right text-[10px] text-[#C4DDEB]">
                  {captain.email ?? "لا يوجد بريد مسجل"}
                </Text>
                <View className="mt-3 self-end rounded-full bg-white/15 px-3 py-1">
                  <Text className="text-[10px] font-bold text-[#D9F5FF]">
                    ملف فريق التوصيل
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View className="mt-4 flex-row-reverse overflow-hidden rounded-2xl border border-[#D8E8F1] bg-white">
            <View className="flex-1 items-center border-l border-[#E8F0F5] px-3 py-3">
              <MaterialIcons
                name="admin-panel-settings"
                size={17}
                color="#0878D1"
              />
              <Text className="mt-1 text-center text-[9px] text-[#7893A4]">
                حالة الحساب
              </Text>
              <Text
                className={`mt-0.5 text-[11px] font-bold ${captain.isActive ? "text-emerald-700" : "text-red-600"}`}
              >
                {captain.isActive ? "مفعل" : "معطل"}
              </Text>
            </View>
            <View className="flex-1 items-center px-3 py-3">
              <MaterialIcons name="inventory-2" size={17} color="#B87916" />
              <Text className="mt-1 text-center text-[9px] text-[#7893A4]">
                أمانات مفتوحة
              </Text>
              <Text className="mt-0.5 text-[11px] font-bold text-amber-700">
                {custodyCount}
              </Text>
            </View>
          </View>

          <View className="mt-5 flex-row-reverse items-center justify-between">
            <View>
              <Text className="text-right text-[15px] font-bold text-[#073D70]">
                الأمانات
              </Text>
              <Text className="mt-0.5 text-right text-[9px] text-[#7893A4]">
                إدارة العهد المسجلة باسم الكابتن
              </Text>
            </View>
            <View className="rounded-xl bg-[#FFF5DE] p-2">
              <MaterialIcons name="inventory-2" size={17} color="#B87916" />
            </View>
          </View>

          <View className="mt-3 rounded-2xl border border-[#D7E8F2] bg-white p-3">
            <View className="flex-row-reverse items-center gap-2">
              <View className="flex-1 rounded-xl border border-[#D4E2EC] bg-[#FBFDFF] px-3">
                <TextInput
                  value={custodyName}
                  onChangeText={setCustodyName}
                  placeholder="اسم الأمانة الجديدة"
                  placeholderTextColor="#8A98A6"
                  className="h-11 text-right text-xs text-[#173B59]"
                  textAlign="right"
                />
              </View>
              <Pressable
                onPress={onAssign}
                className="h-11 items-center justify-center rounded-xl bg-[#0878D1] px-3"
              >
                <MaterialIcons name="add" size={20} color="#FFFFFF" />
              </Pressable>
            </View>

            {captain.custodyRecords.length ? (
              <View className="mt-3 gap-2">
                {captain.custodyRecords.map((record) => (
                  <View
                    key={record.id}
                    className="flex-row-reverse items-center rounded-2xl border border-[#E3EDF3] bg-[#FBFDFF] p-3"
                  >
                    <View className="ml-2 rounded-xl bg-[#FFF5DE] p-2">
                      <MaterialIcons
                        name="inventory-2"
                        size={16}
                        color="#B87916"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-right text-[11px] font-bold text-[#173B59]">
                        {record.itemName}
                      </Text>
                      <Text className="mt-0.5 text-right text-[9px] text-[#708B9C]">
                        {record.returnedAt ? "تم تسجيل الإرجاع" : "عهدة مفتوحة"}
                      </Text>
                    </View>
                    {!record.returnedAt ? (
                      <Pressable
                        onPress={() => onReturn(record.id)}
                        className="rounded-xl bg-emerald-50 px-2.5 py-2"
                      >
                        <Text className="text-[9px] font-bold text-emerald-700">
                          إرجاع
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <View className="mt-3 items-center rounded-2xl border border-dashed border-[#C7DAE8] bg-[#FBFDFF] p-5">
                <MaterialIcons name="inventory-2" size={23} color="#9AB3C2" />
                <Text className="mt-2 text-center text-[10px] text-[#7893A4]">
                  لا توجد أمانات مسجلة لهذا الكابتن.
                </Text>
              </View>
            )}
          </View>

          <View className="mt-5 rounded-2xl border border-[#D7E8F2] bg-white p-3">
            <View className="flex-row-reverse items-center gap-2">
              <View className="rounded-xl bg-[#EAF7FD] p-2">
                <MaterialIcons name="settings" size={17} color="#0878D1" />
              </View>
              <View>
                <Text className="text-right text-[12px] font-bold text-[#173B59]">
                  إجراءات الكابتن
                </Text>
                <Text className="mt-0.5 text-right text-[9px] text-[#7893A4]">
                  تغيير حالة الحساب فقط
                </Text>
              </View>
            </View>
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
        </ScrollView>
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
            <View className="overflow-hidden rounded-[28px] bg-[#063B78] px-4 pb-4 pt-5 shadow-sm">
              <View className="absolute -left-16 top-8 h-24 w-[125%] rounded-full border border-[#16CEFF] opacity-30" />
              <View className="absolute -right-20 top-1 h-20 w-[78%] rounded-full border border-[#16CEFF] opacity-20" />
              <View className="flex-row-reverse items-start justify-between">
                <View className="flex-1 items-end">
                  <Text className="text-[21px] font-bold text-white">
                    الكباتن
                  </Text>
                  <Text className="mt-1 text-right text-[10px] text-[#B9D7E9]">
                    سجل إدارة فريق التوصيل
                  </Text>
                </View>
                <View className="rounded-2xl border border-[#4CCBFA] bg-[#0B5BA8] p-3">
                  <MaterialIcons name="groups" size={22} color="#E1F8FF" />
                </View>
              </View>
              <View className="mt-5 flex-row-reverse divide-x divide-x-reverse divide-[#2E679E]">
                <CaptainPulseMetric
                  icon="groups"
                  label="إجمالي الكباتن"
                  tone="blue"
                  value={data.isLoading ? "—" : snapshot.total}
                />
                <CaptainPulseMetric
                  icon="verified"
                  label="الكباتن المفعلون"
                  tone="green"
                  value={data.isLoading ? "—" : snapshot.active}
                />
                <CaptainPulseMetric
                  icon="inventory-2"
                  label="أمانات مفتوحة"
                  tone="amber"
                  value={data.isLoading ? "—" : snapshot.openCustodies}
                />
              </View>
            </View>

            <View className="rounded-[22px] border border-[#E1EDF4] bg-white p-2 shadow-sm">
              <View className="flex-row-reverse items-center rounded-[15px] bg-[#F7FBFE] px-3">
                <MaterialIcons name="search" size={20} color="#8DA5B5" />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="ابحث عن كابتن..."
                  placeholderTextColor="#9AACB8"
                  className="h-12 flex-1 text-right text-sm text-[#173B59]"
                  textAlign="right"
                />
              </View>
              <View className="mt-2 flex-row-reverse overflow-hidden rounded-[14px] border border-[#E0EBF1]">
                {filters.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setFilter(item.id)}
                    className={`flex-1 items-center border-l border-[#E0EBF1] px-1 py-2.5 ${filter === item.id ? "border-l-[#0878D1] bg-[#0878D1]" : "bg-white"}`}
                  >
                    <Text
                      numberOfLines={1}
                      className={`text-[10px] font-bold ${filter === item.id ? "text-white" : "text-[#536F82]"}`}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
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
