import {
  TabContentSkeleton,
  useDeferredTabContent,
} from "@/hooks/use-deferred-tab-content";

export default function CaptainSettingsScreen() {
  const isReady = useDeferredTabContent(true);

  if (!isReady) return <TabContentSkeleton />;

  const { CaptainSettings } =
    require("@/components/captain/captain-pages") as typeof import("@/components/captain/captain-pages");
  return <CaptainSettings />;
}
