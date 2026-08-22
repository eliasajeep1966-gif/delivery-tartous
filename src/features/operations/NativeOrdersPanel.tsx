import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { deliveryColors, deliveryRadius, deliveryShadows, deliverySpacing } from '@/constants/deliveryTheme';
import { deliverySupabase, type Order, type OrderStatus, type OrderStatusHistory, type OrderStop, type Profile } from '@/data/supabase/supabaseContract';

type OrderFilter = 'all' | 'pending' | 'assigned' | 'received' | 'in_delivery' | 'completed' | 'cancelled' | 'false_order';

type NativeOrdersPanelProps = {
  orders: Order[];
  captains: Profile[];
  availableCaptainIds: Set<string>;
  onReload: () => Promise<void>;
};

const labels: Record<OrderStatus, string> = {
  pending: 'قيد الانتظار',
  assigned: 'تم التعيين',
  received: 'تم الاستلام',
  in_delivery: 'قيد التوصيل',
  completed: 'مكتمل',
  cancelled: 'ملغى',
  false_order: 'طلب كاذب',
};

function captainName(profile: Profile | undefined) {
  return profile?.full_name?.trim() || profile?.email || 'كابتن غير معروف';
}

export function NativeOrdersPanel({ orders, captains, availableCaptainIds, onReload }: NativeOrdersPanelProps) {
  const [filter, setFilter] = useState<OrderFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [stops, setStops] = useState<OrderStop[]>([]);
  const [history, setHistory] = useState<OrderStatusHistory[]>([]);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [chosenCaptainId, setChosenCaptainId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const visibleOrders = useMemo(() => orders.filter((order) => {
    const normalized = query.trim().toLowerCase();
    const matchesFilter = filter === 'all' || order.status === filter;
    const searchable = `${order.order_number} ${order.customer_name} ${order.customer_phone} ${order.pickup_address} ${order.delivery_address}`.toLowerCase();
    return matchesFilter && (!normalized || searchable.includes(normalized));
  }), [filter, orders, query]);
  const assignableCaptains = useMemo(() => captains.filter((captain) => captain.is_active && availableCaptainIds.has(captain.id)), [availableCaptainIds, captains]);

  useEffect(() => {
    if (!selectedOrder) return;
    let active = true;
    setIsDetailsLoading(true);
    setDetailsError(null);
    void Promise.all([
      deliverySupabase.reads.orderStops(selectedOrder.id),
      deliverySupabase.reads.orderStatusHistory(selectedOrder.id),
    ]).then(([nextStops, nextHistory]) => {
      if (!active) return;
      setStops(nextStops);
      setHistory(nextHistory);
    }).catch((cause) => {
      if (active) setDetailsError(cause instanceof Error ? cause.message : 'تعذر تحميل تفاصيل الطلب.');
    }).finally(() => { if (active) setIsDetailsLoading(false); });
    return () => { active = false; };
  }, [selectedOrder?.id]);

  const assignCaptain = async () => {
    if (!selectedOrder || !chosenCaptainId || isSaving) return;
    setIsSaving(true);
    try {
      const updated = await deliverySupabase.actions.assignOrderCaptain(selectedOrder.id, chosenCaptainId);
      setSelectedOrder(updated);
      setIsAssignOpen(false);
      await onReload();
    } catch (cause) {
      Alert.alert('تعذر تعيين الكابتن', cause instanceof Error ? cause.message : 'تعذر تعيين الكابتن.');
    } finally {
      setIsSaving(false);
    }
  };

  const cancelOrder = async () => {
    if (!selectedOrder || !cancelReason.trim() || isSaving) {
      if (!cancelReason.trim()) Alert.alert('سبب مطلوب', 'أدخل سبب إلغاء الطلب.');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await deliverySupabase.actions.cancelOrder(selectedOrder.id, cancelReason.trim());
      setSelectedOrder(updated);
      setIsCancelOpen(false);
      setCancelReason('');
      await onReload();
    } catch (cause) {
      Alert.alert('تعذر إلغاء الطلب', cause instanceof Error ? cause.message : 'تعذر إلغاء الطلب.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.introCard, deliveryShadows.sm]}><View style={styles.introHeading}><View><Text style={styles.introTitle}>قائمة الطلبات</Text><Text style={styles.introText}>ابحث، صفِّ الحالات، ثم اعرض التفاصيل التشغيلية.</Text></View><View style={styles.introIcon}><Text style={styles.introIconText}>□</Text></View></View><View style={styles.searchShell}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="ابحث برقم الطلب أو العميل أو العنوان" placeholderTextColor="#8A98A6" style={styles.searchInput} textAlign="right" /></View></View>
        <ScrollView horizontal contentContainerStyle={styles.filterRow} showsHorizontalScrollIndicator={false}>{([['all', 'الكل'], ['pending', 'قيد الانتظار'], ['assigned', 'تم التعيين'], ['received', 'تم الاستلام'], ['in_delivery', 'قيد التوصيل'], ['completed', 'مكتملة'], ['cancelled', 'ملغاة'], ['false_order', 'طلب كاذب']] as const).map(([key, label]) => <Pressable key={key} onPress={() => setFilter(key)} style={[styles.filterButton, filter === key && styles.filterActive]}><Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{label}</Text></Pressable>)}</ScrollView>
        <View style={styles.listHeading}><Text style={styles.listTitle}>الطلبات المعروضة</Text><Text style={styles.count}>{visibleOrders.length} طلبات</Text></View>
        {visibleOrders.length === 0 ? <View style={styles.empty}><Text style={styles.emptyIcon}>□</Text><Text style={styles.emptyText}>لا توجد طلبات مطابقة</Text><Text style={styles.emptyHint}>جرّب تغيير البحث أو الحالة.</Text></View> : null}
        {visibleOrders.map((order) => <Pressable key={order.id} accessibilityRole="button" onPress={() => setSelectedOrder(order)} style={[styles.orderCard, deliveryShadows.sm]}><View style={[styles.orderStrip, { backgroundColor: order.status === 'completed' ? deliveryColors.success : order.status === 'false_order' || order.status === 'cancelled' ? deliveryColors.danger : deliveryColors.primary }]} /><View style={styles.orderBody}><View style={styles.orderHeading}><Text style={styles.orderNumber}>#{order.order_number}</Text><Text style={styles.status}>{labels[order.status]}</Text></View><View style={styles.customerRow}><Text style={styles.customer}>{order.customer_name}</Text><Text style={styles.fee}>{Number(order.fee).toLocaleString('ar-SY')} ل.س</Text></View><Text style={styles.address} numberOfLines={1}>⌖ {order.pickup_address} ← {order.delivery_address}</Text><Text style={styles.orderTime}>{new Date(order.created_at).toLocaleDateString('ar-SY')}</Text></View><Text style={styles.arrow}>‹</Text></Pressable>)}
      </ScrollView>

      <Modal animationType="slide" visible={selectedOrder !== null} onRequestClose={() => setSelectedOrder(null)}><View style={styles.detailRoot}><View style={styles.detailHeader}><Pressable onPress={() => setSelectedOrder(null)} style={styles.backButton}><Text style={styles.backText}>رجوع</Text></Pressable><View><Text style={styles.detailTitle}>تفاصيل الطلب</Text><Text style={styles.detailSubtitle}>طلب #{selectedOrder?.order_number}</Text></View></View><ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>{isDetailsLoading ? <Text style={styles.loading}>جارٍ تحميل التفاصيل...</Text> : null}{detailsError ? <Text style={styles.error}>{detailsError}</Text> : null}{selectedOrder ? <><View style={styles.detailCard}><Text style={styles.detailLabel}>الحالة</Text><Text style={styles.detailValue}>{labels[selectedOrder.status]}</Text><Text style={styles.detailLabel}>الأجرة</Text><Text style={styles.detailValue}>{Number(selectedOrder.fee).toLocaleString('ar-SY')} ل.س</Text></View><Text style={styles.sectionTitle}>المحطات</Text>{stops.length === 0 ? <View style={styles.detailCard}><Text style={styles.detailValue}>المصدر: {selectedOrder.pickup_address}</Text><Text style={styles.detailValue}>الوجهة: {selectedOrder.delivery_address}</Text></View> : null}{stops.map((stop) => <View key={stop.id} style={styles.stopCard}><Text style={styles.stopType}>{stop.stop_type === 'pickup' ? 'مصدر الاستلام' : 'وجهة التوصيل'}</Text><Text style={styles.stopName}>{stop.contact_name}</Text><Text style={styles.stopInfo}>{stop.contact_phone} · {stop.address}</Text>{stop.note ? <Text style={styles.stopNote}>تعليمات: {stop.note}</Text> : null}</View>)}<View style={styles.actionRow}>{!['completed', 'cancelled', 'false_order'].includes(selectedOrder.status) ? <Pressable onPress={() => { setChosenCaptainId(null); setIsAssignOpen(true); }} style={styles.assignButton}><Text style={styles.assignText}>تعيين كابتن</Text></Pressable> : null}{!['completed', 'cancelled', 'false_order'].includes(selectedOrder.status) ? <Pressable onPress={() => { setCancelReason(''); setIsCancelOpen(true); }} style={styles.cancelButton}><Text style={styles.cancelText}>إلغاء الطلب</Text></Pressable> : null}</View><Text style={styles.sectionTitle}>سجل الحالة</Text>{history.length === 0 ? <Text style={styles.hint}>لا توجد حركات حالة إضافية.</Text> : null}{history.map((entry) => <View key={entry.id} style={styles.historyRow}><Text style={styles.historyStatus}>{labels[entry.next_status]}</Text><Text style={styles.historyTime}>{new Date(entry.changed_at).toLocaleString('ar-SY')}</Text></View>)}</> : null}</ScrollView></View></Modal>
      <Modal animationType="slide" transparent visible={isAssignOpen} onRequestClose={() => setIsAssignOpen(false)}><View style={styles.backdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>تعيين كابتن متاح</Text><ScrollView contentContainerStyle={styles.captainChoices}>{assignableCaptains.map((captain) => <Pressable key={captain.id} onPress={() => setChosenCaptainId(captain.id)} style={[styles.captainChoice, chosenCaptainId === captain.id && styles.captainChoiceActive]}><Text style={[styles.captainChoiceText, chosenCaptainId === captain.id && styles.captainChoiceTextActive]}>{captainName(captain)}</Text></Pressable>)}{assignableCaptains.length === 0 ? <Text style={styles.hint}>لا يوجد كابتن متاح الآن.</Text> : null}</ScrollView><View style={styles.modalActions}><Pressable onPress={() => setIsAssignOpen(false)} style={styles.secondary}><Text style={styles.secondaryText}>إلغاء</Text></Pressable><Pressable disabled={!chosenCaptainId || isSaving} onPress={() => void assignCaptain()} style={[styles.primary, (!chosenCaptainId || isSaving) && styles.disabled]}><Text style={styles.primaryText}>{isSaving ? 'جارٍ الحفظ...' : 'تأكيد التعيين'}</Text></Pressable></View></View></View></Modal>
      <Modal animationType="slide" transparent visible={isCancelOpen} onRequestClose={() => setIsCancelOpen(false)}><View style={styles.backdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>إلغاء الطلب</Text><TextInput value={cancelReason} onChangeText={setCancelReason} multiline placeholder="سبب الإلغاء" style={styles.input} textAlign="right" textAlignVertical="top" /><View style={styles.modalActions}><Pressable onPress={() => setIsCancelOpen(false)} style={styles.secondary}><Text style={styles.secondaryText}>إلغاء</Text></Pressable><Pressable disabled={isSaving} onPress={() => void cancelOrder()} style={[styles.dangerPrimary, isSaving && styles.disabled]}><Text style={styles.primaryText}>{isSaving ? 'جارٍ الحفظ...' : 'تأكيد الإلغاء'}</Text></Pressable></View></View></View></Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  filterRow: { flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 2 },
  filterButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#D4E2EC', borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: 32, paddingHorizontal: 12 },
  filterActive: { backgroundColor: deliveryColors.primary, borderColor: deliveryColors.primary },
  filterText: { color: deliveryColors.muted, fontSize: 10, fontWeight: '800' },
  filterTextActive: { color: deliveryColors.surface },
  scrollContent: { gap: deliverySpacing.md, padding: deliverySpacing.lg, paddingBottom: deliverySpacing.xxxl },
  introCard: { backgroundColor: '#FFFFFF', borderColor: '#D3E3F0', borderRadius: 16, borderWidth: 1, padding: 14 },
  introHeading: { alignItems: 'flex-start', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  introTitle: { color: '#1C1B1B', fontSize: 18, fontWeight: '800', textAlign: 'right' },
  introText: { color: '#58616B', fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: 'right' },
  introIcon: { alignItems: 'center', backgroundColor: '#EAF4FF', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  introIconText: { color: '#0060B8', fontSize: 22, fontWeight: '800' },
  searchShell: { alignItems: 'center', backgroundColor: '#FBFDFF', borderColor: '#C9D9E7', borderRadius: 12, borderWidth: 1, flexDirection: 'row-reverse', height: 44, marginTop: 14 },
  searchIcon: { color: '#75818E', fontSize: 22, paddingHorizontal: 10 },
  searchInput: { color: '#1C2934', flex: 1, fontSize: 13, height: '100%', paddingLeft: 10 },
  listHeading: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 3 },
  listTitle: { color: '#1C1B1B', fontSize: 16, fontWeight: '800' },
  count: { backgroundColor: '#DBEEFF', borderRadius: 99, color: '#0060B8', fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5 },
  empty: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.72)', borderColor: '#C7DAE8', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', minHeight: 150, padding: deliverySpacing.lg },
  emptyIcon: { color: '#7D9AB0', fontSize: 28 },
  emptyText: { color: '#4F5D6B', fontSize: 14, fontWeight: '800', marginTop: 6, textAlign: 'center' },
  emptyHint: { color: '#75818E', fontSize: 11, marginTop: 4, textAlign: 'center' },
  orderCard: { backgroundColor: '#FFFFFF', borderColor: '#E0E8EE', borderRadius: 16, borderWidth: 1, flexDirection: 'row-reverse', overflow: 'hidden' },
  orderStrip: { height: '100%', width: 5 },
  orderBody: { flex: 1, gap: 6, padding: 14 },
  orderHeading: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  orderNumber: { color: '#1C1B1B', fontSize: 16, fontWeight: '800' },
  status: { backgroundColor: '#EAF4FF', borderRadius: 5, color: '#0060B8', fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 },
  customerRow: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  customer: { color: '#1C1B1B', fontSize: 14, textAlign: 'right' },
  address: { color: '#414752', fontSize: 12, textAlign: 'right' },
  fee: { color: '#1C1B1B', fontSize: 15, fontWeight: '800', textAlign: 'left' },
  orderTime: { color: '#75818E', fontSize: 10, textAlign: 'right' },
  arrow: { alignSelf: 'center', color: '#75818E', fontSize: 25, marginLeft: 10 },
  detailRoot: { flex: 1, backgroundColor: deliveryColors.background },
  detailHeader: { alignItems: 'center', backgroundColor: deliveryColors.primary, flexDirection: 'row-reverse', justifyContent: 'space-between', minHeight: 74, paddingHorizontal: deliverySpacing.lg },
  detailTitle: { color: deliveryColors.surface, fontSize: 18, fontWeight: '800', textAlign: 'right' },
  detailSubtitle: { color: '#D7EEFF', fontSize: 11, marginTop: 3, textAlign: 'right' },
  backButton: { borderColor: '#FFFFFF66', borderRadius: deliveryRadius.md, borderWidth: 1, paddingHorizontal: deliverySpacing.md, paddingVertical: deliverySpacing.sm },
  backText: { color: deliveryColors.surface, fontSize: 13, fontWeight: '800' },
  detailContent: { gap: deliverySpacing.md, padding: deliverySpacing.lg, paddingBottom: deliverySpacing.xxxl },
  loading: { color: deliveryColors.primary, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  error: { color: deliveryColors.danger, fontSize: 13, textAlign: 'right' },
  detailCard: { backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.lg, gap: deliverySpacing.sm, padding: deliverySpacing.lg },
  detailLabel: { color: deliveryColors.muted, fontSize: 12, textAlign: 'right' },
  detailValue: { color: deliveryColors.text, fontSize: 14, fontWeight: '800', textAlign: 'right' },
  sectionTitle: { color: deliveryColors.text, fontSize: 16, fontWeight: '800', marginTop: deliverySpacing.sm, textAlign: 'right' },
  stopCard: { backgroundColor: deliveryColors.surface, borderColor: '#DCE7F0', borderRadius: deliveryRadius.lg, borderWidth: 1, padding: deliverySpacing.lg },
  stopType: { color: deliveryColors.primary, fontSize: 11, fontWeight: '800', textAlign: 'right' },
  stopName: { color: deliveryColors.text, fontSize: 15, fontWeight: '800', marginTop: 5, textAlign: 'right' },
  stopInfo: { color: deliveryColors.muted, fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: 'right' },
  stopNote: { color: deliveryColors.warning, fontSize: 12, lineHeight: 18, marginTop: deliverySpacing.sm, textAlign: 'right' },
  actionRow: { flexDirection: 'row-reverse', gap: deliverySpacing.md },
  assignButton: { alignItems: 'center', backgroundColor: deliveryColors.primary, borderRadius: deliveryRadius.md, flex: 1, justifyContent: 'center', minHeight: 44 },
  assignText: { color: deliveryColors.surface, fontSize: 13, fontWeight: '800' },
  cancelButton: { alignItems: 'center', backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderRadius: deliveryRadius.md, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 44 },
  cancelText: { color: deliveryColors.danger, fontSize: 13, fontWeight: '800' },
  historyRow: { alignItems: 'center', backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.md, flexDirection: 'row-reverse', justifyContent: 'space-between', padding: deliverySpacing.md },
  historyStatus: { color: deliveryColors.text, fontSize: 13, fontWeight: '800' },
  historyTime: { color: deliveryColors.muted, fontSize: 10 },
  hint: { color: deliveryColors.muted, fontSize: 13, textAlign: 'right' },
  backdrop: { backgroundColor: 'rgba(15, 35, 54, 0.46)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: deliveryColors.surface, borderTopLeftRadius: deliveryRadius.xl, borderTopRightRadius: deliveryRadius.xl, gap: deliverySpacing.md, maxHeight: '82%', padding: deliverySpacing.xl },
  sheetTitle: { color: deliveryColors.text, fontSize: 18, fontWeight: '800', textAlign: 'right' },
  captainChoices: { gap: deliverySpacing.sm, paddingBottom: deliverySpacing.md },
  captainChoice: { backgroundColor: deliveryColors.background, borderColor: '#DCE7F0', borderRadius: deliveryRadius.md, borderWidth: 1, minHeight: 42, justifyContent: 'center', paddingHorizontal: deliverySpacing.md },
  captainChoiceActive: { backgroundColor: deliveryColors.primary, borderColor: deliveryColors.primary },
  captainChoiceText: { color: deliveryColors.text, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  captainChoiceTextActive: { color: deliveryColors.surface },
  modalActions: { flexDirection: 'row-reverse', gap: deliverySpacing.md },
  primary: { alignItems: 'center', backgroundColor: deliveryColors.primary, borderRadius: deliveryRadius.md, flex: 1, justifyContent: 'center', minHeight: 46 },
  dangerPrimary: { alignItems: 'center', backgroundColor: deliveryColors.danger, borderRadius: deliveryRadius.md, flex: 1, justifyContent: 'center', minHeight: 46 },
  primaryText: { color: deliveryColors.surface, fontSize: 14, fontWeight: '800' },
  secondary: { alignItems: 'center', backgroundColor: deliveryColors.surface, borderColor: '#CFE0EC', borderRadius: deliveryRadius.md, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 46 },
  secondaryText: { color: deliveryColors.primary, fontSize: 14, fontWeight: '800' },
  input: { backgroundColor: '#F8FAFC', borderColor: '#DCE7F0', borderRadius: deliveryRadius.md, borderWidth: 1, minHeight: 100, padding: deliverySpacing.md },
  disabled: { opacity: 0.5 },
});
