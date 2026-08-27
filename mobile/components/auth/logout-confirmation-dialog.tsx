import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

type LogoutConfirmationDialogProps = {
  visible: boolean;
  isSigningOut: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function LogoutConfirmationDialog({
  visible,
  isSigningOut,
  onClose,
  onConfirm,
}: LogoutConfirmationDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isSigningOut ? undefined : onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="إغلاق تأكيد تسجيل الخروج"
          disabled={isSigningOut}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={styles.dialog}>
          <View style={styles.iconWrap}>
            <MaterialIcons name="logout" size={25} color="#BA1A1A" />
          </View>
          <Text style={styles.title}>تأكيد تسجيل الخروج</Text>
          <Text style={styles.description}>
            سيتم تسجيل خروجك من هذا الجهاز فقط. يمكنك الدخول مجدداً في أي وقت باستخدام بيانات حسابك.
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={isSigningOut}
              onPress={onClose}
              style={({ pressed }) => [
                styles.cancelButton,
                isSigningOut && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.cancelText}>تراجع</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isSigningOut}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirmButton,
                isSigningOut && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              {isSigningOut ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <MaterialIcons name="logout" size={17} color="#FFFFFF" />
              )}
              <Text style={styles.confirmText}>
                {isSigningOut ? "جارٍ الخروج..." : "تسجيل الخروج"}
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
    borderColor: "#F2D6D8",
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
    backgroundColor: "#FFF0F1",
    borderRadius: 18,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
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
    backgroundColor: "#BA1A1A",
    borderRadius: 13,
    flex: 1.25,
    flexDirection: "row-reverse",
    gap: 7,
    justifyContent: "center",
    minHeight: 44,
  },
  confirmText: {
    color: "#FFFFFF",
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
  },
  disabled: { opacity: 0.58 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
