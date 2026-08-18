import { Text, View, type ViewStyle, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

import { deliverySpacing } from '@/constants/deliveryTheme';

type CaptainDaySummaryProps = {
  deliveredCount: number;
  earnings: number;
  falseOrdersCount: number;
};

export function CaptainDaySummary({ deliveredCount, earnings, falseOrdersCount }: CaptainDaySummaryProps) {
  const metricIcon = (label: string): ReactNode => <Text style={styles.metricIcon}>{label}</Text>;

  return (
    <View style={styles.row}>
      <View style={styles.metric}>
        <View style={styles.iconBox}>{metricIcon('✅')}</View>
        <Text style={styles.metricValue}>{deliveredCount}</Text>
        <Text style={styles.metricLabel}>تم التوصيل</Text>
      </View>
      <View style={styles.metric}>
        <View style={styles.iconBox}>{metricIcon('💰')}</View>
        <Text style={styles.metricValue}>{earnings.toLocaleString('ar-SY')}</Text>
        <Text style={styles.metricLabel}>أرباحي المستحقة</Text>
      </View>
      <View style={styles.metric}>
        <View style={styles.iconBox}>{metricIcon('⚠️')}</View>
        <Text style={styles.metricValue}>{falseOrdersCount}</Text>
        <Text style={styles.metricLabel}>طلبات كاذبة</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: deliverySpacing.md,
  },
  metric: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
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
  metricIcon: {
    fontSize: 22,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#14213D',
    textAlign: 'center',
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
  },
});
