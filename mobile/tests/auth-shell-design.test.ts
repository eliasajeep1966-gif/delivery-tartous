import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("authentication visual shell", () => {
  const source = readFileSync(
    resolve(__dirname, "../components/auth/auth-shell.tsx"),
    "utf8",
  );

  it("uses the captain asset inside a translucent BlurView card", () => {
    expect(source).toContain('import { BlurView } from "expo-blur";');
    expect(source).toContain('require("@/assets/images/auth-captain.jpg")');
    expect(source).toContain("<BlurView");
    expect(source).toContain('style={styles.glassCard}');
  });

  it("preserves keyboard-aware compacting for the login and activation forms", () => {
    expect(source).toContain("const heroHeight = keyboardVisible");
    expect(source).toContain("scrollRef.current?.scrollToEnd");
    expect(source).toContain("<KeyboardAvoidingView");
  });
});
