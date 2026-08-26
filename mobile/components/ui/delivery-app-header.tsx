import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import { type ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";

import { MotionPressable } from "@/components/ui/motion-pressable";

type IconName = ComponentProps<typeof MaterialIcons>["name"];

type HeaderAction = {
  accessibilityLabel: string;
  badge?: boolean;
  icon: IconName;
  onPress?: () => void;
};

type DeliveryAppHeaderProps = {
  leadingAction?: HeaderAction;
  trailingAction?: HeaderAction;
};

function HeaderActionButton({ action }: { action?: HeaderAction }) {
  if (!action) return <View style={styles.actionPlaceholder} />;

  const content = (
    <View style={styles.actionContent}>
      <MaterialIcons name={action.icon} size={21} color="#0878D1" />
      {action.badge ? <View style={styles.notificationDot} /> : null}
    </View>
  );

  if (!action.onPress) {
    return <View style={styles.actionButton}>{content}</View>;
  }

  return (
    <MotionPressable
      onPress={action.onPress}
      style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
      accessibilityLabel={action.accessibilityLabel}
    >
      {content}
    </MotionPressable>
  );
}

/** Shared glass header for operational screens. It preserves each screen's actions. */
export function DeliveryAppHeader({
  leadingAction,
  trailingAction,
}: DeliveryAppHeaderProps) {
  return (
    <LinearGradient
      colors={[
        "rgba(250,253,255,0.96)",
        "rgba(219,248,253,0.97)",
        "rgba(150,226,239,0.98)",
      ]}
      locations={[0, 0.52, 1]}
      style={styles.shell}
    >
      <View style={styles.content}>
        <HeaderActionButton action={leadingAction} />
        <View pointerEvents="none" style={styles.brand}>
          <Text allowFontScaling={false} style={styles.brandName}>
            Delivery Tartous
          </Text>
        </View>
        <HeaderActionButton action={trailingAction} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderBottomColor: "rgba(81,181,207,0.32)",
    borderBottomWidth: 1,
    shadowColor: "#0B6E8E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    overflow: "visible",
  },
  content: {
    alignItems: "center",
    flexDirection: "row-reverse",
    height: 60,
    justifyContent: "space-between",
    overflow: "visible",
    paddingHorizontal: 16,
    position: "relative",
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.88)",
    borderColor: "rgba(81,181,207,0.32)",
    borderRadius: 17,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  actionContent: { alignItems: "center", justifyContent: "center", position: "relative" },
  actionPlaceholder: { height: 34, width: 34 },
  actionPressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  brand: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 34,
    overflow: "visible",
    position: "absolute",
    right: 34,
    top: 0,
  },
  brandName: {
    color: "#063B78",
    fontFamily: "Parisienne_400Regular",
    fontSize: 20,
    lineHeight: 36,
    paddingHorizontal: 2,
    paddingVertical: 5,
    textAlign: "center",
    width: "100%",
  },
  notificationDot: {
    backgroundColor: "#15C8FF",
    borderColor: "#E6F9FC",
    borderRadius: 5,
    borderWidth: 2,
    height: 10,
    position: "absolute",
    right: -7,
    top: -6,
    width: 10,
  },
});
