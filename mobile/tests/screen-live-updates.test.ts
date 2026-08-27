import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { shouldKeepScreenLiveUpdates } from "../lib/screen-live-updates";

describe("screen live updates", () => {
  it("keeps live updates only for a focused foreground screen", () => {
    expect(shouldKeepScreenLiveUpdates(true, "active")).toBe(true);
    expect(shouldKeepScreenLiveUpdates(false, "active")).toBe(false);
    expect(shouldKeepScreenLiveUpdates(true, "background")).toBe(false);
    expect(shouldKeepScreenLiveUpdates(true, "inactive")).toBe(false);
    expect(shouldKeepScreenLiveUpdates(true, null)).toBe(true);
  });

  it("uses the consolidated focused polling and subscription path for admin orders", () => {
    const hookSource = readFileSync(
      resolve(__dirname, "../features/admin/use-admin-orders.ts"),
      "utf8",
    );
    const screenSource = readFileSync(
      resolve(__dirname, "../components/admin/admin-orders.tsx"),
      "utf8",
    );

    expect(hookSource).toContain("refetchInterval: enabled ? 15_000 : false");
    expect(hookSource).toContain("refetchIntervalInBackground: false");
    expect(screenSource).not.toContain("nativeAdminContract");
    expect(screenSource).not.toContain("setInterval(");
  });
});
