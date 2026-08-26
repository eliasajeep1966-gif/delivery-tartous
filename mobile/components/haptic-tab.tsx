import type { BottomTabBarButtonProps } from "expo-router/build/react-navigation/bottom-tabs";
import { PlatformPressable } from "expo-router/build/react-navigation/elements";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { Platform } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export function HapticTab(props: BottomTabBarButtonProps) {
  const { pressColor, ...buttonProps } = props;
  const selected = props.accessibilityState?.selected === true;
  const selectionProgress = useSharedValue(selected ? 1 : 0);
  const pressProgress = useSharedValue(0);

  useEffect(() => {
    selectionProgress.set(
      withSpring(selected ? 1 : 0, { damping: 16, stiffness: 220 }),
    );
  }, [selected, selectionProgress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(selectionProgress.value, [0, 1], [0.78, 1]),
    transform: [
      {
        translateY: interpolate(
          selectionProgress.value,
          [0, 1],
          [0, -2],
        ),
      },
      {
        scale: interpolate(
          pressProgress.value,
          [0, 1],
          [1, 0.93],
        ),
      },
    ],
  }));

  return (
    <Animated.View style={[{ flex: 1 }, animatedStyle]}>
      <PlatformPressable
        {...buttonProps}
        pressColor={typeof pressColor === "string" ? pressColor : undefined}
        onPressIn={(event) => {
          pressProgress.set(withTiming(1, { duration: 65 }));
          if (!props.disabled && Platform.OS !== "web") {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          props.onPressIn?.(event);
        }}
        onPressOut={(event) => {
          pressProgress.set(withTiming(0, { duration: 130 }));
          props.onPressOut?.(event);
        }}
      />
    </Animated.View>
  );
}
