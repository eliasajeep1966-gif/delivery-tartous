import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { deliveryColors } from '@/constants/deliveryTheme';

const ADMIN_TABS = [{ key: 'more', label: 'المزيد', icon: 'ellipsis' }, { key: 'salaries', label: 'الأجور', icon: 'banknote' }, { key: 'home', label: 'الرئيسية', icon: 'house' }, { key: 'orders', label: 'الطلبات', icon: 'cube.box' }, { key: 'captains', label: 'الكباتن', icon: 'person.2' }] as const;
const CAPTAIN_TABS = [{ key: 'more', label: 'المزيد', icon: 'ellipsis' }, { key: 'earnings', label: 'أرباحي', icon: 'banknote' }, { key: 'home', label: 'الرئيسية', icon: 'house' }, { key: 'my_orders', label: 'طلباتي', icon: 'cube.box' }] as const;
type RoleBottomNavigationProps = { role: 'admin' | 'supervisor' | 'captain'; activeTab: string; onTabPress?: (key: string) => void; disabledTabs?: string[] };

export function RoleBottomNavigation({ role, activeTab, onTabPress, disabledTabs = [] }: RoleBottomNavigationProps) {
  const tabs = role === 'captain' ? CAPTAIN_TABS : ADMIN_TABS;
  return <View style={styles.outer}><View style={styles.container}>{tabs.map((tab) => { const isDisabled = disabledTabs.includes(tab.key); const isActive = !isDisabled && activeTab === tab.key; return <Pressable key={tab.key} accessibilityState={{ disabled: isDisabled, selected: isActive }} disabled={isDisabled} hitSlop={8} onPress={!isDisabled && onTabPress ? () => onTabPress(tab.key) : undefined} style={[styles.tab, isDisabled && styles.disabledTab]}><View style={[styles.iconCapsule, isActive && styles.activeIconCapsule]}><SymbolView name={tab.icon as any} size={20} tintColor={isActive ? '#FFFFFF' : '#7F94A4'} /></View><Text style={[styles.label, isActive && styles.activeLabel]}>{tab.label}</Text></Pressable>; })}</View></View>;
}
const styles = StyleSheet.create({ outer: { backgroundColor: 'transparent', paddingBottom: 8, paddingHorizontal: 12, paddingTop: 7 }, container: { backgroundColor: '#EFFAFF', borderColor: 'rgba(255,255,255,0.88)', borderRadius: 28, borderWidth: 1, flexDirection: 'row-reverse', minHeight: 76, paddingBottom: 6, paddingHorizontal: 5, paddingTop: 5, shadowColor: '#005195', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.19, shadowRadius: 16 }, tab: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 64 }, iconCapsule: { alignItems: 'center', borderRadius: 15, height: 36, justifyContent: 'center', minWidth: 44 }, activeIconCapsule: { backgroundColor: deliveryColors.primary, shadowColor: '#0060B8', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.25, shadowRadius: 8 }, label: { color: '#62798A', fontSize: 10, fontWeight: '700', marginTop: 4 }, activeLabel: { color: '#0059AD', fontWeight: '800' }, disabledTab: { opacity: 0.42 } });
