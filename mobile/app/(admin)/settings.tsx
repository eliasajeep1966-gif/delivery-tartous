import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Building2,
  MapPin,
  Percent,
  Phone,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { goBackOrReplace } from "@/lib/navigation/go-back-or-replace";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { useAppToast } from "@/contexts/app-toast-context";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";

type Exception = {
  id: string;
  keyword: string;
  captain: string;
  office: string;
};
const validSplit = (captain: string, office: string) =>
  Number(captain) + Number(office) === 100 &&
  Number(captain) >= 0 &&
  Number(office) >= 0;

export default function OfficeSettingsScreen() {
  const router = useRouter();
  const { profile } = useDeliveryAuth();
  const { showToast } = useAppToast();
  const [office, setOffice] = useState({
    name: "دليفري طرطوس",
    phone: "0933000000",
    address: "طرطوس — مركز المدينة",
  });
  const [captainShare, setCaptainShare] = useState("70");
  const [officeShare, setOfficeShare] = useState("30");
  const [exceptions, setExceptions] = useState<Exception[]>([
    { id: "default", keyword: "طلب سريع", captain: "75", office: "25" },
  ]);
  const isBackOffice =
    profile?.role === "admin" || profile?.role === "supervisor";
  const update = (
    id: string,
    key: "keyword" | "captain" | "office",
    value: string,
  ) =>
    setExceptions((items) =>
      items.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    );
  const save = () => {
    if (!validSplit(captainShare, officeShare))
      return Alert.alert(
        "بيانات غير صحيحة",
        "يجب أن يكون مجموع نسب التوزيع الأساسية 100%.",
      );
    if (
      exceptions.some(
        (item) =>
          !item.keyword.trim() || !validSplit(item.captain, item.office),
      )
    )
      return Alert.alert(
        "بيانات غير صحيحة",
        "أكمل نص الاستثناء ونسبه، ويجب أن يكون مجموع النسب 100%.",
      );
    showToast({ message: "تم حفظ إعدادات المكتب ضمن هذه الجلسة." });
  };
  if (!isBackOffice)
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
  return (
    <ScreenContainer className="bg-[#F8FAFC]" containerClassName="bg-[#F8FAFC]">
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "العودة",
          icon: "arrow-forward",
          onPress: () =>
            goBackOrReplace(router),
        }}
        trailingAction={{ accessibilityLabel: "إعدادات المكتب", icon: "business" }}
      />
      <ScrollView
        contentContainerClassName="gap-4 p-4 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-3xl border border-[#E4EEF7] bg-white p-4 shadow-[0_8px_30px_rgba(0,96,184,0.04)]">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 items-end">
              <Text className="text-right text-lg font-bold">
                بيانات المكتب
              </Text>
              <Text className="mt-1 text-right text-xs leading-5 text-[#58616B]">
                البيانات الأساسية التي تظهر ضمن تشغيل المكتب.
              </Text>
            </View>
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF4FF]">
              <Building2 size={23} color="#0060B8" />
            </View>
          </View>
          {[
            ["اسم المكتب", office.name, "name", Building2],
            ["رقم المكتب", office.phone, "phone", Phone],
            ["العنوان", office.address, "address", MapPin],
          ].map(([label, value, key, Icon]) => (
            <View key={String(key)} className="mt-3">
              <View className="flex-row items-center justify-end gap-1.5">
                <Text className="text-right text-xs font-bold text-[#4F5D6B]">
                  {String(label)}
                </Text>
                <Icon size={15} color="#0060B8" />
              </View>
              <TextInput
                value={String(value)}
                onChangeText={(next) =>
                  setOffice((current) => ({ ...current, [String(key)]: next }))
                }
                className="mt-1.5 h-11 rounded-xl border border-[#C9D9E7] bg-white px-3 text-right text-sm"
              />
            </View>
          ))}
        </View>
        <View className="rounded-3xl border border-[#E4EEF7] bg-white p-4 shadow-[0_8px_30px_rgba(0,96,184,0.04)]">
          <View className="flex-row items-center justify-end gap-2">
            <Text className="text-sm font-bold">نسب التوزيع الأساسية</Text>
            <Percent size={18} color="#0060B8" />
          </View>
          <Text className="mt-1 text-right text-[11px] leading-5 text-[#66727E]">
            تطبق تلقائياً عندما لا يطابق الطلب استثناءً خاصاً.
          </Text>
          <View className="mt-3 flex-row gap-3">
            <ShareInput
              label="حصة الكابتن"
              value={captainShare}
              onChangeText={setCaptainShare}
              color="green"
            />
            <ShareInput
              label="حصة المكتب"
              value={officeShare}
              onChangeText={setOfficeShare}
              color="blue"
            />
          </View>
          <Text
            className={`mt-3 text-center text-[11px] font-bold ${validSplit(captainShare, officeShare) ? "text-emerald-700" : "text-[#BA1A1A]"}`}
          >
            المجموع: {Number(captainShare || 0) + Number(officeShare || 0)}%
          </Text>
        </View>
        <View className="rounded-3xl border border-blue-100 bg-[#F5FAFF] p-4 shadow-[0_8px_30px_rgba(0,96,184,0.04)]">
          <View className="flex-row items-start justify-end gap-2">
            <View className="flex-1 items-end">
              <Text className="text-sm font-bold text-[#0060B8]">
                استثناءات التوزيع
              </Text>
              <Text className="mt-1 text-right text-[11px] leading-5 text-[#66788A]">
                نسبة خاصة عند وجود كلمة أو عبارة في ملاحظات الطلب.
              </Text>
            </View>
            <SlidersHorizontal size={19} color="#0060B8" />
          </View>
          {exceptions.map((item, index) => (
            <View
              key={item.id}
              className="mt-3 rounded-2xl border border-blue-100 bg-white p-3 shadow-[0_8px_30px_rgba(0,96,184,0.04)]"
            >
              <View className="flex-row items-center justify-between">
                <Pressable
                  accessibilityLabel="حذف الاستثناء"
                  onPress={() =>
                    setExceptions((items) =>
                      items.filter((candidate) => candidate.id !== item.id),
                    )
                  }
                >
                  <Trash2 size={17} color="#BA1A1A" />
                </Pressable>
                <Text className="text-xs font-bold text-[#0060B8]">
                  استثناء {index + 1}
                </Text>
              </View>
              <TextInput
                value={item.keyword}
                onChangeText={(value) => update(item.id, "keyword", value)}
                placeholder="النص المطابق في الملاحظات"
                className="mt-2 h-10 rounded-2xl border border-blue-100 px-3 text-right text-sm"
              />
              <View className="mt-2 flex-row gap-2">
                <TextInput
                  value={item.captain}
                  onChangeText={(value) => update(item.id, "captain", value)}
                  keyboardType="decimal-pad"
                  placeholder="الكابتن %"
                  className="h-9 flex-1 rounded-lg border border-emerald-200 px-2 text-center text-sm"
                />
                <TextInput
                  value={item.office}
                  onChangeText={(value) => update(item.id, "office", value)}
                  keyboardType="decimal-pad"
                  placeholder="المكتب %"
                  className="h-9 flex-1 rounded-lg border border-blue-200 px-2 text-center text-sm"
                />
              </View>
            </View>
          ))}
          <Pressable
            onPress={() =>
              setExceptions((items) => [
                ...items,
                {
                  id: String(Date.now()),
                  keyword: "",
                  captain: "",
                  office: "",
                },
              ])
            }
            className="mt-3 h-10 flex-row items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-white active:scale-95"
          >
            <Plus size={17} color="#0060B8" />
            <Text className="text-xs font-bold text-[#0060B8]">
              إضافة استثناء
            </Text>
          </Pressable>
        </View>
        <Pressable
          onPress={save}
          className="h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-[#0060B8] shadow-[0_8px_30px_rgba(0,96,184,0.04)] active:scale-95"
        >
          <Save size={18} color="#FFF" />
          <Text className="text-sm font-bold text-white">حفظ الإعدادات</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
function ShareInput({
  label,
  value,
  onChangeText,
  color,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  color: "green" | "blue";
}) {
  return (
    <View
      className={`flex-1 rounded-xl p-3 ${color === "green" ? "bg-emerald-50" : "bg-blue-50"}`}
    >
      <Text
        className={`text-right text-xs ${color === "green" ? "text-emerald-700" : "text-[#0060B8]"}`}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        className="mt-2 h-10 rounded-lg border border-white bg-white px-2 text-center text-xl font-bold"
      />
      <Text className="mt-1 text-center text-xs">%</Text>
    </View>
  );
}
