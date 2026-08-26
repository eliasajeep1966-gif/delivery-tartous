import { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ChevronDown,
  Headphones,
  Mail,
  MessageCircle,
  Send,
  ShieldCheck,
  Smartphone,
} from "lucide-react-native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { useAppToast } from "@/contexts/app-toast-context";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";

const questions = [
  [
    "كيف يتم إنشاء طلب جديد؟",
    "من الرئيسية اضغط إنشاء طلب جديد، أضف المصدر والوجهة، ثم اختر كابتناً متاحاً وأرسل الطلب.",
  ],
  [
    "كيف أسلّم دفعة لكابتن؟",
    "من الأجور افتح أجور الكباتن، اختر الفترة والكابتن، ثم اضغط تسجيل دفعة وأدخل المبلغ.",
  ],
  [
    "أين أجد سجل العمليات؟",
    "من المزيد افتح سجل الحركات، وستظهر عمليات الطلبات والمستخدمين وتغييرات الحالة.",
  ],
] as const;
const categories = [
  "مشكلة في طلب",
  "مشكلة في كابتن",
  "الأجور أو الأمانات",
  "تسجيل الدخول",
  "اقتراح أو ملاحظة",
  "موضوع آخر",
];

export default function AdminSupportScreen() {
  const router = useRouter();
  const { profile } = useDeliveryAuth();
  const { showToast } = useAppToast();
  const [open, setOpen] = useState<number | null>(0);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [orderNumber, setOrderNumber] = useState("");
  const [description, setDescription] = useState("");
  const isBackOffice =
    profile?.role === "admin" || profile?.role === "supervisor";
  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("تعذر فتح القناة", "تحقق من توفر التطبيق أو حاول مرة أخرى.");
    }
  };
  const submit = () => {
    const clean = description.trim();
    if (clean.length < 10)
      return Alert.alert(
        "تفاصيل البلاغ",
        "اكتب تفاصيل البلاغ بعشرة أحرف على الأقل.",
      );
    const message = `مرحباً، أريد الإبلاغ عن مشكلة في تطبيق Delivery Tartous.\n\nالاسم: ${name.trim() || "غير مذكور"}\nنوع البلاغ: ${category}\nرقم الطلب: ${orderNumber.trim() || "غير مرتبط بطلب"}\n\nتفاصيل البلاغ:\n${clean}`;
    void openUrl(
      `mailto:eliasajeep1966@gmail.com?subject=${encodeURIComponent(`بلاغ دعم — ${category}`)}&body=${encodeURIComponent(message)}`,
    );
    showToast({ message: "تم فتح البريد لمراجعة البلاغ وإرساله." });
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
        contextLabel="المساعدة والدعم"
        leadingAction={{
          accessibilityLabel: "العودة",
          icon: "arrow-forward",
          onPress: () =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)"),
        }}
        trailingAction={{ accessibilityLabel: "المساعدة والدعم", icon: "headset-mic" }}
      />
      <ScrollView
        contentContainerClassName="gap-4 p-4 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-3xl bg-[#0060B8] p-5 shadow-[0_8px_30px_rgba(0,96,184,0.04)]">
          <Headphones size={28} color="#FFF" />
          <Text className="mt-3 text-right text-[19px] font-bold text-white">
            كيف يمكننا مساعدتك؟
          </Text>
          <Text className="mt-1 text-right text-xs leading-5 text-[#DCEAFF]">
            اختر قناة التواصل المناسبة أو أرسل بلاغاً مفصلاً.
          </Text>
          <View className="mt-4 flex-row gap-2">
            <Contact
              icon={<Smartphone size={15} color="#0060B8" />}
              label="اتصال"
              onPress={() => void openUrl("tel:099658677")}
            />
            <Contact
              icon={<MessageCircle size={15} color="#0060B8" />}
              label="واتساب"
              onPress={() => void openUrl("https://wa.me/96399658677")}
            />
            <Contact
              icon={<Send size={15} color="#0060B8" />}
              label="Telegram"
              onPress={() => void openUrl("https://t.me/Eliasajeep")}
            />
          </View>
          <Pressable
            onPress={() => void openUrl("mailto:eliasajeep1966@gmail.com")}
            className="mt-2 h-10 flex-row items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/10 active:scale-95"
          >
            <Mail size={16} color="#FFF" />
            <Text className="text-xs font-bold text-white">
              eliasajeep1966@gmail.com
            </Text>
          </Pressable>
        </View>
        <View className="rounded-3xl border border-[#E4EEF7] bg-white p-4 shadow-[0_8px_30px_rgba(0,96,184,0.04)]">
          <View className="flex-row items-center justify-end gap-2">
            <Text className="text-base font-bold">إبلاغ عن مشكلة</Text>
            <MessageCircle size={20} color="#0060B8" />
          </View>
          <Text className="mt-1 text-right text-xs leading-5 text-[#66727E]">
            اكتب التفاصيل، ثم أرسل البلاغ عبر البريد لمراجعته قبل الإرسال.
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="اسمك — اختياري"
            className="mt-4 h-11 rounded-xl border border-[#CFE0EC] bg-[#F8FCFF] px-3 text-right text-sm"
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="mt-3 gap-2"
          >
            <Text className="self-center text-xs font-bold text-[#274B65]">
              التصنيف:
            </Text>
            {categories.map((item) => (
              <Pressable
                key={item}
                onPress={() => setCategory(item)}
                className={`rounded-full px-3 py-2 active:scale-95 ${category === item ? "bg-[#0060B8]" : "border border-[#CFE0EC] bg-[#F8FCFF]"}`}
              >
                <Text
                  className={`text-[10px] font-bold ${category === item ? "text-white" : "text-[#58616B]"}`}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput
            value={orderNumber}
            onChangeText={setOrderNumber}
            keyboardType="number-pad"
            placeholder="رقم الطلب — اختياري"
            className="mt-3 h-11 rounded-xl border border-[#CFE0EC] bg-[#F8FCFF] px-3 text-right text-sm"
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            placeholder="اشرح المشكلة بالتفصيل..."
            className="mt-3 min-h-[120px] rounded-xl border border-[#CFE0EC] bg-[#F8FCFF] px-3 py-3 text-right text-sm leading-6"
          />
          <Pressable
            onPress={submit}
            className="mt-3 h-11 flex-row items-center justify-center gap-2 rounded-2xl bg-[#0060B8] active:scale-95"
          >
            <Send size={17} color="#FFF" />
            <Text className="text-sm font-bold text-white">
              إرسال البلاغ عبر البريد
            </Text>
          </Pressable>
        </View>
        <Text className="text-right text-base font-bold">أسئلة شائعة</Text>
        {questions.map(([question, answer], index) => {
          const active = open === index;
          return (
            <View
              key={question}
              className="overflow-hidden rounded-3xl border border-[#E4EEF7] bg-white shadow-[0_8px_30px_rgba(0,96,184,0.04)]"
            >
              <Pressable
                onPress={() => setOpen(active ? null : index)}
                className="flex-row items-center justify-between p-3.5 active:scale-95"
              >
                <ChevronDown
                  size={19}
                  color="#66727E"
                  style={
                    active ? { transform: [{ rotate: "180deg" }] } : undefined
                  }
                />
                <Text className="flex-1 text-right text-sm font-bold">
                  {question}
                </Text>
              </Pressable>
              {active ? (
                <Text className="border-t border-[#EEF3F7] px-3.5 py-3 text-right text-xs leading-6 text-[#58616B]">
                  {answer}
                </Text>
              ) : null}
            </View>
          );
        })}
        <View className="rounded-3xl border border-blue-100 bg-white p-4 shadow-[0_8px_30px_rgba(0,96,184,0.04)]">
          <View className="flex-row items-center justify-end gap-2">
            <Text className="text-sm font-bold text-[#0060B8]">
              خصوصية البلاغ
            </Text>
            <ShieldCheck size={20} color="#0060B8" />
          </View>
          <Text className="mt-2 text-right text-xs leading-5 text-[#58616B]">
            لا يتم حفظ البلاغ داخل التطبيق؛ تفتح القناة لمراجعة الرسالة وإرسالها
            بنفسك.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
function Contact({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="h-10 flex-1 flex-row items-center justify-center gap-1 rounded-2xl bg-white active:scale-95"
    >
      {icon}
      <Text className="text-[11px] font-bold text-[#0060B8]">{label}</Text>
    </Pressable>
  );
}
