import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { KeyRound, ShieldAlert, Trash2 } from "lucide-react-native";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { useAppToast } from "@/contexts/app-toast-context";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import { goBackOrReplace } from "@/lib/navigation/go-back-or-replace";
import { getNativeSupabaseClient } from "@/lib/supabase/native-supabase";

const REQUEST_TIMEOUT_MS = 30_000;

function withTimeout<T>(request: PromiseLike<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), REQUEST_TIMEOUT_MS);
    Promise.resolve(request).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export default function OwnerDataResetScreen() {
  const router = useRouter();
  const { profile, signOut } = useDeliveryAuth();
  const { showToast } = useAppToast();
  const [password, setPassword] = useState("");
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    if (!profile?.id) return () => {
      active = false;
    };

    void Promise.resolve(getNativeSupabaseClient().rpc("is_application_owner"))
      .then(({ data, error }) => {
        if (!active) return;
        setIsOwner(!error && data === true);
      })
      .catch(() => {
        if (active) setIsOwner(false);
      });

    return () => {
      active = false;
    };
  }, [profile?.id]);

  const resetApplication = async () => {
    if (!password) {
      Alert.alert("كلمة المرور مطلوبة", "أدخل كلمة مرور حساب المالك للمتابعة.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await withTimeout(
        getNativeSupabaseClient().rpc("reset_application_data", {
          p_current_password: password,
        }),
        "انتهت مهلة مسح البيانات. تحقق من الاتصال ثم حاول مجدداً.",
      );
      if (error) throw error;

      setPassword("");
      showToast({ message: "تم مسح بيانات التطبيق." });
      await signOut();
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "تعذر مسح بيانات التطبيق.";
      Alert.alert("تعذر مسح البيانات", message);
    } finally {
      setSubmitting(false);
    }
  };

  if (isOwner === null) {
    return (
      <ScreenContainer
        className="items-center justify-center bg-[#F8FAFC]"
        containerClassName="bg-[#F8FAFC]"
      >
        <ActivityIndicator size="large" color="#BA1A1A" />
      </ScreenContainer>
    );
  }

  if (!isOwner) {
    return (
      <ScreenContainer
        className="items-center justify-center bg-[#F8FAFC] p-5"
        containerClassName="bg-[#F8FAFC]"
      >
        <Text className="text-center text-base font-bold text-[#173B59]">
          هذه الشاشة مخصصة لمالك التطبيق فقط.
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-[#F8FAFC]" containerClassName="bg-[#F8FAFC]">
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "العودة",
          icon: "arrow-forward",
          onPress: () => goBackOrReplace(router),
        }}
        trailingAction={{ accessibilityLabel: "بيانات التطبيق", icon: "warning" }}
      />
      <ScrollView contentContainerClassName="p-4 pb-8" keyboardShouldPersistTaps="handled">
        <View className="rounded-3xl border border-[#F2B8B5] bg-[#FFF7F6] p-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 items-end">
              <Text className="text-right text-lg font-bold text-[#BA1A1A]">
                مسح بيانات التطبيق
              </Text>
              <Text className="mt-1 text-right text-xs leading-5 text-[#7F1D1D]">
                أدخل كلمة مرور حساب المالك. عند صحتها تُحذف الطلبات والسجلات المالية والمصروفات والكباتن والمشرفون وكل بيانات التشغيل.
              </Text>
            </View>
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#FFE4E1]">
              <ShieldAlert size={23} color="#BA1A1A" />
            </View>
          </View>

          <View className="mt-5">
            <View className="flex-row items-center justify-end gap-1.5">
              <Text className="text-right text-xs font-bold text-[#7F1D1D]">
                كلمة مرور المالك
              </Text>
              <KeyRound size={15} color="#BA1A1A" />
            </View>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#9B6B6B"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
              returnKeyType="done"
              onSubmitEditing={() => void resetApplication()}
              className="mt-2 h-12 rounded-2xl border border-[#E7AAAA] bg-white px-3 text-left text-base text-[#1C1B1B]"
            />
          </View>

          <Pressable
            accessibilityLabel="مسح بيانات التطبيق"
            disabled={submitting}
            onPress={() => void resetApplication()}
            className={`mt-4 h-12 flex-row items-center justify-center gap-2 rounded-2xl ${submitting ? "bg-[#D9A6A2]" : "bg-[#BA1A1A] active:scale-95"}`}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Trash2 size={18} color="#FFFFFF" />
            )}
            <Text className="text-sm font-bold text-white">
              {submitting ? "جارٍ مسح البيانات..." : "مسح كل بيانات التطبيق"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
