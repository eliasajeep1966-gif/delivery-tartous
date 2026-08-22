import type { ReactNode } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { deliveryColors, deliverySpacing } from '@/constants/deliveryTheme';
import { RoleBottomNavigation } from './RoleBottomNavigation';

type WorkspaceRole = 'admin' | 'supervisor' | 'captain';

type RoleWorkspaceProps = {
  role: WorkspaceRole;
  activeTab: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onTabPress: (tab: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
};

/**
 * Application shell shared by every authenticated role.
 * It deliberately contains no data or role-specific business actions: screens keep
 * using deliverySupabase and the same access controls already enforced by the backend.
 */
export function RoleWorkspace({
  role,
  activeTab,
  title,
  subtitle,
  children,
  onTabPress,
  onRefresh,
  isRefreshing = false,
}: RoleWorkspaceProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {onRefresh ? (
          <Pressable
            accessibilityLabel="تحديث البيانات"
            accessibilityRole="button"
            disabled={isRefreshing}
            onPress={onRefresh}
            style={[styles.refreshButton, isRefreshing && styles.refreshButtonDisabled]}
          >
            <Text style={styles.refreshText}>{isRefreshing ? 'جارٍ التحديث' : 'تحديث'}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.content}>{children}</View>

      <RoleBottomNavigation role={role} activeTab={activeTab} onTabPress={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: deliveryColors.background,
  },
  header: {
    minHeight: 72,
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    backgroundColor: deliveryColors.surface,
    borderBottomColor: '#E5EDF4',
    borderBottomWidth: 1,
    paddingHorizontal: deliverySpacing.lg,
    paddingVertical: deliverySpacing.md,
  },
  headerText: {
    flex: 1,
    alignItems: 'flex-end',
  },
  title: {
    color: deliveryColors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
  },
  subtitle: {
    color: deliveryColors.muted,
    fontSize: 12,
    marginTop: 3,
    textAlign: 'right',
  },
  refreshButton: {
    alignItems: 'center',
    borderColor: '#CFE4F2',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    marginLeft: deliverySpacing.md,
    minHeight: 36,
    paddingHorizontal: deliverySpacing.md,
  },
  refreshButtonDisabled: {
    opacity: 0.55,
  },
  refreshText: {
    color: deliveryColors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
});
