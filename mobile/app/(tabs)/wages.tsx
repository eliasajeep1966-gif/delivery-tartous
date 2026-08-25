import { AdminWages } from "@/components/admin/admin-wages";
import { CaptainWages } from "@/components/captain/captain-pages";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";

export default function WagesScreen() {
  const { profile } = useDeliveryAuth();
  return profile?.role === "captain" ? <CaptainWages /> : <AdminWages />;
}
