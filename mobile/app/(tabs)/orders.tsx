import { AdminOrders } from "@/components/admin/admin-orders";
import { CaptainOrders } from "@/components/captain/captain-pages";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";

export default function OrdersScreen() {
  const { profile } = useDeliveryAuth();
  return profile?.role === "captain" ? <CaptainOrders /> : <AdminOrders />;
}
