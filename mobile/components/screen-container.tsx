import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View, type ViewProps } from "react-native";
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
 * Shared safe-area screen wrapper. The screen backdrop uses a quiet white-to-cyan
 * gradient while each operational screen keeps its existing content and routing.
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
      className={cn("flex-1", containerClassName)}
      style={styles.transparentLayer}
      {...props}
    >
      <LinearGradient
        pointerEvents="none"
        colors={["#FAFCFE", "#F5FAFC", "#E1F5F9", "#9CDAE8"]}
        locations={[0, 0.48, 0.79, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView
        edges={edges}
        className={cn("flex-1", safeAreaClassName)}
        style={style}
      >
        <View className={cn("flex-1", className)} style={styles.transparentLayer}>
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  transparentLayer: { backgroundColor: "transparent" },
});
