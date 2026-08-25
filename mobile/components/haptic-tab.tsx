import type { BottomTabBarButtonProps } from "expo-router/build/react-navigation/bottom-tabs";
import { PlatformPressable } from "expo-router/build/react-navigation/elements";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export function HapticTab(props: BottomTabBarButtonProps) {
  const { pressColor, ...buttonProps } = props;

  return (
    <PlatformPressable
      {...buttonProps}
      pressColor={typeof pressColor === "string" ? pressColor : undefined}
      onPressIn={(event) => {
        if (Platform.OS !== "web") {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(event);
      }}
    />
  );
}
