import { useIsFocused } from "expo-router";
import { AppState, type AppStateStatus } from "react-native";
import { useEffect, useRef, useState } from "react";

import { shouldKeepScreenLiveUpdates } from "@/lib/screen-live-updates";

/**
 * Keeps subscriptions and periodic refreshes active only while the current
 * tab is visible and the app is in the foreground.
 */
export function useScreenLiveUpdates() {
  const isFocused = useIsFocused();
  const [appState, setAppState] = useState<AppStateStatus | null>(
    AppState.currentState,
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);

  return shouldKeepScreenLiveUpdates(isFocused, appState);
}

/**
 * Runs only on subsequent inactive-to-active transitions. The first active
 * render is allowed to use the screen's normal initial query instead.
 */
export function useRefreshOnScreenResume(
  isActive: boolean,
  refresh: () => void,
) {
  const wasActive = useRef(false);
  const hasBeenActive = useRef(false);

  useEffect(() => {
    if (isActive && !wasActive.current && hasBeenActive.current) {
      refresh();
    }
    if (isActive) hasBeenActive.current = true;
    wasActive.current = isActive;
  }, [isActive, refresh]);
}
