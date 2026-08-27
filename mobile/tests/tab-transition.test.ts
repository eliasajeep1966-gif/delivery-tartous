import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("tab transitions", () => {
  it("prewarms only the active role modules without adding a scene delay", () => {
    const source = readFileSync(
      resolve(__dirname, "../app/(tabs)/_layout.tsx"),
      "utf8",
    );

    expect(source).not.toContain('animation: "fade"');
    expect(source).not.toContain("transitionSpec:");
    expect(source).toContain('require("@/components/captain/captain-pages")');
    expect(source).toContain('require("@/components/admin/admin-orders")');
    expect(source).toContain('}, 600);');
    expect(source).not.toContain("lazy: false");
  });
});
