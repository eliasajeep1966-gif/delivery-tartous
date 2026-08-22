import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { deliveryColors, deliveryRadius, deliveryShadows, deliverySpacing } from '@/constants/deliveryTheme';
import { deliverySupabase, type CompanyProfitDayDetail, type CompanyProfitPeriod, type CompanyProfitPeriodHistory } from '@/data/supabase/supabaseContract';

type NativeCompanyWagesPanelProps = { onClose: () => void };

function money(value: number) { return `${Number(value).toLocaleString('ar-SY')} ل.س`; }
function label(period: CompanyProfitPeriod, start: string, end: string) {
  if (period === 'daily') return new Date(`${start}T12:00:00`).toLocaleDateString('ar-SY');
  if (period === 'weekly') return `من ${new Date(`${start}T12:00:00`).toLocaleDateString('ar-SY')} إلى ${new Date(`${end}T12:00:00`).toLocaleDateString('ar-SY')}`;
  return new Intl.DateTimeFormat('ar-SY', { month: 'long', year: 'numeric' }).format(new Date(`${start}T12:00:00`));
}

export function NativeCompanyWagesPanel({ onClose }: NativeCompanyWagesPanelProps) {
  const [period, setPeriod] = useState<CompanyProfitPeriod>('daily');
  const [rows, setRows] = useState<CompanyProfitPeriodHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayDetails, setDayDetails] = useState<CompanyProfitDayDetail[]>([]);
  const [isDayLoading, setIsDayLoading] = useState(false);

  const load = useCallback(async (nextPeriod = period) => {
    setIsLoading(true); setError(null);
    try { setRows(await deliverySupabase.reads.companyProfitPeriodHistory({ period: nextPeriod, limit: 100 })); setPeriod(nextPeriod); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر تحميل سجل أرباح الشركة.'); }
    finally { setIsLoading(false); }
  }, [period]);
  useEffect(() => { void load('daily'); }, []);

  const totals = useMemo(() => rows.reduce((sum, row) => ({ gross: sum.gross + Number(row.gross_total), company: sum.company + Number(row.company_total), orders: sum.orders + Number(row.order_count) }), { gross: 0, company: 0, orders: 0 }), [rows]);
  const openDay = async (day: string) => {
    setSelectedDay(day); setIsDayLoading(true);
    try { setDayDetails(await deliverySupabase.reads.companyProfitDayDetails({ businessDay: day, limit: 100 })); }
    catch { setDayDetails([]); }
    finally { setIsDayLoading(false); }
  };

  return <View style={styles.root}><View style={styles.header}><Pressable onPress={onClose} style={styles.backButton}><Text style={styles.backText}>رجوع</Text></Pressable><View><Text style={styles.headerTitle}>أجور الشركة</Text><Text style={styles.headerSubtitle}>سجل الأرباح حسب الفترة</Text></View></View><View style={styles.periodRow}>{(['daily', 'weekly', 'monthly'] as CompanyProfitPeriod[]).map((item) => <Pressable key={item} onPress={() => void load(item)} style={[styles.periodButton, period === item && styles.periodActive]}><Text style={[styles.periodText, period === item && styles.periodTextActive]}>{item === 'daily' ? 'يومي' : item === 'weekly' ? 'أسبوعي' : 'شهري'}</Text></Pressable>)}</View><ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>{isLoading ? <Text style={styles.status}>جارٍ تحميل أرباح الشركة...</Text> : null}{error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void load(period)} style={styles.retry}><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable></View> : null}{!isLoading && !error ? <><View style={styles.metrics}><Metric label="الأجور الكلية" value={money(totals.gross)} /><Metric label="صافي الشركة" value={money(totals.company)} /><Metric label="الطلبات" value={String(totals.orders)} /></View>{rows.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>لا توجد أرباح مسجلة ضمن هذه الفترة.</Text></View> : null}{rows.map((row) => <Pressable key={row.period_start} disabled={period !== 'daily'} onPress={() => void openDay(row.period_start)} style={[styles.row, deliveryShadows.sm]}><Text style={styles.dayLabel}>{label(period, row.period_start, row.period_end)}</Text><Text style={styles.dayMeta}>{row.order_count} طلبات · الإجمالي: {money(row.gross_total)}</Text><Text style={styles.companyAmount}>صافي الشركة: {money(row.company_total)}</Text>{period === 'daily' ? <Text style={styles.detailHint}>اضغط لعرض تفاصيل اليوم</Text> : null}</Pressable>)}</> : null}</ScrollView><Modal animationType="slide" visible={selectedDay !== null} onRequestClose={() => setSelectedDay(null)}><View style={styles.detailRoot}><View style={styles.header}><Pressable onPress={() => setSelectedDay(null)} style={styles.backButton}><Text style={styles.backText}>رجوع</Text></Pressable><View><Text style={styles.headerTitle}>تفاصيل اليوم</Text><Text style={styles.headerSubtitle}>{selectedDay ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString('ar-SY') : ''}</Text></View></View><ScrollView contentContainerStyle={styles.scrollContent}>{isDayLoading ? <Text style={styles.status}>جارٍ تحميل التفاصيل...</Text> : null}{!isDayLoading && dayDetails.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>لا توجد تفاصيل لهذا اليوم.</Text></View> : null}{dayDetails.map((entry) => <View key={entry.financial_ledger_id} style={[styles.row, deliveryShadows.sm]}><Text style={styles.dayLabel}>طلب #{entry.order_number}</Text><Text style={styles.dayMeta}>{entry.captain_name} · {new Date(entry.completed_at).toLocaleTimeString('ar-SY')}</Text><Text style={styles.companyAmount}>الشركة: {money(entry.company_amount)}</Text><Text style={styles.dayMeta}>الإجمالي: {money(entry.gross_fee)}{Number(entry.settlement_amount) > 0 ? ` · تسوية: ${money(entry.settlement_amount)}` : ''}</Text></View>)}</ScrollView></View></Modal></View>;
}
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: deliveryColors.background },
  header: { alignItems: 'center', backgroundColor: deliveryColors.primary, flexDirection: 'row-reverse', justifyContent: 'space-between', minHeight: 74, paddingHorizontal: deliverySpacing.lg },
  headerTitle: { color: deliveryColors.surface, fontSize: 18, fontWeight: '800', textAlign: 'right' }, headerSubtitle: { color: '#D7EEFF', fontSize: 11, marginTop: 3, textAlign: 'right' },
  backButton: { borderColor: '#FFFFFF66', borderRadius: deliveryRadius.md, borderWidth: 1, paddingHorizontal: deliverySpacing.md, paddingVertical: deliverySpacing.sm }, backText: { color: deliveryColors.surface, fontSize: 13, fontWeight: '800' },
  periodRow: { backgroundColor: deliveryColors.surface, flexDirection: 'row-reverse', gap: deliverySpacing.sm, padding: deliverySpacing.md }, periodButton: { alignItems: 'center', borderColor: '#DCE7F0', borderRadius: deliveryRadius.md, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 40 }, periodActive: { backgroundColor: deliveryColors.primary, borderColor: deliveryColors.primary }, periodText: { color: deliveryColors.muted, fontSize: 12, fontWeight: '800' }, periodTextActive: { color: deliveryColors.surface },
  scrollContent: { gap: deliverySpacing.md, padding: deliverySpacing.lg, paddingBottom: deliverySpacing.xxxl }, status: { color: deliveryColors.primary, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderRadius: deliveryRadius.md, borderWidth: 1, padding: deliverySpacing.md }, errorText: { color: deliveryColors.danger, fontSize: 13, textAlign: 'right' }, retry: { alignItems: 'center', borderColor: '#FECACA', borderRadius: deliveryRadius.sm, borderWidth: 1, marginTop: deliverySpacing.sm, minHeight: 36 }, retryText: { color: deliveryColors.danger, fontSize: 12, fontWeight: '800', paddingTop: 8 },
  metrics: { flexDirection: 'row-reverse', gap: deliverySpacing.sm }, metric: { alignItems: 'center', backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.lg, flex: 1, justifyContent: 'center', minHeight: 92, padding: deliverySpacing.sm }, metricValue: { color: deliveryColors.primary, fontSize: 13, fontWeight: '800', textAlign: 'center' }, metricLabel: { color: deliveryColors.muted, fontSize: 10, marginTop: 5, textAlign: 'center' },
  empty: { alignItems: 'center', backgroundColor: deliveryColors.surface, borderColor: '#DCE7F0', borderRadius: deliveryRadius.lg, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', minHeight: 120, padding: deliverySpacing.lg }, emptyText: { color: deliveryColors.muted, fontSize: 14, textAlign: 'center' },
  row: { backgroundColor: deliveryColors.surface, borderRadius: deliveryRadius.lg, padding: deliverySpacing.lg }, dayLabel: { color: deliveryColors.text, fontSize: 15, fontWeight: '800', textAlign: 'right' }, dayMeta: { color: deliveryColors.muted, fontSize: 12, marginTop: 5, textAlign: 'right' }, companyAmount: { color: '#7E22CE', fontSize: 14, fontWeight: '800', marginTop: deliverySpacing.sm, textAlign: 'right' }, detailHint: { color: deliveryColors.primary, fontSize: 11, fontWeight: '700', marginTop: deliverySpacing.sm, textAlign: 'right' }, detailRoot: { flex: 1, backgroundColor: deliveryColors.background },
});
