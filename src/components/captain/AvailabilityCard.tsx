import { Switch, Text, View, type ViewStyle, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

import { CaptainAvailability } from '@/types';
import { deliveryColors, deliveryRadius, deliveryShadows, deliverySpacing } from '@/constants/deliveryTheme';

type AvailabilityCardProps = {
  availability: CaptainAvailability;
  onToggle: () => void;
};

export function AvailabilityCard({ availability, onToggle }: AvailabilityCardProps) {
  const isAvailable = availability === 'available';

  return (
    <View style={[styles.card, deliveryShadows.md]}>
      <Text style={styles.title}>حالة التوفر</Text>
      <Text style={[styles.status, { color: isAvailable ? deliveryColors.success : deliveryColors.danger }]}>
        {isAvailable ? 'متاح الآن' : 'غير متاح الآن'}
      </Text>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>متاح</Text>
        <Switch
          value={isAvailable}
          onValueChange={onToggle}
          trackColor={{ false: '#D1D5DB', true: deliveryColors.success }}
          thumbColor={deliveryColors.surface}
          ios_backgroundColor="#D1D5DB"
        />
        <Text style={styles.switchLabel}>غير متاح</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: deliveryColors.surface,
    borderRadius: deliveryRadius.lg,
    padding: deliverySpacing.xl,
    alignItems: 'center',
    gap: deliverySpacing.lg,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: deliveryColors.text,
    textAlign: 'center',
  },
  status: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: deliverySpacing.lg,
    gap: deliverySpacing.md,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: deliveryColors.text,
    textAlign: 'center',
  },
});
