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
import { KeyRound, ShieldAlert, Trash2, UserRound } from "lucide-react-native";

import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
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

export default function OwnerDataResetScreen() {
  const router = useRouter();
  const { profile, signOut } = useDeliveryAuth();
  const { showToast } = useAppToast();
  const [password, setPassword] = useState("");
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<NativeUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false);

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

  const requestApplicationReset = () => {
    if (!password) {
      showToast({
        message: "أدخل كلمة مرور حساب المالك للمتابعة.",
        tone: "error",
      });
      return;
    }
    setResetConfirmationOpen(true);
  };

  const resetApplication = async () => {
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
      showToast({ message, tone: "error", durationMs: 5000 });
    } finally {
      setSubmitting(false);
    }
  };

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
      if (data && typeof data === "object" && "error" in data)
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : "تعذر تعيين كلمة المرور للمستخدم.",
        );

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
      <ScrollView contentContainerClassName="gap-4 p-4 pb-8" keyboardShouldPersistTaps="handled">
        <View className="rounded-3xl border border-[#E4EEF7] bg-white p-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 items-end">
              <Text className="text-right text-lg font-bold text-[#173B59]">
                تعيين كلمة مرور مستخدم
              </Text>
              <Text className="mt-1 text-right text-xs leading-5 text-[#58616B]">
                اختر مستخدماً واحداً ثم عيّن له كلمة مرور جديدة. باقي الحسابات لا تتأثر.
              </Text>
            </View>
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF4FF]">
              <UserRound size={23} color="#0060B8" />
            </View>
          </View>

          <Text className="mt-4 text-right text-xs font-bold text-[#4F5D6B]">
            اختر المستخدم
          </Text>
          {usersLoading ? (
            <View className="mt-2 h-16 items-center justify-center rounded-2xl border border-[#D3E3F0] bg-[#F8FCFF]">
              <ActivityIndicator color="#0060B8" />
            </View>
          ) : manageableUsers.length ? (
            <View className="mt-2 gap-2">
              {manageableUsers.map((user) => {
                const selected = user.id === selectedUserId;
                return (
                  <Pressable
                    key={user.id}
                    onPress={() => setSelectedUserId(user.id)}
                    className={`rounded-2xl border p-3 ${selected ? "border-[#0060B8] bg-[#EAF4FF]" : "border-[#D3E3F0] bg-[#F8FCFF]"}`}
                  >
                    <Text className="text-right text-sm font-bold text-[#173B59]">
                      {userLabel(user)}
                    </Text>
                    <Text className="mt-0.5 text-right text-[11px] text-[#66727E]">
                      {user.email ?? ""} · {user.role}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text className="mt-2 text-right text-xs text-[#66727E]">
              لا يوجد حساب آخر يمكن تعيين كلمة مرور له.
            </Text>
          )}

          <Text className="mt-4 text-right text-xs font-bold text-[#4F5D6B]">
            كلمة المرور الجديدة
          </Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="12 حرفاً على الأقل"
            placeholderTextColor="#8A98A6"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!resettingPassword}
            className="mt-1.5 h-12 rounded-2xl border border-[#C9D9E7] bg-[#F8FCFF] px-3 text-left text-base text-[#1C1B1B]"
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
            {resettingPassword ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <KeyRound size={18} color="#FFFFFF" />
            )}
            <Text className="text-sm font-bold text-white">
              {resettingPassword ? "جارٍ التعيين..." : "تعيين كلمة المرور"}
            </Text>
          </Pressable>
        </View>

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
              onSubmitEditing={requestApplicationReset}
              className="mt-2 h-12 rounded-2xl border border-[#E7AAAA] bg-white px-3 text-left text-base text-[#1C1B1B]"
            />
          </View>

          <Pressable
            accessibilityLabel="مسح بيانات التطبيق"
            disabled={submitting}
            onPress={requestApplicationReset}
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
      <ActionConfirmationDialog
        visible={resetConfirmationOpen}
        isConfirming={submitting}
        title="تأكيد مسح بيانات التطبيق"
        description="سيتم حذف الطلبات والسجلات المالية والمصروفات وبيانات التشغيل نهائياً. لا يمكن التراجع عن هذه العملية."
        confirmLabel="مسح البيانات نهائياً"
        icon="delete-forever"
        tone="danger"
        onClose={() => setResetConfirmationOpen(false)}
        onConfirm={() => void resetApplication()}
      />
    </ScreenContainer>
  );
}
