import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { authRouteRedirect, isAuthRoute } from "../lib/auth/auth-routing";

describe("Native auth route guard", () => {
  it("keeps unauthenticated users on both Login and activation screens", () => {
    expect(isAuthRoute("login")).toBe(true);
    expect(isAuthRoute("activate-account")).toBe(true);
    expect(authRouteRedirect("unauthenticated", "login", false)).toBeNull();
    expect(
      authRouteRedirect("unauthenticated", "activate-account", false),
    ).toBeNull();
  });

  it("redirects authenticated users after activation and protects private routes", () => {
    expect(authRouteRedirect("authenticated", "activate-account", true)).toBe(
      "/(tabs)",
    );
    expect(authRouteRedirect("authenticated", "login", true)).toBe("/(tabs)");
    expect(authRouteRedirect("unauthenticated", "(tabs)", false)).toBe(
      "/login",
    );
  });

  it("waits for the profile before choosing a role-specific tab screen", () => {
    for (const route of ["index.tsx", "orders.tsx", "wages.tsx"]) {
      const source = readFileSync(
        resolve(__dirname, `../app/(tabs)/${route}`),
        "utf8",
      );
      expect(source).toContain("if (!profile) return null;");
    }

    const tabLayout = readFileSync(
      resolve(__dirname, "../app/(tabs)/_layout.tsx"),
      "utf8",
    );
    expect(tabLayout).toContain("if (!profile) return null;");
  });

  it("defers the unselected role UI until the role-specific branch renders", () => {
    const roleScreens = [
      {
        route: "index.tsx",
        adminModule: "@/components/admin/admin-home",
        captainModule: "@/components/captain/captain-home",
      },
      {
        route: "orders.tsx",
        adminModule: "@/components/admin/admin-orders",
        captainModule: "@/components/captain/captain-pages",
      },
      {
        route: "wages.tsx",
        adminModule: "@/components/admin/admin-wages",
        captainModule: "@/components/captain/captain-pages",
      },
    ];

    for (const { route, adminModule, captainModule } of roleScreens) {
      const source = readFileSync(
        resolve(__dirname, `../app/(tabs)/${route}`),
        "utf8",
      );
      expect(source).not.toMatch(/^import .*components\/(admin|captain)\//m);
      expect(source).toContain(`require(\"${adminModule}\")`);
      expect(source).toContain(`require(\"${captainModule}\")`);
    }
  });
});
