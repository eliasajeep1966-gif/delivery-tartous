import { describe, expect, it } from "vitest";

import { authRouteRedirect, isAuthRoute } from "../lib/auth/auth-routing";

describe("Native auth route guard", () => {
  it("keeps unauthenticated users on both Login and activation screens", () => {
    expect(isAuthRoute("login")).toBe(true);
    expect(isAuthRoute("activate-account")).toBe(true);
    expect(authRouteRedirect("unauthenticated", "login", false)).toBeNull();
    expect(authRouteRedirect("unauthenticated", "activate-account", false)).toBeNull();
  });

  it("redirects authenticated users after activation and protects private routes", () => {
    expect(authRouteRedirect("authenticated", "activate-account", true)).toBe("/(tabs)");
    expect(authRouteRedirect("authenticated", "login", true)).toBe("/(tabs)");
    expect(authRouteRedirect("unauthenticated", "(tabs)", false)).toBe("/login");
  });
});
