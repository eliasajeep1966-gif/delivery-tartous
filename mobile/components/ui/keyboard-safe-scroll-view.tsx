import { forwardRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type KeyboardSafeScrollViewProps = ScrollViewProps & {
  /** Additional space after the last item, beyond the device safe area. */
  bottomSpacing?: number;
  /** Offset for a persistent header outside this component. */
  keyboardVerticalOffset?: number;
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * Scroll wrapper for editable mobile screens. It keeps the focused input and
 * the final action reachable above Android/iOS keyboards without changing the
 * visual structure of the hosted screen.
 */
export const KeyboardSafeScrollView = forwardRef<
  ScrollView,
  KeyboardSafeScrollViewProps
>(function KeyboardSafeScrollView(
  {
    bottomSpacing = 24,
    keyboardVerticalOffset = 0,
    containerStyle,
    contentContainerStyle,
    keyboardDismissMode,
    keyboardShouldPersistTaps = "handled",
    showsVerticalScrollIndicator = false,
    ...props
  },
  ref,
) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={[styles.flex, containerStyle]}
    >
      <ScrollView
        {...props}
        ref={ref}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        contentContainerStyle={[
          contentContainerStyle,
          { paddingBottom: Math.max(insets.bottom, 16) + bottomSpacing },
        ]}
        keyboardDismissMode={
          keyboardDismissMode ??
          (Platform.OS === "ios" ? "interactive" : "on-drag")
        }
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      />
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
