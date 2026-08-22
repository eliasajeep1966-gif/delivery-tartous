import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { deliveryColors, deliveryRadius, deliveryShadows, deliverySpacing } from '@/constants/deliveryTheme';
import { deliverySupabase, type AuditLog, type Profile } from '@/data/supabase/supabaseContract';

type ActivityFilter = 'all' | 'orders' | 'users' | 'captains' | 'system';

type NativeActivityLogsPanelProps = {
  profiles: Profile[];
  onClose: () => void;
};

function metadataValue(log: AuditLog, key: string): string | null {
  if (!log.metadata || typeof log.metadata !== 'object' || Array.isArray(log.metadata)) return null;
  const value = (log.metadata as Record<string, unknown>)[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function categoryOf(log: AuditLog): Exclude<ActivityFilter, 'all'> {
  const type = log.entity_type.toLowerCase();
  if (type === 'order' || log.action.startsWith('order_')) return 'orders';
  if (type === 'captain_payout' || log.action.includes('captain_') || log.action.includes('custody') || log.action.includes('payout')) return 'captains';
  if (['user', 'profile', 'pending_account', 'user_permission_override'].includes(type) || log.action.includes('account') || log.action.includes('user_') || log.action.includes('profile') || log.action.includes('permission')) return 'users';
  return 'system';
}

function presentation(log: AuditLog) {
  switch (log.action) {
    case 'order_created':
    case 'order_created_with_stops': return { title: 'إنشاء طلب', details: 'تم إنشاء طلب جديد في النظام.' };
    case 'order_assigned': return { title: 'تعيين كابتن', details: 'تم إسناد الطلب إلى كابتن.' };
    case 'order_status_changed': return { title: 'تحديث حالة طلب', details: 'تم تحديث المرحلة التشغيلية للطلب.' };
    case 'order_cancelled': return { title: 'إلغاء طلب', details: 'تم إلغاء الطلب وتسجيل السبب.' };
    case 'pending_account_created': return { title: 'إنشاء حساب معلّق', details: 'تمت إضافة حساب بانتظار التفعيل.' };
    case 'pending_account_cancelled': return { title: 'إلغاء حساب معلّق', details: 'تم إلغاء حساب قبل تفعيله.' };
    case 'pending_account_activated': return { title: 'تفعيل حساب', details: 'تم تفعيل الحساب بنجاح.' };
    case 'captain_deactivated': return { title: 'تعطيل كابتن', details: 'تم إيقاف حساب الكابتن.' };
    case 'captain_reactivated': return { title: 'تفعيل كابتن', details: 'تم إعادة تفعيل حساب الكابتن.' };
    case 'captain_custody_assigned': return { title: 'إضافة أمانة', details: `تم تسجيل أمانة: ${metadataValue(log, 'item_name') ?? 'عنصر جديد'}.` };
    case 'captain_custody_returned': return { title: 'إرجاع أمانة', details: `تم تسجيل إرجاع أمانة: ${metadataValue(log, 'item_name') ?? 'عنصر'}.` };
    case 'captain_payout_recorded': return { title: 'تسجيل دفعة كابتن', details: 'تم تسجيل دفعة أجور لكابتن.' };
    case 'captain_partial_payout_recorded': return { title: 'تسجيل دفعة جزئية', details: 'تم تسجيل دفعة جزئية من أجور كابتن.' };
    case 'user_permission_override_set': return { title: 'تعديل تخصيص صلاحية', details: 'تم تعديل تخصيص صلاحية مستخدم.' };
    default: return { title: 'نشاط إداري', details: 'تم تسجيل حركة إدارية في النظام.' };
  }
}

function displayProfile(profile: Profile | undefined) {
  return profile?.full_name?.trim() || profile?.email || 'النظام';
}

export function NativeActivityLogsPanel({ profiles, onClose }: NativeActivityLogsPanelProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setLogs(await deliverySupabase.reads.auditLogs());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل سجل الحركات.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const profilesById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const visibleLogs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return logs.filter((log) => {
      const item = presentation(log);
      const subject = `${metadataValue(log, 'order_number') ?? ''} ${metadataValue(log, 'email') ?? ''} ${metadataValue(log, 'item_name') ?? ''}`.toLowerCase();
      return (filter === 'all' || categoryOf(log) === filter) && (!normalized || `${item.title} ${item.details} ${subject}`.toLowerCase().includes(normalized));
    });
  }, [filter, logs, query]);

  return (
    <View style={styles.root}>
      <View style={styles.header}><Pressable accessibilityRole="button" onPress={onClose} style={styles.backButton}><Text style={styles.backButtonText}>رجوع</Text></Pressable><View><Text style={styles.headerTitle}>سجل الحركات</Text><Text style={styles.headerSubtitle}>كل العمليات المسجلة في النظام</Text></View></View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.introCard, deliveryShadows.sm]}><View style={styles.introHeading}><View><Text style={styles.introTitle}>سجل الحركات</Text><Text style={styles.introText}>كل التغييرات والعمليات في مكان واحد، مع منفّذ الحركة ووقتها.</Text></View><View style={styles.introIcon}><Text style={styles.introIconText}>◷</Text></View></View><View style={styles.searchShell}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="ابحث باسم، طلب، أو حركة" placeholderTextColor="#8A98A6" style={styles.searchInput} textAlign="right" /></View></View>
        <ScrollView horizontal contentContainerStyle={styles.filterRow} showsHorizontalScrollIndicator={false}>{([['all', 'الكل'], ['orders', 'الطلبات'], ['users', 'المستخدمون'], ['captains', 'الكباتن'], ['system', 'النظام']] as const).map(([key, label]) => <Pressable key={key} onPress={() => setFilter(key)} style={[styles.filterButton, filter === key && styles.filterActive]}><Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{label}</Text></Pressable>)}</ScrollView>
        <View style={styles.listHeading}><Text style={styles.listTitle}>آخر الحركات</Text><Text style={styles.count}>{visibleLogs.length} حركة</Text></View>
        {isLoading ? <Text style={styles.status}>جارٍ تحميل السجل...</Text> : null}
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void reload()} style={styles.retry}><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable></View> : null}
        {!isLoading && !error && visibleLogs.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>لا توجد حركات ضمن هذا التصنيف.</Text></View> : null}
        {visibleLogs.map((log) => {
          const item = presentation(log);
          const orderNo = metadataValue(log, 'order_number');
          const captainId = metadataValue(log, 'captain_id');
          const subject = orderNo ? `الطلب #${orderNo}` : captainId ? displayProfile(profilesById.get(captainId)) : metadataValue(log, 'email') ?? metadataValue(log, 'item_name') ?? 'النظام';
          const tone = categoryOf(log) === 'orders' ? styles.toneBlue : categoryOf(log) === 'users' ? styles.toneViolet : categoryOf(log) === 'captains' ? styles.toneGreen : styles.toneSlate;
          return <View key={log.id} style={[styles.logRow]}><View style={[styles.logIcon, tone]}><Text style={styles.logIconText}>{categoryOf(log) === 'orders' ? '□' : categoryOf(log) === 'users' ? '◉' : categoryOf(log) === 'captains' ? '◈' : '◷'}</Text></View><View style={[styles.logCard, deliveryShadows.sm]}><View style={styles.logHeading}><Text style={styles.logTitle}>{item.title}</Text><Text style={styles.logTime}>{new Date(log.created_at).toLocaleDateString('ar-SY')}</Text></View><Text style={styles.subject}>{subject}</Text><Text style={styles.details}>{item.details}</Text><Text style={styles.meta}>بواسطة: {displayProfile(log.actor_user_id ? profilesById.get(log.actor_user_id) : undefined)}</Text></View></View>;
        })}
      </ScrollView>
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
  filterRow: { gap: 8, paddingHorizontal: 2 },
  filterButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#D4E2EC', borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: 34, paddingHorizontal: 12 },
  filterActive: { backgroundColor: deliveryColors.primary, borderColor: deliveryColors.primary },
  filterText: { color: deliveryColors.muted, fontSize: 10, fontWeight: '800' },
  filterTextActive: { color: deliveryColors.surface },
  scrollContent: { gap: deliverySpacing.md, padding: deliverySpacing.lg, paddingBottom: deliverySpacing.xxxl },
  introCard: { backgroundColor: '#FFFFFF', borderColor: '#D3E3F0', borderRadius: 16, borderWidth: 1, padding: 14 },
  introHeading: { alignItems: 'flex-start', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  introTitle: { color: '#1C1B1B', fontSize: 18, fontWeight: '800', textAlign: 'right' },
  introText: { color: '#58616B', fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: 'right' },
  introIcon: { alignItems: 'center', backgroundColor: '#EAF4FF', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  introIconText: { color: '#0060B8', fontSize: 20, fontWeight: '800' },
  searchShell: { alignItems: 'center', backgroundColor: '#FBFDFF', borderColor: '#C9D9E7', borderRadius: 12, borderWidth: 1, flexDirection: 'row-reverse', height: 44, marginTop: 14 },
  searchIcon: { color: '#75818E', fontSize: 22, paddingHorizontal: 10 },
  searchInput: { color: '#1C2934', flex: 1, fontSize: 13, height: '100%', paddingLeft: 10 },
  listHeading: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  listTitle: { color: '#1C1B1B', fontSize: 16, fontWeight: '800' },
  count: { backgroundColor: '#DBEEFF', borderRadius: 99, color: '#0060B8', fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5 },
  status: { color: deliveryColors.primary, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderRadius: deliveryRadius.md, borderWidth: 1, padding: deliverySpacing.md },
  errorText: { color: deliveryColors.danger, fontSize: 13, textAlign: 'right' },
  retry: { alignItems: 'center', borderColor: '#FECACA', borderRadius: deliveryRadius.sm, borderWidth: 1, marginTop: deliverySpacing.sm, minHeight: 36 },
  retryText: { color: deliveryColors.danger, fontSize: 12, fontWeight: '800', paddingTop: 8 },
  empty: { alignItems: 'center', backgroundColor: deliveryColors.surface, borderColor: '#DCE7F0', borderRadius: deliveryRadius.lg, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', minHeight: 120, padding: deliverySpacing.lg },
  emptyText: { color: deliveryColors.muted, fontSize: 14, textAlign: 'center' },
  logRow: { flexDirection: 'row-reverse', gap: 10 },
  logIcon: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 12, height: 44, justifyContent: 'center', width: 44 },
  logIconText: { fontSize: 18, fontWeight: '800' },
  toneBlue: { backgroundColor: '#DBEEFF' },
  toneGreen: { backgroundColor: '#DCFCE7' },
  toneViolet: { backgroundColor: '#EDE9FE' },
  toneSlate: { backgroundColor: '#E2E8F0' },
  logCard: { backgroundColor: '#FFFFFF', borderColor: '#DBE7F2', borderRadius: 16, borderWidth: 1, flex: 1, padding: 14 },
  logHeading: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  logTitle: { color: '#1C1B1B', fontSize: 14, fontWeight: '800', textAlign: 'right' },
  logTime: { color: '#75818E', fontSize: 10 },
  subject: { color: deliveryColors.primary, fontSize: 13, fontWeight: '800', marginTop: deliverySpacing.sm, textAlign: 'right' },
  details: { color: deliveryColors.muted, fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: 'right' },
  meta: { color: '#8293A3', fontSize: 10, lineHeight: 16, marginTop: deliverySpacing.sm, textAlign: 'right' },
});
