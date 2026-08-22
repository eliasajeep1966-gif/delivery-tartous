import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';

import { AvailabilityCard } from '@/components/captain/AvailabilityCard';
import { CaptainDaySummary } from '@/components/captain/CaptainDaySummary';
import { CurrentOrderCard } from '@/components/captain/CurrentOrderCard';
import { RoleWorkspace } from '@/components/layout/RoleWorkspace';
import { deliveryColors, deliveryRadius, deliveryShadows, deliverySpacing } from '@/constants/deliveryTheme';
import { mapOrderRowToDeliveryOrder } from '@/data/supabase/mappers';
import { ProtectedRoleGate } from '@/features/auth/ProtectedRoleGate';
import { useAuth } from '@/features/auth/useAuth';
import { useCaptainOperationsDashboard } from '@/features/operations/useCaptainOperationsDashboard';
import { NativeInfoPanel } from '@/features/operations/NativeInfoPanel';

type CaptainTab = 'home' | 'my_orders' | 'earnings' | 'more';

const statusLabels = {
  pending: 'قيد الانتظار',
  assigned: 'تم التعيين',
  received: 'تم الاستلام',
  in_delivery: 'قيد التوصيل',
  completed: 'مكتمل',
  cancelled: 'ملغى',
  false_order: 'طلب كاذب',
} as const;

function formatCurrency(value: number) {
  return `${value.toLocaleString('ar-SY')} ل.س`;
}

