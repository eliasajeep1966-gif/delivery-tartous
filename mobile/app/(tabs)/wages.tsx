import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import {
  TabContentSkeleton,
  useDeferredTabContent,
} from "@/hooks/use-deferred-tab-content";

export default function WagesScreen() {
  const { profile } = useDeliveryAuth();
  const isReady = useDeferredTabContent(Boolean(profile));

  if (!profile) return null;
  if (!isReady) return <TabContentSkeleton />;

  if (profile.role === "captain") {
    const { CaptainWages } =
      require("@/components/captain/captain-pages") as typeof import("@/components/captain/captain-pages");
    return <CaptainWages />;
  }

  const { AdminWages } =
    require("@/components/admin/admin-wages") as typeof import("@/components/admin/admin-wages");
  return <AdminWages />;
}
