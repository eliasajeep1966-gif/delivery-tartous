import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  type PropsWithChildren,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, { FadeInLeft, FadeInRight } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

type AuthShellProps = PropsWithChildren<{
  title: string;
  subtitle: string;
  visual?: "default" | "delivery-login";
  cardTransition?: "login" | "activation";
}>;

export function AuthShell({
  title,
  subtitle,
  children,
  visual = "default",
  cardTransition = "login",
}: AuthShellProps) {
  const { height, width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const isDeliveryLogin = visual === "delivery-login";
  const cardEntering =
    cardTransition === "activation"
      ? FadeInRight.duration(220)
      : FadeInLeft.duration(220);
  const cardWidth = Math.min(410, Math.max(width - 32, 0));
  const compact = height < 720;
  const heroHeight = keyboardVisible ? 156 : compact ? 244 : 320;
  const contentStyle = useMemo(
    () => [
      styles.content,
      {
        justifyContent: keyboardVisible
          ? ("flex-start" as const)
          : ("center" as const),
        paddingVertical: keyboardVisible || compact ? 16 : 28,
      },
    ],
    [compact, keyboardVisible],
  );

  useEffect(() => {
    if (Platform.OS === "web") return;

    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    const showKeyboard = () => {
      setKeyboardVisible(true);
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(
        () => scrollRef.current?.scrollToEnd({ animated: true }),
        90,
      );
    };
    const hideKeyboard = () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      setKeyboardVisible(false);
    };
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, showKeyboard);
    const hideSubscription = Keyboard.addListener(hideEvent, hideKeyboard);

    return () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <SafeAreaView
      edges={["top", "bottom", "left", "right"]}
      style={styles.safeArea}
    >
      {isDeliveryLogin ? (
        <>
          <Image
            accessibilityElementsHidden
            source={require("@/assets/images/auth-login-scene.png")}
            resizeMode="cover"
            style={styles.loginScene}
          />
        </>
      ) : (
        <>
          <LinearGradient
            colors={["#C7EDFF", "#EEF9FF", "#CEE7FB"]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.topGlow} />
          <View pointerEvents="none" style={styles.bottomGlow} />
        </>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          ref={scrollRef}
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={contentStyle}
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (keyboardVisible)
              scrollRef.current?.scrollToEnd({ animated: false });
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.layout, { width: cardWidth }]}>
            <View
              style={[
                styles.hero,
                { height: heroHeight },
                isDeliveryLogin && styles.loginHero,
              ]}
            >
              {isDeliveryLogin ? (
                <Text style={styles.loginWordmark}>Delivery Tartous</Text>
              ) : (
                <>
                  <View pointerEvents="none" style={styles.heroHalo} />
                  <Image
                    source={require("@/assets/images/auth-captain.jpg")}
                    resizeMode="contain"
                    style={styles.captain}
                  />
                  <View style={styles.brandPill}>
                    <Image
                      source={require("@/assets/images/delivery-tartous-office-logo.jpg")}
                      style={styles.brandLogo}
                    />
                    <Text style={styles.brand}>دليفري طرطوس</Text>
                  </View>
                </>
              )}
            </View>

            <Animated.View
              entering={isDeliveryLogin ? cardEntering : undefined}
              style={isDeliveryLogin && styles.loginCardLayer}
            >
              <BlurView
                intensity={Platform.OS === "android" ? 34 : 58}
                style={[
                  styles.glassCard,
                  isDeliveryLogin && styles.loginGlassCard,
                ]}
                tint="light"
              >
                <View
                  style={[
                    styles.cardContent,
                    isDeliveryLogin && styles.loginCardContent,
                  ]}
                >
                  <View style={styles.heading}>
                    <Text
                      style={[styles.title, isDeliveryLogin && styles.loginTitle]}
                    >
                      {title}
                    </Text>
                    <Text
                      style={[
                        styles.subtitle,
                        isDeliveryLogin && styles.loginSubtitle,
                      ]}
                    >
                      {subtitle}
                    </Text>
                  </View>
                  {children}
                </View>
              </BlurView>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#DCEFFB", flex: 1 },
  flex: { flex: 1 },
  topGlow: {
    backgroundColor: "rgba(255,255,255,0.58)",
    borderRadius: 170,
    height: 340,
    left: -126,
    position: "absolute",
    top: -142,
    width: 340,
  },
  bottomGlow: {
    backgroundColor: "rgba(0,96,184,0.10)",
    borderRadius: 210,
    bottom: -150,
    height: 390,
    position: "absolute",
    right: -210,
    width: 390,
  },
  loginScene: {
    bottom: 0,
    height: "100%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    width: "100%",
  },
  content: { alignItems: "center", flexGrow: 1, paddingHorizontal: 16 },
  layout: { alignSelf: "center", maxWidth: 410 },
  hero: {
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "visible",
    position: "relative",
  },
  loginHero: { zIndex: 1 },
  heroHalo: {
    backgroundColor: "rgba(255,255,255,0.36)",
    borderColor: "rgba(255,255,255,0.52)",
    borderRadius: 154,
    borderWidth: 1,
    bottom: 4,
    height: 236,
    position: "absolute",
    width: 276,
  },
  captain: {
    bottom: -12,
    height: "112%",
    maxWidth: 365,
    position: "absolute",
    width: "100%",
  },
  loginWordmark: {
    color: "#075BA6",
    fontFamily: "Parisienne_400Regular",
    fontSize: 28,
    position: "absolute",
    right: 2,
    top: 12,
  },
  brandPill: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.86)",
    borderColor: "rgba(255,255,255,0.96)",
    borderRadius: 18,
    borderWidth: 1,
    bottom: 4,
    flexDirection: "row-reverse",
    gap: 8,
    paddingBottom: 6,
    paddingHorizontal: 12,
    paddingTop: 6,
    position: "absolute",
    shadowColor: "#004B88",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.13,
    shadowRadius: 10,
    elevation: 3,
  },
  brandLogo: { borderRadius: 10, height: 24, width: 24 },
  brand: {
    color: "#075BA6",
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    writingDirection: "rtl",
  },
  loginCardLayer: { zIndex: 2 },
  glassCard: {
    backgroundColor: "rgba(255,255,255,0.42)",
    borderColor: "rgba(255,255,255,0.82)",
    borderRadius: 30,
    borderWidth: 1,
    marginTop: -10,
    overflow: "hidden",
    shadowColor: "#0059A0",
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.17,
    shadowRadius: 26,
    elevation: 7,
  },
  loginGlassCard: {
    backgroundColor: "rgba(244,250,255,0.51)",
    borderColor: "rgba(255,255,255,0.88)",
    borderRadius: 32,
    marginTop: -18,
    shadowColor: "#0C5794",
    shadowOpacity: 0.2,
  },
  cardContent: { padding: 20 },
  loginCardContent: { paddingBottom: 22, paddingHorizontal: 20, paddingTop: 22 },
  heading: { alignItems: "center" },
  title: {
    color: "#123B5D",
    fontFamily: "Cairo_700Bold",
    fontSize: 22,
    lineHeight: 31,
    textAlign: "center",
    writingDirection: "rtl",
  },
  loginTitle: { color: "#075BA6", fontSize: 25, lineHeight: 35 },
  subtitle: {
    color: "#526E84",
    fontFamily: "Cairo_400Regular",
    fontSize: 13,
    lineHeight: 21,
    marginTop: 4,
    textAlign: "center",
    writingDirection: "rtl",
  },
  loginSubtitle: { color: "#3478A9", fontSize: 13, marginTop: 2 },
});
