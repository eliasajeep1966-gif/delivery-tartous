import { StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { AppHeader } from '@/components/layout/AppHeader';
import { AppShell } from '@/components/layout/AppShell';
import { RoleBottomNavigation } from '@/components/layout/RoleBottomNavigation';
import { AvailableCaptainsRow } from '@/components/management/AvailableCaptainsRow';
import { MetricCard } from '@/components/ui/MetricCard';
import { OrderSummaryCard } from '@/components/ui/OrderSummaryCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { deliverySpacing } from '@/constants/deliveryTheme';
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
            label="طلبات مغلقة"
            value={dashboard.metrics.closed}
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
