import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react-native";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { useAppToast } from "@/contexts/app-toast-context";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import { presentAccountSettingsError } from "@/lib/auth/account-settings-errors";
import { goBackOrReplace } from "@/lib/navigation/go-back-or-replace";
import { nativeCaptainContract } from "@/lib/supabase/native-captain-contract";
import { getNativeSupabaseClient } from "@/lib/supabase/native-supabase";

const BLUE = "#0060B8";
const DANGER = "#BA1A1A";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AccountSettingsScreen() {
  const router = useRouter();
  const auth = useDeliveryAuth();
  const { showToast } = useAppToast();
  const savedFullName = auth.profile?.full_name ?? "";
  const savedEmail = auth.profile?.email ?? auth.session?.user.email ?? "";
  const [fullNameDraft, setFullNameDraft] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);
  const [saving, setSaving] = useState<"name" | "email" | "password" | null>(null);

  const fullName = fullNameDraft ?? savedFullName;
  const email = emailDraft ?? savedEmail;
  const normalizedEmail = email.trim().toLowerCase();
  const currentEmail = savedEmail.trim().toLowerCase();
  const nameChanged = fullName.trim() !== savedFullName.trim();
  const emailChanged = normalizedEmail !== currentEmail;
  const passwordIsLongEnough = password.length >= 12;
  const passwordMatches = Boolean(password) && password === confirmation;
  const busy = saving !== null;

  const saveName = async () => {
    if (!fullName.trim()) {
      showToast({ message: "أدخل الاسم الكامل قبل الحفظ.", tone: "error" });
      return;
    }
    if (!nameChanged) {
      showToast({ message: "لم تُجرَ أي تعديلات على الاسم." });
      return;
    }

    setSaving("name");
    try {
      await nativeCaptainContract.actions.updateName(fullName.trim());
      await auth.refresh();
      setFullNameDraft(null);
      showToast({ message: "تم تحديث الاسم بنجاح." });
    } catch (cause) {
      showToast({
        message: presentAccountSettingsError(cause, "name"),
        tone: "error",
        durationMs: 5000,
      });
    } finally {
      setSaving(null);
    }
  };

  const saveEmail = async () => {
    if (!normalizedEmail) {
      showToast({ message: "أدخل البريد الإلكتروني قبل الحفظ.", tone: "error" });
      return;
    }
    if (!emailPattern.test(normalizedEmail)) {
      showToast({ message: "صيغة البريد الإلكتروني غير صحيحة.", tone: "error" });
      return;
    }
    if (!emailChanged) {
      showToast({ message: "البريد الجديد يجب أن يختلف عن البريد الحالي.", tone: "error" });
      return;
    }

    setSaving("email");
    try {
      const { error } = await getNativeSupabaseClient().auth.updateUser({
        email: normalizedEmail,
      });
      if (error) throw new Error(error.message);
      setEmailConfirmationSent(true);
      showToast({ message: "أرسلنا رسالة تأكيد إلى البريد الجديد." });
    } catch (cause) {
      showToast({
        message: presentAccountSettingsError(cause, "email"),
        tone: "error",
        durationMs: 5000,
      });
    } finally {
      setSaving(null);
    }
  };

  const savePassword = async () => {
    if (!passwordIsLongEnough) {
      showToast({
        message: "يجب أن تتكون كلمة المرور من 12 حرفاً على الأقل.",
        tone: "error",
      });
      return;
    }
    if (!passwordMatches) {
      showToast({ message: "تأكيد كلمة المرور غير مطابق.", tone: "error" });
      return;
    }

    setSaving("password");
    try {
      await nativeCaptainContract.actions.updatePassword(password);
      setPassword("");
      setConfirmation("");
      showToast({ message: "تم تغيير كلمة المرور بنجاح." });
    } catch (cause) {
      showToast({
        message: presentAccountSettingsError(cause, "password"),
        tone: "error",
        durationMs: 5000,
      });
    } finally {
      setSaving(null);
    }
  };

  const roleLabel =
    auth.profile?.role === "supervisor"
      ? "مشرف"
      : auth.profile?.role === "admin"
        ? "مدير"
        : "كابتن";

  return (
    <ScreenContainer className="bg-[#F0F7FF]" containerClassName="bg-[#EAF5FF]">
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "العودة",
          icon: "arrow-forward",
          onPress: () => goBackOrReplace(router),
        }}
        trailingAction={{ accessibilityLabel: "إعدادات الحساب", icon: "manage-accounts" }}
      />
      <ScrollView
        contentContainerClassName="gap-4 p-4 pb-9"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="overflow-hidden rounded-3xl border border-[#CDE5F7] bg-white p-5 shadow-sm">
          <View className="flex-row items-start justify-end gap-3">
            <View className="flex-1 items-end">
              <View className="flex-row items-center gap-1.5 rounded-full bg-[#EAF5FF] px-2.5 py-1">
                <View className="h-1.5 w-1.5 rounded-full bg-[#18A875]" />
                <Text className="text-[10px] font-bold text-[#08755C]">حساب نشط</Text>
              </View>
              <Text className="mt-3 text-right text-[21px] font-bold text-[#173B54]">إعدادات الحساب</Text>
              <Text className="mt-1 text-right text-xs leading-5 text-[#637E92]">
                عدّل بيانات حسابك بأمان. التغييرات لا تمس صلاحيات الحساب أو نوعه.
              </Text>
            </View>
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF5FF]">
              <UserRound size={27} color={BLUE} />
            </View>
          </View>
          <View className="mt-4 flex-row gap-2">
            <AccountInfo label="البريد الحالي" value={savedEmail || "غير متاح"} icon={<Mail size={16} color={BLUE} />} />
            <AccountInfo label="نوع الحساب" value={roleLabel} icon={<ShieldCheck size={16} color={BLUE} />} />
          </View>
        </View>

        <SettingsCard
          title="الاسم الظاهر"
          subtitle="هذا الاسم يظهر ضمن نشاطات الطلبات والسجلات."
          icon={<UserRound size={19} color={BLUE} />}
        >
          <LabeledInput
            label="الاسم الكامل"
            value={fullName}
            onChangeText={setFullNameDraft}
            maxLength={120}
            placeholder="أدخل الاسم الكامل"
            autoCapitalize="words"
          />
          <ActionButton
            label="حفظ الاسم"
            loading={saving === "name"}
            disabled={busy || !nameChanged}
            onPress={() => void saveName()}
          />
        </SettingsCard>

        <SettingsCard
          title="البريد الإلكتروني"
          subtitle="سنرسل رابط تأكيد إلى البريد الجديد قبل اعتماده."
          icon={<Mail size={19} color={BLUE} />}
        >
          <LabeledInput
            label="البريد الجديد"
            value={email}
            onChangeText={(value) => {
              setEmailDraft(value);
              setEmailConfirmationSent(false);
            }}
            placeholder="name@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            textAlign="left"
          />
          {emailConfirmationSent ? (
            <View className="flex-row items-center justify-end gap-2 rounded-xl border border-[#BFE8D7] bg-[#F0FBF6] px-3 py-2.5">
              <Text className="flex-1 text-right text-[11px] leading-5 text-[#08755C]">
                تم إرسال رابط التأكيد إلى {normalizedEmail}. سيبقى البريد الحالي فعالاً إلى أن تؤكد التغيير.
              </Text>
              <CheckCircle2 size={17} color="#08755C" />
            </View>
          ) : null}
          <ActionButton
            label="إرسال رابط التأكيد"
            loading={saving === "email"}
            disabled={busy || !emailChanged}
            onPress={() => void saveEmail()}
          />
        </SettingsCard>

        <SettingsCard
          title="كلمة المرور"
          subtitle="استخدم كلمة مرور جديدة لا تقل عن 12 حرفاً."
          icon={<KeyRound size={19} color={BLUE} />}
        >
          <PasswordInput
            label="كلمة المرور الجديدة"
            value={password}
            onChangeText={setPassword}
            visible={passwordVisible}
            onToggleVisibility={() => setPasswordVisible((visible) => !visible)}
            placeholder="أدخل كلمة المرور الجديدة"
          />
          <PasswordInput
            label="تأكيد كلمة المرور"
            value={confirmation}
            onChangeText={setConfirmation}
            visible={confirmationVisible}
            onToggleVisibility={() => setConfirmationVisible((visible) => !visible)}
            placeholder="أعد إدخال كلمة المرور"
          />
          {password ? (
            <PasswordStatus
              valid={passwordIsLongEnough && passwordMatches}
              message={
                !passwordIsLongEnough
                  ? `باقي ${Math.max(12 - password.length, 0)} حرف على الأقل.`
                  : passwordMatches
                    ? "كلمتا المرور متطابقتان."
                    : "تأكيد كلمة المرور غير مطابق."
              }
            />
          ) : null}
          <ActionButton
            label="حفظ كلمة المرور"
            loading={saving === "password"}
            disabled={busy || !passwordIsLongEnough || !passwordMatches}
            onPress={() => void savePassword()}
          />
        </SettingsCard>
      </ScrollView>
    </ScreenContainer>
  );
}

function SettingsCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-3 rounded-2xl border border-[#D8E7F2] bg-white p-4 shadow-sm">
      <View className="flex-row items-start justify-end gap-2">
        <View className="flex-1 items-end">
          <Text className="text-right text-[15px] font-bold text-[#173B54]">{title}</Text>
          <Text className="mt-1 text-right text-[11px] leading-5 text-[#6B8497]">{subtitle}</Text>
        </View>
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#EAF5FF]">{icon}</View>
      </View>
      {children}
    </View>
  );
}

function AccountInfo({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <View className="min-w-0 flex-1 rounded-xl bg-[#F7FBFE] px-3 py-2.5">
      <View className="flex-row items-center justify-end gap-1.5">
        <Text className="text-right text-[10px] text-[#6D879A]">{label}</Text>
        {icon}
      </View>
      <Text numberOfLines={1} className="mt-1 text-right text-xs font-bold text-[#244B67]">
        {value}
      </Text>
    </View>
  );
}

function LabeledInput({
  label,
  textAlign = "right",
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View className="gap-1.5">
      <Text className="text-right text-[11px] font-bold text-[#47657A]">{label}</Text>
      <TextInput
        {...props}
        textAlign={textAlign}
        className="h-11 rounded-xl border border-[#CFE0EC] bg-[#F8FCFF] px-3 text-sm text-[#173B54]"
      />
    </View>
  );
}

