import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("tab transitions", () => {
  it("uses a short fade and prewarms only the active role modules after startup", () => {
    const source = readFileSync(
      resolve(__dirname, "../app/(tabs)/_layout.tsx"),
      "utf8",
    );

    expect(source).toContain('animation: "fade"');
    expect(source).toContain('duration: 160');
    expect(source).toContain('require("@/components/captain/captain-pages")');
    expect(source).toContain('require("@/components/admin/admin-orders")');
    expect(source).toContain('}, 600);');
    expect(source).not.toContain("lazy: false");
  });
});
