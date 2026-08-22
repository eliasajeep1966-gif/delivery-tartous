import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { deliveryColors, deliveryRadius, deliveryShadows, deliverySpacing } from '@/constants/deliveryTheme';
import { deliverySupabase, type CaptainCustody, type Profile } from '@/data/supabase/supabaseContract';

type NativeCustodyPanelProps = {
  captains: Profile[];
  onClose: () => void;
};

function captainName(captain: Profile | undefined) {
  return captain?.full_name?.trim() || captain?.email || 'كابتن غير معروف';
}

export function NativeCustodyPanel({ captains, onClose }: NativeCustodyPanelProps) {
  const [items, setItems] = useState<CaptainCustody[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemDetails, setItemDetails] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [returnTarget, setReturnTarget] = useState<CaptainCustody | null>(null);
  const [returnNotes, setReturnNotes] = useState('');

  const captainsById = useMemo(() => new Map(captains.map((captain) => [captain.id, captain])), [captains]);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setItems(await deliverySupabase.reads.captainCustodies());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل الأمانات.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const openAssign = () => {
    if (captains.length === 0) {
      Alert.alert('لا يوجد كابتن', 'لا يمكن تسجيل أمانة قبل وجود حساب كابتن.');
      return;
    }
    setCaptainId(captains[0].id);
    setItemName('');
    setItemDetails('');
    setIsAssignOpen(true);
  };

  const assignCustody = async () => {
    if (!captainId || !itemName.trim() || isSaving) {
      if (!itemName.trim()) Alert.alert('بيانات ناقصة', 'أدخل اسم الأمانة.');
      return;
    }
    setIsSaving(true);
    try {
      await deliverySupabase.actions.assignCaptainCustody(captainId, itemName.trim(), itemDetails.trim() || undefined);
      setIsAssignOpen(false);
      await reload();
    } catch (cause) {
      Alert.alert('تعذر تسجيل الأمانة', cause instanceof Error ? cause.message : 'تعذر تسجيل الأمانة.');
    } finally {
      setIsSaving(false);
    }
  };

  const returnCustody = async () => {
    if (!returnTarget || isSaving) return;
    setIsSaving(true);
    try {
      await deliverySupabase.actions.returnCaptainCustody(returnTarget.id, returnNotes.trim() || undefined);
      setReturnTarget(null);
      setReturnNotes('');
      await reload();
    } catch (cause) {
      Alert.alert('تعذر تسجيل الإعادة', cause instanceof Error ? cause.message : 'تعذر تسجيل إعادة الأمانة.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}><Pressable accessibilityRole="button" onPress={onClose} style={styles.backButton}><Text style={styles.backButtonText}>رجوع</Text></Pressable><View><Text style={styles.headerTitle}>إدارة الأمانات</Text><Text style={styles.headerSubtitle}>استلام وتسليم أمانات الكباتن</Text></View></View>
      <View style={styles.topActions}><Pressable accessibilityRole="button" onPress={openAssign} style={styles.addButton}><Text style={styles.addButtonText}>إضافة أمانة</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void reload()} style={styles.refreshButton}><Text style={styles.refreshButtonText}>تحديث</Text></Pressable></View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoading ? <Text style={styles.status}>جارٍ تحميل الأمانات...</Text> : null}
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        {!isLoading && !error && items.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>لا توجد أمانات مسجلة.</Text></View> : null}
        {items.map((item) => <View key={item.id} style={[styles.itemCard, deliveryShadows.sm]}><Text style={styles.itemName}>{item.item_name}</Text><Text style={styles.captainName}>{captainName(captainsById.get(item.captain_id))}</Text>{item.item_details ? <Text style={styles.itemDetails}>{item.item_details}</Text> : null}<Text style={[styles.state, item.returned_at && styles.returned]}>{item.returned_at ? `تمت الإعادة في ${new Date(item.returned_at).toLocaleDateString('ar-SY')}` : 'بحوزة الكابتن حالياً'}</Text>{!item.returned_at ? <Pressable onPress={() => { setReturnTarget(item); setReturnNotes(''); }} style={styles.returnButton}><Text style={styles.returnButtonText}>تسجيل الإعادة</Text></Pressable> : null}</View>)}
      </ScrollView>

      <Modal animationType="slide" transparent visible={isAssignOpen} onRequestClose={() => setIsAssignOpen(false)}><View style={styles.backdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>تسجيل أمانة جديدة</Text><TextInput value={itemName} onChangeText={setItemName} placeholder="اسم الأمانة" style={styles.input} textAlign="right" /><TextInput value={itemDetails} onChangeText={setItemDetails} multiline placeholder="تفاصيل إضافية (اختياري)" style={[styles.input, styles.textArea]} textAlign="right" textAlignVertical="top" /><Text style={styles.label}>اختر الكابتن</Text><ScrollView horizontal contentContainerStyle={styles.captainChoices}>{captains.map((captain) => <Pressable key={captain.id} onPress={() => setCaptainId(captain.id)} style={[styles.captainChoice, captainId === captain.id && styles.captainChoiceActive]}><Text style={[styles.captainChoiceText, captainId === captain.id && styles.captainChoiceTextActive]}>{captainName(captain)}</Text></Pressable>)}</ScrollView><View style={styles.modalActions}><Pressable onPress={() => setIsAssignOpen(false)} style={styles.secondary}><Text style={styles.secondaryText}>إلغاء</Text></Pressable><Pressable disabled={isSaving} onPress={() => void assignCustody()} style={[styles.primary, isSaving && styles.disabled]}><Text style={styles.primaryText}>{isSaving ? 'جارٍ الحفظ...' : 'تسجيل الأمانة'}</Text></Pressable></View></View></View></Modal>
      <Modal animationType="slide" transparent visible={returnTarget !== null} onRequestClose={() => setReturnTarget(null)}><View style={styles.backdrop}><View style={styles.sheet}><Text style={styles.sheetTitle}>تسجيل إعادة الأمانة</Text><Text style={styles.sheetDescription}>{returnTarget?.item_name}</Text><TextInput value={returnNotes} onChangeText={setReturnNotes} multiline placeholder="ملاحظات الإعادة (اختياري)" style={[styles.input, styles.textArea]} textAlign="right" textAlignVertical="top" /><View style={styles.modalActions}><Pressable onPress={() => setReturnTarget(null)} style={styles.secondary}><Text style={styles.secondaryText}>إلغاء</Text></Pressable><Pressable disabled={isSaving} onPress={() => void returnCustody()} style={[styles.primary, isSaving && styles.disabled]}><Text style={styles.primaryText}>{isSaving ? 'جارٍ الحفظ...' : 'تأكيد الإعادة'}</Text></Pressable></View></View></View></Modal>
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
  topActions: { backgroundColor: deliveryColors.surface, flexDirection: 'row-reverse', gap: deliverySpacing.md, padding: deliverySpacing.md },
  addButton: { alignItems: 'center', backgroundColor: deliveryColors.primary, borderRadius: deliveryRadius.md, flex: 1, justifyContent: 'center', minHeight: 44 },
  addButtonText: { color: deliveryColors.surface, fontSize: 14, fontWeight: '800' },
  refreshButton: { alignItems: 'center', borderColor: '#CFE0EC', borderRadius: deliveryRadius.md, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: deliverySpacing.lg },
  refreshButtonText: { color: deliveryColors.primary, fontSize: 13, fontWeight: '800' },
  scrollContent: { gap: deliverySpacing.md, padding: deliverySpacing.lg, paddingBottom: deliverySpacing.xxxl },
  status: { color: deliveryColors.primary, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderRadius: deliveryRadius.md, borderWidth: 1, padding: deliverySpacing.md },
  errorText: { color: deliveryColors.danger, fontSize: 13, textAlign: 'right' },
  empty: { alignItems: 'center', backgroundColor: deliveryColors.surface, borderColor: '#DCE7F0', borderRadius: deliveryRadius.lg, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', minHeight: 120, padding: deliverySpacing.lg },
  emptyText: { color: deliveryColors.muted, fontSize: 14, textAlign: 'center' },
  itemCard: { backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.lg, padding: deliverySpacing.lg },
  itemName: { color: deliveryColors.text, fontSize: 16, fontWeight: '800', textAlign: 'right' },
  captainName: { color: deliveryColors.primary, fontSize: 13, fontWeight: '800', marginTop: 5, textAlign: 'right' },
  itemDetails: { color: deliveryColors.muted, fontSize: 12, marginTop: 5, textAlign: 'right' },
  state: { color: deliveryColors.warning, fontSize: 12, fontWeight: '800', marginTop: deliverySpacing.sm, textAlign: 'right' },
  returned: { color: deliveryColors.success },
  returnButton: { alignItems: 'center', backgroundColor: deliveryColors.primarySoft, borderRadius: deliveryRadius.sm, justifyContent: 'center', marginTop: deliverySpacing.md, minHeight: 38 },
  returnButtonText: { color: deliveryColors.primary, fontSize: 12, fontWeight: '800' },
  backdrop: { backgroundColor: 'rgba(15, 35, 54, 0.46)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: deliveryColors.surface, borderTopLeftRadius: deliveryRadius.xl, borderTopRightRadius: deliveryRadius.xl, gap: deliverySpacing.md, padding: deliverySpacing.xl },
  sheetTitle: { color: deliveryColors.text, fontSize: 18, fontWeight: '800', textAlign: 'right' },
  sheetDescription: { color: deliveryColors.muted, fontSize: 13, textAlign: 'right' },
  input: { backgroundColor: '#F8FAFC', borderColor: '#DCE7F0', borderRadius: deliveryRadius.md, borderWidth: 1, color: deliveryColors.text, minHeight: 46, paddingHorizontal: deliverySpacing.md },
  textArea: { minHeight: 88, paddingTop: deliverySpacing.md },
  label: { color: deliveryColors.text, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  captainChoices: { flexDirection: 'row-reverse', gap: deliverySpacing.sm },
  captainChoice: { backgroundColor: deliveryColors.background, borderColor: '#DCE7F0', borderRadius: deliveryRadius.md, borderWidth: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: deliverySpacing.md },
  captainChoiceActive: { backgroundColor: deliveryColors.primary, borderColor: deliveryColors.primary },
  captainChoiceText: { color: deliveryColors.text, fontSize: 12, fontWeight: '800' },
  captainChoiceTextActive: { color: deliveryColors.surface },
  modalActions: { flexDirection: 'row-reverse', gap: deliverySpacing.md },
  primary: { alignItems: 'center', backgroundColor: deliveryColors.primary, borderRadius: deliveryRadius.md, flex: 1, justifyContent: 'center', minHeight: 46 },
  primaryText: { color: deliveryColors.surface, fontSize: 14, fontWeight: '800' },
  secondary: { alignItems: 'center', backgroundColor: deliveryColors.surface, borderColor: '#CFE0EC', borderRadius: deliveryRadius.md, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 46 },
  secondaryText: { color: deliveryColors.primary, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.5 },
});
