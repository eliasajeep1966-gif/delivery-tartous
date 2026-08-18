import { Pressable, Text, View, type ViewStyle, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

import { deliveryColors } from '@/constants/deliveryTheme';

const ADMIN_TABS = [
  { key: 'home', label: 'الرئيسية' },
  { key: 'orders', label: 'الطلبات' },
  { key: 'captains', label: 'الكباتن' },
  { key: 'salaries', label: 'الأجور' },
  { key: 'more', label: 'المزيد' },
] as const;

const CAPTAIN_TABS = [
  { key: 'home', label: 'الرئيسية' },
  { key: 'my_orders', label: 'طلباتي' },
  { key: 'earnings', label: 'أرباحي' },
  { key: 'more', label: 'المزيد' },
] as const;

type RoleBottomNavigationProps = {
  role: 'admin' | 'supervisor' | 'captain';
  activeTab: string;
  onTabPress: (key: string) => void;
};

export function RoleBottomNavigation({ role, activeTab, onTabPress }: RoleBottomNavigationProps) {
  const tabs = role === 'captain' ? CAPTAIN_TABS : ADMIN_TABS;

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabPress(tab.key)}
            style={styles.tab}
            hitSlop={8}
          >
            <Text style={[styles.label, isActive && styles.activeLabel]}>{tab.label}</Text>
            <View style={[styles.indicator, isActive && styles.activeIndicator]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: deliveryColors.surface,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: deliveryColors.muted,
  },
  activeLabel: {
    color: deliveryColors.primary,
    fontWeight: '700',
  },
  indicator: {
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  activeIndicator: {
    backgroundColor: deliveryColors.primary,
  },
});
