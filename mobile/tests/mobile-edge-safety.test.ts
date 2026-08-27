import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(__dirname, "..", path), "utf8");

describe("mobile edge safety", () => {
  const screenContainer = source("components/screen-container.tsx");
  const keyboardSafeScroll = source(
    "components/ui/keyboard-safe-scroll-view.tsx",
  );
  const accountSettings = source("app/account-settings.tsx");
  const ownerPasswordReset = source("app/owner-password-reset.tsx");
  const ownerDataReset = source("app/owner-data-reset.tsx");
  const officeSettings = source("app/(admin)/settings.tsx");
  const support = source("app/(admin)/support.tsx");
  const captainPages = source("components/captain/captain-pages.tsx");
  const newOrderModal = source("components/admin/admin-new-order-modal.tsx");
  const adminOrders = source("components/admin/admin-orders.tsx");

  it("keeps bottom safety opt-in so tab screens retain their existing layout", () => {
    expect(screenContainer).toContain("safeBottom?: boolean");
    expect(screenContainer).toContain('edges = ["top", "left", "right"]');
    expect(screenContainer).toContain('!edges.includes("bottom")');
  });

  it("uses a shared Android/iOS keyboard-aware scroll wrapper", () => {
    expect(keyboardSafeScroll).toContain("KeyboardAvoidingView");
    expect(keyboardSafeScroll).toContain(
      'Platform.OS === "ios" ? "padding" : "height"',
    );
    expect(keyboardSafeScroll).toContain("useSafeAreaInsets");
    expect(keyboardSafeScroll).toContain(
      'keyboardShouldPersistTaps = "handled"',
    );
  });

  it("protects every editable standalone form from keyboard and system overlap", () => {
    for (const formSource of [
      accountSettings,
      ownerPasswordReset,
      ownerDataReset,
      officeSettings,
      support,
    ]) {
      expect(formSource).toContain("KeyboardSafeScrollView");
      expect(formSource).toContain("safeBottom");
    }
    expect(captainPages).toContain("keyboardAware");
    expect(captainPages).toContain("KeyboardSafeScrollView");
  });

  it("uses Android keyboard resizing and a compact layout for creating orders", () => {
    expect(newOrderModal).toContain(
      'Platform.OS === "ios" ? "padding" : "height"',
    );
    expect(newOrderModal).toContain(
      "const compactLayout = width <= 360 || fontScale >= 1.3",
    );
    expect(newOrderModal).toContain("locationCardRowCompact");
    expect(newOrderModal).toContain("locationCardCompact");
    expect(newOrderModal).toContain("Math.max(insets.bottom, 14)");
  });

  it("allows operational order text to use more than one line and protects details modal bottom", () => {
    expect(adminOrders).toContain(
      "numberOfLines={2} style={styles.orderCustomer}",
    );
    expect(adminOrders).toContain("numberOfLines={2} style={styles.routeText}");
    expect(adminOrders).toContain("Math.max(insets.bottom, 16) + 16");
  });
});
