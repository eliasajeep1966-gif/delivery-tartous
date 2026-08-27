import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("authentication visual shell", () => {
  const shellSource = readFileSync(
    resolve(__dirname, "../components/auth/auth-shell.tsx"),
    "utf8",
  );
  const loginSource = readFileSync(resolve(__dirname, "../app/login.tsx"), "utf8");

  it("uses a translucent BlurView card and retains the fallback captain asset", () => {
    expect(shellSource).toContain('import { BlurView } from "expo-blur";');
    expect(shellSource).toContain('require("@/assets/images/auth-captain.jpg")');
    expect(shellSource).toContain("<BlurView");
    expect(shellSource).toContain("styles.glassCard");
  });

  it("uses the full-width cartoon delivery scene only for the login visual", () => {
    expect(shellSource).toContain(
      'require("@/assets/images/auth-login-scene.png")',
    );
    expect(shellSource).toContain('resizeMode="cover"');
    expect(shellSource).toContain('fontFamily: "Parisienne_400Regular"');
    expect(loginSource).toContain('visual="delivery-login"');
  });

  it("preserves keyboard-aware compacting for the login and activation forms", () => {
    expect(shellSource).toContain("const heroHeight = keyboardVisible");
    expect(shellSource).toContain("scrollRef.current?.scrollToEnd");
    expect(shellSource).toContain("<KeyboardAvoidingView");
  });
});
