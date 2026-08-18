import { type ScrollViewProps, SafeAreaView, ScrollView, View, type ViewStyle, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

import { deliveryColors, deliverySpacing } from '@/constants/deliveryTheme';

type AppShellProps = {
  header?: ReactNode;
  bottomNavigation?: ReactNode;
  children: ReactNode;
  contentContainerStyle?: ViewStyle;
};

export function AppShell({ header, bottomNavigation, children, contentContainerStyle }: AppShellProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {header}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {bottomNavigation}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: deliveryColors.background,
  },
  container: {
    flex: 1,
    backgroundColor: deliveryColors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: deliverySpacing.lg,
    paddingTop: deliverySpacing.lg,
    paddingBottom: deliverySpacing.lg,
  },
});
