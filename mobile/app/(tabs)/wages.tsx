import { View, Text } from "react-native";
import { AdminWages } from "@/components/admin/admin-wages";
import { CaptainWages } from "@/components/captain/captain-pages"; 
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";

export default function WagesScreen() {
  const { profile } = useDeliveryAuth();

  const isCaptain = profile?.role === "captain";

  if (isCaptain && typeof CaptainWages !== "function") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>جاري تحميل صفحة أجور الكابتن...</Text>
      </View>
    );
  }

  if (!isCaptain && typeof AdminWages !== "function") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>جاري تحميل صفحة أجور الإدارة...</Text>
      </View>
    );
  }

  return isCaptain ? <CaptainWages /> : <AdminWages />;
}