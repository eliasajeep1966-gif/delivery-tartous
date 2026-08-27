import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("tab module prewarming", () => {
  const source = readFileSync(
    resolve(__dirname, "../app/(tabs)/_layout.tsx"),
    "utf8",
  );

  it("prewarms tab modules after the home screen is interactive", () => {
    expect(source).toContain("TAB_PREWARM_START_MS = 240");
    expect(source).toContain("TAB_PREWARM_GAP_MS = 180");
    expect(source).toContain("useEffect(() => {");
    expect(source).toContain("setTimeout(prewarm, index * TAB_PREWARM_GAP_MS)");
  });

  it("prewarms the role-specific heavy tab modules without mounting every screen", () => {
    expect(source).toContain('import("@/components/captain/captain-pages")');
    expect(source).toContain('import("@/components/admin/admin-orders")');
    expect(source).toContain('import("@/components/admin/admin-wages")');
    expect(source).toContain('import("@/components/admin/admin-captains")');
    expect(source).toContain('import("@/components/admin/admin-more")');
    expect(source).not.toContain("lazy: false");
  });
});
