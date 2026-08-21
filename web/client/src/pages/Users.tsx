import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Ban,
  CircleUserRound,
  LoaderCircle,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  UserCog,
  UserRound,
  UsersRound,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLocation } from 'wouter';

import { AdminBottomNav } from '@/components/AdminBottomNav';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useWebAuth } from '@/contexts/WebAuthContext';
import {
  webSupabase,
  type WebAppRole,
  type WebPermission,
  type WebProfile,
  type WebUserPermissionOverride,
} from '@/data/supabase/webSupabaseContract';
import { getUsersErrorMessage, useAdminUsersData } from '@/features/admin/useAdminUsersData';
import { WebRequestTimeoutError, withWebRequestTimeout } from '@/lib/authRequest';

type PendingAccountDraft = {
  name: string;
  email: string;
  role: WebAppRole;
  custodyItemsText: string;
};

type OverrideChoiceByCode = Record<string, boolean | undefined>;

const roleMeta: Record<WebAppRole, { label: string; cardClass: string; icon: typeof ShieldCheck }> = {
  admin: { label: 'أدمن', cardClass: 'bg-violet-50 text-violet-700 border-violet-100', icon: ShieldCheck },
  supervisor: { label: 'مشرف', cardClass: 'bg-blue-50 text-[#0060B8] border-blue-100', icon: CircleUserRound },
  captain: { label: 'كابتن', cardClass: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: Truck },
};

const roles = Object.keys(roleMeta) as WebAppRole[];
const fieldClass = 'h-11 w-full rounded-xl border border-[#c9d9e7] bg-white px-3 text-sm text-[#1c1b1b] placeholder:text-[#8a98a6] focus:border-[#0060B8] focus:outline-none focus:ring-2 focus:ring-[#0060B8]/15 disabled:cursor-not-allowed disabled:opacity-70';

function createDraft(): PendingAccountDraft {
  return { name: '', email: '', role: 'captain', custodyItemsText: '' };
}

function hasValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function displayName(profile: Pick<WebProfile, 'full_name' | 'email'>): string {
  return profile.full_name?.trim() || profile.email;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'غير متاح';

  return new Intl.DateTimeFormat('ar-SY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function RoleChip({ role }: { role: WebAppRole }) {
  const meta = roleMeta[role];
  const Icon = meta.icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${meta.cardClass}`}>
      <Icon size={13} />
      {meta.label}
    </span>
  );
}

function RoleSelection({
  selectedRole,
  currentRole,
  onSelect,
  disabled = false,
}: {
  selectedRole: WebAppRole | null;
  currentRole?: WebAppRole;
  onSelect: (role: WebAppRole) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {roles.map((role) => {
        const meta = roleMeta[role];
        const Icon = meta.icon;
        const isCurrent = currentRole === role;
        const isSelected = selectedRole === role;

        return (
          <button
            type="button"
            key={role}
            disabled={disabled || isCurrent}
            onClick={() => onSelect(role)}
            className={`relative flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border text-xs font-bold transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-55 ${isSelected ? 'border-[#0060B8] bg-[#eaf4ff] text-[#0060B8] shadow-[inset_0_0_0_1px_#0060B8]' : 'border-[#dce6ef] bg-white text-[#64717e] hover:bg-[#f7fbff]'}`}
          >
            <Icon size={18} />
            {meta.label}
            {isCurrent && <span className="absolute bottom-1 text-[9px] font-normal">الحالي</span>}
          </button>
        );
      })}
    </div>
  );
}

function PermissionOverridesDialog({
  target,
  permissions,
  overrides,
  choices,
  isLoading,
  errorMessage,
  savingOverrideKey,
  onClose,
  onChoiceChange,
  onSave,
  onRetry,
}: {
  target: WebProfile | null;
  permissions: WebPermission[];
  overrides: WebUserPermissionOverride[];
  choices: OverrideChoiceByCode;
  isLoading: boolean;
  errorMessage: string | null;
  savingOverrideKey: string | null;
  onClose: () => void;
  onChoiceChange: (permissionCode: string, isAllowed: boolean) => void;
  onSave: (permission: WebPermission) => void;
  onRetry: () => void;
}) {
  const overridesByCode = new Map(overrides.map((override) => [override.permission_code, override]));

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton className="max-h-[88dvh] max-w-[calc(100%-1.25rem)] gap-0 overflow-y-auto rounded-2xl border-[#cfe1f0] bg-[#f0f7ff] p-0 sm:max-w-[430px]" dir="rtl">
        <DialogHeader className="border-b border-[#dbe7f2] bg-white px-5 pt-5 pb-4 text-right">
          <DialogTitle className="pr-7 text-right text-[19px]">Permission Overrides</DialogTitle>
          <DialogDescription className="text-right text-xs">
            تخصيص صلاحيات المستخدم {target ? displayName(target) : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 p-4">
          {isLoading && (
            <div className="flex min-h-32 items-center justify-center gap-2 rounded-2xl border border-[#dbe7f2] bg-white text-sm font-bold text-[#0060B8]">
              <LoaderCircle className="animate-spin" size={19} />
              جارٍ تحميل الصلاحيات...
            </div>
          )}

          {!isLoading && errorMessage && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-right text-sm leading-6 text-[#ba1a1a]">
              <p>{errorMessage}</p>
              <button type="button" onClick={onRetry} className="mt-3 flex h-9 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-[#ba1a1a] active:scale-[0.98]">
                <RefreshCw size={14} />
                إعادة المحاولة
              </button>
            </div>
          )}

          {!isLoading && !errorMessage && permissions.length === 0 && (
            <div className="rounded-2xl border border-[#dbe7f2] bg-white p-4 text-center text-sm text-[#58616b]">
              لا توجد صلاحيات معرّفة حالياً.
            </div>
          )}

          {!isLoading && !errorMessage && permissions.map((permission) => {
            const existingOverride = overridesByCode.get(permission.code);
            const choice = choices[permission.code];
            const overrideKey = `${target?.id ?? ''}:${permission.code}`;
            const isSaving = savingOverrideKey === overrideKey;

            return (
              <article key={permission.code} className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#1c1b1b]">{permission.code}</h3>
                    <p className="mt-1 text-xs leading-5 text-[#58616b]">{permission.description}</p>
                    <p className="mt-1 text-[11px] text-[#75818e]">
                      التخصيص الحالي: {existingOverride ? (existingOverride.is_allowed ? 'سماح' : 'منع') : 'لا يوجد تخصيص'}
                    </p>
                  </div>
                </div>

                <RadioGroup
                  value={choice === undefined ? '' : choice ? 'allow' : 'deny'}
                  onValueChange={(value) => onChoiceChange(permission.code, value === 'allow')}
                  disabled={isSaving}
                  className="mt-3 grid grid-cols-2 gap-2"
                >
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-2 text-xs font-bold text-emerald-700 has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-emerald-300">
                    <RadioGroupItem value="allow" id={`allow-${permission.code}`} className="border-emerald-500 text-emerald-600" />
                    سماح
                  </label>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-2 py-2 text-xs font-bold text-[#ba1a1a] has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-red-300">
                    <RadioGroupItem value="deny" id={`deny-${permission.code}`} className="border-red-500 text-red-600" />
                    منع
                  </label>
                </RadioGroup>

                <button
                  type="button"
                  disabled={choice === undefined || isSaving}
                  onClick={() => onSave(permission)}
                  className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#a8c8ff] bg-[#eef6ff] text-xs font-bold text-[#0060B8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving && <LoaderCircle className="animate-spin" size={15} />}
                  {isSaving ? 'جارٍ الحفظ...' : 'حفظ التخصيص'}
                </button>
              </article>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Users() {
  const [, setLocation] = useLocation();
  const { profile: currentProfile, refresh: refreshAuth } = useWebAuth();
  const {
    profiles,
    captainStatuses,
    pendingAccounts,
    isInitialLoading,
    readError,
    reload,
    addPendingAccount,
    removePendingAccount,
    replaceProfile,
    profilesPageNumber,
    pendingPageNumber,
    hasNextProfilesPage,
    hasPreviousProfilesPage,
    hasNextPendingPage,
    hasPreviousPendingPage,
    nextProfilesPage,
    previousProfilesPage,
    nextPendingPage,
    previousPendingPage,
  } = useAdminUsersData();

  const [draft, setDraft] = useState<PendingAccountDraft>(createDraft);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingPending, setIsCreatingPending] = useState(false);
  const [cancellingPendingId, setCancellingPendingId] = useState<string | null>(null);
  const [roleTarget, setRoleTarget] = useState<WebProfile | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<WebAppRole | null>(null);
  const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(null);
  const [togglingCaptainId, setTogglingCaptainId] = useState<string | null>(null);
  const [permissionTarget, setPermissionTarget] = useState<WebProfile | null>(null);
  const [permissions, setPermissions] = useState<WebPermission[]>([]);
  const [overrides, setOverrides] = useState<WebUserPermissionOverride[]>([]);
  const [overrideChoices, setOverrideChoices] = useState<OverrideChoiceByCode>({});
  const [loadingPermissionsForUserId, setLoadingPermissionsForUserId] = useState<string | null>(null);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [savingOverrideKey, setSavingOverrideKey] = useState<string | null>(null);
  const permissionsRequestVersion = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const captainStatusById = new Map(captainStatuses.map((status) => [status.captain_id, status]));

  const updateDraft = <Field extends keyof PendingAccountDraft>(field: Field, value: PendingAccountDraft[Field]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const closeCreateDialog = () => {
    if (isCreatingPending) return;
    setIsCreateDialogOpen(false);
    setDraft(createDraft());
  };

  const reportMutationFailure = (label: string, error: unknown, fallbackMessage: string) => {
    console.error(`${label} failed.`, error);
    toast.error(getUsersErrorMessage(error, fallbackMessage));

    if (error instanceof WebRequestTimeoutError) {
      // Do not keep the mutation control pending. The RPC may have completed after its response timed out.
      // This performs a read-only verification and never retries the mutation automatically.
      void reload({ background: true });
    }
  };

  const createPending = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = draft.email.trim().toLowerCase();
    const normalizedName = draft.name.trim();

    if (!normalizedName) {
      toast.error('أدخل الاسم الكامل للحساب.');
      return;
    }

    if (!hasValidEmail(normalizedEmail)) {
      toast.error('أدخل بريداً إلكترونياً صحيحاً.');
      return;
    }

    if (!roles.includes(draft.role)) {
      toast.error('اختر دوراً صحيحاً للحساب.');
      return;
    }

    if (isCreatingPending) return;
    setIsCreatingPending(true);

    try {
      const createdAccount = await withWebRequestTimeout(
        webSupabase.actions.createPendingAccount({
          email: normalizedEmail,
          fullName: normalizedName,
          role: draft.role,
          custodyItemsText: draft.role === 'captain' ? draft.custodyItemsText : undefined,
        }),
        'انتهت مهلة إنشاء الحساب بعد 15 ثانية. تم التحقق من القائمة؛ لا تعِد الإرسال قبل مراجعتها.',
      );

      addPendingAccount(createdAccount);
      setIsCreateDialogOpen(false);
      setDraft(createDraft());
      toast.success('تم إنشاء الحساب المعلّق بنجاح.');
    } catch (error) {
      reportMutationFailure('Create pending account', error, 'تعذر إنشاء الحساب المعلّق.');
    } finally {
      if (mounted.current) setIsCreatingPending(false);
    }
  };

  const cancelPending = async (pendingId: string) => {
    if (cancellingPendingId) return;
    setCancellingPendingId(pendingId);

    try {
      const cancelledAccount = await withWebRequestTimeout(
        webSupabase.actions.cancelPendingAccount(pendingId),
        'انتهت مهلة إلغاء الحساب بعد 15 ثانية. تم التحقق من القائمة؛ لا تعِد الإلغاء قبل مراجعتها.',
      );

      removePendingAccount(cancelledAccount.id);
      toast.success('تم إلغاء الحساب المعلّق.');
    } catch (error) {
      reportMutationFailure('Cancel pending account', error, 'تعذر إلغاء الحساب المعلّق.');
    } finally {
      if (mounted.current) setCancellingPendingId(null);
    }
  };

  const openRoleDialog = (user: WebProfile) => {
    setRoleTarget(user);
    setSelectedNewRole(null);
  };

  const closeRoleDialog = () => {
    if (changingRoleUserId) return;
    setRoleTarget(null);
    setSelectedNewRole(null);
  };

  const confirmRoleChange = async () => {
    if (!roleTarget || !selectedNewRole || selectedNewRole === roleTarget.role) {
      toast.error('اختر دوراً جديداً مختلفاً عن الدور الحالي.');
      return;
    }

    if (changingRoleUserId) return;
    setChangingRoleUserId(roleTarget.id);

    try {
      const updatedProfile = await withWebRequestTimeout(
        webSupabase.actions.setUserRole(roleTarget.id, selectedNewRole),
        'انتهت مهلة تغيير الدور بعد 15 ثانية. تم التحقق من القائمة؛ لا تعِد العملية قبل مراجعتها.',
      );

      replaceProfile(updatedProfile);
      setRoleTarget(null);
      setSelectedNewRole(null);
      toast.success('تم تغيير دور المستخدم بنجاح.');

      if (updatedProfile.id === currentProfile?.id) {
        await refreshAuth();
      }
    } catch (error) {
      reportMutationFailure('Set user role', error, 'تعذر تغيير دور المستخدم.');
    } finally {
      if (mounted.current) setChangingRoleUserId(null);
    }
  };

  const toggleCaptain = async (user: WebProfile) => {
    if (user.role !== 'captain' || togglingCaptainId) return;
    setTogglingCaptainId(user.id);

    try {
      const updatedProfile = await withWebRequestTimeout(
        webSupabase.actions.setCaptainActive(user.id, !user.is_active),
        'انتهت مهلة تحديث حالة الكابتن بعد 15 ثانية. تم التحقق من القائمة؛ لا تعِد العملية قبل مراجعتها.',
      );

      replaceProfile(updatedProfile);
      toast.success(updatedProfile.is_active ? 'تم تفعيل الكابتن.' : 'تم تعطيل الكابتن.');
    } catch (error) {
      reportMutationFailure('Set captain active', error, 'تعذر تحديث حالة الكابتن.');
    } finally {
      if (mounted.current) setTogglingCaptainId(null);
    }
  };

  const closePermissionsDialog = () => {
    if (savingOverrideKey) return;
    ++permissionsRequestVersion.current;
    setPermissionTarget(null);
    setPermissions([]);
    setOverrides([]);
    setOverrideChoices({});
    setPermissionsError(null);
    setLoadingPermissionsForUserId(null);
  };

  const openPermissionsDialog = async (user: WebProfile) => {
    if (currentProfile?.role !== 'admin' || user.role !== 'supervisor') {
      toast.error('تخصيص الصلاحيات مسموح للمشرفين فقط.');
      return;
    }

    const requestVersion = ++permissionsRequestVersion.current;
    setPermissionTarget(user);
    setPermissions([]);
    setOverrides([]);
    setOverrideChoices({});
    setPermissionsError(null);
    setLoadingPermissionsForUserId(user.id);

    try {
      const [nextPermissions, nextOverrides] = await Promise.all([
        withWebRequestTimeout(
          webSupabase.reads.permissions(),
          'انتهت مهلة تحميل الصلاحيات بعد 15 ثانية. حاول مرة أخرى.',
        ),
        withWebRequestTimeout(
          webSupabase.reads.userPermissionOverrides(user.id),
          'انتهت مهلة تحميل تخصيصات الصلاحيات بعد 15 ثانية. حاول مرة أخرى.',
        ),
      ]);

      if (!mounted.current || requestVersion !== permissionsRequestVersion.current) return;

      setPermissions(nextPermissions);
      setOverrides(nextOverrides);
      setOverrideChoices(Object.fromEntries(nextOverrides.map((item) => [item.permission_code, item.is_allowed])));
    } catch (error) {
      console.error('Permission overrides load failed.', error);
      if (!mounted.current || requestVersion !== permissionsRequestVersion.current) return;

      setPermissionsError(getUsersErrorMessage(error, 'تعذر تحميل تخصيصات الصلاحيات.'));
    } finally {
      if (mounted.current && requestVersion === permissionsRequestVersion.current) {
        setLoadingPermissionsForUserId(null);
      }
    }
  };

  const savePermissionOverride = async (permission: WebPermission) => {
    if (currentProfile?.role !== 'admin' || !permissionTarget || permissionTarget.role !== 'supervisor') {
      toast.error('تخصيص الصلاحيات مسموح للمشرفين فقط.');
      return;
    }
    const isAllowed = overrideChoices[permission.code];
    const overrideKey = `${permissionTarget.id}:${permission.code}`;

    if (isAllowed === undefined) {
      toast.error('اختر سماحاً أو منعاً قبل الحفظ.');
      return;
    }

    if (savingOverrideKey) return;
    setSavingOverrideKey(overrideKey);

    try {
      const savedOverride = await withWebRequestTimeout(
        webSupabase.actions.setUserPermissionOverride(permissionTarget.id, permission.code, isAllowed),
        'انتهت مهلة حفظ التخصيص بعد 15 ثانية. أعد فتح التخصيصات للتحقق قبل محاولة جديدة.',
      );

      setOverrides((current) => {
        const existingIndex = current.findIndex((item) => item.permission_code === savedOverride.permission_code);
        if (existingIndex === -1) return [...current, savedOverride];

        return current.map((item) => (
          item.permission_code === savedOverride.permission_code ? savedOverride : item
        ));
      });
      toast.success('تم حفظ تخصيص الصلاحية.');
    } catch (error) {
      reportMutationFailure('Set permission override', error, 'تعذر حفظ تخصيص الصلاحية.');
    } finally {
      if (mounted.current) setSavingOverrideKey(null);
    }
  };

  const retryPermissionsLoad = () => {
    if (permissionTarget) void openPermissionsDialog(permissionTarget);
  };

  const isPermissionsLoading = permissionTarget !== null && loadingPermissionsForUserId === permissionTarget.id;

  return (
    <div className="min-h-screen bg-[#eaf5ff] text-[#1c1b1b]" dir="rtl">
      <div className="relative mx-auto min-h-screen w-full max-w-[453px] overflow-x-hidden bg-[#f0f7ff] shadow-[0_0_40px_rgba(0,72,141,0.08)]">
        <header className="fixed top-0 right-0 left-0 z-30 mx-auto flex h-16 w-full max-w-[453px] items-center justify-between bg-[#0060B8] px-5 text-white shadow-[0_4px_18px_rgba(0,96,184,0.28)]">
          <button type="button" aria-label="العودة إلى المزيد" onClick={() => setLocation('/more')} className="grid h-10 w-10 place-items-center rounded-full transition-transform duration-150 hover:bg-white/10 active:scale-[0.96]">
            <ArrowRight size={22} strokeWidth={2.4} />
          </button>
          <div className="flex items-center gap-2">
            <div className="text-left">
              <p className="text-[11px] leading-4 text-[#dbeaff]">المزيد والإدارة</p>
              <h1 className="text-[19px] font-bold leading-6">إدارة المستخدمين</h1>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><UsersRound size={21} /></span>
          </div>
        </header>

        <main className="px-5 pt-[84px] pb-24">
          <section className="rounded-2xl border border-[#d3e3f0] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-bold">الحسابات والصلاحيات</h2>
                <p className="mt-1 text-xs leading-5 text-[#58616b]">أنشئ حساباً بانتظار التفعيل أو راجع الحسابات المفعّلة.</p>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eaf4ff] text-[#0060B8]"><UserRound size={23} /></span>
            </div>
            <button type="button" onClick={() => setIsCreateDialogOpen(true)} disabled={isInitialLoading || Boolean(readError)} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0060B8] text-sm font-bold text-white shadow-[0_4px_12px_rgba(0,96,184,0.18)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
              <Plus size={19} />
              إنشاء حساب معلّق
            </button>
          </section>

          {isInitialLoading && (
            <section className="mt-6 flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-[#dbe7f2] bg-white text-sm font-bold text-[#0060B8] shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
              <LoaderCircle className="animate-spin" size={20} />
              جارٍ تحميل المستخدمين...
            </section>
          )}

          {!isInitialLoading && readError && (
            <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-center shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
              <p className="text-sm leading-6 text-[#ba1a1a]">{readError}</p>
              <button type="button" onClick={() => void reload()} className="mx-auto mt-3 flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-xs font-bold text-[#ba1a1a] active:scale-[0.98]">
                <RefreshCw size={15} />
                إعادة المحاولة
              </button>
            </section>
          )}

          {!isInitialLoading && !readError && (
            <>
              <section className="mt-6" aria-labelledby="pending-title">
                <div className="mb-3 flex items-center justify-between">
                  <h2 id="pending-title" className="text-base font-bold">الحسابات المعلّقة</h2>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{pendingAccounts.length} في الصفحة {pendingPageNumber}</span>
                </div>

                {pendingAccounts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/60 p-4 text-center text-sm text-amber-800">
                    لا توجد حسابات معلّقة حالياً.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingAccounts.map((account) => {
                      const isCancelling = cancellingPendingId === account.id;
                      const isOpen = !account.activated_at && !account.cancelled_at;

                      return (
                        <article key={account.id} className="rounded-2xl border border-amber-200 bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-[15px] font-bold">{account.full_name?.trim() || account.email}</h3>
                              <p className="mt-1 inline-flex items-center gap-1 text-xs text-[#58616b]" dir="ltr"><Mail size={14} />{account.email}</p>
                              <div className="mt-2"><RoleChip role={account.role} /></div>
                            </div>
                            <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">{formatDate(account.created_at)}</span>
                          </div>

                          {isOpen && (
                            <button type="button" onClick={() => void cancelPending(account.id)} disabled={isCancelling} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-[#ba1a1a] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
                              {isCancelling && <LoaderCircle className="animate-spin" size={16} />}
                              <XCircle size={16} />
                              {isCancelling ? 'جارٍ الإلغاء...' : 'إلغاء الحساب المعلّق'}
                            </button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
                {(hasPreviousPendingPage || hasNextPendingPage) && <nav className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3" aria-label="تنقل الحسابات المعلقة"><button type="button" onClick={() => void previousPendingPage()} disabled={!hasPreviousPendingPage} className="h-10 flex-1 rounded-xl border border-amber-200 bg-white text-xs font-bold text-amber-800 disabled:cursor-not-allowed disabled:opacity-45">السابق</button><span className="text-xs font-bold text-amber-800">صفحة {pendingPageNumber}</span><button type="button" onClick={() => void nextPendingPage()} disabled={!hasNextPendingPage} className="h-10 flex-1 rounded-xl bg-amber-700 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">التالي</button></nav>}
              </section>

              <section className="mt-6" aria-labelledby="active-users-title">
                <div className="mb-3 flex items-center justify-between">
                  <h2 id="active-users-title" className="text-base font-bold">الحسابات المفعّلة</h2>
                  <span className="rounded-full bg-[#dbeeff] px-2.5 py-1 text-xs font-bold text-[#0060B8]">{profiles.length} في الصفحة {profilesPageNumber}</span>
                </div>

                {profiles.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#bfd6eb] bg-white p-4 text-center text-sm text-[#58616b]">
                    لا توجد حسابات مفعّلة حالياً.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {profiles.map((user) => {
                      const captainStatus = user.role === 'captain' ? captainStatusById.get(user.id) : undefined;
                      const isToggling = togglingCaptainId === user.id;
                      const isChangingRole = changingRoleUserId === user.id;
                      const canConfigureOverrides = currentProfile?.role === 'admin' && user.role === 'supervisor';
                      const actionCount = 1 + (user.role === 'captain' ? 1 : 0) + (canConfigureOverrides ? 1 : 0);
                      const actionColumns = `repeat(${actionCount}, minmax(0, 1fr))`;

                      return (
                        <article key={user.id} className="rounded-2xl border border-[#dbe7f2] bg-white p-4 shadow-[0_2px_8px_rgba(0,72,141,0.05)]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#e7edf2] text-sm font-bold text-[#52606d]">{displayName(user).slice(0, 1)}</span>
                              <div>
                                <h3 className="text-[15px] font-bold">{displayName(user)}</h3>
                                <div className="mt-1"><RoleChip role={user.role} /></div>
                              </div>
                            </div>
                            {user.role === 'captain' && (
                              <div className="flex flex-col items-end gap-1">
                                <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${user.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-[#ba1a1a]'}`}>{user.is_active ? 'مفعّل' : 'معطّل'}</span>
                                <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${captainStatus?.availability === 'available' ? 'bg-blue-50 text-[#0060B8]' : 'bg-slate-100 text-slate-600'}`}>{captainStatus?.availability === 'available' ? 'متاح' : 'غير متاح'}</span>
                              </div>
                            )}
                          </div>

                          <p className="mt-3 inline-flex items-center gap-1 text-xs text-[#58616b]" dir="ltr"><Mail size={14} />{user.email}</p>

                          <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: actionColumns }}>
                            <button type="button" onClick={() => openRoleDialog(user)} disabled={isChangingRole} className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#a8c8ff] bg-[#eef6ff] text-xs font-bold text-[#0060B8] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
                              {isChangingRole && <LoaderCircle className="animate-spin" size={15} />}
                              <UserCog size={16} />
                              تغيير الدور
                            </button>

                            {user.role === 'captain' && (
                              <button type="button" onClick={() => void toggleCaptain(user)} disabled={isToggling} className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-[#ba1a1a] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
                                {isToggling && <LoaderCircle className="animate-spin" size={15} />}
                                <Ban size={16} />
                                {isToggling ? 'جارٍ التحديث...' : user.is_active ? 'تعطيل الكابتن' : 'تفعيل الكابتن'}
                              </button>
                            )}

                            {canConfigureOverrides && (
                              <button type="button" onClick={() => void openPermissionsDialog(user)} className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 text-xs font-bold text-violet-700 active:scale-[0.98]">
                                <SlidersHorizontal size={16} />
                                تخصيص الصلاحيات
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
                {(hasPreviousProfilesPage || hasNextProfilesPage) && <nav className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#d3e3f0] bg-white p-3" aria-label="تنقل الحسابات المفعلة"><button type="button" onClick={() => void previousProfilesPage()} disabled={!hasPreviousProfilesPage} className="h-10 flex-1 rounded-xl border border-[#c9d9e7] text-xs font-bold text-[#0060B8] disabled:cursor-not-allowed disabled:opacity-45">السابق</button><span className="text-xs font-bold text-[#58616b]">صفحة {profilesPageNumber}</span><button type="button" onClick={() => void nextProfilesPage()} disabled={!hasNextProfilesPage} className="h-10 flex-1 rounded-xl bg-[#0060B8] text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">التالي</button></nav>}
              </section>
            </>
          )}
        </main>

        <AdminBottomNav active="more" />

        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => (open ? setIsCreateDialogOpen(true) : closeCreateDialog())}>
          <DialogContent showCloseButton className="max-h-[88dvh] max-w-[calc(100%-1.25rem)] gap-0 overflow-y-auto rounded-2xl border-[#cfe1f0] bg-[#f0f7ff] p-0 sm:max-w-[430px]" dir="rtl">
            <DialogHeader className="border-b border-[#dbe7f2] bg-white px-5 pt-5 pb-4 text-right">
              <DialogTitle className="pr-7 text-right text-[19px]">إنشاء حساب معلّق</DialogTitle>
              <DialogDescription className="text-right text-xs">يصبح الحساب جاهزاً ليختار المستخدم كلمة مروره عند أول تفعيل.</DialogDescription>
            </DialogHeader>

            <form onSubmit={(event) => void createPending(event)} className="space-y-3 p-4">
              <section className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5">
                <h3 className="mb-3 text-sm font-bold">البيانات الأساسية</h3>
                <div className="space-y-2.5">
                  <input value={draft.email} onChange={(event) => updateDraft('email', event.target.value)} type="email" placeholder="البريد الإلكتروني" disabled={isCreatingPending} className={fieldClass} required />
                  <input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} placeholder="الاسم الكامل" disabled={isCreatingPending} className={fieldClass} required />
                </div>
              </section>

              <section className="rounded-2xl border border-[#dbe7f2] bg-white p-3.5">
                <h3 className="mb-3 text-sm font-bold">الدور</h3>
                <RoleSelection selectedRole={draft.role} onSelect={(role) => updateDraft('role', role)} disabled={isCreatingPending} />
              </section>

              {draft.role === 'captain' && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
                  <h3 className="text-sm font-bold text-amber-900">الأمانات عند التفعيل</h3>
                  <p className="mt-1 text-[11px] text-amber-800">غرض واحد في كل سطر. هذا الحقل اختياري.</p>
                  <textarea value={draft.custodyItemsText} onChange={(event) => updateDraft('custodyItemsText', event.target.value)} disabled={isCreatingPending} placeholder={'مثال:\nحقيبة حرارية\nهاتف العمل'} className="mt-2 min-h-[102px] w-full resize-none rounded-xl border border-amber-200 bg-white p-3 text-sm text-[#4e3b14] placeholder:text-[#a48751] focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/15 disabled:cursor-not-allowed disabled:opacity-70" />
                </section>
              )}

              <button type="submit" disabled={isCreatingPending} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0060B8] text-sm font-bold text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
                {isCreatingPending && <LoaderCircle className="animate-spin" size={19} />}
                <Plus size={19} />
                {isCreatingPending ? 'جارٍ إنشاء الحساب...' : 'إنشاء حساب معلّق'}
              </button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={roleTarget !== null} onOpenChange={(open) => !open && closeRoleDialog()}>
          <DialogContent showCloseButton className="max-w-[calc(100%-1.25rem)] rounded-2xl border-[#cfe1f0] bg-[#f0f7ff] p-0 sm:max-w-[390px]" dir="rtl">
            <DialogHeader className="border-b border-[#dbe7f2] bg-white px-5 pt-5 pb-4 text-right">
              <DialogTitle className="pr-7 text-right text-[19px]">تغيير الدور</DialogTitle>
              <DialogDescription className="text-right text-xs">اختر دوراً جديداً للمستخدم {roleTarget ? displayName(roleTarget) : ''}. الدور الحالي لا يمكن تأكيده.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 p-4">
              <RoleSelection selectedRole={selectedNewRole} currentRole={roleTarget?.role} onSelect={setSelectedNewRole} disabled={changingRoleUserId !== null} />
              <button type="button" disabled={!selectedNewRole || selectedNewRole === roleTarget?.role || changingRoleUserId !== null} onClick={() => void confirmRoleChange()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0060B8] text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">
                {changingRoleUserId && <LoaderCircle className="animate-spin" size={18} />}
                <UserCog size={18} />
                {changingRoleUserId ? 'جارٍ حفظ الدور...' : 'تأكيد تغيير الدور'}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        <PermissionOverridesDialog
          target={permissionTarget}
          permissions={permissions}
          overrides={overrides}
          choices={overrideChoices}
          isLoading={isPermissionsLoading}
          errorMessage={permissionsError}
          savingOverrideKey={savingOverrideKey}
          onClose={closePermissionsDialog}
          onChoiceChange={(permissionCode, isAllowed) => setOverrideChoices((current) => ({ ...current, [permissionCode]: isAllowed }))}
          onSave={(permission) => void savePermissionOverride(permission)}
          onRetry={retryPermissionsLoad}
        />
      </div>
    </div>
  );
}