export default function CaptainScreen() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<CaptainTab>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const {
    availability,
    captainEarnings,
    completedCount,
    custody,
    currentOrder,
    unpaidEarnings,
    wageDetails,
    currentOrderStops,
    error,
    isLoading,
    orders,
    reload,
    transitionOrder,
    updateAvailability,
    updatingAvailability,
    updatingOrderId,
  } = useCaptainOperationsDashboard();

  const mappedCurrentOrder = currentOrder ? mapOrderRowToDeliveryOrder(currentOrder) : null;
  const falseOrdersCount = useMemo(() => orders.filter((order) => order.status === 'false_order').length, [orders]);
  const activeOrders = useMemo(
    () => orders.filter((order) => ['assigned', 'received', 'in_delivery'].includes(order.status)),
    [orders]
  );

  const nextOrderAction = async (nextStatus: 'received' | 'in_delivery' | 'completed') => {
    if (!currentOrder) return;
    const success = await transitionOrder(currentOrder.id, nextStatus);
    if (success && nextStatus === 'completed') {
      Alert.alert('تم التحديث', 'تم تسجيل الطلب كمكتمل.');
    }
  };

  const markFalseOrder = () => {
    if (!currentOrder || !['received', 'in_delivery'].includes(currentOrder.status)) return;
    Alert.alert('تأكيد الطلب الكاذب', 'سيتم إنهاء الطلب وتسجيله كطلب كاذب. هل تريد المتابعة؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تأكيد',
        style: 'destructive',
        onPress: () => {
          void transitionOrder(currentOrder.id, 'false_order');
        },
      },
    ]);
  };

  const showDetails = () => {
    if (!currentOrder) return;
    const pickup = currentOrderStops.filter((stop) => stop.stop_type === 'pickup').map((stop) => stop.address).join('\n') || currentOrder.pickup_address;
    const destination = currentOrderStops.filter((stop) => stop.stop_type === 'delivery').map((stop) => stop.address).join('\n') || currentOrder.delivery_address;
    Alert.alert(`تفاصيل الطلب #${currentOrder.order_number}`, `المصدر:\n${pickup}\n\nالوجهة:\n${destination}`);
  };

  const toggleAvailability = () => {
    void updateAvailability(availability === 'available' ? 'unavailable' : 'available');
  };

  const renderHome = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {error ? <ErrorNotice message={error} /> : null}
      <AvailabilityCard availability={availability} onToggle={toggleAvailability} />
      {updatingAvailability ? <Text style={styles.loadingInline}>جارٍ حفظ حالة التوفر...</Text> : null}

      <SectionTitle title="الطلب الحالي" />
      <CurrentOrderCard
        order={mappedCurrentOrder}
        onReceive={() => void nextOrderAction('received')}
        onStartDelivery={() => void nextOrderAction('in_delivery')}
        onComplete={() => void nextOrderAction('completed')}
        onDetails={showDetails}
      />
      {updatingOrderId ? <Text style={styles.loadingInline}>جارٍ تحديث مرحلة الطلب...</Text> : null}
      {currentOrder && ['received', 'in_delivery'].includes(currentOrder.status) ? (
        <Pressable accessibilityRole="button" onPress={markFalseOrder} style={styles.falseOrderButton}>
          <Text style={styles.falseOrderText}>تسجيل طلب كاذب</Text>
        </Pressable>
      ) : null}

      <SectionTitle title="ملخص عملي" />
      <CaptainDaySummary
        deliveredCount={completedCount}
        earnings={captainEarnings}
        falseOrdersCount={falseOrdersCount}
      />
    </ScrollView>
  );

  const renderOrders = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {error ? <ErrorNotice message={error} /> : null}
      <SectionTitle title="طلباتي" />
      {orders.length === 0 ? <EmptyNotice text="لا توجد طلبات مرتبطة بحسابك حالياً." /> : null}
      {orders.map((order) => (
        <View key={order.id} style={[styles.orderCard, deliveryShadows.sm]}>
          <View style={styles.orderHeading}>
            <Text style={styles.orderNumber}>طلب #{order.order_number}</Text>
            <Text style={[styles.statusBadge, order.status === 'completed' && styles.statusCompleted]}>{statusLabels[order.status]}</Text>
          </View>
          <Text style={styles.orderAddress} numberOfLines={1}>من: {order.pickup_address}</Text>
          <Text style={styles.orderAddress} numberOfLines={1}>إلى: {order.delivery_address}</Text>
          <Text style={styles.orderFee}>{formatCurrency(Number(order.fee))}</Text>
        </View>
      ))}
    </ScrollView>
  );

  const renderEarnings = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <SectionTitle title="أرباحي" />
      <View style={[styles.earningsCard, deliveryShadows.md]}>
        <Text style={styles.earningsLabel}>إجمالي الطلبات المكتملة</Text>
        <Text style={styles.earningsValue}>{completedCount}</Text>
        <View style={styles.earningsDivider} />
        <Text style={styles.earningsLabel}>إجمالي أرباح الكابتن</Text>
        <Text style={styles.earningsAmount}>{formatCurrency(captainEarnings)}</Text>
        <Text style={styles.earningsLabel}>المبلغ غير المدفوع</Text>
        <Text style={styles.earningsAmount}>{formatCurrency(unpaidEarnings)}</Text>
        <Text style={styles.earningsHint}>تعتمد القيم على كشف الأجور الفعلي وليس على رسوم الطلبات الإجمالية.</Text>
      </View>
      <SectionTitle title="سجل الأجور" />
      {wageDetails.length === 0 ? <EmptyNotice text="لا توجد سجلات أجور بعد." /> : null}
      {wageDetails.map((entry) => (
        <View key={entry.financial_ledger_id} style={[styles.wageRow, deliveryShadows.sm]}>
          <Text style={styles.wageOrderNumber}>طلب #{entry.order_number}</Text>
          <Text style={styles.wageMeta}>الأجر: {formatCurrency(Number(entry.captain_amount))} · المدفوع: {formatCurrency(Number(entry.paid_amount))}</Text>
          <Text style={styles.wageUnpaid}>المتبقي: {formatCurrency(Number(entry.unpaid_amount))}</Text>
        </View>
      ))}
    </ScrollView>
  );

  const renderMore = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={[styles.profileCard, deliveryShadows.sm]}>
        <Text style={styles.profileName}>{profile?.full_name || profile?.email || 'الكابتن'}</Text>
        <Text style={styles.profileRole}>كابتن دليفري طرطوس</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={() => setIsSettingsOpen(true)} style={styles.moreLink}><Text style={styles.moreLinkTitle}>إعدادات الحساب</Text><Text style={styles.moreLinkText}>خيارات الحساب وكلمة المرور</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => setIsHelpOpen(true)} style={styles.moreLink}><Text style={styles.moreLinkTitle}>المساعدة والدعم</Text><Text style={styles.moreLinkText}>إرشادات العمل مع الطلبات</Text></Pressable>
      <SectionTitle title="الأمانات المستلمة" />
      {custody.length === 0 ? <EmptyNotice text="لا توجد أمانات مسجلة على حسابك." /> : null}
      {custody.map((item) => (
        <View key={item.id} style={[styles.custodyCard, deliveryShadows.sm]}>
          <Text style={styles.custodyName}>{item.item_name}</Text>
          {item.item_details ? <Text style={styles.custodyDetails}>{item.item_details}</Text> : null}
          <Text style={[styles.custodyState, item.returned_at && styles.custodyReturned]}>{item.returned_at ? 'تمت الإعادة' : 'بحوزتك حالياً'}</Text>
        </View>
      ))}
      <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.signOutButton}>
        <Text style={styles.signOutText}>تسجيل الخروج</Text>
      </Pressable>
    </ScrollView>
  );

  const content = activeTab === 'home'
    ? renderHome()
    : activeTab === 'my_orders'
      ? renderOrders()
      : activeTab === 'earnings'
        ? renderEarnings()
        : renderMore();

  return (
    <ProtectedRoleGate allowedRoles={['captain']}>
      <Stack.Screen options={{ headerShown: false }} />
      <RoleWorkspace
        activeTab={activeTab}
        isRefreshing={isLoading}
        onRefresh={() => void reload()}
        onTabPress={(tab) => setActiveTab(tab as CaptainTab)}
        role="captain"
        subtitle={profile?.full_name || 'لوحة التشغيل الميدانية'}
        title="دليفري طرطوس"
      >
        {content}
      </RoleWorkspace>
      <Modal animationType="slide" visible={isSettingsOpen} onRequestClose={() => setIsSettingsOpen(false)}>
        <NativeInfoPanel title="إعدادات الكابتن" subtitle="الحساب والخصوصية" onClose={() => setIsSettingsOpen(false)} sections={[{ title: 'بيانات الحساب', body: 'واجهة الويب الحالية تعرض إعدادات الحساب كواجهة تحضيرية. لا توجد عملية خلفية معتمدة لتعديل الملف الشخصي أو كلمة المرور ضمن العقد الحالي.' }, { title: 'حالة التوفر', body: 'تُعدّل من الصفحة الرئيسية للكابتن وتُحفظ مباشرة عبر النظام.' }]} />
      </Modal>
      <Modal animationType="slide" visible={isHelpOpen} onRequestClose={() => setIsHelpOpen(false)}>
        <NativeInfoPanel title="مساعدة الكابتن" subtitle="إرشادات التشغيل" onClose={() => setIsHelpOpen(false)} sections={[{ title: 'الطلب الحالي', body: 'استلم الطلب ثم ابدأ التوصيل وأكمل المرحلة عند التسليم. تجنب تكرار النقر أثناء الحفظ.' }, { title: 'الطلب الكاذب', body: 'يتاح بعد الاستلام أو أثناء التوصيل فقط، وينهي الطلب بعد التأكيد.' }, { title: 'الأجور والأمانات', body: 'راجع سجل أجورك والأمانات المسجلة من التبويبات المتاحة في التطبيق.' }]} />
      </Modal>
    </ProtectedRoleGate>
  );
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
  scrollContent: {
    gap: deliverySpacing.md,
    padding: deliverySpacing.lg,
    paddingBottom: deliverySpacing.xxxl,
  },
  sectionTitle: {
    color: deliveryColors.text,
    fontSize: 17,
    fontWeight: '800',
    marginTop: deliverySpacing.sm,
    textAlign: 'right',
  },
  loadingInline: {
    color: deliveryColors.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  falseOrderButton: {
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderRadius: deliveryRadius.md,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  falseOrderText: {
    color: deliveryColors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  errorNotice: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderRadius: deliveryRadius.md,
    borderWidth: 1,
    padding: deliverySpacing.md,
  },
  errorText: {
    color: deliveryColors.danger,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  emptyNotice: {
    alignItems: 'center',
    backgroundColor: deliveryColors.surface,
    borderColor: '#DCE7F0',
    borderRadius: deliveryRadius.lg,
    borderStyle: 'dashed',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 132,
    padding: deliverySpacing.lg,
  },
  emptyText: {
    color: deliveryColors.muted,
    fontSize: 14,
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: deliveryColors.surface,
    borderRadius: deliveryRadius.lg,
    gap: deliverySpacing.sm,
    padding: deliverySpacing.lg,
  },
  orderHeading: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  orderNumber: {
    color: deliveryColors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  statusBadge: {
    backgroundColor: deliveryColors.primarySoft,
    borderRadius: 999,
    color: deliveryColors.primary,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: deliverySpacing.sm,
    paddingVertical: 4,
  },
  statusCompleted: {
    backgroundColor: '#E6F7EC',
    color: deliveryColors.success,
  },
  orderAddress: {
    color: deliveryColors.muted,
    fontSize: 13,
    textAlign: 'right',
  },
  orderFee: {
    color: deliveryColors.primary,
    fontSize: 16,
    fontWeight: '800',
    marginTop: deliverySpacing.xs,
    textAlign: 'right',
  },
  earningsCard: {
    alignItems: 'center',
    backgroundColor: deliveryColors.surface,
    borderRadius: deliveryRadius.xl,
    padding: deliverySpacing.xxl,
  },
  earningsLabel: {
    color: deliveryColors.muted,
    fontSize: 14,
    textAlign: 'center',
  },
  earningsValue: {
    color: deliveryColors.text,
    fontSize: 34,
    fontWeight: '800',
    marginTop: deliverySpacing.sm,
  },
  earningsDivider: {
    backgroundColor: '#E5EDF4',
    height: 1,
    marginVertical: deliverySpacing.xl,
    width: '100%',
  },
  earningsAmount: {
    color: deliveryColors.primary,
    fontSize: 22,
    fontWeight: '800',
    marginTop: deliverySpacing.sm,
  },
  earningsHint: {
    color: deliveryColors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: deliverySpacing.xl,
    textAlign: 'center',
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: deliveryColors.surface,
    borderRadius: deliveryRadius.lg,
    padding: deliverySpacing.xxl,
  },
  profileName: {
    color: deliveryColors.text,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  profileRole: {
    color: deliveryColors.muted,
    fontSize: 13,
    marginTop: deliverySpacing.xs,
  },
  wageRow: { backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.lg, padding: deliverySpacing.lg },
  wageOrderNumber: { color: deliveryColors.text, fontSize: 14, fontWeight: '800', textAlign: 'right' },
  wageMeta: { color: deliveryColors.muted, fontSize: 12, marginTop: deliverySpacing.xs, textAlign: 'right' },
  wageUnpaid: { color: deliveryColors.primary, fontSize: 13, fontWeight: '800', marginTop: deliverySpacing.sm, textAlign: 'right' },
  custodyCard: { backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.lg, padding: deliverySpacing.lg },
  custodyName: { color: deliveryColors.text, fontSize: 15, fontWeight: '800', textAlign: 'right' },
  custodyDetails: { color: deliveryColors.muted, fontSize: 12, marginTop: deliverySpacing.xs, textAlign: 'right' },
  custodyState: { color: deliveryColors.warning, fontSize: 12, fontWeight: '800', marginTop: deliverySpacing.sm, textAlign: 'right' },
  custodyReturned: { color: deliveryColors.success },
  moreLink: { backgroundColor: deliveryColors.surface, borderColor: '#DCE7F0', borderRadius: deliveryRadius.lg, borderWidth: 1, padding: deliverySpacing.lg },
  moreLinkTitle: { color: deliveryColors.text, fontSize: 15, fontWeight: '800', textAlign: 'right' },
  moreLinkText: { color: deliveryColors.muted, fontSize: 12, marginTop: 4, textAlign: 'right' },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: deliveryColors.surface,
    borderColor: '#FECACA',
    borderRadius: deliveryRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  signOutText: {
    color: deliveryColors.danger,
    fontSize: 15,
    fontWeight: '800',
  },
});
