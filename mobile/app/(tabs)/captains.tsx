import {
  TabContentSkeleton,
  useDeferredTabContent,
} from "@/hooks/use-deferred-tab-content";

export default function CaptainsTabScreen() {
  const isReady = useDeferredTabContent(true);

  if (!isReady) return <TabContentSkeleton />;

  const { AdminCaptainsScreen } =
    require("@/components/admin/admin-captains") as typeof import("@/components/admin/admin-captains");
  return <AdminCaptainsScreen />;
}
