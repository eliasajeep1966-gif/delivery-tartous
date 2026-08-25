import * as Haptics from "expo-haptics";
import {
  type ComponentProps,
  type PropsWithChildren,
  useCallback,
} from "react";
import {
  Platform,
  Pressable,
  type PressableStateCallbackType,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
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
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  style,
  ...props
}: MotionPressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn: NonNullable<PressableProps["onPressIn"]> = useCallback(
    (event) => {
      if (!disabled) scale.set(withTiming(pressedScale, { duration: 85 }));
      onPressIn?.(event);
    },
    [disabled, onPressIn, pressedScale, scale],
  );

  const handlePressOut: NonNullable<PressableProps["onPressOut"]> = useCallback(
    (event) => {
      scale.set(withTiming(1, { duration: 130 }));
      onPressOut?.(event);
    },
    [onPressOut, scale],
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
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={(state: PressableStateCallbackType) => [
        typeof style === "function" ? style(state) : style,
        animatedStyle,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}
