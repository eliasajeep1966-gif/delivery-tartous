import type { DeliveryAuthStatus } from "@/contexts/delivery-auth-context";

export function isAuthRoute(segment: string | undefined): boolean {
  return segment === "login" || segment === "activate-account";
}

export function authRouteRedirect(status: DeliveryAuthStatus, segment: string | undefined, hasProfile: boolean): "/login" | "/(tabs)" | null {
  const onAuthRoute = isAuthRoute(segment);
  if (status === "unauthenticated" && !onAuthRoute) return "/login";
  if (status === "authenticated" && onAuthRoute && hasProfile) return "/(tabs)";
  return null;
}
