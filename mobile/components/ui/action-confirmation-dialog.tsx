import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

type DialogTone = "primary" | "danger";
type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

type ActionConfirmationDialogProps = {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  icon?: IconName;
  tone?: DialogTone;
  isConfirming?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ActionConfirmationDialog({
  visible,
  title,
  description,
  confirmLabel,
  icon = "warning-amber",
  tone = "danger",
  isConfirming = false,
  onClose,
  onConfirm,
}: ActionConfirmationDialogProps) {
  const isDanger = tone === "danger";
  const accent = isDanger ? "#BA1A1A" : "#0060B8";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isConfirming ? undefined : onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="إغلاق نافذة التأكيد"
          disabled={isConfirming}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={styles.dialog}>
          <View
            style={[
              styles.iconWrap,
              isDanger ? styles.iconWrapDanger : styles.iconWrapPrimary,
            ]}
          >
            <MaterialIcons name={icon} size={26} color={accent} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={isConfirming}
              onPress={onClose}
              style={({ pressed }) => [
                styles.cancelButton,
                isConfirming && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.cancelText}>تراجع</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isConfirming}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirmButton,
                isDanger ? styles.confirmDanger : styles.confirmPrimary,
                isConfirming && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              {isConfirming ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <MaterialIcons name={icon} size={17} color="#FFFFFF" />
              )}
              <Text style={styles.confirmText}>
                {isConfirming ? "جارٍ التنفيذ..." : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(18, 42, 62, 0.5)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D8E7F2",
    borderRadius: 24,
    borderWidth: 1,
    maxWidth: 380,
    padding: 22,
    shadowColor: "#173B54",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    width: "100%",
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: 18,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  iconWrapDanger: { backgroundColor: "#FFF0F1" },
  iconWrapPrimary: { backgroundColor: "#EAF5FF" },
  title: {
    color: "#173B54",
    fontFamily: "Cairo_700Bold",
    fontSize: 17,
    marginTop: 13,
    textAlign: "center",
    writingDirection: "rtl",
  },
  description: {
    color: "#607B90",
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    lineHeight: 21,
    marginTop: 7,
    textAlign: "center",
    writingDirection: "rtl",
  },
  actions: {
    flexDirection: "row-reverse",
    gap: 10,
    marginTop: 20,
    width: "100%",
  },
  cancelButton: {
    alignItems: "center",
    borderColor: "#CEDFEB",
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  cancelText: {
    color: "#416176",
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
  },
  confirmButton: {
    alignItems: "center",
    borderRadius: 13,
    flex: 1.25,
    flexDirection: "row-reverse",
    gap: 7,
    justifyContent: "center",
    minHeight: 44,
  },
  confirmDanger: { backgroundColor: "#BA1A1A" },
  confirmPrimary: { backgroundColor: "#0060B8" },
  confirmText: {
    color: "#FFFFFF",
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
  },
  disabled: { opacity: 0.58 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
