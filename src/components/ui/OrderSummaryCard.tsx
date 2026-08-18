import { Pressable, Text, View, type ViewStyle, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

import { DeliveryOrder, OrderStatus } from '@/types';
import { deliveryColors, deliveryRadius, deliveryShadows, deliverySpacing } from '@/constants/deliveryTheme';

type OrderSummaryCardProps = {
  order: DeliveryOrder;
  onPress?: () => void;
};

const statusConfig: Record<
  OrderStatus,
  { label: string; bg: string; text: string }
> = {
  pending: { label: 'بانتظار استلام الكابتن', bg: '#FFF7E6', text: deliveryColors.warning },
  assigned: { label: 'بانتظار استلام الكابتن', bg: '#FFF7E6', text: deliveryColors.warning },
  received: { label: 'تم الاستلام', bg: '#EAF4FC', text: deliveryColors.primary },
  in_delivery: { label: 'قيد التوصيل', bg: '#E6F7EC', text: deliveryColors.success },
  completed: { label: 'تم التوصيل', bg: '#E6F7EC', text: deliveryColors.success },
  cancelled: { label: 'ملغى', bg: '#FEECEC', text: deliveryColors.danger },
  false_order: { label: 'طلب كاذب', bg: '#FEECEC', text: deliveryColors.danger },
};

export function OrderSummaryCard({ order, onPress }: OrderSummaryCardProps) {
  const status = statusConfig[order.status];

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]} disabled={!onPress}>
      <View style={styles.row}>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
        <View style={[styles.badge, { backgroundColor: status.bg }]}>
          <Text style={[styles.badgeText, { color: status.text }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.customer}>{order.customerName}</Text>
        <Text style={styles.address} numberOfLines={1}>
          {order.deliveryAddress}
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.fee}>{order.fee.toLocaleString('ar-SY')} ل.س</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: deliveryColors.surface,
    borderRadius: deliveryRadius.lg,
    padding: deliverySpacing.lg,
    gap: deliverySpacing.sm,
    ...deliveryShadows.sm,
  },
  pressed: {
    opacity: 0.92,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: deliveryColors.muted,
    textAlign: 'right',
  },
  badge: {
    paddingHorizontal: deliverySpacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    gap: 4,
  },
  customer: {
    fontSize: 16,
    fontWeight: '700',
    color: deliveryColors.text,
    textAlign: 'right',
  },
  address: {
    fontSize: 14,
    fontWeight: '500',
    color: deliveryColors.muted,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  fee: {
    fontSize: 16,
    fontWeight: '700',
    color: deliveryColors.primary,
    textAlign: 'left',
  },
});