function PasswordInput({
  label,
  visible,
  onToggleVisibility,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  visible: boolean;
  onToggleVisibility: () => void;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-right text-[11px] font-bold text-[#47657A]">{label}</Text>
      <View className="h-11 flex-row items-center rounded-xl border border-[#CFE0EC] bg-[#F8FCFF] px-3">
        <TextInput
          {...props}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          textAlign="left"
          className="h-full flex-1 text-sm text-[#173B54]"
        />
        <Pressable
          accessibilityLabel={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          hitSlop={8}
          onPress={onToggleVisibility}
          className="ml-2 h-8 w-8 items-center justify-center rounded-lg"
        >
          {visible ? <EyeOff size={18} color="#5C7B90" /> : <Eye size={18} color="#5C7B90" />}
        </Pressable>
      </View>
    </View>
  );
}

function PasswordStatus({ valid, message }: { valid: boolean; message: string }) {
  return (
    <View
      className={`flex-row items-center justify-end gap-2 rounded-xl px-3 py-2.5 ${
        valid ? "bg-[#F0FBF6]" : "bg-[#FFF4F4]"
      }`}
    >
      <Text className={`flex-1 text-right text-[11px] ${valid ? "text-[#08755C]" : "text-[#A03D44]"}`}>
        {message}
      </Text>
      <CheckCircle2 size={16} color={valid ? "#08755C" : DANGER} />
    </View>
  );
}

function ActionButton({
  label,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className={`h-11 flex-row items-center justify-center gap-2 rounded-xl bg-[#0060B8] ${disabled ? "opacity-45" : ""}`}
    >
      {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Save size={16} color="#FFFFFF" />}
      <Text className="text-xs font-bold text-white">{loading ? "جارٍ الحفظ..." : label}</Text>
    </Pressable>
  );
}
