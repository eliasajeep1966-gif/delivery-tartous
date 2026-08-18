import { Text, View, type ViewStyle, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

import { deliveryColors, deliveryRadius, deliverySpacing, deliveryShadows } from '@/constants/deliveryTheme';

type Tone = 'primary' | 'success' | 'warning' | 'danger';

type MetricCardProps = {
  icon: ReactNode;
  label: string;
  value: string | number;
  tone?: Tone;
};

const toneColors: Record<Tone, { bg: string; text: string }> = {
  primary: { bg: deliveryColors.primarySoft, text: deliveryColors.primary },
  success: { bg: '#E6F7EC', text: deliveryColors.success },
  warning: { bg: '#FFF7E6', text: deliveryColors.warning },
  danger: { bg: '#FEECEC', text: deliveryColors.danger },
};

export function MetricCard({ icon, label, value, tone = 'primary' }: MetricCardProps) {
  const palette = toneColors[tone];

  return (
    <View style={[styles.card, { backgroundColor: palette.bg }, deliveryShadows.sm]}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={[styles.value, { color: palette.text }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: deliveryRadius.lg,
    padding: deliverySpacing.lg,
    alignItems: 'center',
    gap: deliverySpacing.sm,
    minHeight: 120,
    justifyContent: 'center',
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: deliveryColors.muted,
    textAlign: 'center',
  },
});
