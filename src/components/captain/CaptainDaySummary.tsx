import { SymbolView } from 'expo-symbols';
import { Text, View, type ViewStyle, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

import { deliveryColors, deliveryRadius, deliverySpacing } from '@/constants/deliveryTheme';

type CaptainDaySummaryProps = {
  deliveredCount: number;
  earnings: number;
  falseOrdersCount: number;
};

export function CaptainDaySummary({ deliveredCount, earnings, falseOrdersCount }: CaptainDaySummaryProps) {
  return (
    <View style={styles.row}>
      <View style={styles.metric}>
        <View style={styles.iconBox}>
          <SymbolView name="checkmark.circle" size={28} tintColor={deliveryColors.success} />
        </View>
        <Text style={styles.metricValue}>{deliveredCount}</Text>
        <Text style={styles.metricLabel}>تم التوصيل</Text>
      </View>
      <View style={styles.metric}>
        <View style={styles.iconBox}>
          <SymbolView name="banknote" size={28} tintColor={deliveryColors.primary} />
        </View>
        <Text style={styles.metricValue}>{earnings.toLocaleString('ar-SY')}</Text>
        <Text style={styles.metricLabel}>أرباحي المستحقة</Text>
      </View>
      <View style={styles.metric}>
        <View style={styles.iconBox}>
          <SymbolView name="exclamationmark.triangle" size={28} tintColor={deliveryColors.warning} />
        </View>
        <Text style={styles.metricValue}>{falseOrdersCount}</Text>
        <Text style={styles.metricLabel}>طلبات كاذبة</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    gap: deliverySpacing.md,
  },
  metric: {
    flex: 1,
    backgroundColor: deliveryColors.surface,
    borderRadius: deliveryRadius.lg,
    padding: deliverySpacing.lg,
    alignItems: 'center',
    gap: deliverySpacing.sm,
  },
  iconBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: deliveryColors.text,
    textAlign: 'center',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: deliveryColors.muted,
    textAlign: 'center',
  },
});
