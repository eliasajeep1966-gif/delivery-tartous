import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";

import { DeliveryBottomTabBar } from "@/components/delivery-bottom-tab-bar";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";

export default function TabLayout() {
  const { profile } = useDeliveryAuth();
  const isCaptain = profile?.role === "captain";

  return (
    <Tabs
      tabBar={(props) => <DeliveryBottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: isCaptain ? "طلباتي" : "الطلبات",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="list.bullet" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wages"
        options={{
          title: isCaptain ? "أجوري" : "الأجور",
          href: undefined,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="wallet.pass.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="custody"
        options={{
          title: "أماناتي",
          href: isCaptain ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="shippingbox.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="captains"
        options={{
          title: "الكباتن",
          href: isCaptain ? null : undefined,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="person.2.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "الإعدادات",
          href: isCaptain ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="gearshape.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "المزيد",
          href: isCaptain ? null : undefined,
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="more-horiz" size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
