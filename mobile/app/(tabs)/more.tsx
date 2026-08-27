import {
  TabContentSkeleton,
  useDeferredTabContent,
} from "@/hooks/use-deferred-tab-content";

export default function MoreTab() {
  const isReady = useDeferredTabContent(true);

  if (!isReady) return <TabContentSkeleton />;

  const { AdminMore } =
    require("@/components/admin/admin-more") as typeof import("@/components/admin/admin-more");
  return <AdminMore />;
}
