import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyRound, Mail, Save, ShieldCheck, UserRound } from "lucide-react-native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { useAppToast } from "@/contexts/app-toast-context";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import { nativeCaptainContract } from "@/lib/supabase/native-captain-contract";
import { getNativeSupabaseClient } from "@/lib/supabase/native-supabase";

const BLUE = "#0060B8";

export default function AccountSettingsScreen() {
  const router = useRouter();
  const auth = useDeliveryAuth();
  const { showToast } = useAppToast();
  const [fullName, setFullName] = useState(auth.profile?.full_name ?? "");
  const [email, setEmail] = useState(auth.profile?.email ?? auth.session?.user.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState<"name" | "email" | "password" | null>(null);

  const saveName = async () => {
    if (!fullName.trim()) return Alert.alert("بيانات الحساب", "أدخل الاسم الكامل.");
    setSaving("name");
    try {
      await nativeCaptainContract.actions.updateName(fullName.trim());
      await auth.refresh();
      showToast({ message: "تم تحديث الاسم بنجاح." });
    } catch (cause) {
      Alert.alert("تعذر تحديث الاسم", cause instanceof Error ? cause.message : "حاول مرة أخرى.");
    } finally {
      setSaving(null);
    }
  };

  const saveEmail = async () => {
    const nextEmail = email.trim().toLowerCase();
    const currentEmail = (auth.profile?.email ?? auth.session?.user.email ?? "").toLowerCase();
    if (!nextEmail) return Alert.alert("بيانات الحساب", "أدخل البريد الإلكتروني.");
    if (nextEmail === currentEmail) return Alert.alert("بيانات الحساب", "البريد الجديد يجب أن يختلف عن الحالي.");
    setSaving("email");
    try {
      const { error } = await getNativeSupabaseClient().auth.updateUser({ email: nextEmail });
      if (error) throw new Error(error.message);
      showToast({ message: "تم إرسال رسالة التأكيد إلى البريد الجديد." });
    } catch (cause) {
      Alert.alert("تعذر تحديث البريد", cause instanceof Error ? cause.message : "حاول مرة أخرى.");
    } finally {
      setSaving(null);
    }
  };

  const savePassword = async () => {
    if (password.length < 12) return Alert.alert("بيانات كلمة المرور", "يجب أن تتكون كلمة المرور من 12 حرفاً على الأقل.");
    if (password !== confirmation) return Alert.alert("بيانات كلمة المرور", "تأكيد كلمة المرور غير مطابق.");
    setSaving("password");
    try {
      await nativeCaptainContract.actions.updatePassword(password);
      setPassword("");
      setConfirmation("");
      showToast({ message: "تم تغيير كلمة المرور بنجاح." });
    } catch (cause) {
      Alert.alert("تعذر تغيير كلمة المرور", cause instanceof Error ? cause.message : "حاول مرة أخرى.");
    } finally {
      setSaving(null);
    }
  };

  const roleLabel = auth.profile?.role === "supervisor" ? "مشرف" : auth.profile?.role === "admin" ? "مدير" : "كابتن";
  const busy = saving !== null;

  return (
    <ScreenContainer className="bg-[#F0F7FF]" containerClassName="bg-[#EAF5FF]">
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "العودة",
          icon: "arrow-forward",
          onPress: () =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)"),
        }}
        trailingAction={{ accessibilityLabel: "إدارة الحساب", icon: "shield" }}
      />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-8" showsVerticalScrollIndicator={false}>
        <View className="rounded-2xl border border-[#D3E3F0] bg-white p-4 shadow-sm"><View className="flex-row items-center justify-end gap-3"><View className="flex-1 items-end"><Text className="text-[17px] font-bold">بيانات الحساب</Text><Text className="mt-1 text-right text-xs text-[#66727E]">يمكنك تعديل بياناتك الشخصية فقط.</Text></View><View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF4FF]"><UserRound size={24} color={BLUE} /></View></View><InfoRow label="البريد الحالي" value={auth.profile?.email ?? auth.session?.user.email ?? "غير متاح"} icon={<Mail size={17} color={BLUE} />} /><InfoRow label="نوع الحساب" value={roleLabel} icon={<ShieldCheck size={17} color={BLUE} />} /></View>
        <Card title="تعديل الاسم" icon={<UserRound size={19} color={BLUE} />}><TextInput value={fullName} onChangeText={setFullName} maxLength={120} placeholder="الاسم الكامل" className="h-11 rounded-xl border border-[#CFE0EC] bg-[#F8FCFF] px-3 text-right text-sm" /><ActionButton label="حفظ الاسم" loading={saving === "name"} disabled={busy} onPress={() => void saveName()} /></Card>
        <Card title="تعديل البريد الإلكتروني المستخدم" icon={<Mail size={19} color={BLUE} />}><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="name@example.com" className="h-11 rounded-xl border border-[#CFE0EC] bg-[#F8FCFF] px-3 text-left text-sm" /><Text className="text-right text-[11px] leading-5 text-[#66727E]">قد يطلب Supabase تأكيد البريد الجديد قبل اعتماده.</Text><ActionButton label="حفظ البريد الإلكتروني" loading={saving === "email"} disabled={busy} onPress={() => void saveEmail()} /></Card>
        <Card title="تغيير كلمة المرور" icon={<KeyRound size={19} color={BLUE} />}><TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="كلمة المرور الجديدة" className="h-11 rounded-xl border border-[#CFE0EC] bg-[#F8FCFF] px-3 text-left text-sm" /><TextInput value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" placeholder="تأكيد كلمة المرور" className="h-11 rounded-xl border border-[#CFE0EC] bg-[#F8FCFF] px-3 text-left text-sm" /><Text className="text-right text-[11px] leading-5 text-[#66727E]">يجب أن تكون كلمة المرور الجديدة بطول 12 حرفاً على الأقل.</Text><ActionButton label="حفظ كلمة المرور" loading={saving === "password"} disabled={busy} onPress={() => void savePassword()} /></Card>
      </ScrollView>
    </ScreenContainer>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <View className="gap-3 rounded-2xl border border-[#DBE7F2] bg-white p-4 shadow-sm"><View className="flex-row items-center justify-end gap-2"><Text className="text-[15px] font-bold text-[#0060B8]">{title}</Text>{icon}</View>{children}</View>; }
function InfoRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <View className="mt-3 flex-row items-center justify-end gap-3 rounded-xl bg-[#F8FCFF] px-3 py-2.5">{icon}<View className="min-w-0 flex-1 items-end"><Text className="text-[10px] text-[#74818C]">{label}</Text><Text className="text-right text-xs font-bold text-[#274B65]">{value}</Text></View></View>; }
function ActionButton({ label, loading, disabled, onPress }: { label: string; loading: boolean; disabled: boolean; onPress: () => void }) { return <Pressable disabled={disabled} onPress={onPress} className={`h-10 flex-row items-center justify-center gap-2 rounded-xl bg-[#0060B8] ${disabled ? "opacity-60" : ""}`}>{loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Save size={15} color="#FFFFFF" />}<Text className="text-xs font-bold text-white">{loading ? "جارٍ الحفظ..." : label}</Text></Pressable>; }
