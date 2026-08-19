import { Pressable, Text, View, type ViewStyle, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

import { deliveryColors, deliverySpacing } from '@/constants/deliveryTheme';

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

export function SectionHeader({ title, actionLabel, onActionPress }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel && onActionPress && (
        <Pressable onPress={onActionPress} hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: deliverySpacing.md,
    marginTop: deliverySpacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: deliveryColors.text,
    textAlign: 'right',
  },
  action: {
    fontSize: 14,
    fontWeight: '600',
    color: deliveryColors.primary,
    textAlign: 'left',
  },
});
