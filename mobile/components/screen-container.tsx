import { StyleSheet, View, type ViewProps } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { cn } from "@/lib/utils";

export interface ScreenContainerProps extends ViewProps {
  /** Safe-area edges; bottom is normally owned by the tab bar. */
  edges?: Edge[];
  /** NativeWind classes for the screen content. */
  className?: string;
  /** NativeWind classes for the outer background layer. */
  containerClassName?: string;
  /** NativeWind classes for the safe-area layer. */
  safeAreaClassName?: string;
}

/**
 * Shared safe-area screen wrapper. The content fade is intentionally short so
 * route transitions feel continuous without delaying operational screens.
 */
export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  className,
  containerClassName,
  safeAreaClassName,
  style,
  ...props
}: ScreenContainerProps) {
  return (
    <View
      className={cn("flex-1", "bg-background", containerClassName)}
      {...props}
    >
      <SafeAreaView
        edges={edges}
        className={cn("flex-1", safeAreaClassName)}
        style={style}
      >
        <Animated.View entering={FadeIn.duration(180)} style={styles.content}>
          <View className={cn("flex-1", className)}>{children}</View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
});
