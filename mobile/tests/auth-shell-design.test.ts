import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("authentication visual shell", () => {
  const shellSource = readFileSync(
    resolve(__dirname, "../components/auth/auth-shell.tsx"),
    "utf8",
  );
  const loginSource = readFileSync(resolve(__dirname, "../app/login.tsx"), "utf8");
  const activationSource = readFileSync(
    resolve(__dirname, "../app/activate-account.tsx"),
    "utf8",
  );
  const navigationSource = readFileSync(resolve(__dirname, "../app/_layout.tsx"), "utf8");
  const authUiSource = readFileSync(
    resolve(__dirname, "../components/auth/auth-ui.tsx"),
    "utf8",
  );

  it("uses a translucent BlurView card and retains the fallback captain asset", () => {
    expect(shellSource).toContain('import { BlurView } from "expo-blur";');
    expect(shellSource).toContain('require("@/assets/images/auth-captain.jpg")');
    expect(shellSource).toContain("<BlurView");
    expect(shellSource).toContain("styles.glassCard");
  });

  it("uses the supplied transparent full Delivery Tartous logo beside the captain", () => {
    expect(shellSource).toContain(
      'require("@/assets/images/auth-login-scene.png")',
    );
    expect(shellSource).toContain(
      'require("@/assets/images/delivery-tartous-full-logo-transparent.png")',
    );
    expect(shellSource).toContain("styles.sideLogo");
    expect(shellSource).not.toContain("chestLogo");
    expect(shellSource).not.toContain("cargoBoxFill");
    expect(shellSource).not.toContain("cargoSign");
    expect(shellSource).toContain('resizeMode="cover"');
    expect(shellSource).toContain('fontFamily: "Parisienne_400Regular"');
    expect(loginSource).toContain('visual="delivery-login"');
    expect(activationSource).toContain('visual="delivery-login"');
  });

  it("animates only the glass card when changing between login and activation", () => {
    expect(shellSource).toContain("FadeInLeft");
    expect(shellSource).toContain("FadeInRight");
    expect(shellSource).toContain("cardTransition");
    expect(loginSource).toContain('cardTransition="login"');
    expect(activationSource).toContain('cardTransition="activation"');
    expect(navigationSource).toContain(
      '<Stack.Screen name="login" options={{ animation: "none" }} />',
    );
    expect(navigationSource).toContain(
      '<Stack.Screen name="activate-account" options={{ animation: "none" }} />',
    );
  });

  it("uses the blue authentication palette", () => {
    expect(authUiSource).toContain('color: "#0563B4"');
    expect(authUiSource).toContain('backgroundColor: "#0068C6"');
    expect(shellSource).toContain('color: "#075BA6"');
  });

  it("preserves keyboard-aware compacting for the login and activation forms", () => {
    expect(shellSource).toContain("const heroHeight = keyboardVisible");
    expect(shellSource).toContain("scrollRef.current?.scrollToEnd");
    expect(shellSource).toContain("<KeyboardAvoidingView");
  });
});
