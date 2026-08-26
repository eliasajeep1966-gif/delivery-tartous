import { AdminHome } from "@/components/admin/admin-home";
import { CaptainHome } from "@/components/captain/captain-home";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";

export default function HomeScreen() {
  const { profile } = useDeliveryAuth();

  if (!profile) return null;
  return profile.role === "captain" ? <CaptainHome /> : <AdminHome />;
}
