import { SymbolView } from 'expo-symbols';
import { ScrollView, Text, View, type ViewStyle, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

import { CaptainProfile } from '@/types';
import { deliveryColors, deliveryRadius, deliveryShadows, deliverySpacing } from '@/constants/deliveryTheme';

type AvailableCaptainsRowProps = {
  captains: CaptainProfile[];
};

export function AvailableCaptainsRow({ captains }: AvailableCaptainsRowProps) {
  const available = captains.filter((c) => c.availability === 'available');

  if (available.length === 0) return null;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {available.map((captain) => {
          const initial = captain.name.trim().charAt(0);
          return (
            <View key={captain.userId} style={[styles.card, deliveryShadows.sm]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
                <View style={styles.dot} />
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {captain.name}
              </Text>
              <Text style={styles.status}>متاح</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexDirection: 'row-reverse',
    gap: deliverySpacing.md,
    paddingHorizontal: deliverySpacing.lg,
  },
  card: {
    width: 120,
    backgroundColor: deliveryColors.surface,
    borderRadius: deliveryRadius.lg,
    padding: deliverySpacing.md,
    alignItems: 'center',
    gap: deliverySpacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: deliveryRadius.full,
    backgroundColor: deliveryColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: deliveryColors.primary,
    textAlign: 'center',
  },
  dot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: deliveryColors.success,
    borderWidth: 2,
    borderColor: deliveryColors.surface,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: deliveryColors.text,
    textAlign: 'center',
  },
  status: {
    fontSize: 12,
    fontWeight: '500',
    color: deliveryColors.success,
    textAlign: 'center',
  },
});
