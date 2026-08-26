import type { Href } from "expo-router";

type NavigationRouter = {
  back: () => void;
  canGoBack: () => boolean;
  replace: (href: Href) => void;
};

/**
 * Keeps secondary-screen navigation predictable: go back through the user's
 * actual history, or use a declared fallback when the route was opened directly.
 */
export function goBackOrReplace(
  router: NavigationRouter,
  fallback: Href = "/(tabs)",
): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
}
