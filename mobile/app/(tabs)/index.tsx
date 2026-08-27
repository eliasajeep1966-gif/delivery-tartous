import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import {
  TabContentSkeleton,
  useDeferredTabContent,
} from "@/hooks/use-deferred-tab-content";

export default function HomeScreen() {
  const { profile } = useDeliveryAuth();
  const isReady = useDeferredTabContent(Boolean(profile));

  if (!profile) return null;
  if (!isReady) return <TabContentSkeleton />;

  if (profile.role === "captain") {
    const { CaptainHome } =
      require("@/components/captain/captain-home") as typeof import("@/components/captain/captain-home");
    return <CaptainHome />;
  }

  const { AdminHome } =
    require("@/components/admin/admin-home") as typeof import("@/components/admin/admin-home");
  return <AdminHome />;
}
