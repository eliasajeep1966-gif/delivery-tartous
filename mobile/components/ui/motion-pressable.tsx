import * as Haptics from "expo-haptics";
import {
  type ComponentProps,
  type PropsWithChildren,
  useCallback,
} from "react";
import {
  Platform,
  Pressable,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  withTiming,
} from "react-native-reanimated";

type PressableProps = ComponentProps<typeof Pressable>;
type HapticTone = "light" | "medium" | "none";

type MotionPressableProps = PropsWithChildren<
  Omit<PressableProps, "onPress" | "onPressIn" | "onPressOut" | "style">
> & {
  onPress?: PressableProps["onPress"];
  onPressIn?: PressableProps["onPressIn"];
  onPressOut?: PressableProps["onPressOut"];
  style?: PressableProps["style"];
  haptic?: HapticTone;
  pressedScale?: number;
  pressedOpacity?: number;
};

/**
 * Reusable press feedback for operating controls. It keeps interaction on the
 * UI thread and triggers native haptics only on real devices.
 */
export function MotionPressable({
  children,
  disabled = false,
  haptic = "light",
  onPress,
  onPressIn,
  onPressOut,
  pressedScale = 0.97,
  pressedOpacity = 0.92,
  style,
  ...props
}: MotionPressableProps) {
  const pressProgress = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressProgress.value, [0, 1], [1, pressedOpacity]),
    transform: [
      { translateY: interpolate(pressProgress.value, [0, 1], [0, 1]) },
      { scale: interpolate(pressProgress.value, [0, 1], [1, pressedScale]) },
    ],
  }));

  const handlePressIn: NonNullable<PressableProps["onPressIn"]> = useCallback(
    (event) => {
      if (!disabled) pressProgress.set(withTiming(1, { duration: 75 }));
      onPressIn?.(event);
    },
    [disabled, onPressIn, pressProgress],
  );

  const handlePressOut: NonNullable<PressableProps["onPressOut"]> = useCallback(
    (event) => {
      pressProgress.set(withTiming(0, { duration: 145 }));
      onPressOut?.(event);
    },
    [onPressOut, pressProgress],
  );

  const handlePress: NonNullable<PressableProps["onPress"]> = useCallback(
    (event) => {
      if (Platform.OS !== "web" && haptic !== "none") {
        void Haptics.impactAsync(
          haptic === "medium"
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light,
        );
      }
      onPress?.(event);
    },
    [haptic, onPress],
  );

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        {...props}
        disabled={disabled}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
