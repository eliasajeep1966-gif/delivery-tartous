import { Pressable, Text, View, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { deliveryColors, deliverySpacing } from '@/constants/deliveryTheme';

const ADMIN_TABS = [
  { key: 'home', label: 'الرئيسية', icon: 'house' },
  { key: 'orders', label: 'الطلبات', icon: 'list.bullet' },
  { key: 'captains', label: 'الكباتن', icon: 'person.2' },
  { key: 'salaries', label: 'الأجور', icon: 'banknote' },
  { key: 'more', label: 'المزيد', icon: 'ellipsis' },
] as const;

const CAPTAIN_TABS = [
  { key: 'home', label: 'الرئيسية', icon: 'house' },
  { key: 'my_orders', label: 'طلباتي', icon: 'cube.box' },
  { key: 'earnings', label: 'أرباحي', icon: 'banknote' },
  { key: 'more', label: 'المزيد', icon: 'ellipsis' },
] as const;

type RoleBottomNavigationProps = {
  role: 'admin' | 'supervisor' | 'captain';
  activeTab: string;
  onTabPress?: (key: string) => void;
  disabledTabs?: string[];
};

export function RoleBottomNavigation({
  role,
  activeTab,
  onTabPress,
  disabledTabs = [],
}: RoleBottomNavigationProps) {
  const tabs = role === 'captain' ? CAPTAIN_TABS : ADMIN_TABS;

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isDisabled = disabledTabs.includes(tab.key);
        const isActive = !isDisabled && activeTab === tab.key;
        const onPress = !isDisabled && onTabPress ? () => onTabPress(tab.key) : undefined;

        return (
          <Pressable
            key={tab.key}
            disabled={isDisabled}
            onPress={onPress}
            style={[styles.tab, isDisabled && styles.disabledTab]}
            accessibilityState={{ disabled: isDisabled, selected: isActive }}
            hitSlop={8}
          >
            <SymbolView
              name={tab.icon as any}
              size={20}
              tintColor={isActive ? deliveryColors.primary : deliveryColors.muted}
            />
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
    flexDirection: 'row-reverse',
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
  disabledTab: {
    opacity: 0.42,
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
