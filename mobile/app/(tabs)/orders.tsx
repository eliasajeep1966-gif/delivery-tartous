import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import {
  TabContentSkeleton,
  useDeferredTabContent,
} from "@/hooks/use-deferred-tab-content";

export default function OrdersScreen() {
  const { profile } = useDeliveryAuth();
  const isReady = useDeferredTabContent(Boolean(profile));

  if (!profile) return null;
  if (!isReady) return <TabContentSkeleton />;

  if (profile.role === "captain") {
    const { CaptainOrders } =
      require("@/components/captain/captain-pages") as typeof import("@/components/captain/captain-pages");
    return <CaptainOrders />;
  }

  const { AdminOrders } =
    require("@/components/admin/admin-orders") as typeof import("@/components/admin/admin-orders");
  return <AdminOrders />;
}
