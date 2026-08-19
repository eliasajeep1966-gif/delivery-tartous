import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { AppHeader } from '@/components/layout/AppHeader';
import { AppShell } from '@/components/layout/AppShell';
import { RoleBottomNavigation } from '@/components/layout/RoleBottomNavigation';
import { AvailableCaptainsRow } from '@/components/management/AvailableCaptainsRow';
import { MetricCard } from '@/components/ui/MetricCard';
import { OrderSummaryCard } from '@/components/ui/OrderSummaryCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { deliveryColors, deliveryRadius, deliverySpacing } from '@/constants/deliveryTheme';
import {
  getManagementDashboard,
  managementDashboardRole,
} from '@/data/mock/managementDashboard';

const disabledTabs = ['orders', 'captains', 'salaries', 'more'];
const dashboard = getManagementDashboard(managementDashboardRole);

export default function HomeScreen() {
  return (
    <AppShell
      header={<AppHeader roleLabel={dashboard.roleLabel} showNotifications />}
      bottomNavigation={
        <RoleBottomNavigation
          role={dashboard.role}
          activeTab="home"
          disabledTabs={disabledTabs}
        />
      }
    >
      <View style={styles.greeting}>
        <Text style={styles.greetingTitle}>مرحباً، {dashboard.roleLabel}</Text>
        <Text style={styles.greetingSubtitle}>إليك ملخص حركة الطلبات اليوم</Text>
      </View>

      <Pressable
        disabled
        accessibilityState={{ disabled: true }}
        style={[styles.createOrderButton, styles.createOrderButtonDisabled]}
      >
        <View style={styles.createOrderContent}>
          <View style={styles.createOrderIcon}>
            <SymbolView name="plus" size={22} tintColor={deliveryColors.surface} />
          </View>
          <View style={styles.createOrderText}>
            <Text style={styles.createOrderTitle}>إنشاء طلب جديد</Text>
            <Text style={styles.createOrderSubtitle}>ستتوفر هذه الميزة قريباً</Text>
          </View>
        </View>
        <SymbolView name="chevron.left" size={18} tintColor={deliveryColors.surface} />
      </Pressable>

      <View style={styles.metricsGrid}>
        <View style={styles.metricSlot}>
          <MetricCard
            icon={<SymbolView name="person.crop.circle.badge.checkmark" size={28} tintColor="#0060B8" />}
            label="بانتظار استلام الكابتن"
            value={dashboard.metrics.awaitingCaptainAcceptance}
            tone="primary"
          />
        </View>
        <View style={styles.metricSlot}>
          <MetricCard
            icon={<SymbolView name="bicycle" size={28} tintColor="#16A34A" />}
            label="قيد التوصيل"
            value={dashboard.metrics.inDelivery}
            tone="success"
          />
        </View>
        <View style={styles.metricSlot}>
          <MetricCard
            icon={<SymbolView name="checkmark.circle" size={28} tintColor="#0060B8" />}
            label="تم التوصيل اليوم"
            value={dashboard.metrics.completed}
            tone="primary"
          />
        </View>
        <View style={styles.metricSlot}>
          <MetricCard
            icon={<SymbolView name="xmark.circle" size={28} tintColor="#DC2626" />}
            label="طلبات ملغاة"
            value={dashboard.metrics.cancelled}
            tone="danger"
          />
        </View>
      </View>

      <SectionHeader title="أحدث الطلبات" />
      <View style={styles.ordersList}>
        {dashboard.orders.slice(0, 3).map((order) => (
          <OrderSummaryCard key={order.id} order={order} />
        ))}
      </View>

      <SectionHeader title="الكباتن المتاحون" />
      <View style={styles.captainsSection}>
        <AvailableCaptainsRow captains={dashboard.captains} />
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  greeting: {
    alignItems: 'flex-end',
    gap: deliverySpacing.xs,
  },
  greetingTitle: {
    color: deliveryColors.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'right',
  },
  greetingSubtitle: {
    color: deliveryColors.muted,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
  },
  createOrderButton: {
    marginTop: deliverySpacing.xl,
    marginBottom: deliverySpacing.md,
    minHeight: 84,
    borderRadius: deliveryRadius.lg,
    backgroundColor: deliveryColors.primary,
    paddingHorizontal: deliverySpacing.lg,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  createOrderButtonDisabled: {
    opacity: 0.58,
  },
  createOrderContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: deliverySpacing.md,
  },
  createOrderIcon: {
    width: 42,
    height: 42,
    borderRadius: deliveryRadius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createOrderText: {
    alignItems: 'flex-end',
    gap: 2,
  },
  createOrderTitle: {
    color: deliveryColors.surface,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'right',
  },
  createOrderSubtitle: {
    color: '#D9ECFF',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
  },
  metricsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: deliverySpacing.md,
  },
  metricSlot: {
    width: '48%',
  },
  ordersList: {
    gap: deliverySpacing.md,
  },
  captainsSection: {
    marginHorizontal: -deliverySpacing.lg,
    marginBottom: deliverySpacing.lg,
  },
});
