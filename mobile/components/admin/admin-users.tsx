import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { type Href, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { useAppToast } from "@/contexts/app-toast-context";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import { useAdminUsers } from "@/features/admin/use-admin-users";
import {
  type NativeAppRole,
  type NativeUser,
} from "@/lib/supabase/native-admin-users-contract";

const roles: NativeAppRole[] = ["admin", "supervisor", "captain"];
const roleLabels: Record<NativeAppRole | "all", string> = {
  all: "الكل",
  admin: "أدمن",
  supervisor: "مشرف",
  captain: "كابتن",
};

export function AdminUsers() {
  const router = useRouter();
  const { profile, refresh } = useDeliveryAuth();
  const { showToast } = useAppToast();
  const users = useAdminUsers();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<NativeAppRole | "all">("all");
  const [roleUser, setRoleUser] = useState<NativeUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const isAdmin = profile?.role === "admin";

  const visible = useMemo(
    () =>
      users.users.filter(
        (user) =>
          (filter === "all" || user.role === filter) &&
          `${user.fullName ?? ""} ${user.email ?? ""}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
    [filter, search, users.users],
  );

  if (profile?.role === "captain") {
    return (
      <ScreenContainer className="bg-[#F0F7FF]" containerClassName="bg-[#EAF5FF]">
        <View style={styles.restricted}>
          <MaterialIcons name="lock-outline" size={34} color="#0060B8" />
          <Text style={styles.restrictedTitle}>الوصول غير مسموح</Text>
          <Text style={styles.subtle}>هذه الشاشة مخصصة للأدمن والمشرفين.</Text>
          <Pressable onPress={() => router.replace("/(tabs)" as Href)} style={styles.submitButton}>
            <Text style={styles.submitText}>العودة للرئيسية</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const mutate = async (
    input: Parameters<typeof users.mutate>[0],
    success: string,
  ) => {
    try {
      await users.mutate(input);
      showToast({ message: success });
      if (input.type === "role" && input.userId === profile?.id) await refresh();
      return true;
    } catch (error) {
      Alert.alert(
        "تعذر تنفيذ العملية",
        error instanceof Error ? error.message : "حاول مرة أخرى.",
      );
      return false;
    }
  };

  const toggle = (user: NativeUser) => {
    const action = user.isActive ? "تعطيل" : "تفعيل";
    Alert.alert(
      `${action} الحساب`,
      `هل تريد ${action} حساب ${user.fullName || user.email || "المستخدم"}؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تأكيد",
          style: user.isActive ? "destructive" : "default",
          onPress: () =>
            void mutate(
              { type: "active", user, value: !user.isActive },
              `تم ${action} الحساب.`,
            ),
        },
      ],
    );
  };

  return (
    <ScreenContainer
      className="bg-[#F0F7FF]"
      containerClassName="bg-[#EAF5FF]"
    >
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "العودة إلى المزيد",
          icon: "arrow-forward",
          onPress: () => router.replace("/(tabs)/more" as Href),
        }}
        trailingAction={{ accessibilityLabel: "إدارة المستخدمين", icon: "people" }}
      />

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={users.isFetching}
            onRefresh={() => void users.refetch()}
            tintColor="#0060B8"
          />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <View style={styles.heroRow}>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroTitle}>الحسابات والصلاحيات</Text>
                  <Text style={styles.subtle}>
                    أنشئ حساباً بانتظار التفعيل أو راجع الحسابات المفعلة.
                  </Text>
                </View>
                <View style={styles.heroIcon}>
                  <MaterialIcons name="person-outline" size={23} color="#0060B8" />
                </View>
              </View>
              <Pressable
                disabled={users.isPending || users.isMutating}
                onPress={() => setCreateOpen(true)}
                style={({ pressed }) => [
                  styles.createButton,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.createButtonText}>إنشاء حساب معلّق</Text>
              </Pressable>
            </View>

            {users.error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>
                  {users.error instanceof Error
                    ? users.error.message
                    : "تعذر تحميل المستخدمين."}
                </Text>
                <Pressable onPress={() => void users.refetch()} style={styles.retry}>
                  <Text style={styles.retryText}>إعادة المحاولة</Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={styles.section}>البحث والتصفية</Text>
            <View style={styles.searchBox}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="ابحث بالاسم أو البريد"
                placeholderTextColor="#8A98A6"
                style={styles.searchInput}
                textAlign="right"
                autoCapitalize="none"
              />
              <MaterialIcons name="search" size={20} color="#66727E" />
            </View>
            <View style={styles.filters}>
              {(Object.keys(roleLabels) as (NativeAppRole | "all")[]).map(
                (key) => (
                  <Pressable
                    key={key}
                    onPress={() => setFilter(key)}
                    style={[styles.filter, filter === key && styles.filterActive]}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        filter === key && styles.filterTextActive,
                      ]}
                    >
                      {roleLabels[key]}
                    </Text>
                  </Pressable>
                ),
              )}
            </View>

            <SectionHeader
              title="الحسابات المعلقة"
              count={users.pending.length}
              pending
            />
            {users.pending.length === 0 ? (
              <View style={styles.pendingEmpty}>
                <Text style={styles.pendingEmptyText}>
                  لا توجد حسابات معلقة حالياً.
                </Text>
              </View>
            ) : (
              users.pending.map((pending) => (
                <View key={pending.id} style={styles.pendingCard}>
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <Text style={styles.cardTitle}>
                        {pending.fullName || pending.email}
                      </Text>
                      <Text style={styles.email}>{pending.email}</Text>
                    </View>
                    <Text style={styles.pendingBadge}>
                      {roleLabels[pending.role]}
                    </Text>
                  </View>
                  <Pressable
                    disabled={users.isMutating}
                    onPress={() =>
                      Alert.alert(
                        "إلغاء الحساب المعلق",
                        "لن يتمكن المستخدم من تفعيل هذا الحساب.",
                        [
                          { text: "إلغاء", style: "cancel" },
                          {
                            text: "تأكيد",
                            style: "destructive",
                            onPress: () =>
                              void mutate(
                                { type: "cancel", pendingId: pending.id },
                                "تم إلغاء الحساب المعلق.",
                              ),
                          },
                        ],
                      )
                    }
                    style={styles.cancelButton}
                  >
                    <MaterialIcons name="cancel" size={16} color="#BA1A1A" />
                    <Text style={styles.cancelText}>إلغاء الحساب المعلق</Text>
                  </Pressable>
                </View>
              ))
            )}

            <SectionHeader title="الحسابات المفعلة" count={visible.length} />
          </>
        }
        renderItem={({ item }) => (
          <UserCard
            user={item}
            canChangeRole={isAdmin}
            canToggle={
              item.role === "captain"
              || (isAdmin && item.role === "supervisor")
            }
            disabled={users.isMutating}
            onToggle={() => toggle(item)}
            onChangeRole={() => setRoleUser(item)}
          />
        )}
        ListEmptyComponent={
          users.isPending ? (
            <Text style={styles.empty}>جارٍ تحميل المستخدمين...</Text>
          ) : (
            <Text style={styles.empty}>لا توجد حسابات مطابقة.</Text>
          )
        }
      />

      <CreatePendingModal
        visible={createOpen}
        isAdmin={isAdmin}
        busy={users.isMutating}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (draft) => {
          const completed = await mutate(
            { type: "create", ...draft },
            "تم إنشاء الحساب المعلق. يمكن للمستخدم تفعيله من شاشة الدخول.",
          );
          if (completed) setCreateOpen(false);
        }}
      />

      {roleUser ? (
        <RoleModal
          user={roleUser}
          busy={users.isMutating}
          onClose={() => setRoleUser(null)}
          onSelect={(nextRole) => {
            const target = roleUser;
            setRoleUser(null);
            void mutate(
              { type: "role", userId: target.id, value: nextRole },
              "تم تغيير دور المستخدم.",
            );
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}

function SectionHeader({
  title,
  count,
  pending = false,
}: {
  title: string;
  count: number;
  pending?: boolean;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text
        style={[styles.countBadge, pending && styles.pendingCountBadge]}
      >
        {count} حساب
      </Text>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
    </View>
  );
}

function UserCard({
  user,
  canChangeRole,
  canToggle,
  disabled,
  onToggle,
  onChangeRole,
}: {
  user: NativeUser;
  canChangeRole: boolean;
  canToggle: boolean;
  disabled: boolean;
  onToggle: () => void;
  onChangeRole: () => void;
}) {
  const name = user.fullName || user.email || "مستخدم";
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.slice(0, 1)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{name}</Text>
          <View style={styles.badgesRow}>
            <Text style={styles.roleBadge}>{roleLabels[user.role]}</Text>
            <Text
              style={user.isActive ? styles.activeBadge : styles.inactiveBadge}
            >
              {user.isActive ? "مفعّل" : "معطّل"}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.emailRow}>
        <MaterialIcons name="mail-outline" size={14} color="#66727E" />
        <Text style={styles.email}>{user.email || "بدون بريد"}</Text>
      </View>
      {canToggle || canChangeRole ? (
        <View style={styles.actions}>
          {canToggle ? (
            <Pressable
              disabled={disabled}
              onPress={onToggle}
              style={[
                styles.action,
                user.isActive ? styles.danger : styles.success,
              ]}
            >
              <MaterialIcons
                name={user.isActive ? "block" : "check-circle-outline"}
                size={16}
                color={user.isActive ? "#BA1A1A" : "#047857"}
              />
              <Text
                style={[
                  styles.actionText,
                  user.isActive ? styles.dangerText : styles.successText,
                ]}
              >
                {user.isActive ? "تعطيل الحساب" : "تفعيل الحساب"}
              </Text>
            </Pressable>
          ) : null}
          {canChangeRole ? (
            <Pressable
              disabled={disabled}
              onPress={onChangeRole}
              style={[styles.action, styles.roleAction]}
            >
              <MaterialIcons name="manage-accounts" size={17} color="#0060B8" />
              <Text style={styles.roleActionText}>تغيير الدور</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function CreatePendingModal({
  visible,
  isAdmin,
  busy,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  isAdmin: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (draft: {
    email: string;
    fullName: string;
    role: NativeAppRole;
    custodyItemsText?: string;
  }) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<NativeAppRole>("captain");
  const [custody, setCustody] = useState("");

  const close = () => {
    if (busy) return;
    setEmail("");
    setFullName("");
    setRole("captain");
    setCustody("");
    onClose();
  };

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.createModal}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalHeadingRow}>
              <Pressable disabled={busy} onPress={close} style={styles.modalCloseIcon}>
                <MaterialIcons name="close" size={21} color="#66727E" />
              </Pressable>
              <View style={styles.flex}>
                <Text style={styles.modalTitle}>إنشاء حساب معلّق</Text>
                <Text style={styles.subtle}>
                  يختار المستخدم كلمة مروره عند أول تفعيل.
                </Text>
              </View>
            </View>

            <Text style={styles.fieldLabel}>البيانات الأساسية</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              editable={!busy}
              placeholder="الاسم الكامل"
              placeholderTextColor="#8A98A6"
              style={styles.input}
              textAlign="right"
            />
            <TextInput
              value={email}
              onChangeText={setEmail}
              editable={!busy}
              placeholder="البريد الإلكتروني"
              placeholderTextColor="#8A98A6"
              style={styles.input}
              textAlign="right"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.fieldLabel}>الدور</Text>
            <View style={styles.roleGrid}>
              {(isAdmin ? roles : (["captain"] as NativeAppRole[])).map(
                (option) => (
                  <Pressable
                    key={option}
                    disabled={busy}
                    onPress={() => setRole(option)}
                    style={[
                      styles.roleChoice,
                      role === option && styles.roleChoiceSelected,
                    ]}
                  >
                    <MaterialIcons
                      name={
                        option === "captain"
                          ? "local-shipping"
                          : option === "supervisor"
                            ? "supervisor-account"
                            : "verified-user"
                      }
                      size={20}
                      color={role === option ? "#0060B8" : "#64717E"}
                    />
                    <Text
                      style={[
                        styles.roleChoiceText,
                        role === option && styles.roleChoiceTextSelected,
                      ]}
                    >
                      {roleLabels[option]}
                    </Text>
                  </Pressable>
                ),
              )}
            </View>

            {role === "captain" ? (
              <>
                <Text style={styles.fieldLabel}>الأمانات عند التفعيل</Text>
                <TextInput
                  value={custody}
                  onChangeText={setCustody}
                  editable={!busy}
                  placeholder={"غرض واحد في كل سطر\nمثال: حقيبة حرارية"}
                  placeholderTextColor="#A48751"
                  style={[styles.input, styles.custodyInput]}
                  textAlign="right"
                  multiline
                />
              </>
            ) : null}

            <Pressable
              disabled={busy}
              onPress={() =>
                void onSubmit({
                  email,
                  fullName,
                  role,
                  custodyItemsText: role === "captain" ? custody : undefined,
                })
              }
              style={[styles.submitButton, busy && styles.disabled]}
            >
              <MaterialIcons name="person-add" size={19} color="#FFFFFF" />
              <Text style={styles.submitText}>
                {busy ? "جارٍ إنشاء الحساب..." : "إنشاء الحساب المعلّق"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function RoleModal({
  user,
  busy,
  onClose,
  onSelect,
}: {
  user: NativeUser;
  busy: boolean;
  onClose: () => void;
  onSelect: (role: NativeAppRole) => void;
}) {
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>تغيير دور المستخدم</Text>
          <Text style={styles.subtle}>{user.fullName || user.email}</Text>
          {roles.map((role) => (
            <Pressable
              key={role}
              disabled={busy || role === user.role}
              onPress={() => onSelect(role)}
              style={[
                styles.roleOption,
                role === user.role && styles.roleOptionCurrent,
              ]}
            >
              <Text style={styles.roleOptionText}>
                {roleLabels[role]}
                {role === user.role ? " (الحالي)" : ""}
              </Text>
            </Pressable>
          ))}
          <Pressable disabled={busy} onPress={onClose} style={styles.closeModal}>
            <Text style={styles.closeModalText}>إلغاء</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 64,
    backgroundColor: "#0060B8",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitles: { alignItems: "flex-end" },
  headerIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  brand: { color: "#DBEAFF", fontFamily: "Cairo_400Regular", fontSize: 11 },
  title: { color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 18 },
  content: { padding: 12, paddingBottom: 30 },
  hero: { backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, borderColor: "#D3E3F0", padding: 14 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  heroCopy: { flex: 1, alignItems: "flex-end" },
  heroIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#EAF4FF", alignItems: "center", justifyContent: "center" },
  heroTitle: { textAlign: "right", fontFamily: "Cairo_700Bold", color: "#1C1B1B", fontSize: 17 },
  subtle: { textAlign: "right", color: "#66727E", fontFamily: "Cairo_400Regular", fontSize: 11, marginTop: 3 },
  createButton: { height: 45, borderRadius: 12, backgroundColor: "#0060B8", marginTop: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  createButtonText: { color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 13 },
  errorCard: { marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: "#F2B8B5", backgroundColor: "#FFF5F5", padding: 12 },
  errorText: { textAlign: "right", color: "#BA1A1A", fontFamily: "Cairo_400Regular", fontSize: 12 },
  retry: { alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#FFFFFF" },
  retryText: { color: "#BA1A1A", fontFamily: "Cairo_700Bold", fontSize: 11 },
  section: { textAlign: "right", fontFamily: "Cairo_700Bold", color: "#1C1B1B", fontSize: 15, marginTop: 18, marginBottom: 8 },
  searchBox: { height: 46, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C9D9E7", borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, height: 44, fontFamily: "Cairo_400Regular", color: "#1C1B1B" },
  filters: { flexDirection: "row-reverse", gap: 7, marginTop: 9 },
  filter: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1, borderColor: "#C9D9E7", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  filterActive: { backgroundColor: "#EAF4FF", borderColor: "#0060B8" },
  filterText: { fontFamily: "Cairo_600SemiBold", color: "#64717E", fontSize: 11 },
  filterTextActive: { color: "#0060B8" },
  sectionHeader: { marginTop: 19, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionHeaderTitle: { color: "#1C1B1B", fontFamily: "Cairo_700Bold", fontSize: 15 },
  countBadge: { color: "#0060B8", backgroundColor: "#DBEEFF", borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3, fontFamily: "Cairo_700Bold", fontSize: 10 },
  pendingCountBadge: { color: "#9A6700", backgroundColor: "#FFF3D8" },
  pendingEmpty: { minHeight: 58, borderRadius: 13, borderWidth: 1, borderStyle: "dashed", borderColor: "#F3D08A", backgroundColor: "#FFFCF4", alignItems: "center", justifyContent: "center", padding: 12 },
  pendingEmptyText: { color: "#9A6700", fontFamily: "Cairo_400Regular", fontSize: 12 },
  pendingCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#F3D08A", borderRadius: 14, padding: 13, marginBottom: 9 },
  card: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DBE7F2", borderRadius: 14, padding: 13, marginBottom: 9 },
  row: { flexDirection: "row", alignItems: "center", gap: 9 },
  flex: { flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E7EDF2", alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: "Cairo_700Bold", color: "#52606D" },
  cardTitle: { textAlign: "right", fontFamily: "Cairo_700Bold", color: "#1C1B1B", fontSize: 14 },
  emailRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 5, marginTop: 9 },
  email: { textAlign: "right", color: "#58616B", fontFamily: "Cairo_400Regular", fontSize: 10 },
  badgesRow: { flexDirection: "row-reverse", gap: 5, marginTop: 4 },
  roleBadge: { backgroundColor: "#EAF4FF", color: "#0060B8", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, fontFamily: "Cairo_700Bold", fontSize: 9 },
  activeBadge: { backgroundColor: "#ECFDF5", color: "#047857", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, fontFamily: "Cairo_700Bold", fontSize: 9 },
  inactiveBadge: { backgroundColor: "#FFF0F0", color: "#BA1A1A", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, fontFamily: "Cairo_700Bold", fontSize: 9 },
  pendingBadge: { backgroundColor: "#FFF3D8", color: "#9A6700", paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7, fontFamily: "Cairo_700Bold", fontSize: 10 },
  actions: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  action: { flex: 1, minHeight: 39, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1 },
  actionText: { fontFamily: "Cairo_700Bold", fontSize: 10 },
  danger: { backgroundColor: "#FFF0F0", borderColor: "#F2B8B5" },
  dangerText: { color: "#BA1A1A" },
  success: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  successText: { color: "#047857" },
  roleAction: { backgroundColor: "#EEF6FF", borderColor: "#A8C8FF" },
  roleActionText: { color: "#0060B8", fontFamily: "Cairo_700Bold", fontSize: 10 },
  cancelButton: { height: 36, marginTop: 10, borderRadius: 9, backgroundColor: "#FFF5F5", borderWidth: 1, borderColor: "#F2B8B5", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5 },
  cancelText: { color: "#BA1A1A", fontFamily: "Cairo_700Bold", fontSize: 11 },
  empty: { textAlign: "center", color: "#66727E", fontFamily: "Cairo_400Regular", padding: 25 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#F0F7FF", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 },
  createModal: { maxHeight: "91%", backgroundColor: "#F0F7FF", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18 },
  modalHeadingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  modalCloseIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  modalTitle: { textAlign: "right", fontFamily: "Cairo_700Bold", color: "#1C1B1B", fontSize: 18 },
  fieldLabel: { textAlign: "right", marginTop: 13, marginBottom: 7, color: "#1C1B1B", fontFamily: "Cairo_700Bold", fontSize: 13 },
  input: { minHeight: 46, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#C9D9E7", borderRadius: 12, paddingHorizontal: 12, marginBottom: 8, fontFamily: "Cairo_400Regular", color: "#1C1B1B" },
  roleGrid: { flexDirection: "row-reverse", gap: 8 },
  roleChoice: { flex: 1, minHeight: 66, borderRadius: 11, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DBE7F2", alignItems: "center", justifyContent: "center", gap: 3 },
  roleChoiceSelected: { backgroundColor: "#EAF4FF", borderColor: "#0060B8" },
  roleChoiceText: { color: "#64717E", fontFamily: "Cairo_700Bold", fontSize: 10 },
  roleChoiceTextSelected: { color: "#0060B8" },
  custodyInput: { minHeight: 94, paddingTop: 10, textAlignVertical: "top", borderColor: "#F3D08A", backgroundColor: "#FFFCF4" },
  submitButton: { height: 48, borderRadius: 12, backgroundColor: "#0060B8", marginTop: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  submitText: { color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 13 },
  disabled: { opacity: 0.55 },
  roleOption: { height: 50, borderRadius: 11, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DBE7F2", justifyContent: "center", alignItems: "center", marginTop: 9 },
  roleOptionCurrent: { opacity: 0.45, borderColor: "#0060B8" },
  roleOptionText: { fontFamily: "Cairo_700Bold", color: "#0060B8" },
  closeModal: { height: 45, alignItems: "center", justifyContent: "center", marginTop: 10 },
  closeModalText: { fontFamily: "Cairo_700Bold", color: "#BA1A1A" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  restricted: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  restrictedTitle: { color: "#1C1B1B", fontFamily: "Cairo_700Bold", fontSize: 18, marginTop: 8 },
});
