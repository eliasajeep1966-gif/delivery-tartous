import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(resolve(__dirname, path), "utf8");

describe("mobile logout guards", () => {
  it("prevents concurrent logout requests from repeated taps", () => {
    const source = readSource("../contexts/delivery-auth-context.tsx");

    expect(source).toContain(
      'if (current.operation === "signing-out") return;',
    );
  });

  it("limits a user-initiated logout to the current device session", () => {
    const source = readSource("../contexts/delivery-auth-context.tsx");
    const signOutStart = source.indexOf("const signOut = useCallback");
    const resetToLoginStart = source.indexOf("const resetToLogin = useCallback");
    const signOutImplementation = source.slice(signOutStart, resetToLoginStart);

    expect(signOutImplementation).toContain(
      'await getClient().auth.signOut({ scope: "local" });',
    );
    expect(signOutImplementation).not.toContain("auth.signOut();");
  });

  it("requires the in-app confirmation dialog from every direct logout control", () => {
    for (const path of [
      "../components/admin/admin-more.tsx",
      "../components/captain/captain-home.tsx",
      "../components/captain/captain-pages.tsx",
    ]) {
      const source = readSource(path);

      expect(source).toContain("LogoutConfirmationDialog");
      expect(source).toContain("setLogoutConfirmationOpen(true)");
      expect(source).toContain('isSigningOut={');
    }

    const dialog = readSource("../components/auth/logout-confirmation-dialog.tsx");
    expect(dialog).toContain("تأكيد تسجيل الخروج");
    expect(dialog).toContain("تراجع");
    expect(dialog).toContain("تسجيل الخروج");
  });
});
