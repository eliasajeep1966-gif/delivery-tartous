import {
  TabContentSkeleton,
  useDeferredTabContent,
} from "@/hooks/use-deferred-tab-content";

export default function CaptainCustodyScreen() {
  const isReady = useDeferredTabContent(true);

  if (!isReady) return <TabContentSkeleton />;

  const { CaptainCustodyPage } =
    require("@/components/captain/captain-pages") as typeof import("@/components/captain/captain-pages");
  return <CaptainCustodyPage />;
}
