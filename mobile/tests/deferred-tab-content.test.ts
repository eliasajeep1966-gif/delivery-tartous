import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tabRoutes = [
  "index.tsx",
  "orders.tsx",
  "wages.tsx",
  "captains.tsx",
  "custody.tsx",
  "settings.tsx",
  "more.tsx",
];

describe("deferred tab content", () => {
  it("waits for a frame before marking a tab body ready", () => {
    const source = readFileSync(
      resolve(__dirname, "../hooks/use-deferred-tab-content.tsx"),
      "utf8",
    );

    expect(source).toContain("requestAnimationFrame");
    expect(source).toContain("cancelAnimationFrame");
    expect(source).toContain("setTimeout");
    expect(source).not.toContain("require(");
  });

  it("shows a skeleton before evaluating every visible tab route body", () => {
    for (const route of tabRoutes) {
      const source = readFileSync(
        resolve(__dirname, `../app/(tabs)/${route}`),
        "utf8",
      );

      expect(source).toContain("useDeferredTabContent");
      expect(source).toMatch(
        /if \(!isReady\) return <TabContentSkeleton \/>;[\s\S]*require\(/,
      );
    }
  });
});
