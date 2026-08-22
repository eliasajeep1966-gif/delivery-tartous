import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { RoleWorkspace } from '@/components/layout/RoleWorkspace';
import { NativeUsersPanel } from './NativeUsersPanel';
import { NativeActivityLogsPanel } from './NativeActivityLogsPanel';
import { NativeCustodyPanel } from './NativeCustodyPanel';
import { NativeOrdersPanel } from './NativeOrdersPanel';
import { NativeWagesPanel } from './NativeWagesPanel';
import { NativeCompanyWagesPanel } from './NativeCompanyWagesPanel';
import { NativeReportsPanel } from './NativeReportsPanel';
import { NativeOfficeSettingsPanel } from './NativeOfficeSettingsPanel';
import { NativeInfoPanel } from './NativeInfoPanel';
import { NativeWageOrdersPanel } from './NativeWageOrdersPanel';
import { NativeCaptainDetailPanel } from './NativeCaptainDetailPanel';
import { deliveryColors, deliveryRadius, deliveryShadows, deliverySpacing } from '@/constants/deliveryTheme';
import {
  deliverySupabase,
  type AppRole,
  type PendingAccountActivation,
} from '@/data/supabase/supabaseContract';
import { useAdminOperationsDashboard } from './useAdminOperationsDashboard';

type BackOfficeRole = 'admin' | 'supervisor';
type BackOfficeTab = 'home' | 'orders' | 'captains' | 'salaries' | 'more';

const orderStatusLabels = {
  pending: 'قيد الانتظار',
  assigned: 'تم التعيين',
  received: 'تم الاستلام',
  in_delivery: 'قيد التوصيل',
  completed: 'مكتمل',
  cancelled: 'ملغى',
  false_order: 'طلب كاذب',
} as const;

function formatMoney(value: number) {
  return `${Number(value).toLocaleString('ar-SY')} ل.س`;
}

function displayName(name: string | null, email: string) {
  return name?.trim() || email;
}

