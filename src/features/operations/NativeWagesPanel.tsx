import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { deliveryColors, deliveryRadius, deliveryShadows, deliverySpacing } from '@/constants/deliveryTheme';
import { deliverySupabase, type CaptainWageDetailV2, type CaptainWagePeriod, type CaptainWagePeriodSummary } from '@/data/supabase/supabaseContract';

type NativeWagesPanelProps = { onRefreshDashboard: () => Promise<void> };

function money(value: number) { return `${Number(value).toLocaleString('ar-SY')} ل.س`; }
function periodLabel(period: CaptainWagePeriod, start: string, end: string) {
  if (period === 'daily') return new Date(`${start}T12:00:00`).toLocaleDateString('ar-SY');
  if (period === 'weekly') return `من ${new Date(`${start}T12:00:00`).toLocaleDateString('ar-SY')} إلى ${new Date(`${end}T12:00:00`).toLocaleDateString('ar-SY')}`;
  return new Intl.DateTimeFormat('ar-SY', { month: 'long', year: 'numeric' }).format(new Date(`${start}T12:00:00`));
}

export function NativeWagesPanel({ onRefreshDashboard }: NativeWagesPanelProps) {
  const [period, setPeriod] = useState<CaptainWagePeriod>('daily');
  const [rows, setRows] = useState<CaptainWagePeriodSummary[]>([]);
  const [selectedPeriodStart, setSelectedPeriodStart] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [payingCaptainId, setPayingCaptainId] = useState<string | null>(null);
  const [detailTarget, setDetailTarget] = useState<CaptainWagePeriodSummary | null>(null);
  const [detailRows, setDetailRows] = useState<CaptainWageDetailV2[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const load = useCallback(async (nextPeriod = period) => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await deliverySupabase.reads.captainWagePeriodSummary({ period: nextPeriod, limit: 100 });
      setRows(loaded);
      setPeriod(nextPeriod);
      const firstPeriod = loaded[0]?.period_start ?? '';
      setSelectedPeriodStart(firstPeriod);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل أجور الكباتن.');
    } finally { setIsLoading(false); }
  }, [period]);

  useEffect(() => { void load('daily'); }, []);

  const periodOptions = useMemo(() => {
    const map = new Map<string, { start: string; end: string }>();
    rows.forEach((row) => { if (!map.has(row.period_start)) map.set(row.period_start, { start: row.period_start, end: row.period_end }); });
    return Array.from(map.values());
  }, [rows]);
  const activeStart = periodOptions.some((option) => option.start === selectedPeriodStart) ? selectedPeriodStart : periodOptions[0]?.start ?? '';
  const activeRows = useMemo(() => rows.filter((row) => row.period_start === activeStart), [activeStart, rows]);
  const totals = useMemo(() => activeRows.reduce((sum, row) => ({ net: sum.net + Number(row.captain_net_total), paid: sum.paid + Number(row.paid_total), unpaid: sum.unpaid + Number(row.unpaid_total), orders: sum.orders + Number(row.order_count) }), { net: 0, paid: 0, unpaid: 0, orders: 0 }), [activeRows]);

  const openDetails = async (row: CaptainWagePeriodSummary) => {
    setDetailTarget(row);
    setDetailsLoading(true);
    try {
      setDetailRows(await deliverySupabase.reads.captainWageDetailsV2(row.captain_id));
    } catch (cause) {
      Alert.alert('تعذر تحميل كشف الحساب', cause instanceof Error ? cause.message : 'تعذر تحميل كشف الحساب.');
      setDetailRows([]);
    } finally { setDetailsLoading(false); }
  };

  const recordPayout = async (row: CaptainWagePeriodSummary) => {
    const amount = Number(paymentInputs[row.captain_id]);
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number(row.unpaid_total) || payingCaptainId) {
      Alert.alert('قيمة غير صحيحة', 'أدخل مبلغاً موجباً لا يتجاوز الأجر المتبقي.');
      return;
    }
    setPayingCaptainId(row.captain_id);
    try {
      await deliverySupabase.actions.createCaptainPartialPayout({ captainId: row.captain_id, amount });
      setPaymentInputs((current) => ({ ...current, [row.captain_id]: '' }));
      await Promise.all([load(period), onRefreshDashboard()]);
      Alert.alert('تم تسجيل الدفعة', `تم تسجيل دفعة بقيمة ${money(amount)}.`);
    } catch (cause) {
      Alert.alert('تعذر تسجيل الدفعة', cause instanceof Error ? cause.message : 'تعذر تسجيل دفعة الكابتن.');
    } finally { setPayingCaptainId(null); }
  };

  return <View style={styles.root}>
    <View style={styles.periodRow}>{(['daily', 'weekly', 'monthly'] as CaptainWagePeriod[]).map((item) => <Pressable key={item} onPress={() => void load(item)} style={[styles.periodButton, period === item && styles.periodActive]}><Text style={[styles.periodText, period === item && styles.periodTextActive]}>{item === 'daily' ? 'يومي' : item === 'weekly' ? 'أسبوعي' : 'شهري'}</Text></Pressable>)}</View>
    {periodOptions.length > 1 ? <ScrollView horizontal contentContainerStyle={styles.periodOptions}>{periodOptions.map((option) => <Pressable key={option.start} onPress={() => setSelectedPeriodStart(option.start)} style={[styles.periodOption, activeStart === option.start && styles.periodOptionActive]}><Text style={[styles.periodOptionText, activeStart === option.start && styles.periodOptionTextActive]}>{periodLabel(period, option.start, option.end)}</Text></Pressable>)}</ScrollView> : null}
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {isLoading ? <Text style={styles.status}>جارٍ تحميل الأجور...</Text> : null}
      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void load(period)} style={styles.retry}><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable></View> : null}
      {!isLoading && !error ? <><View style={styles.metricsGrid}><Metric label="صافي الكباتن" value={money(totals.net)} /><Metric label="دفعات مسلّمة" value={money(totals.paid)} /><Metric label="المتبقي" value={money(totals.unpaid)} /><Metric label="طلبات الفترة" value={String(totals.orders)} /></View><Text style={styles.sectionTitle}>سجلات الكباتن — {activeStart ? periodLabel(period, activeStart, periodOptions.find((item) => item.start === activeStart)?.end ?? activeStart) : 'لا توجد فترات'}</Text>{activeRows.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>لا توجد أجور ضمن الفترة المختارة.</Text></View> : null}{activeRows.map((row) => <View key={row.captain_id} style={[styles.wageCard, deliveryShadows.sm]}><Text style={styles.captainName}>{row.captain_name}</Text><Text style={styles.meta}>{row.order_count} طلبات · الإجمالي: {money(row.gross_total)}</Text><View style={styles.amounts}><Amount label="صافي الكابتن" value={money(row.captain_net_total)} /><Amount label="المدفوع" value={money(row.paid_total)} /><Amount label="المتبقي" value={money(row.unpaid_total)} /></View><Pressable onPress={() => void openDetails(row)} style={styles.detailButton}><Text style={styles.detailButtonText}>فتح كشف الحساب</Text></Pressable><View style={styles.payoutRow}><TextInput value={paymentInputs[row.captain_id] ?? ''} onChangeText={(value) => setPaymentInputs((current) => ({ ...current, [row.captain_id]: value }))} keyboardType="decimal-pad" placeholder="مبلغ الدفعة" style={styles.payoutInput} textAlign="right" editable={Number(row.unpaid_total) > 0 && payingCaptainId !== row.captain_id} /><Pressable disabled={Number(row.unpaid_total) <= 0 || payingCaptainId !== null} onPress={() => void recordPayout(row)} style={[styles.payoutButton, (Number(row.unpaid_total) <= 0 || payingCaptainId !== null) && styles.disabled]}><Text style={styles.payoutButtonText}>{payingCaptainId === row.captain_id ? 'جارٍ التسجيل...' : 'تسليم دفعة'}</Text></Pressable></View></View>)}</> : null}
    </ScrollView>
    <Modal animationType="slide" visible={detailTarget !== null} onRequestClose={() => setDetailTarget(null)}><View style={styles.detailRoot}><View style={styles.detailHeader}><Pressable onPress={() => setDetailTarget(null)} style={styles.backButton}><Text style={styles.backText}>رجوع</Text></Pressable><View><Text style={styles.detailTitle}>كشف حساب الكابتن</Text><Text style={styles.detailSubtitle}>{detailTarget?.captain_name}</Text></View></View><ScrollView contentContainerStyle={styles.detailContent}>{detailsLoading ? <Text style={styles.status}>جارٍ تحميل السجلات...</Text> : null}{detailRows.map((entry) => <View key={entry.financial_ledger_id} style={[styles.ledgerCard, deliveryShadows.sm]}><Text style={styles.ledgerTitle}>طلب #{entry.order_number}</Text><Text style={styles.ledgerMeta}>التاريخ: {new Date(entry.completed_at).toLocaleString('ar-SY')}</Text><Text style={styles.ledgerAmount}>أجر الكابتن: {money(entry.captain_amount)}</Text><Text style={styles.ledgerMeta}>مدفوع: {money(entry.paid_amount)} · متبقي: {money(entry.unpaid_amount)}</Text></View>)}{!detailsLoading && detailRows.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>لا توجد سجلات تفصيلية.</Text></View> : null}</ScrollView></View></Modal>
  </View>;
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function Amount({ label, value }: { label: string; value: string }) { return <View style={styles.amount}><Text style={styles.amountLabel}>{label}</Text><Text style={styles.amountValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  root: { flex: 1 },
  periodRow: { backgroundColor: deliveryColors.surface, flexDirection: 'row-reverse', gap: deliverySpacing.sm, padding: deliverySpacing.md },
  periodButton: { alignItems: 'center', borderColor: '#DCE7F0', borderRadius: deliveryRadius.md, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 40 },
  periodActive: { backgroundColor: deliveryColors.primary, borderColor: deliveryColors.primary },
  periodText: { color: deliveryColors.muted, fontSize: 12, fontWeight: '800' },
  periodTextActive: { color: deliveryColors.surface },
  periodOptions: { backgroundColor: deliveryColors.surface, flexDirection: 'row-reverse', gap: deliverySpacing.sm, paddingHorizontal: deliverySpacing.md, paddingBottom: deliverySpacing.md },
  periodOption: { backgroundColor: deliveryColors.background, borderColor: '#DCE7F0', borderRadius: 999, borderWidth: 1, paddingHorizontal: deliverySpacing.md, paddingVertical: 8 },
  periodOptionActive: { backgroundColor: deliveryColors.primarySoft, borderColor: deliveryColors.primary },
  periodOptionText: { color: deliveryColors.muted, fontSize: 11, fontWeight: '700' },
  periodOptionTextActive: { color: deliveryColors.primary },
  scrollContent: { gap: deliverySpacing.md, padding: deliverySpacing.lg, paddingBottom: deliverySpacing.xxxl },
  status: { color: deliveryColors.primary, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderRadius: deliveryRadius.md, borderWidth: 1, padding: deliverySpacing.md },
  errorText: { color: deliveryColors.danger, fontSize: 13, textAlign: 'right' },
  retry: { alignItems: 'center', borderColor: '#FECACA', borderRadius: deliveryRadius.sm, borderWidth: 1, marginTop: deliverySpacing.sm, minHeight: 36 },
  retryText: { color: deliveryColors.danger, fontSize: 12, fontWeight: '800', paddingTop: 8 },
  metricsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: deliverySpacing.md },
  metric: { alignItems: 'center', backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.lg, flexBasis: '47%', flexGrow: 1, minHeight: 92, justifyContent: 'center', padding: deliverySpacing.md },
  metricValue: { color: deliveryColors.primary, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  metricLabel: { color: deliveryColors.muted, fontSize: 11, marginTop: 6, textAlign: 'center' },
  sectionTitle: { color: deliveryColors.text, fontSize: 16, fontWeight: '800', marginTop: deliverySpacing.sm, textAlign: 'right' },
  empty: { alignItems: 'center', backgroundColor: deliveryColors.surface, borderColor: '#DCE7F0', borderRadius: deliveryRadius.lg, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', minHeight: 120, padding: deliverySpacing.lg },
  emptyText: { color: deliveryColors.muted, fontSize: 14, textAlign: 'center' },
  wageCard: { backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.lg, padding: deliverySpacing.lg },
  captainName: { color: deliveryColors.text, fontSize: 16, fontWeight: '800', textAlign: 'right' },
  meta: { color: deliveryColors.muted, fontSize: 12, marginTop: 4, textAlign: 'right' },
  amounts: { flexDirection: 'row-reverse', gap: deliverySpacing.sm, marginTop: deliverySpacing.md },
  amount: { backgroundColor: deliveryColors.background, borderRadius: deliveryRadius.sm, flex: 1, padding: deliverySpacing.sm },
  amountLabel: { color: deliveryColors.muted, fontSize: 10, textAlign: 'center' },
  amountValue: { color: deliveryColors.text, fontSize: 11, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  detailButton: { alignItems: 'center', backgroundColor: deliveryColors.primarySoft, borderRadius: deliveryRadius.md, justifyContent: 'center', marginTop: deliverySpacing.md, minHeight: 40 },
  detailButtonText: { color: deliveryColors.primary, fontSize: 12, fontWeight: '800' },
  payoutRow: { flexDirection: 'row-reverse', gap: deliverySpacing.sm, marginTop: deliverySpacing.md },
  payoutInput: { backgroundColor: '#F8FAFC', borderColor: '#DCE7F0', borderRadius: deliveryRadius.md, borderWidth: 1, flex: 1, minHeight: 42, paddingHorizontal: deliverySpacing.sm },
  payoutButton: { alignItems: 'center', backgroundColor: deliveryColors.primary, borderRadius: deliveryRadius.md, justifyContent: 'center', minWidth: 100 },
  payoutButtonText: { color: deliveryColors.surface, fontSize: 12, fontWeight: '800' },
  detailRoot: { flex: 1, backgroundColor: deliveryColors.background },
  detailHeader: { alignItems: 'center', backgroundColor: deliveryColors.primary, flexDirection: 'row-reverse', justifyContent: 'space-between', minHeight: 74, paddingHorizontal: deliverySpacing.lg },
  detailTitle: { color: deliveryColors.surface, fontSize: 18, fontWeight: '800', textAlign: 'right' },
  detailSubtitle: { color: '#D7EEFF', fontSize: 11, marginTop: 3, textAlign: 'right' },
  backButton: { borderColor: '#FFFFFF66', borderRadius: deliveryRadius.md, borderWidth: 1, paddingHorizontal: deliverySpacing.md, paddingVertical: deliverySpacing.sm },
  backText: { color: deliveryColors.surface, fontSize: 13, fontWeight: '800' },
  detailContent: { gap: deliverySpacing.md, padding: deliverySpacing.lg, paddingBottom: deliverySpacing.xxxl },
  ledgerCard: { backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.lg, padding: deliverySpacing.lg },
  ledgerTitle: { color: deliveryColors.text, fontSize: 15, fontWeight: '800', textAlign: 'right' },
  ledgerMeta: { color: deliveryColors.muted, fontSize: 12, marginTop: 4, textAlign: 'right' },
  ledgerAmount: { color: deliveryColors.primary, fontSize: 14, fontWeight: '800', marginTop: deliverySpacing.sm, textAlign: 'right' },
  disabled: { opacity: 0.5 },
});
