import { Pressable, Text, View, type ViewStyle, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

import { DeliveryOrder } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { deliveryColors, deliveryRadius, deliveryShadows, deliverySpacing } from '@/constants/deliveryTheme';

type CurrentOrderCardProps = {
  order: DeliveryOrder | null;
  onReceive?: () => void;
  onStartDelivery?: () => void;
  onComplete?: () => void;
  onDetails?: () => void;
};

export function CurrentOrderCard({
  order,
  onReceive,
  onStartDelivery,
  onComplete,
  onDetails,
}: CurrentOrderCardProps) {
  if (!order) {
    return (
      <View style={styles.card}>
        <EmptyState
          icon={<Text style={styles.emptyIcon}>📦</Text>}
          title="لا يوجد لديك طلبات حالياً"
          description="سيظهر هنا الطلب المعين لك عندما يتوفر"
        />
      </View>
    );
  }

  const renderActions = (): ReactNode => {
    if (order.status === 'assigned') {
      return (
        <Pressable onPress={onReceive} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>استلام الطلب</Text>
        </Pressable>
      );
    }
    if (order.status === 'received') {
      return (
        <Pressable onPress={onStartDelivery} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>بدء التوصيل</Text>
        </Pressable>
      );
    }
    if (order.status === 'in_delivery') {
      return (
        <Pressable onPress={onComplete} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>تم التوصيل</Text>
        </Pressable>
      );
    }
    return null;
  };

  return (
    <View style={[styles.card, deliveryShadows.sm]}>
      <View style={styles.row}>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
        <Text style={styles.customer}>{order.customerName}</Text>
      </View>

      <Text style={styles.address} numberOfLines={1}>
        {order.deliveryAddress}
      </Text>

      <View style={styles.footer}>
        <Text style={styles.fee}>{order.fee.toLocaleString('ar-SY')} ل.س</Text>
        {onDetails && (
          <Pressable onPress={onDetails}>
            <Text style={styles.detailsText}>التفاصيل</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.actions}>{renderActions()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: deliveryRadius.lg,
    padding: deliverySpacing.lg,
    gap: deliverySpacing.sm,
  },
  emptyIcon: {
    fontSize: 48,
    textAlign: 'center',
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
  customer: {
    fontSize: 16,
    fontWeight: '700',
    color: deliveryColors.text,
    textAlign: 'left',
  },
  address: {
    fontSize: 14,
    fontWeight: '500',
    color: deliveryColors.muted,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: deliverySpacing.sm,
  },
  fee: {
    fontSize: 18,
    fontWeight: '700',
    color: deliveryColors.primary,
    textAlign: 'right',
  },
  detailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: deliveryColors.primary,
    textAlign: 'left',
  },
  actions: {
    marginTop: deliverySpacing.md,
  },
  primaryButton: {
    backgroundColor: deliveryColors.primary,
    paddingVertical: deliverySpacing.md,
    borderRadius: deliveryRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: deliveryColors.surface,
    textAlign: 'center',
  },
});
