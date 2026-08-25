import { CheckCircle2, XCircle } from "lucide-react-native";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ToastTone = "success" | "error";
type ToastInput = Readonly<{
  message: string;
  tone?: ToastTone;
  durationMs?: number;
}>;
type ToastItem = ToastInput & Readonly<{ id: number }>;
type AppToastContextValue = Readonly<{
  showToast: (input: ToastInput) => void;
}>;

const AppToastContext = createContext<AppToastContextValue | null>(null);

export function AppToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const nextId = useRef(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const insets = useSafeAreaInsets();

  const showToast = useCallback((input: ToastInput) => {
    const message = input.message.trim();
    if (!message) return;
    setToast({
      id: ++nextId.current,
      message,
      tone: input.tone ?? "success",
      durationMs: input.durationMs ?? 2_200,
    });
  }, []);

  useEffect(() => {
    if (!toast) return;

    opacity.setValue(0);
    translateY.setValue(18);
    const entrance = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
    ]);
    entrance.start();

    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 160,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(translateY, {
          toValue: 12,
          duration: 160,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start(({ finished }) => {
        if (finished) setToast((current) => (current?.id === toast.id ? null : current));
      });
    }, toast.durationMs);

    return () => {
      entrance.stop();
      clearTimeout(timeout);
    };
  }, [opacity, toast, translateY]);

  const isError = toast?.tone === "error";
  const Icon = isError ? XCircle : CheckCircle2;

  return (
    <AppToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.position,
            { bottom: Math.max(insets.bottom, 12) + 72, opacity, transform: [{ translateY }] },
          ]}
        >
          <View style={[styles.toast, isError ? styles.error : styles.success]}>
            <Icon size={19} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.message}>{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </AppToastContext.Provider>
  );
}

export function useAppToast(): AppToastContextValue {
  const context = useContext(AppToastContext);
  if (!context) throw new Error("useAppToast must be used within AppToastProvider.");
  return context;
}

const styles = StyleSheet.create({
  position: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 1000,
    alignItems: "center",
  },
  toast: {
    minHeight: 48,
    maxWidth: 420,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 9,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 11,
    shadowColor: "#0B2740",
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 7 },
    shadowRadius: 14,
    elevation: 8,
  },
  success: { backgroundColor: "#0060B8" },
  error: { backgroundColor: "#B42318" },
  message: {
    flexShrink: 1,
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "right",
  },
});
