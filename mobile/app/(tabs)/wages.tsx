import { useDeliveryAuth } from "@/contexts/delivery-auth-context";

export default function WagesScreen() {
  const { profile } = useDeliveryAuth();

  if (!profile) return null;

  if (profile.role === "captain") {
    const { CaptainWages } =
      require("@/components/captain/captain-pages") as typeof import("@/components/captain/captain-pages");
    return <CaptainWages />;
  }

  const { AdminWages } =
    require("@/components/admin/admin-wages") as typeof import("@/components/admin/admin-wages");
  return <AdminWages />;
}