export function BackOfficeWorkspace({ role, onSignOut }: { role: BackOfficeRole; onSignOut: () => Promise<void> }) {
  const [activeTab, setActiveTab] = useState<BackOfficeTab>('home');
  const [pendingAccounts, setPendingAccounts] = useState<PendingAccountActivation[]>([]);
  const [isPendingLoading, setIsPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('captain');
  const [custodyText, setCustodyText] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [updatingCaptainId, setUpdatingCaptainId] = useState<string | null>(null);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [assignedCaptainId, setAssignedCaptainId] = useState<string | null>(null);
  const [pickupName, setPickupName] = useState('');
  const [pickupPhone, setPickupPhone] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupNote, setPickupNote] = useState('');
  const [deliveryName, setDeliveryName] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [feeText, setFeeText] = useState('');
  const [isUsersOpen, setIsUsersOpen] = useState(false);
  const [isActivityLogsOpen, setIsActivityLogsOpen] = useState(false);
  const [isCustodyOpen, setIsCustodyOpen] = useState(false);
  const [isCompanyWagesOpen, setIsCompanyWagesOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isOfficeSettingsOpen, setIsOfficeSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isCorrectionsOpen, setIsCorrectionsOpen] = useState(false);
  const [isWageOrdersOpen, setIsWageOrdersOpen] = useState(false);
  const [selectedCaptainId, setSelectedCaptainId] = useState<string | null>(null);

  const {
    availableCaptainIds,
    captainStatuses,
    captains,
    error,
    isLoading,
    metrics,
    orders,
    profiles,
    profitHistory,
    reload,
    wageSummaries,
    wageTotals,
  } = useAdminOperationsDashboard();

  const loadPendingAccounts = useCallback(async () => {
    if (role !== 'admin') return;
    setIsPendingLoading(true);
    setPendingError(null);
    try {
      setPendingAccounts(await deliverySupabase.reads.pendingAccounts());
    } catch (cause) {
      setPendingError(cause instanceof Error ? cause.message : 'تعذر تحميل الحسابات المعلقة.');
    } finally {
      setIsPendingLoading(false);
    }
  }, [role]);

  useEffect(() => {
    if (activeTab === 'more') void loadPendingAccounts();
  }, [activeTab, loadPendingAccounts]);

  const createPendingAccount = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      Alert.alert('بيانات ناقصة', 'أدخل بريداً إلكترونياً صحيحاً.');
      return;
    }
    if (isCreating) return;

    setIsCreating(true);
    try {
      const created = await deliverySupabase.actions.createPendingAccount({
        email: normalizedEmail,
        fullName: fullName.trim() || undefined,
        role: newRole,
        custodyItemsText: newRole === 'captain' ? custodyText.trim() || undefined : undefined,
      });
      setPendingAccounts((current) => [created, ...current.filter((account) => account.id !== created.id)]);
      setEmail('');
      setFullName('');
      setCustodyText('');
      setNewRole('captain');
      Alert.alert('تم الإنشاء', 'أُنشئ الحساب المعلق بنجاح.');
    } catch (cause) {
      Alert.alert('تعذر الإنشاء', cause instanceof Error ? cause.message : 'تعذر إنشاء الحساب المعلق.');
    } finally {
      setIsCreating(false);
    }
  };

  const cancelPendingAccount = (pendingId: string) => {
    Alert.alert('إلغاء الحساب', 'هل تريد إلغاء هذا الحساب المعلق؟', [
      { text: 'لا', style: 'cancel' },
      {
        text: 'نعم، إلغاء',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setCancellingId(pendingId);
            try {
              await deliverySupabase.actions.cancelPendingAccount(pendingId);
              setPendingAccounts((current) => current.filter((account) => account.id !== pendingId));
            } catch (cause) {
              Alert.alert('تعذر الإلغاء', cause instanceof Error ? cause.message : 'تعذر إلغاء الحساب.');
            } finally {
              setCancellingId(null);
            }
          })();
        },
      },
    ]);
  };

  const toggleCaptain = async (captainId: string, currentActive: boolean) => {
    if (role !== 'admin' || updatingCaptainId) return;
    setUpdatingCaptainId(captainId);
    try {
      await deliverySupabase.actions.setCaptainActive(captainId, !currentActive);
      await reload();
    } catch (cause) {
      Alert.alert('تعذر تحديث الكابتن', cause instanceof Error ? cause.message : 'تعذر تحديث حالة الكابتن.');
    } finally {
      setUpdatingCaptainId(null);
    }
  };

  const recentOrders = useMemo(() => orders.slice(0, 6), [orders]);
  const availableCaptains = useMemo(
    () => captains.filter((captain) => captain.is_active && availableCaptainIds.has(captain.id)),
    [availableCaptainIds, captains]
  );

  const resetOrderDraft = () => {
    setAssignedCaptainId(null);
    setPickupName('');
    setPickupPhone('');
    setPickupAddress('');
    setPickupNote('');
    setDeliveryName('');
    setDeliveryPhone('');
    setDeliveryAddress('');
    setFeeText('');
  };

  const openCreateOrder = () => {
    if (role !== 'admin') {
      Alert.alert('صلاحية مطلوبة', 'إنشاء الطلبات متاح للأدمن فقط.');
      return;
    }
    if (availableCaptains.length === 0) {
      Alert.alert('لا يوجد كابتن متاح', 'فعّل كابتناً واجعله متاحاً قبل إنشاء الطلب.');
      return;
    }
    setAssignedCaptainId(availableCaptains[0].id);
    setIsCreateOrderOpen(true);
  };

  const submitCreateOrder = async () => {
    const fee = Number(feeText);
    if (!assignedCaptainId || !pickupName.trim() || !pickupPhone.trim() || !pickupAddress.trim() || !deliveryName.trim() || !deliveryPhone.trim() || !deliveryAddress.trim() || !Number.isFinite(fee) || fee <= 0) {
      Alert.alert('بيانات ناقصة', 'أكمل بيانات المصدر والوجهة والأجرة واختر كابتناً متاحاً.');
      return;
    }
    if (isCreatingOrder) return;

    setIsCreatingOrder(true);
    try {
      const created = await deliverySupabase.actions.createOrderWithStops({
        fee,
        stops: [
          { stopType: 'pickup', sequence: 1, contactName: pickupName.trim(), contactPhone: pickupPhone.trim(), address: pickupAddress.trim(), note: pickupNote.trim() || undefined },
          { stopType: 'delivery', sequence: 1, contactName: deliveryName.trim(), contactPhone: deliveryPhone.trim(), address: deliveryAddress.trim() },
        ],
      });
      await deliverySupabase.actions.assignOrderCaptain(created.id, assignedCaptainId);
      setIsCreateOrderOpen(false);
      resetOrderDraft();
      await reload();
      Alert.alert('تم إنشاء الطلب', `تم إنشاء وتعيين الطلب #${created.order_number}.`);
    } catch (cause) {
      Alert.alert('تعذر إنشاء الطلب', cause instanceof Error ? cause.message : 'تعذر إنشاء وتعيين الطلب.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const renderHome = () => (
    <ScrollView contentContainerStyle={styles.homeScroll} showsVerticalScrollIndicator={false}>
      {error ? <ErrorNotice message={error} /> : null}
      <WelcomeCard role={role} />
      <View style={styles.homeMetrics}>
        <HomeMetric label="طلبات نشطة" value={metrics.activeOrders} tone="light" onPress={() => setActiveTab('orders')} />
        <HomeMetric label="قيد التوصيل" value={metrics.inDelivery} tone="highlight" onPress={() => setActiveTab('orders')} />
        <HomeMetric label="مكتملة اليوم" value={metrics.completedToday} tone="light" onPress={() => setActiveTab('orders')} />
        <HomeMetric label="طلبات كاذبة" value={orders.filter((order) => order.status === 'false_order').length} tone="light" onPress={() => setActiveTab('orders')} />
      </View>
      {role === 'admin' ? <Pressable accessibilityRole="button" onPress={openCreateOrder} style={styles.createOrderButton}><View><Text style={styles.createOrderTitle}>إنشاء طلب جديد</Text><Text style={styles.createOrderSubtitle}>{availableCaptains.length ? 'أضف طلباً وعيّن كابتناً متاحاً' : 'لا يوجد كابتن متاح حالياً'}</Text></View><View style={styles.createOrderIcon}><Text style={styles.createOrderIconText}>+</Text></View></Pressable> : null}
      <View style={styles.sectionHeading}><Text style={styles.homeSectionTitle}>آخر النشاطات</Text><Pressable onPress={() => setActiveTab('orders')}><Text style={styles.showAll}>عرض الطلبات</Text></Pressable></View>
      {recentOrders.length === 0 ? <EmptyNotice text="لا توجد نشاطات إدارية حديثة." /> : null}
      {recentOrders.map((order) => <Pressable key={order.id} onPress={() => setActiveTab('orders')} style={[styles.activityRow, deliveryShadows.sm]}><View style={[styles.activityStrip, { backgroundColor: order.status === 'completed' ? deliveryColors.success : order.status === 'false_order' ? deliveryColors.danger : deliveryColors.primary }]} /><View style={styles.activityBody}><View style={styles.activityHeading}><Text style={styles.activityTitle}>طلب #{order.order_number}</Text><Text style={styles.activityStatus}>{orderStatusLabels[order.status]}</Text></View><Text numberOfLines={1} style={styles.activitySubtitle}>من {order.pickup_address} إلى {order.delivery_address}</Text><Text style={styles.activityTime}>{new Date(order.updated_at).toLocaleDateString('ar-SY')}</Text></View><Text style={styles.activityArrow}>‹</Text></Pressable>)}
      <View style={styles.sectionHeading}><Text style={styles.homeSectionTitle}>الكباتن المتاحون الآن</Text><Pressable onPress={() => setActiveTab('captains')}><Text style={styles.showAll}>عرض الكل</Text></Pressable></View>
      <ScrollView horizontal contentContainerStyle={styles.availableCaptains} showsHorizontalScrollIndicator={false}>{availableCaptains.length ? availableCaptains.map((captain) => <Pressable key={captain.id} onPress={() => setActiveTab('captains')} style={styles.availableCaptain}><View style={styles.avatar}><Text style={styles.avatarText}>{displayName(captain.full_name, captain.email).slice(0, 1)}</Text><View style={styles.onlineDot} /></View><Text numberOfLines={1} style={styles.availableCaptainName}>{displayName(captain.full_name, captain.email)}</Text><Text style={styles.availableCaptainState}>متاح</Text></Pressable>) : <Text style={styles.noCaptain}>لا يوجد كابتن متاح حالياً.</Text>}</ScrollView>
    </ScrollView>
  );

  const renderOrders = () => (
    <NativeOrdersPanel
      availableCaptainIds={availableCaptainIds}
      captains={captains}
      onReload={reload}
      orders={orders}
    />
  );

  const renderCaptains = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <SectionTitle title="الكباتن" />
      {captains.length === 0 ? <EmptyNotice text="لا توجد حسابات كباتن ضمن نطاق حسابك." /> : null}
      {captains.map((captain) => {
        const available = availableCaptainIds.has(captain.id);
        return (
          <Pressable key={captain.id} accessibilityRole="button" onPress={() => setSelectedCaptainId(captain.id)} style={[styles.captainCard, deliveryShadows.sm]}>
            <View style={styles.captainHeader}>
              <View style={[styles.availabilityDot, { backgroundColor: available ? deliveryColors.success : deliveryColors.muted }]} />
              <View style={styles.captainHeadingText}>
                <Text style={styles.captainName}>{displayName(captain.full_name, captain.email)}</Text>
                <Text style={styles.captainMeta}>{available ? 'متاح الآن' : 'غير متاح'} · {captain.is_active ? 'الحساب مفعّل' : 'الحساب معطل'}</Text>
              </View>
            </View>
            {role === 'admin' ? (
              <Pressable
                accessibilityRole="button"
                disabled={updatingCaptainId === captain.id}
                onPress={() => void toggleCaptain(captain.id, captain.is_active)}
                style={[styles.captainAction, updatingCaptainId === captain.id && styles.disabled]}
              >
                <Text style={styles.captainActionText}>{updatingCaptainId === captain.id ? 'جارٍ الحفظ...' : captain.is_active ? 'تعطيل الحساب' : 'تفعيل الحساب'}</Text>
              </Pressable>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const renderSalaries = () => <><NativeWagesPanel onRefreshDashboard={reload} /><Pressable accessibilityRole="button" onPress={() => setIsCompanyWagesOpen(true)} style={styles.companyWagesShortcut}><Text style={styles.companyWagesTitle}>واجهة أجور الشركة</Text><Text style={styles.companyWagesText}>سجل كامل بالتاريخ والأرباح وصافي الشركة</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setIsWageOrdersOpen(true)} style={styles.companyWagesShortcut}><Text style={styles.companyWagesTitle}>كشف طلبات الأجور</Text><Text style={styles.companyWagesText}>ابحث في الطلبات وحصص الكابتن والشركة</Text></Pressable></>;

  const renderMore = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <SectionTitle title="الحسابات وإعدادات التشغيل" />
      <Pressable accessibilityRole="button" onPress={() => setIsUsersOpen(true)} style={styles.usersShortcut}><Text style={styles.usersShortcutTitle}>إدارة المستخدمين</Text><Text style={styles.usersShortcutText}>الأدوار، تفعيل الكباتن، وتخصيص صلاحيات المشرفين</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => setIsActivityLogsOpen(true)} style={styles.usersShortcut}><Text style={styles.usersShortcutTitle}>سجل الحركات</Text><Text style={styles.usersShortcutText}>تابع العمليات المسجلة ومن قام بتنفيذها</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => setIsCustodyOpen(true)} style={styles.usersShortcut}><Text style={styles.usersShortcutTitle}>إدارة الأمانات</Text><Text style={styles.usersShortcutText}>سجّل أمانات الكباتن وتابع إعادتها</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => setIsReportsOpen(true)} style={styles.usersShortcut}><Text style={styles.usersShortcutTitle}>التقارير</Text><Text style={styles.usersShortcutText}>ملخص المكتب الشهري والأجور وحصة الكباتن</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => setIsOfficeSettingsOpen(true)} style={styles.usersShortcut}><Text style={styles.usersShortcutTitle}>إعدادات المكتب</Text><Text style={styles.usersShortcutText}>بيانات المكتب ونسب التوزيع والاستثناءات</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => setIsHelpOpen(true)} style={styles.usersShortcut}><Text style={styles.usersShortcutTitle}>المساعدة والدعم</Text><Text style={styles.usersShortcutText}>إرشادات تشغيلية ودعم المستخدمين</Text></Pressable>
      {role === 'admin' ? <Pressable accessibilityRole="button" onPress={() => setIsCorrectionsOpen(true)} style={styles.usersShortcut}><Text style={styles.usersShortcutTitle}>التصحيحات الإدارية</Text><Text style={styles.usersShortcutText}>إجراءات إدارية قيد التجهيز كما في الويب</Text></Pressable> : null}
      {role === 'admin' ? (
        <View style={[styles.accountForm, deliveryShadows.sm]}>
          <Text style={styles.formTitle}>إنشاء حساب معلق</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="البريد الإلكتروني" autoCapitalize="none" keyboardType="email-address" style={styles.input} textAlign="right" />
          <TextInput value={fullName} onChangeText={setFullName} placeholder="الاسم الكامل (اختياري)" style={styles.input} textAlign="right" />
          <View style={styles.roleChoices}>
            {(['admin', 'supervisor', 'captain'] as AppRole[]).map((candidate) => (
              <Pressable key={candidate} onPress={() => setNewRole(candidate)} style={[styles.roleChoice, newRole === candidate && styles.roleChoiceActive]}>
                <Text style={[styles.roleChoiceText, newRole === candidate && styles.roleChoiceTextActive]}>{candidate === 'admin' ? 'أدمن' : candidate === 'supervisor' ? 'مشرف' : 'كابتن'}</Text>
              </Pressable>
            ))}
          </View>
          {newRole === 'captain' ? <TextInput value={custodyText} onChangeText={setCustodyText} multiline placeholder="الأمانات المستلمة، كل سطر غرض" style={[styles.input, styles.textArea]} textAlign="right" textAlignVertical="top" /> : null}
          <Pressable disabled={isCreating} onPress={() => void createPendingAccount()} style={[styles.primaryButton, isCreating && styles.disabled]}>
            <Text style={styles.primaryButtonText}>{isCreating ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}</Text>
          </Pressable>
        </View>
      ) : <View style={styles.supervisorNotice}><Text style={styles.helperText}>يستطيع المشرف متابعة التشغيل، بينما تبقى إدارة الحسابات لدى الأدمن.</Text></View>}

      {role === 'admin' ? <SectionTitle title="حسابات بانتظار التفعيل" /> : null}
      {role === 'admin' && pendingError ? <ErrorNotice message={pendingError} /> : null}
      {role === 'admin' && isPendingLoading ? <Text style={styles.helperText}>جارٍ تحميل الحسابات...</Text> : null}
      {role === 'admin' && !isPendingLoading && pendingAccounts.length === 0 ? <EmptyNotice text="لا توجد حسابات بانتظار التفعيل." /> : null}
      {role === 'admin' && pendingAccounts.map((account) => (
        <View key={account.id} style={[styles.pendingRow, deliveryShadows.sm]}>
          <Text style={styles.pendingEmail}>{account.email}</Text>
          <Text style={styles.pendingMeta}>{account.full_name || 'دون اسم'} · {account.role === 'admin' ? 'أدمن' : account.role === 'supervisor' ? 'مشرف' : 'كابتن'}</Text>
          {!account.activated_at && !account.cancelled_at ? (
            <Pressable disabled={cancellingId === account.id} onPress={() => cancelPendingAccount(account.id)} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>{cancellingId === account.id ? 'جارٍ الإلغاء...' : 'إلغاء'}</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      <Pressable accessibilityRole="button" onPress={() => void onSignOut()} style={styles.signOutButton}>
        <Text style={styles.signOutText}>تسجيل الخروج</Text>
      </Pressable>
    </ScrollView>
  );

  const content = activeTab === 'home'
    ? renderHome()
    : activeTab === 'orders'
      ? renderOrders()
      : activeTab === 'captains'
        ? renderCaptains()
        : activeTab === 'salaries'
          ? renderSalaries()
          : renderMore();

  return (
    <>
      <RoleWorkspace
        activeTab={activeTab}
        isRefreshing={isLoading}
        onRefresh={() => void reload()}
        onTabPress={(tab) => setActiveTab(tab as BackOfficeTab)}
        role={role}
        subtitle={role === 'admin' ? 'لوحة إدارة العمليات' : 'لوحة متابعة العمليات'}
        title="دليفري طرطوس"
      >
        {content}
      </RoleWorkspace>
      <Modal animationType="slide" visible={isUsersOpen} onRequestClose={() => setIsUsersOpen(false)}>
        <NativeUsersPanel role={role} profiles={profiles} captainStatuses={captainStatuses} onClose={() => setIsUsersOpen(false)} onRefresh={reload} />
      </Modal>
      <Modal animationType="slide" visible={isActivityLogsOpen} onRequestClose={() => setIsActivityLogsOpen(false)}>
        <NativeActivityLogsPanel profiles={profiles} onClose={() => setIsActivityLogsOpen(false)} />
      </Modal>
      <Modal animationType="slide" visible={isCustodyOpen} onRequestClose={() => setIsCustodyOpen(false)}>
        <NativeCustodyPanel captains={captains} onClose={() => setIsCustodyOpen(false)} />
      </Modal>
      <Modal animationType="slide" visible={isCompanyWagesOpen} onRequestClose={() => setIsCompanyWagesOpen(false)}>
        <NativeCompanyWagesPanel onClose={() => setIsCompanyWagesOpen(false)} />
      </Modal>
      <Modal animationType="slide" visible={isReportsOpen} onRequestClose={() => setIsReportsOpen(false)}>
        <NativeReportsPanel onClose={() => setIsReportsOpen(false)} />
      </Modal>
      <Modal animationType="slide" visible={isOfficeSettingsOpen} onRequestClose={() => setIsOfficeSettingsOpen(false)}>
        <NativeOfficeSettingsPanel onClose={() => setIsOfficeSettingsOpen(false)} />
      </Modal>
      <Modal animationType="slide" visible={isHelpOpen} onRequestClose={() => setIsHelpOpen(false)}>
        <NativeInfoPanel title="المساعدة والدعم" subtitle="دليفري طرطوس" onClose={() => setIsHelpOpen(false)} sections={[{ title: 'إنشاء الطلبات', body: 'أنشئ الطلب، أضف محطات المصدر والوجهة، ثم عيّن كابتناً متاحاً.' }, { title: 'متابعة التشغيل', body: 'تابع مراحل الطلب من قائمة الطلبات، ولا تكرر العملية عند ظهور حالة الحفظ.' }, { title: 'الأجور', body: 'تظهر ملخصات الأجور أولاً، وتفاصيل الكابتن أو اليوم تُفتح عند الطلب.' }]} />
      </Modal>
      <Modal animationType="slide" visible={isCorrectionsOpen} onRequestClose={() => setIsCorrectionsOpen(false)}>
        <NativeInfoPanel title="التصحيحات الإدارية" subtitle="إجراءات إدارية" onClose={() => setIsCorrectionsOpen(false)} sections={[{ title: 'حالة الواجهة', body: 'هذه المساحة موجودة في نسخة الويب كإجراءات إدارية قيد التجهيز، ولا تنفذ أي تعديل خلفي غير معتمد.' }, { title: 'مبدأ الأمان', body: 'تظل كل العمليات الحساسة مرتبطة بعقد Supabase والصلاحيات الخلفية.' }]} />
      </Modal>
      <Modal animationType="slide" visible={isWageOrdersOpen} onRequestClose={() => setIsWageOrdersOpen(false)}>
        <NativeWageOrdersPanel captains={captains} onClose={() => setIsWageOrdersOpen(false)} />
      </Modal>
      <Modal animationType="slide" visible={selectedCaptainId !== null} onRequestClose={() => setSelectedCaptainId(null)}>
        {(() => {
          const captain = captains.find((item) => item.id === selectedCaptainId);
          if (!captain) return null;
          return <NativeCaptainDetailPanel captain={captain} status={captainStatuses.find((item) => item.captain_id === captain.id)} orders={orders.filter((order) => order.assigned_captain_id === captain.id)} wage={wageSummaries.find((item) => item.captain_id === captain.id)} canToggle={role === 'admin'} isSaving={updatingCaptainId === captain.id} onToggle={() => toggleCaptain(captain.id, captain.is_active)} onClose={() => setSelectedCaptainId(null)} />;
        })()}
      </Modal>
      <Modal animationType="slide" transparent visible={isCreateOrderOpen} onRequestClose={() => setIsCreateOrderOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>إنشاء طلب وتعيين كابتن</Text>
              <Text style={styles.modalSection}>معلومات الاستلام</Text>
              <TextInput value={pickupName} onChangeText={setPickupName} placeholder="اسم المستلم من المصدر" style={styles.input} textAlign="right" />
              <TextInput value={pickupPhone} onChangeText={setPickupPhone} placeholder="هاتف المصدر" keyboardType="phone-pad" style={styles.input} textAlign="right" />
              <TextInput value={pickupAddress} onChangeText={setPickupAddress} placeholder="عنوان المصدر" style={styles.input} textAlign="right" />
              <TextInput value={pickupNote} onChangeText={setPickupNote} multiline placeholder="تعليمات للكابتن (اختياري)" style={[styles.input, styles.textArea]} textAlign="right" textAlignVertical="top" />
              <Text style={styles.modalSection}>معلومات الوجهة</Text>
              <TextInput value={deliveryName} onChangeText={setDeliveryName} placeholder="اسم المستلم في الوجهة" style={styles.input} textAlign="right" />
              <TextInput value={deliveryPhone} onChangeText={setDeliveryPhone} placeholder="هاتف الوجهة" keyboardType="phone-pad" style={styles.input} textAlign="right" />
              <TextInput value={deliveryAddress} onChangeText={setDeliveryAddress} placeholder="عنوان الوجهة" style={styles.input} textAlign="right" />
              <TextInput value={feeText} onChangeText={setFeeText} placeholder="أجرة التوصيل" keyboardType="decimal-pad" style={styles.input} textAlign="right" />
              <Text style={styles.modalSection}>الكابتن المتاح</Text>
              <View style={styles.captainChoices}>
                {availableCaptains.map((captain) => <Pressable key={captain.id} onPress={() => setAssignedCaptainId(captain.id)} style={[styles.captainChoice, assignedCaptainId === captain.id && styles.captainChoiceActive]}><Text style={[styles.captainChoiceText, assignedCaptainId === captain.id && styles.captainChoiceTextActive]}>{displayName(captain.full_name, captain.email)}</Text></Pressable>)}
              </View>
              <View style={styles.modalActions}>
                <Pressable disabled={isCreatingOrder} onPress={() => setIsCreateOrderOpen(false)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>إلغاء</Text></Pressable>
                <Pressable disabled={isCreatingOrder} onPress={() => void submitCreateOrder()} style={[styles.primaryButton, styles.modalPrimaryButton, isCreatingOrder && styles.disabled]}><Text style={styles.primaryButtonText}>{isCreatingOrder ? 'جارٍ الحفظ...' : 'إنشاء وتعيين'}</Text></Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function WelcomeCard({ role }: { role: BackOfficeRole }) {
  return <View style={[styles.welcomeCard, deliveryShadows.sm]}><Text style={styles.welcomeTitle}>مرحباً، {role === 'admin' ? 'المدير' : 'المشرف'}</Text><Text style={styles.welcomeSubtitle}>هذه نظرة تشغيلية مباشرة على حركة الطلبات والكباتن.</Text></View>;
}

function HomeMetric({ label, value, tone, onPress }: { label: string; value: number; tone: 'light' | 'highlight'; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.homeMetric, tone === 'highlight' && styles.homeMetricHighlight]}><View style={styles.metricTop}><Text style={[styles.metricValue, tone === 'highlight' && styles.metricValueHighlight]}>{value}</Text><Text style={[styles.metricGlyph, tone === 'highlight' && styles.metricGlyphHighlight]}>{tone === 'highlight' ? '◈' : '◌'}</Text></View><Text style={[styles.metricLabel, tone === 'highlight' && styles.metricLabelHighlight]}>{label}</Text></Pressable>;
}

function FinanceMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.financeMetric}><Text style={styles.financeMetricValue}>{value}</Text><Text style={styles.financeMetricLabel}>{label}</Text></View>;
}

function OrderRow({ order, detail = false }: { order: ReturnType<typeof useAdminOperationsDashboard>['orders'][number]; detail?: boolean }) {
  return <View style={[styles.orderCard, deliveryShadows.sm]}><View style={styles.orderHeading}><Text style={styles.orderNumber}>طلب #{order.order_number}</Text><Text style={styles.statusBadge}>{orderStatusLabels[order.status]}</Text></View><Text style={styles.orderAddress} numberOfLines={1}>من: {order.pickup_address}</Text><Text style={styles.orderAddress} numberOfLines={detail ? 2 : 1}>إلى: {order.delivery_address}</Text>{detail ? <Text style={styles.orderFee}>{formatMoney(Number(order.fee))}</Text> : null}</View>;
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function ErrorNotice({ message }: { message: string }) {
  return <View style={styles.errorNotice}><Text style={styles.errorText}>{message}</Text></View>;
}

function EmptyNotice({ text }: { text: string }) {
  return <View style={styles.emptyNotice}><Text style={styles.emptyText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  scrollContent: { gap: deliverySpacing.md, padding: deliverySpacing.lg, paddingBottom: deliverySpacing.xxxl },
  homeScroll: { gap: deliverySpacing.md, padding: 12, paddingBottom: deliverySpacing.xxxl },
  homeMetrics: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  homeMetric: { backgroundColor: deliveryColors.surface, borderColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, flexBasis: '47%', flexGrow: 1, minHeight: 104, padding: 14, shadowColor: '#0060B8', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 5 },
  homeMetricHighlight: { backgroundColor: deliveryColors.primary, borderColor: deliveryColors.primary, shadowOpacity: 0.22, shadowRadius: 9 },
  metricTop: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  metricGlyph: { color: '#1478BF', fontSize: 18 },
  metricGlyphHighlight: { color: '#FFFFFF' },
  metricValueHighlight: { color: '#FFFFFF' },
  metricLabelHighlight: { color: '#FFFFFF' },
  sectionHeading: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 5 },
  homeSectionTitle: { color: '#18547E', fontSize: 13, fontWeight: '800' },
  showAll: { color: '#0877C2', fontSize: 10, fontWeight: '800' },
  activityRow: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, flexDirection: 'row-reverse', minHeight: 86, overflow: 'hidden' },
  activityStrip: { height: '100%', width: 4 },
  activityBody: { flex: 1, gap: 5, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  activityHeading: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  activityTitle: { color: '#154F79', fontSize: 12, fontWeight: '800' },
  activityStatus: { backgroundColor: deliveryColors.primarySoft, borderRadius: 5, color: deliveryColors.primary, fontSize: 9, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2 },
  activitySubtitle: { color: '#38586F', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  activityTime: { color: '#7590A2', fontSize: 9, textAlign: 'right' },
  activityArrow: { alignSelf: 'center', color: '#88A0B0', fontSize: 27, marginLeft: 10 },
  availableCaptains: { gap: 12, paddingVertical: 2 },
  availableCaptain: { alignItems: 'center', maxWidth: 68, minWidth: 58 },
  avatar: { alignItems: 'center', backgroundColor: deliveryColors.surface, borderRadius: 24, height: 46, justifyContent: 'center', shadowColor: '#0060B8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5, width: 46 },
  avatarText: { color: '#477188', fontSize: 16, fontWeight: '800' },
  onlineDot: { backgroundColor: deliveryColors.success, borderColor: '#D9EFF9', borderRadius: 7, borderWidth: 2, bottom: 0, height: 14, position: 'absolute', right: 0, width: 14 },
  availableCaptainName: { color: '#335872', fontSize: 10, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  availableCaptainState: { color: '#55788E', fontSize: 9, marginTop: 1 },
  noCaptain: { color: '#638096', fontSize: 12, paddingVertical: 10 },
  welcomeCard: { backgroundColor: '#EAF4FC', borderRadius: deliveryRadius.lg, padding: deliverySpacing.lg },
  createOrderButton: { alignItems: 'center', backgroundColor: deliveryColors.primary, borderRadius: 12, flexDirection: 'row-reverse', justifyContent: 'space-between', minHeight: 94, padding: 14, shadowColor: '#0060B8', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.23, shadowRadius: 10 },
  createOrderTitle: { color: deliveryColors.surface, fontSize: 17, fontWeight: '800', textAlign: 'right' },
  createOrderSubtitle: { color: '#D7EEFF', fontSize: 11, marginTop: 5, textAlign: 'right' },
  createOrderIcon: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 22, height: 42, justifyContent: 'center', width: 42 },
  createOrderIconText: { color: '#FFFFFF', fontSize: 28, fontWeight: '300', lineHeight: 31 },
  welcomeTitle: { color: deliveryColors.primaryDark, fontSize: 17, fontWeight: '800', textAlign: 'right' },
  welcomeSubtitle: { color: '#4F718A', fontSize: 12, marginTop: 5, textAlign: 'right' },
  metricsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: deliverySpacing.md },
  metric: { alignItems: 'center', backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.lg, flexBasis: '47%', flexGrow: 1, minHeight: 96, justifyContent: 'center', padding: deliverySpacing.md },
  metricValue: { fontSize: 26, fontWeight: '800' },
  metricLabel: { color: deliveryColors.muted, fontSize: 12, marginTop: 5, textAlign: 'center' },
  sectionTitle: { color: deliveryColors.text, fontSize: 17, fontWeight: '800', marginTop: deliverySpacing.sm, textAlign: 'right' },
  helperText: { color: deliveryColors.muted, fontSize: 13, lineHeight: 19, textAlign: 'right' },
  orderCard: { backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.lg, gap: deliverySpacing.sm, padding: deliverySpacing.lg },
  orderHeading: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  orderNumber: { color: deliveryColors.text, fontSize: 15, fontWeight: '800' },
  statusBadge: { backgroundColor: deliveryColors.primarySoft, borderRadius: 999, color: deliveryColors.primary, fontSize: 11, fontWeight: '700', overflow: 'hidden', paddingHorizontal: deliverySpacing.sm, paddingVertical: 4 },
  orderAddress: { color: deliveryColors.muted, fontSize: 13, textAlign: 'right' },
  orderFee: { color: deliveryColors.primary, fontSize: 16, fontWeight: '800', marginTop: deliverySpacing.xs, textAlign: 'right' },
  captainCard: { backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.lg, gap: deliverySpacing.md, padding: deliverySpacing.lg },
  captainHeader: { alignItems: 'center', flexDirection: 'row-reverse', gap: deliverySpacing.md },
  availabilityDot: { borderRadius: 999, height: 12, width: 12 },
  captainHeadingText: { flex: 1 },
  captainName: { color: deliveryColors.text, fontSize: 15, fontWeight: '800', textAlign: 'right' },
  captainMeta: { color: deliveryColors.muted, fontSize: 12, marginTop: 3, textAlign: 'right' },
  captainAction: { alignItems: 'center', backgroundColor: deliveryColors.primarySoft, borderRadius: deliveryRadius.md, justifyContent: 'center', minHeight: 40 },
  captainActionText: { color: deliveryColors.primary, fontSize: 13, fontWeight: '800' },
  financeGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: deliverySpacing.md },
  financeMetric: { backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.lg, flexBasis: '47%', flexGrow: 1, minHeight: 100, justifyContent: 'center', padding: deliverySpacing.md },
  financeMetricValue: { color: deliveryColors.primary, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  financeMetricLabel: { color: deliveryColors.muted, fontSize: 11, marginTop: 7, textAlign: 'center' },
  wageRow: { backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.lg, padding: deliverySpacing.lg },
  wageName: { color: deliveryColors.text, fontSize: 15, fontWeight: '800', textAlign: 'right' },
  wageMeta: { color: deliveryColors.muted, fontSize: 12, marginTop: 4, textAlign: 'right' },
  wageAmount: { color: deliveryColors.primary, fontSize: 15, fontWeight: '800', marginTop: deliverySpacing.sm, textAlign: 'right' },
  companyProfitRow: { backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.lg, padding: deliverySpacing.lg },
  companyProfitDay: { color: deliveryColors.text, fontSize: 14, fontWeight: '800', textAlign: 'right' },
  companyProfitMeta: { color: deliveryColors.muted, fontSize: 12, marginTop: 4, textAlign: 'right' },
  companyProfitAmount: { color: deliveryColors.success, fontSize: 14, fontWeight: '800', marginTop: deliverySpacing.sm, textAlign: 'right' },
  companyWagesShortcut: { backgroundColor: '#F3E8FF', borderColor: '#E9D5FF', borderRadius: deliveryRadius.lg, borderWidth: 1, margin: deliverySpacing.lg, padding: deliverySpacing.lg },
  companyWagesTitle: { color: '#6B21A8', fontSize: 16, fontWeight: '800', textAlign: 'right' },
  companyWagesText: { color: '#7E22CE', fontSize: 12, marginTop: 5, textAlign: 'right' },
  usersShortcut: { backgroundColor: deliveryColors.primarySoft, borderColor: '#CFE4F2', borderRadius: deliveryRadius.lg, borderWidth: 1, padding: deliverySpacing.lg },
  usersShortcutTitle: { color: deliveryColors.primaryDark, fontSize: 16, fontWeight: '800', textAlign: 'right' },
  usersShortcutText: { color: '#4F718A', fontSize: 12, marginTop: 5, textAlign: 'right' },
  accountForm: { backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.lg, gap: deliverySpacing.md, padding: deliverySpacing.lg },
  formTitle: { color: deliveryColors.text, fontSize: 16, fontWeight: '800', textAlign: 'right' },
  input: { backgroundColor: '#F8FAFC', borderColor: '#DCE7F0', borderRadius: deliveryRadius.md, borderWidth: 1, color: deliveryColors.text, fontSize: 14, minHeight: 48, paddingHorizontal: deliverySpacing.md },
  textArea: { minHeight: 96, paddingTop: deliverySpacing.md },
  roleChoices: { flexDirection: 'row-reverse', gap: deliverySpacing.sm },
  roleChoice: { alignItems: 'center', backgroundColor: '#F8FAFC', borderColor: '#DCE7F0', borderRadius: deliveryRadius.md, borderWidth: 1, flex: 1, minHeight: 40, justifyContent: 'center' },
  roleChoiceActive: { backgroundColor: deliveryColors.primary, borderColor: deliveryColors.primary },
  roleChoiceText: { color: deliveryColors.muted, fontSize: 12, fontWeight: '700' },
  roleChoiceTextActive: { color: deliveryColors.surface },
  primaryButton: { alignItems: 'center', backgroundColor: deliveryColors.primary, borderRadius: deliveryRadius.md, justifyContent: 'center', minHeight: 48 },
  primaryButtonText: { color: deliveryColors.surface, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  supervisorNotice: { backgroundColor: deliveryColors.primarySoft, borderRadius: deliveryRadius.md, padding: deliverySpacing.lg },
  pendingRow: { backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.lg, padding: deliverySpacing.lg },
  pendingEmail: { color: deliveryColors.text, fontSize: 14, fontWeight: '800', textAlign: 'right' },
  pendingMeta: { color: deliveryColors.muted, fontSize: 12, marginTop: 4, textAlign: 'right' },
  cancelButton: { alignItems: 'center', backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderRadius: deliveryRadius.sm, borderWidth: 1, justifyContent: 'center', marginTop: deliverySpacing.md, minHeight: 36 },
  cancelButtonText: { color: deliveryColors.danger, fontSize: 12, fontWeight: '800' },
  errorNotice: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderRadius: deliveryRadius.md, borderWidth: 1, padding: deliverySpacing.md },
  errorText: { color: deliveryColors.danger, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  emptyNotice: { alignItems: 'center', backgroundColor: deliveryColors.surface, borderColor: '#DCE7F0', borderRadius: deliveryRadius.lg, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', minHeight: 112, padding: deliverySpacing.lg },
  emptyText: { color: deliveryColors.muted, fontSize: 14, textAlign: 'center' },
  signOutButton: { alignItems: 'center', backgroundColor: deliveryColors.surface, borderColor: '#FECACA', borderRadius: deliveryRadius.md, borderWidth: 1, justifyContent: 'center', marginTop: deliverySpacing.lg, minHeight: 48 },
  signOutText: { color: deliveryColors.danger, fontSize: 15, fontWeight: '800' },
  modalBackdrop: { backgroundColor: 'rgba(15, 35, 54, 0.46)', flex: 1, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: deliveryColors.background, borderTopLeftRadius: deliveryRadius.xl, borderTopRightRadius: deliveryRadius.xl, maxHeight: '92%' },
  modalContent: { gap: deliverySpacing.md, padding: deliverySpacing.xl, paddingBottom: deliverySpacing.xxxl },
  modalTitle: { color: deliveryColors.text, fontSize: 18, fontWeight: '800', textAlign: 'right' },
  modalSection: { color: deliveryColors.primaryDark, fontSize: 14, fontWeight: '800', marginTop: deliverySpacing.sm, textAlign: 'right' },
  captainChoices: { gap: deliverySpacing.sm },
  captainChoice: { backgroundColor: deliveryColors.surface, borderColor: '#DCE7F0', borderRadius: deliveryRadius.md, borderWidth: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: deliverySpacing.md },
  captainChoiceActive: { backgroundColor: deliveryColors.primary, borderColor: deliveryColors.primary },
  captainChoiceText: { color: deliveryColors.text, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  captainChoiceTextActive: { color: deliveryColors.surface },
  modalActions: { flexDirection: 'row-reverse', gap: deliverySpacing.md, marginTop: deliverySpacing.md },
  modalPrimaryButton: { flex: 1 },
  secondaryButton: { alignItems: 'center', backgroundColor: deliveryColors.surface, borderColor: '#CFE0EC', borderRadius: deliveryRadius.md, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48 },
  secondaryButtonText: { color: deliveryColors.primary, fontSize: 15, fontWeight: '800' },
});
