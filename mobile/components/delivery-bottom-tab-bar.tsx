import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ACTIVE = "#0878D1";
const MUTED = "#7890A2";

export function DeliveryBottomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 8);
  const visibleRoutes = state.routes.filter((route) => {
    const options = descriptors[route.key].options as typeof descriptors[string]["options"] & {
      href?: unknown;
    };
    return options.href !== null;
  });

  return (
    <View style={[styles.bar, { paddingBottom: bottomPadding }]}>
      <View pointerEvents="none" style={styles.neonLine} />
      <View style={styles.items}>
        {visibleRoutes.map((route) => {
          const routeIndex = state.routes.findIndex((item) => item.key === route.key);
          const descriptor = descriptors[route.key];
          const { options } = descriptor;
          const focused = state.index === routeIndex;
          const color = focused ? ACTIVE : MUTED;
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : options.title ?? route.name;
          const icon =
            typeof options.tabBarIcon === "function"
              ? options.tabBarIcon({ focused, color, size: 22 })
              : null;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              void Haptics.selectionAsync();
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onLongPress={() =>
                navigation.emit({ type: "tabLongPress", target: route.key })
              }
              onPress={onPress}
              style={({ pressed }) => [
                styles.item,
                pressed && styles.itemPressed,
              ]}
            >
              {focused ? <View pointerEvents="none" style={styles.activeRail} /> : null}
              <View style={styles.iconWrap}>{icon}</View>
              <Text
                numberOfLines={1}
                style={[styles.label, focused && styles.labelActive]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "#FFFFFF",
    borderTopColor: "rgba(22,206,255,0.28)",
    borderTopWidth: 1,
    paddingTop: 7,
    shadowColor: "#0A3658",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  neonLine: {
    backgroundColor: "rgba(22,206,255,0.8)",
    height: 1,
    left: 22,
    position: "absolute",
    right: 22,
    top: -1,
  },
  items: { flexDirection: "row-reverse", minHeight: 50 },
  item: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
    paddingHorizontal: 2,
    paddingVertical: 2,
    position: "relative",
  },
  itemPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  activeRail: {
    backgroundColor: "#16CEFF",
    borderRadius: 2,
    height: 2,
    position: "absolute",
    top: 0,
    width: 22,
  },
  iconWrap: { height: 25, justifyContent: "center" },
  label: {
    color: MUTED,
    fontFamily: "Cairo_700Bold",
    fontSize: 8.5,
    marginTop: 1,
    textAlign: "center",
    writingDirection: "rtl",
  },
  labelActive: { color: ACTIVE },
});
