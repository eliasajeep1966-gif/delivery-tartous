import type { ReactNode } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { deliveryColors, deliverySpacing } from '@/constants/deliveryTheme';
import { RoleBottomNavigation } from './RoleBottomNavigation';

type WorkspaceRole = 'admin' | 'supervisor' | 'captain';
type RoleWorkspaceProps = { role: WorkspaceRole; activeTab: string; title: string; subtitle?: string; children: ReactNode; onTabPress: (tab: string) => void; onRefresh?: () => void; isRefreshing?: boolean };

/** Shared native shell, styled after the compact white web headers for admin and captain. */
export function RoleWorkspace({ role, activeTab, title, subtitle, children, onTabPress, onRefresh, isRefreshing = false }: RoleWorkspaceProps) {
  const helpLabel = role === 'captain' ? 'المساعدة' : 'الدعم';
  return <SafeAreaView style={styles.safeArea}><View style={styles.header}><Pressable accessibilityLabel={helpLabel} accessibilityRole="button" onPress={() => onTabPress('more')} style={styles.headerControl}><Text style={styles.helpGlyph}>i</Text></Pressable><View style={styles.headerText}><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle || (role === 'captain' ? 'حساب الكابتن' : 'لوحة العمليات')}</Text></View><Pressable accessibilityLabel={isRefreshing ? 'جارٍ التحديث' : 'الإعدادات والتحديث'} accessibilityRole="button" disabled={isRefreshing} onPress={onRefresh ?? (() => onTabPress('more'))} style={[styles.headerControl, isRefreshing && styles.disabled]}><Text style={styles.controlGlyph}>{isRefreshing ? '…' : onRefresh ? '↻' : '⚙'}</Text></Pressable></View><View style={styles.content}>{children}</View><RoleBottomNavigation role={role} activeTab={activeTab} onTabPress={onTabPress} /></SafeAreaView>;
}
const styles = StyleSheet.create({ safeArea: { flex: 1, backgroundColor: deliveryColors.background }, header: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.96)', borderBottomColor: '#D8EDF7', borderBottomWidth: 1, flexDirection: 'row-reverse', height: 64, justifyContent: 'space-between', paddingHorizontal: deliverySpacing.md }, headerText: { alignItems: 'center', flex: 1 }, title: { color: '#075EAE', fontSize: 14, fontWeight: '800', textAlign: 'center' }, subtitle: { color: '#7B97AA', fontSize: 10, fontWeight: '700', marginTop: 2, textAlign: 'center' }, headerControl: { alignItems: 'center', backgroundColor: '#F4FBFF', borderColor: '#DCECF4', borderRadius: 12, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 }, helpGlyph: { color: '#36719A', fontSize: 19, fontWeight: '900', lineHeight: 22 }, controlGlyph: { color: '#36719A', fontSize: 20, fontWeight: '800', lineHeight: 22 }, content: { flex: 1 }, disabled: { opacity: 0.55 } });
