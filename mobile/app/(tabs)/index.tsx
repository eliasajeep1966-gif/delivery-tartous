import { useDeliveryAuth } from "@/contexts/delivery-auth-context";

export default function HomeScreen() {
  const { profile } = useDeliveryAuth();

  if (!profile) return null;

  if (profile.role === "captain") {
    const { CaptainHome } =
      require("@/components/captain/captain-home") as typeof import("@/components/captain/captain-home");
    return <CaptainHome />;
  }

  const { AdminHome } =
    require("@/components/admin/admin-home") as typeof import("@/components/admin/admin-home");
  return <AdminHome />;
}
