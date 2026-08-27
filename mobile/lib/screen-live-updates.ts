export function shouldKeepScreenLiveUpdates(
  isFocused: boolean,
  appState: string | null,
) {
  return isFocused && (appState === "active" || appState === null);
}
