import type { BottomTabBarButtonProps } from "expo-router/build/react-navigation/bottom-tabs";
import { PlatformPressable } from "expo-router/build/react-navigation/elements";
import * as Haptics from "expo-haptics";

export function HapticTab(props: BottomTabBarButtonProps) {
  const { pressColor, ...buttonProps } = props;

  return (
    <PlatformPressable
      {...buttonProps}
      pressColor={typeof pressColor === "string" ? pressColor : undefined}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === "ios") {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
