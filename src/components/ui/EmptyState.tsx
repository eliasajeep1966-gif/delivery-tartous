import { Text, View, type ViewStyle, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

import { deliveryColors, deliverySpacing } from '@/constants/deliveryTheme';

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {action ? <View style={styles.actionWrap}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: deliverySpacing.xxxl,
    paddingHorizontal: deliverySpacing.xl,
    gap: deliverySpacing.md,
  },
  iconWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: deliverySpacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: deliveryColors.text,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    fontWeight: '500',
    color: deliveryColors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionWrap: {
    marginTop: deliverySpacing.sm,
  },
});
