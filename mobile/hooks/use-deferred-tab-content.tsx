import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

export function useDeferredTabContent(enabled: boolean) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsReady(false);
      return;
    }

    let isActive = true;
    let contentTimer: ReturnType<typeof setTimeout> | null = null;
    const frame = requestAnimationFrame(() => {
      contentTimer = setTimeout(() => {
        if (isActive) setIsReady(true);
      }, 0);
    });

    return () => {
      isActive = false;
      cancelAnimationFrame(frame);
      if (contentTimer) clearTimeout(contentTimer);
    };
  }, [enabled]);

  return isReady;
}

export function TabContentSkeleton() {
  return (
    <View style={styles.screen}>
      <View style={styles.header} />
      <View style={styles.hero} />
      <View style={styles.card} />
      <View style={styles.card} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#E7F4F7",
    borderRadius: 18,
    height: 88,
  },
  header: {
    alignSelf: "flex-end",
    backgroundColor: "#D7EDF2",
    borderRadius: 9,
    height: 18,
    width: "42%",
  },
  hero: {
    backgroundColor: "#DDF4FB",
    borderRadius: 20,
    height: 140,
  },
  screen: {
    backgroundColor: "#F8FCFD",
    flex: 1,
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 28,
  },
});
