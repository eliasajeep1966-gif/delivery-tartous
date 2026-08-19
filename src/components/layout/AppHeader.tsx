import { Pressable, Text, View, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';

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
  const notificationsDisabled = !onNotificationsPress;
  const settingsDisabled = !onSettingsPress;

  return (
    <View style={styles.container}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>دليفري طرطوس</Text>
        <Text style={styles.role}>{roleLabel}</Text>
      </View>
      <View style={styles.actions}>
        {showNotifications && (
          <Pressable
            disabled={notificationsDisabled}
            onPress={onNotificationsPress}
            style={[styles.iconButton, notificationsDisabled && styles.disabledIconButton]}
            accessibilityState={{ disabled: notificationsDisabled }}
            hitSlop={8}
          >
            <SymbolView name="bell" size={20} tintColor={deliveryColors.surface} />
          </Pressable>
        )}
        <Pressable
          disabled={settingsDisabled}
          onPress={onSettingsPress}
          style={[styles.iconButton, settingsDisabled && styles.disabledIconButton]}
          accessibilityState={{ disabled: settingsDisabled }}
          hitSlop={8}
        >
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
  disabledIconButton: {
    opacity: 0.42,
  },
});
