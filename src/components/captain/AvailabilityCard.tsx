import { Pressable, Text, View, type ViewStyle, StyleSheet } from 'react-native';
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
      <Pressable
        onPress={onToggle}
        style={[styles.button, isAvailable ? styles.buttonOff : styles.buttonOn]}
      >
        <Text style={styles.buttonText}>{isAvailable ? 'إيقاف التوفر' : 'تفعيل التوفر'}</Text>
      </Pressable>
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
  button: {
    width: '100%',
    paddingVertical: deliverySpacing.md,
    borderRadius: deliveryRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOn: {
    backgroundColor: deliveryColors.primary,
  },
  buttonOff: {
    backgroundColor: deliveryColors.muted,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: deliveryColors.surface,
    textAlign: 'center',
  },
});
