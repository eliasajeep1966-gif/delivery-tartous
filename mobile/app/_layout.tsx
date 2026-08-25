import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
  useFonts,
} from "@expo-google-fonts/cairo";
import {
  Stack,
  useRootNavigationState,
  useRouter,
  useSegments,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { I18nManager, Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
  type EdgeInsets,
  type Metrics,
  type Rect,
} from "react-native-safe-area-context";

import "@/lib/_core/nativewind-pressable";
import { AuthStateScreen } from "@/components/auth/auth-state-screen";
import { AppToastProvider } from "@/contexts/app-toast-context";
import { AppSoundProvider } from "@/contexts/app-sound-context";
import {
  DeliveryAuthProvider,
  useDeliveryAuth,
} from "@/contexts/delivery-auth-context";
import { authRouteRedirect } from "@/lib/auth/auth-routing";
import {
  initManusRuntime,
  subscribeSafeAreaInsets,
} from "@/lib/_core/manus-runtime";
import { ThemeProvider } from "@/lib/theme-provider";

I18nManager.allowRTL(true);

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = { anchor: "(tabs)" };

function AuthAwareNavigator() {
  const {
    status,
    issue,
    profile,
    retryProfile,
    resetToLogin,
    homePathForRole,
  } = useDeliveryAuth();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const segments = useSegments();
  const currentSegment = segments[0];
  const isOnLogin = currentSegment === "login";

  useEffect(() => {
    if (!rootNavigationState?.key || status === "initializing") return;
    const redirect = authRouteRedirect(
      status,
      currentSegment,
      Boolean(profile),
    );
    if (redirect === "/login") router.replace(redirect);
    if (redirect === "/(tabs)" && profile)
      router.replace(homePathForRole(profile.role));
  }, [
    currentSegment,
    homePathForRole,
    profile,
    rootNavigationState?.key,
    router,
    status,
  ]);

  const profileIssueOnLogin =
    isOnLogin &&
    (status === "profile-unavailable" || status === "profile-missing");
  const isRecoverableState =
    (status === "profile-unavailable" ||
      status === "profile-missing" ||
      status === "account-disabled" ||
      status === "auth-invalid") &&
    !profileIssueOnLogin;

  return (
    <View style={styles.navigator}>
      <Stack
        initialRouteName="login"
        screenOptions={{ headerShown: false, animation: "slide_from_left" }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="activate-account" />
        <Stack.Screen name="orders" />
        <Stack.Screen name="users" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="navigation-test" />
        <Stack.Screen name="activity-logs" />
      </Stack>

      {status === "initializing" ? (
        <View style={styles.overlay}>
          <AuthStateScreen
            title="جارٍ استعادة الجلسة"
            message="نتحقق من جلسة الدخول وصلاحيات الحساب بأمان."
            loading
          />
        </View>
      ) : null}

      {isRecoverableState ? (
        <View style={styles.overlay}>
          <AuthStateScreen
            title="تعذر التحقق من الحساب"
            message="تعذر متابعة فتح التطبيق حالياً."
            issue={issue}
            primaryLabel={issue?.recoverable ? "إعادة التحقق" : undefined}
            onPrimaryPress={
              issue?.recoverable ? () => void retryProfile() : undefined
            }
            secondaryLabel="العودة لتسجيل الدخول"
            onSecondaryPress={() => void resetToLogin()}
          />
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;
  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
      }),
  );

  useEffect(() => {
    initManusRuntime();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    return subscribeSafeAreaInsets(handleSafeAreaUpdate);
  }, [handleSafeAreaUpdate]);

  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? {
      insets: initialInsets,
      frame: initialFrame,
    };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialFrame, initialInsets]);

  const content = (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <AppToastProvider>
          <AppSoundProvider>
            <DeliveryAuthProvider>
              <AuthAwareNavigator />
            </DeliveryAuthProvider>
          </AppSoundProvider>
        </AppToastProvider>
        <StatusBar style="dark" />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );

  if (!fontsLoaded && !fontError) return null;

  if (Platform.OS === "web") {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>
        {content}
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navigator: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#EAF5FF",
    zIndex: 20,
  },
});
