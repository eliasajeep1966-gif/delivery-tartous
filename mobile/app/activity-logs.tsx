import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { CheckCircle2, ClipboardList, Clock3, Package, Search, ShieldCheck, Trash2, Truck, UserPlus, WalletCards, XCircle } from "lucide-react-native";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { useNativeActivityLogs, type ActivityLogCategory, type ActivityLogIcon, type ActivityLogTone } from "@/features/admin/use-native-activity-logs";

const filters = [{ id: "all", label: "الكل" }, { id: "orders", label: "الطلبات" }, { id: "users", label: "المستخدمون" }, { id: "captains", label: "الكباتن" }, { id: "system", label: "النظام" }] as const;
type Filter = "all" | ActivityLogCategory;
const toneClasses: Record<ActivityLogTone, { bg: string; color: string; chip: string }> = { blue: { bg: "#EAF4FF", color: "#0060B8", chip: "#EFF7FF" }, green: { bg: "#DDF8ED", color: "#047857", chip: "#ECFDF5" }, red: { bg: "#FDE8E8", color: "#BA1A1A", chip: "#FFF1F2" }, violet: { bg: "#F0E9FF", color: "#7C3AED", chip: "#F5F3FF" }, slate: { bg: "#F1F5F9", color: "#475569", chip: "#F1F5F9" } };
const activityIcons: Record<ActivityLogIcon, typeof Package> = { package: Package, "user-plus": UserPlus, check: CheckCircle2, trash: Trash2, truck: Truck, shield: ShieldCheck, wallet: WalletCards, cancel: XCircle, clipboard: ClipboardList };

export default function ActivityLogsScreen() {
  const router = useRouter(); const [filter, setFilter] = useState<Filter>("all"); const [query, setQuery] = useState(""); const data = useNativeActivityLogs();
  const activities = useMemo(() => { const normalized = query.trim().toLocaleLowerCase(); return data.activities.filter((item) => (filter === "all" || item.category === filter) && (!normalized || `${item.action} ${item.subject} ${item.actor} ${item.details}`.toLocaleLowerCase().includes(normalized))); }, [data.activities, filter, query]);
  return <ScreenContainer edges={["top"]} className="bg-[#F0F7FF]" containerClassName="bg-[#EAF5FF]">
    <DeliveryAppHeader
      leadingAction={{
        accessibilityLabel: "العودة",
        icon: "arrow-forward",
        onPress: () =>
          router.canGoBack() ? router.back() : router.replace("/(tabs)"),
      }}
      trailingAction={{ accessibilityLabel: "سجل الحركات", icon: "assignment" }}
    />
    <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-8" showsVerticalScrollIndicator={false}>
      <View className="rounded-2xl border border-[#D3E3F0] bg-white p-4 shadow-sm"><View className="flex-row items-start justify-between gap-3"><View className="flex-1 items-end"><Text className="text-right text-lg font-bold text-[#1C1B1B]">سجل الحركات</Text><Text className="mt-1 text-right text-xs leading-5 text-[#58616B]">كل التغييرات والعمليات في مكان واحد، مع منفّذ الحركة ووقتها.</Text></View><View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF4FF]"><Clock3 size={23} color="#0060B8" /></View></View><View className="mt-4 flex-row items-center rounded-xl border border-[#C9D9E7] bg-[#FBFDFF] px-3"><Search size={18} color="#75818E" /><TextInput value={query} onChangeText={setQuery} placeholder="ابحث باسم، طلب، أو حركة" placeholderTextColor="#8A98A6" className="h-11 flex-1 text-right text-sm text-[#1C1B1B]" /></View></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2" directionalLockEnabled><View className="flex-row gap-2">{filters.map((item) => <Pressable key={item.id} onPress={() => setFilter(item.id)} className={`rounded-full px-4 py-2 ${filter === item.id ? "bg-[#0060B8]" : "border border-[#D4E2EC] bg-white"}`}><Text className={`text-xs font-bold ${filter === item.id ? "text-white" : "text-[#58616B]"}`}>{item.label}</Text></Pressable>)}</View></ScrollView>
      <View><View className="mb-3 flex-row items-center justify-between"><Text className="text-base font-bold text-[#1C1B1B]">آخر الحركات</Text><Text className="rounded-full bg-[#DBEEFF] px-2.5 py-1 text-xs font-bold text-[#0060B8]">{data.isInitialLoading ? "..." : `${activities.length} حركة`}</Text></View>
        {data.isInitialLoading ? <View className="h-48 items-center justify-center rounded-2xl border border-[#DBE7F2] bg-white"><ActivityIndicator color="#0060B8" /></View> : data.error ? <View className="rounded-2xl border border-red-200 bg-red-50 p-4"><Text className="text-center text-sm font-bold text-[#BA1A1A]">{data.error}</Text><Pressable onPress={() => void data.reload()} className="mt-3 items-center rounded-xl bg-white py-2"><Text className="text-xs font-bold text-[#BA1A1A]">إعادة المحاولة</Text></Pressable></View> : activities.length ? <View className="gap-3">{activities.map((item) => { const Icon = activityIcons[item.icon]; const tone = toneClasses[item.tone]; return <View key={item.id} className="flex-row gap-3 rounded-2xl border border-[#DBE7F2] bg-white p-3.5 shadow-sm"><View style={{ backgroundColor: tone.bg }} className="h-11 w-11 items-center justify-center rounded-xl"><Icon size={20} color={tone.color} strokeWidth={2.25} /></View><View className="flex-1 items-end"><View className="w-full flex-row items-start justify-between gap-2"><Text className="flex-1 text-right text-sm font-bold text-[#1C1B1B]">{item.action}</Text><Text className="text-[10px] text-[#75818E]">{item.time}</Text></View><Text className="mt-1 w-full text-right text-xs font-bold text-[#0060B8]">{item.subject}</Text><Text className="mt-1 w-full text-right text-xs leading-5 text-[#58616B]">{item.details}</Text><Text style={{ backgroundColor: tone.chip, color: tone.color }} className="mt-2 rounded-md px-2 py-1 text-[10px] font-bold">بواسطة: {item.actor}</Text></View></View>; })}</View> : <View className="items-center rounded-2xl border border-dashed border-[#C7DAE8] bg-white/70 px-4 py-10"><ClipboardList size={28} color="#7D9AB0" /><Text className="mt-2 text-sm font-bold text-[#4F5D6B]">لا توجد حركات مطابقة</Text><Text className="mt-1 text-xs text-[#75818E]">جرّب تغيير البحث أو نوع السجل.</Text></View>}
        {!data.isInitialLoading && !data.error ? <View className="mt-4 flex-row items-center gap-3 rounded-2xl border border-[#D3E3F0] bg-white p-3"><Pressable disabled={!data.hasPreviousPage} onPress={() => void data.previousPage()} className="flex-1 items-center rounded-xl border border-[#C9D9E7] py-3 opacity-100 disabled:opacity-40"><Text className="text-xs font-bold text-[#0060B8]">السابق</Text></Pressable><Text className="text-xs font-bold text-[#58616B]">صفحة {data.pageNumber}</Text><Pressable disabled={!data.hasNextPage} onPress={() => void data.nextPage()} className="flex-1 items-center rounded-xl bg-[#0060B8] py-3 opacity-100 disabled:opacity-40"><Text className="text-xs font-bold text-white">التالي</Text></Pressable></View> : null}</View>
    </ScrollView>
  </ScreenContainer>;
}
