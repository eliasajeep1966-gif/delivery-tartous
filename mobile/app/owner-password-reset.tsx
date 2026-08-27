import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { CheckCircle2, KeyRound, UserRound } from "lucide-react-native";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { useAppToast } from "@/contexts/app-toast-context";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import { goBackOrReplace } from "@/lib/navigation/go-back-or-replace";
import {
  nativeAdminUsersContract,
  type NativeUser,
} from "@/lib/supabase/native-admin-users-contract";
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

function userLabel(user: NativeUser): string {
  return user.fullName?.trim() || user.email || "مستخدم بلا اسم";
}

export default function OwnerPasswordResetScreen() {
  const router = useRouter();
  const { profile } = useDeliveryAuth();
  const { showToast } = useAppToast();
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [users, setUsers] = useState<NativeUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    let active = true;
    if (!profile?.id) return () => {
      active = false;
    };

    void Promise.resolve(getNativeSupabaseClient().rpc("is_application_owner"))
      .then(({ data, error }) => {
        if (active) setIsOwner(!error && data === true);
      })
      .catch(() => {
        if (active) setIsOwner(false);
      });

    return () => {
      active = false;
    };
  }, [profile?.id]);

  useEffect(() => {
    let active = true;
    if (!isOwner) return () => {
      active = false;
    };

    void Promise.resolve()
      .then(() => {
        if (active) setUsersLoading(true);
        return nativeAdminUsersContract.list();
      })
      .then(({ users: loadedUsers }) => {
        if (active) setUsers(loadedUsers);
      })
      .catch(() => {
        if (active) setUsers([]);
      })
      .finally(() => {
        if (active) setUsersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOwner]);

  const manageableUsers = useMemo(
    () => users.filter((user) => user.id !== profile?.id),
    [profile?.id, users],
  );
  const selectedUser = manageableUsers.find((user) => user.id === selectedUserId) ?? null;

  const resetSelectedUserPassword = async () => {
    if (!selectedUser) {
      showToast({
        message: "اختر الحساب الذي تريد تعيين كلمة مرور جديدة له.",
        tone: "error",
      });
      return;
    }
    if (newPassword.length < 12) {
      showToast({
        message: "يجب أن تكون كلمة المرور الجديدة 12 حرفاً على الأقل.",
        tone: "error",
      });
      return;
    }
    if (newPassword !== passwordConfirmation) {
      showToast({ message: "تأكيد كلمة المرور غير مطابق.", tone: "error" });
      return;
    }

    setResettingPassword(true);
    try {
      const { data, error } = await withTimeout(
        getNativeSupabaseClient().functions.invoke("owner-reset-user-password", {
          body: {
            userId: selectedUser.id,
            password: newPassword,
            passwordConfirmation,
          },
        }),
        "انتهت مهلة تعيين كلمة المرور. تحقق من الاتصال ثم حاول مجدداً.",
      );
      if (error) throw error;
      if (data && typeof data === "object" && "error" in data) {
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : "تعذر تعيين كلمة المرور للمستخدم.",
        );
      }

      setNewPassword("");
      setPasswordConfirmation("");
      showToast({ message: `تم تعيين كلمة مرور جديدة لـ ${userLabel(selectedUser)}.` });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "تعذر تعيين كلمة المرور للمستخدم.";
      showToast({ message, tone: "error", durationMs: 5000 });
    } finally {
      setResettingPassword(false);
    }
  };

  if (isOwner === null) {
    return (
      <ScreenContainer
        className="items-center justify-center bg-[#F8FAFC]"
        containerClassName="bg-[#F8FAFC]"
      >
        <ActivityIndicator size="large" color="#0060B8" />
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
        trailingAction={{ accessibilityLabel: "تعيين كلمة المرور", icon: "key" }}
      />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-8" keyboardShouldPersistTaps="handled">
        <View className="overflow-hidden rounded-3xl bg-[#0060B8] p-5 shadow-sm">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <KeyRound size={24} color="#FFFFFF" />
          </View>
          <Text className="mt-4 text-right text-xl font-bold text-white">
            تعيين كلمة مرور مستخدم
          </Text>
          <Text className="mt-2 text-right text-xs leading-5 text-[#DDEEFF]">
            اختر حساباً واحداً فقط ثم عيّن له كلمة مرور جديدة. لا تتأثر أي حسابات أخرى.
          </Text>
        </View>

        <View className="rounded-3xl border border-[#D9E8F4] bg-white p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 items-end">
              <Text className="text-right text-base font-bold text-[#173B59]">1. اختر الحساب</Text>
              <Text className="mt-1 text-right text-[11px] text-[#66727E]">
                حساب المالك غير ظاهر في هذه القائمة.
              </Text>
            </View>
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF4FF]">
              <UserRound size={21} color="#0060B8" />
            </View>
          </View>

          {usersLoading ? (
            <View className="mt-4 h-20 items-center justify-center rounded-2xl border border-[#D3E3F0] bg-[#F8FCFF]">
              <ActivityIndicator color="#0060B8" />
            </View>
          ) : manageableUsers.length ? (
            <View className="mt-4 gap-2">
              {manageableUsers.map((user) => {
                const selected = user.id === selectedUserId;
                return (
                  <Pressable
                    key={user.id}
                    disabled={resettingPassword}
                    onPress={() => setSelectedUserId(user.id)}
                    className={`flex-row items-center gap-3 rounded-2xl border p-3 ${selected ? "border-[#0060B8] bg-[#EAF4FF]" : "border-[#D9E8F4] bg-[#FCFEFF]"}`}
                  >
                    <View className={`h-9 w-9 items-center justify-center rounded-xl ${selected ? "bg-[#0060B8]" : "bg-[#EAF4FF]"}`}>
                      <Text className={`text-xs font-bold ${selected ? "text-white" : "text-[#0060B8]"}`}>
                        {userLabel(user).slice(0, 1)}
                      </Text>
                    </View>
                    <View className="flex-1 items-end">
                      <Text className="text-right text-sm font-bold text-[#173B59]">
                        {userLabel(user)}
                      </Text>
                      <Text className="mt-0.5 text-right text-[10px] text-[#66727E]">
                        {user.email ?? "بدون بريد"} · {user.role}
                      </Text>
                    </View>
                    {selected ? <CheckCircle2 size={20} color="#0060B8" /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text className="mt-4 text-right text-xs text-[#66727E]">
              لا يوجد حساب آخر يمكن تعيين كلمة مرور له.
            </Text>
          )}
        </View>

        <View className="rounded-3xl border border-[#D9E8F4] bg-white p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 items-end">
              <Text className="text-right text-base font-bold text-[#173B59]">2. كلمة المرور الجديدة</Text>
              <Text className="mt-1 text-right text-[11px] text-[#66727E]">
                يجب أن تكون 12 حرفاً على الأقل.
              </Text>
            </View>
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF4FF]">
              <KeyRound size={20} color="#0060B8" />
            </View>
          </View>

          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="كلمة المرور الجديدة"
            placeholderTextColor="#8A98A6"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!resettingPassword}
            className="mt-4 h-12 rounded-2xl border border-[#C9D9E7] bg-[#F8FCFF] px-3 text-left text-base text-[#1C1B1B]"
          />
          <TextInput
            value={passwordConfirmation}
            onChangeText={setPasswordConfirmation}
            placeholder="تأكيد كلمة المرور الجديدة"
            placeholderTextColor="#8A98A6"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!resettingPassword}
            returnKeyType="done"
            onSubmitEditing={() => void resetSelectedUserPassword()}
            className="mt-2 h-12 rounded-2xl border border-[#C9D9E7] bg-[#F8FCFF] px-3 text-left text-base text-[#1C1B1B]"
          />

          <Pressable
            accessibilityLabel="تعيين كلمة مرور المستخدم"
            disabled={resettingPassword || !manageableUsers.length}
            onPress={() => void resetSelectedUserPassword()}
            className={`mt-4 h-12 flex-row items-center justify-center gap-2 rounded-2xl ${resettingPassword || !manageableUsers.length ? "bg-[#94A9BD]" : "bg-[#0060B8] active:scale-95"}`}
          >
            {resettingPassword ? <ActivityIndicator color="#FFFFFF" /> : <KeyRound size={18} color="#FFFFFF" />}
            <Text className="text-sm font-bold text-white">
              {resettingPassword ? "جارٍ التعيين..." : "تعيين كلمة المرور"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
