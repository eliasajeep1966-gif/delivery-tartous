import { Pressable, Text, View, type ViewStyle, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';

import { deliveryColors, deliverySpacing } from '@/constants/deliveryTheme';

type AppHeaderProps = {
  roleLabel: 'المدير' | 'المشرف' | 'الكابتن';
  showNotifications?: boolean;
  onNotificationsPress?: () => void;
  onSettingsPress?: () => void;
};

export function AppHeader({
  roleLabel,
  showNotifications = false,
  onNotificationsPress,
  onSettingsPress,
}: AppHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>دليفري طرطوس</Text>
        <Text style={styles.role}>{roleLabel}</Text>
      </View>
      <View style={styles.actions}>
        {showNotifications && (
          <Pressable onPress={onNotificationsPress} style={styles.iconButton} hitSlop={8}>
            <SymbolView name="bell" size={20} tintColor={deliveryColors.surface} />
          </Pressable>
        )}
        <Pressable onPress={onSettingsPress} style={styles.iconButton} hitSlop={8}>
          <SymbolView name="gearshape" size={20} tintColor={deliveryColors.surface} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: deliveryColors.primary,
    paddingHorizontal: deliverySpacing.lg,
    paddingVertical: deliverySpacing.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: deliveryColors.surface,
    textAlign: 'right',
  },
  role: {
    fontSize: 12,
    fontWeight: '500',
    color: '#C8E1F5',
    textAlign: 'right',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: deliverySpacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
