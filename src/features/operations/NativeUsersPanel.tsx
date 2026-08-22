import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { deliveryColors, deliveryRadius, deliveryShadows, deliverySpacing } from '@/constants/deliveryTheme';
import {
  deliverySupabase,
  type AppRole,
  type CaptainStatus,
  type Permission,
  type Profile,
  type UserPermissionOverride,
} from '@/data/supabase/supabaseContract';

type BackOfficeRole = 'admin' | 'supervisor';

type NativeUsersPanelProps = {
  role: BackOfficeRole;
  profiles: Profile[];
  captainStatuses: CaptainStatus[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
};

const roleLabels: Record<AppRole, string> = {
  admin: 'أدمن',
  supervisor: 'مشرف',
  captain: 'كابتن',
};

function userName(profile: Profile) {
  return profile.full_name?.trim() || profile.email;
}

export function NativeUsersPanel({ role, profiles, captainStatuses, onClose, onRefresh }: NativeUsersPanelProps) {
  const [roleTarget, setRoleTarget] = useState<Profile | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [permissionTarget, setPermissionTarget] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [overrides, setOverrides] = useState<UserPermissionOverride[]>([]);
  const [permissionChoices, setPermissionChoices] = useState<Record<string, boolean | undefined>>({});
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [savingPermissionCode, setSavingPermissionCode] = useState<string | null>(null);

  const captainStatusById = useMemo(
    () => new Map(captainStatuses.map((status) => [status.captain_id, status])),
    [captainStatuses]
  );

  const changeRole = async () => {
    if (role !== 'admin' || !roleTarget || !selectedRole || selectedRole === roleTarget.role || updatingUserId) return;
    setUpdatingUserId(roleTarget.id);
    try {
      await deliverySupabase.actions.setUserRole(roleTarget.id, selectedRole);
      setRoleTarget(null);
      setSelectedRole(null);
      await onRefresh();
    } catch (cause) {
      Alert.alert('تعذر تغيير الدور', cause instanceof Error ? cause.message : 'تعذر تغيير دور المستخدم.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const toggleCaptain = async (profile: Profile) => {
    if (profile.role !== 'captain' || updatingUserId) return;
    setUpdatingUserId(profile.id);
    try {
      await deliverySupabase.actions.setCaptainActive(profile.id, !profile.is_active);
      await onRefresh();
    } catch (cause) {
      Alert.alert('تعذر تحديث الكابتن', cause instanceof Error ? cause.message : 'تعذر تحديث حالة الكابتن.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const openPermissions = useCallback(async (profile: Profile) => {
    if (role !== 'admin' || profile.role !== 'supervisor') return;
    setPermissionTarget(profile);
    setPermissions([]);
    setOverrides([]);
    setPermissionChoices({});
    setPermissionsError(null);
    setIsPermissionsLoading(true);
    try {
      const [nextPermissions, nextOverrides] = await Promise.all([
        deliverySupabase.reads.permissions(),
        deliverySupabase.reads.userPermissionOverrides(profile.id),
      ]);
      setPermissions(nextPermissions);
      setOverrides(nextOverrides);
      setPermissionChoices(Object.fromEntries(nextOverrides.map((item) => [item.permission_code, item.is_allowed])));
    } catch (cause) {
      setPermissionsError(cause instanceof Error ? cause.message : 'تعذر تحميل تخصيصات الصلاحيات.');
    } finally {
      setIsPermissionsLoading(false);
    }
  }, [role]);

  const savePermission = async (permission: Permission) => {
    if (!permissionTarget || savingPermissionCode || permissionChoices[permission.code] === undefined) return;
    setSavingPermissionCode(permission.code);
    try {
      const saved = await deliverySupabase.actions.setUserPermissionOverride(permissionTarget.id, permission.code, Boolean(permissionChoices[permission.code]));
      setOverrides((current) => {
        const found = current.some((item) => item.permission_code === saved.permission_code);
        return found
          ? current.map((item) => item.permission_code === saved.permission_code ? saved : item)
          : [...current, saved];
      });
    } catch (cause) {
      Alert.alert('تعذر حفظ التخصيص', cause instanceof Error ? cause.message : 'تعذر حفظ تخصيص الصلاحية.');
    } finally {
      setSavingPermissionCode(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.backButton}><Text style={styles.backButtonText}>رجوع</Text></Pressable>
        <View><Text style={styles.headerTitle}>إدارة المستخدمين</Text><Text style={styles.headerSubtitle}>الحسابات والأدوار والصلاحيات</Text></View>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {profiles.map((profile) => {
          const captainStatus = profile.role === 'captain' ? captainStatusById.get(profile.id) : undefined;
          const isUpdating = updatingUserId === profile.id;
          return (
            <View key={profile.id} style={[styles.userCard, deliveryShadows.sm]}>
              <View style={styles.userHeader}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{userName(profile).slice(0, 1)}</Text></View>
                <View style={styles.userTitleWrap}><Text style={styles.userName}>{userName(profile)}</Text><Text style={styles.email}>{profile.email}</Text></View>
                <Text style={styles.roleChip}>{roleLabels[profile.role]}</Text>
              </View>
              {profile.role === 'captain' ? <Text style={styles.statusText}>{profile.is_active ? 'الحساب مفعّل' : 'الحساب معطّل'} · {captainStatus?.availability === 'available' ? 'متاح' : 'غير متاح'}</Text> : null}
              <View style={styles.actions}>
                {role === 'admin' ? <Pressable disabled={isUpdating} onPress={() => { setRoleTarget(profile); setSelectedRole(null); }} style={[styles.actionButton, isUpdating && styles.disabled]}><Text style={styles.actionButtonText}>تغيير الدور</Text></Pressable> : null}
                {profile.role === 'captain' ? <Pressable disabled={isUpdating} onPress={() => void toggleCaptain(profile)} style={[styles.actionButton, isUpdating && styles.disabled]}><Text style={styles.actionButtonText}>{isUpdating ? 'جارٍ الحفظ...' : profile.is_active ? 'تعطيل الكابتن' : 'تفعيل الكابتن'}</Text></Pressable> : null}
                {role === 'admin' && profile.role === 'supervisor' ? <Pressable onPress={() => void openPermissions(profile)} style={styles.permissionButton}><Text style={styles.permissionButtonText}>تخصيص الصلاحيات</Text></Pressable> : null}
              </View>
            </View>
          );
        })}
        {profiles.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>لا توجد حسابات ضمن نطاق صلاحياتك.</Text></View> : null}
      </ScrollView>

      <Modal animationType="slide" transparent visible={roleTarget !== null} onRequestClose={() => setRoleTarget(null)}>
        <View style={styles.backdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>تغيير دور المستخدم</Text><Text style={styles.sheetDescription}>{roleTarget ? userName(roleTarget) : ''}</Text><View style={styles.roleOptions}>{(['admin', 'supervisor', 'captain'] as AppRole[]).map((candidate) => <Pressable key={candidate} disabled={candidate === roleTarget?.role} onPress={() => setSelectedRole(candidate)} style={[styles.roleOption, selectedRole === candidate && styles.roleOptionActive, candidate === roleTarget?.role && styles.disabled]}><Text style={[styles.roleOptionText, selectedRole === candidate && styles.roleOptionTextActive]}>{roleLabels[candidate]}</Text></Pressable>)}</View><View style={styles.sheetActions}><Pressable onPress={() => setRoleTarget(null)} style={styles.secondary}><Text style={styles.secondaryText}>إلغاء</Text></Pressable><Pressable disabled={!selectedRole || updatingUserId !== null} onPress={() => void changeRole()} style={[styles.primary, (!selectedRole || updatingUserId !== null) && styles.disabled]}><Text style={styles.primaryText}>{updatingUserId ? 'جارٍ الحفظ...' : 'حفظ الدور'}</Text></Pressable></View></View></View>
      </Modal>

      <Modal animationType="slide" transparent visible={permissionTarget !== null} onRequestClose={() => setPermissionTarget(null)}>
        <View style={styles.backdrop}><View style={styles.permissionSheet}><Text style={styles.sheetTitle}>تخصيص صلاحيات المشرف</Text><Text style={styles.sheetDescription}>{permissionTarget ? userName(permissionTarget) : ''}</Text><ScrollView contentContainerStyle={styles.permissionsContent}>{isPermissionsLoading ? <Text style={styles.loading}>جارٍ تحميل الصلاحيات...</Text> : null}{permissionsError ? <Text style={styles.error}>{permissionsError}</Text> : null}{!isPermissionsLoading && !permissionsError && permissions.map((permission) => { const saved = overrides.find((item) => item.permission_code === permission.code); const choice = permissionChoices[permission.code]; const saving = savingPermissionCode === permission.code; return <View key={permission.code} style={styles.permissionCard}><Text style={styles.permissionCode}>{permission.code}</Text><Text style={styles.permissionDescription}>{permission.description}</Text><Text style={styles.currentChoice}>الحالي: {saved ? saved.is_allowed ? 'سماح' : 'منع' : 'دون تخصيص'}</Text><View style={styles.choiceRow}><Pressable disabled={saving} onPress={() => setPermissionChoices((current) => ({ ...current, [permission.code]: true }))} style={[styles.choice, choice === true && styles.allowActive]}><Text style={styles.choiceText}>سماح</Text></Pressable><Pressable disabled={saving} onPress={() => setPermissionChoices((current) => ({ ...current, [permission.code]: false }))} style={[styles.choice, choice === false && styles.denyActive]}><Text style={styles.choiceText}>منع</Text></Pressable></View><Pressable disabled={choice === undefined || saving} onPress={() => void savePermission(permission)} style={[styles.savePermission, (choice === undefined || saving) && styles.disabled]}><Text style={styles.savePermissionText}>{saving ? 'جارٍ الحفظ...' : 'حفظ التخصيص'}</Text></Pressable></View>; })}</ScrollView><Pressable onPress={() => setPermissionTarget(null)} style={styles.secondary}><Text style={styles.secondaryText}>إغلاق</Text></Pressable></View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: deliveryColors.background },
  header: { alignItems: 'center', backgroundColor: deliveryColors.primary, flexDirection: 'row-reverse', justifyContent: 'space-between', minHeight: 74, paddingHorizontal: deliverySpacing.lg, paddingVertical: deliverySpacing.md },
  headerTitle: { color: deliveryColors.surface, fontSize: 18, fontWeight: '800', textAlign: 'right' },
  headerSubtitle: { color: '#D7EEFF', fontSize: 11, marginTop: 3, textAlign: 'right' },
  backButton: { borderColor: '#FFFFFF66', borderRadius: deliveryRadius.md, borderWidth: 1, paddingHorizontal: deliverySpacing.md, paddingVertical: deliverySpacing.sm },
  backButtonText: { color: deliveryColors.surface, fontSize: 13, fontWeight: '800' },
  scrollContent: { gap: deliverySpacing.md, padding: deliverySpacing.lg, paddingBottom: deliverySpacing.xxxl },
  userCard: { backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.lg, padding: deliverySpacing.lg },
  userHeader: { alignItems: 'center', flexDirection: 'row-reverse', gap: deliverySpacing.sm },
  avatar: { alignItems: 'center', backgroundColor: deliveryColors.primarySoft, borderRadius: 999, height: 40, justifyContent: 'center', width: 40 },
  avatarText: { color: deliveryColors.primary, fontSize: 17, fontWeight: '800' },
  userTitleWrap: { flex: 1 },
  userName: { color: deliveryColors.text, fontSize: 15, fontWeight: '800', textAlign: 'right' },
  email: { color: deliveryColors.muted, fontSize: 11, marginTop: 3, textAlign: 'right' },
  roleChip: { backgroundColor: deliveryColors.primarySoft, borderRadius: 999, color: deliveryColors.primary, fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: deliverySpacing.sm, paddingVertical: 4 },
  statusText: { color: deliveryColors.muted, fontSize: 12, marginTop: deliverySpacing.md, textAlign: 'right' },
  actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: deliverySpacing.sm, marginTop: deliverySpacing.md },
  actionButton: { alignItems: 'center', backgroundColor: deliveryColors.primarySoft, borderRadius: deliveryRadius.sm, flexGrow: 1, justifyContent: 'center', minHeight: 38, paddingHorizontal: deliverySpacing.sm },
  actionButtonText: { color: deliveryColors.primary, fontSize: 11, fontWeight: '800' },
  permissionButton: { alignItems: 'center', backgroundColor: '#F3E8FF', borderRadius: deliveryRadius.sm, flexGrow: 1, justifyContent: 'center', minHeight: 38, paddingHorizontal: deliverySpacing.sm },
  permissionButtonText: { color: '#7E22CE', fontSize: 11, fontWeight: '800' },
  empty: { alignItems: 'center', backgroundColor: deliveryColors.surface, borderColor: '#DCE7F0', borderRadius: deliveryRadius.lg, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', minHeight: 120, padding: deliverySpacing.lg },
  emptyText: { color: deliveryColors.muted, fontSize: 14, textAlign: 'center' },
  backdrop: { backgroundColor: 'rgba(15, 35, 54, 0.46)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: deliveryColors.surface, borderTopLeftRadius: deliveryRadius.xl, borderTopRightRadius: deliveryRadius.xl, gap: deliverySpacing.md, padding: deliverySpacing.xl },
  permissionSheet: { backgroundColor: deliveryColors.background, borderTopLeftRadius: deliveryRadius.xl, borderTopRightRadius: deliveryRadius.xl, maxHeight: '88%', padding: deliverySpacing.xl },
  sheetTitle: { color: deliveryColors.text, fontSize: 18, fontWeight: '800', textAlign: 'right' },
  sheetDescription: { color: deliveryColors.muted, fontSize: 13, textAlign: 'right' },
  roleOptions: { flexDirection: 'row-reverse', gap: deliverySpacing.sm },
  roleOption: { alignItems: 'center', backgroundColor: deliveryColors.background, borderColor: '#DCE7F0', borderRadius: deliveryRadius.md, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 50 },
  roleOptionActive: { backgroundColor: deliveryColors.primary, borderColor: deliveryColors.primary },
  roleOptionText: { color: deliveryColors.text, fontSize: 12, fontWeight: '800' },
  roleOptionTextActive: { color: deliveryColors.surface },
  sheetActions: { flexDirection: 'row-reverse', gap: deliverySpacing.md },
  primary: { alignItems: 'center', backgroundColor: deliveryColors.primary, borderRadius: deliveryRadius.md, flex: 1, justifyContent: 'center', minHeight: 46 },
  primaryText: { color: deliveryColors.surface, fontSize: 14, fontWeight: '800' },
  secondary: { alignItems: 'center', backgroundColor: deliveryColors.surface, borderColor: '#CFE0EC', borderRadius: deliveryRadius.md, borderWidth: 1, justifyContent: 'center', minHeight: 46, paddingHorizontal: deliverySpacing.lg },
  secondaryText: { color: deliveryColors.primary, fontSize: 14, fontWeight: '800' },
  permissionsContent: { gap: deliverySpacing.md, paddingVertical: deliverySpacing.lg },
  loading: { color: deliveryColors.primary, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  error: { color: deliveryColors.danger, fontSize: 13, textAlign: 'right' },
  permissionCard: { backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.lg, padding: deliverySpacing.md },
  permissionCode: { color: deliveryColors.text, fontSize: 14, fontWeight: '800', textAlign: 'right' },
  permissionDescription: { color: deliveryColors.muted, fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: 'right' },
  currentChoice: { color: deliveryColors.muted, fontSize: 11, marginTop: deliverySpacing.sm, textAlign: 'right' },
  choiceRow: { flexDirection: 'row-reverse', gap: deliverySpacing.sm, marginTop: deliverySpacing.sm },
  choice: { alignItems: 'center', backgroundColor: deliveryColors.background, borderColor: '#DCE7F0', borderRadius: deliveryRadius.sm, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 36 },
  allowActive: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  denyActive: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  choiceText: { color: deliveryColors.text, fontSize: 12, fontWeight: '800' },
  savePermission: { alignItems: 'center', backgroundColor: deliveryColors.primarySoft, borderRadius: deliveryRadius.sm, justifyContent: 'center', marginTop: deliverySpacing.sm, minHeight: 38 },
  savePermissionText: { color: deliveryColors.primary, fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.5 },
});
