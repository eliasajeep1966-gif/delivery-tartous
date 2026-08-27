import { useDeliveryAuth } from "@/contexts/delivery-auth-context";

export default function OrdersScreen() {
  const { profile } = useDeliveryAuth();

  if (!profile) return null;

  if (profile.role === "captain") {
    const { CaptainOrders } =
      require("@/components/captain/captain-pages") as typeof import("@/components/captain/captain-pages");
    return <CaptainOrders />;
  }

  const { AdminOrders } =
    require("@/components/admin/admin-orders") as typeof import("@/components/admin/admin-orders");
  return <AdminOrders />;
}
