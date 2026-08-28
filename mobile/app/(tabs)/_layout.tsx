import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, Alert, BackHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import { useColors } from "@/hooks/use-colors";


import { useEffect } from 'react';
import JailMonkey from 'jail-monkey';

export function useSecurityShield() {
  useEffect(() => {
    const checkDeviceSecurity = () => {
      try {
        if (JailMonkey.isJailBroken()) {
          Alert.alert(
            "we're sorry",
"please try again code:101001",
            [{ text: "خروج", onPress: () => BackHandler.exitApp() }]
          );
        }
      } catch (error) {
        console.warn("Security check failed", error);
      }
    };

    checkDeviceSecurity();

  }, []);
}


function DeliveryTabBackdrop() {
  return (
    <LinearGradient
      colors={["rgba(250,253,255,0.96)", "rgba(219,248,253,0.97)", "rgba(150,226,239,0.98)"]}
      locations={[0, 0.52, 1]}
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function TabLayout() {
  useSecurityShield();
  const colors = useColors();
  const { profile } = useDeliveryAuth();
  const insets = useSafeAreaInsets();
  const role = profile?.role;
  if (!profile) return null;
  const isCaptain = role === "captain";
  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 8);
  const tabBarHeight = 64 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#063B78",
        tabBarInactiveTintColor: "#48738B",
        tabBarActiveBackgroundColor: "rgba(255,255,255,0.88)",
        tabBarBackground: DeliveryTabBackdrop,
        tabBarButton: HapticTab,
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: [
          styles.tabBar,
          {
            height: tabBarHeight,
            paddingBottom: bottomPadding,
          },
        ],
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="orders"
        options={{
          title: isCaptain ? "طلباتي" : "الطلبات",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="list.bullet" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wages"
        options={{
          title: isCaptain ? "أجوري" : "الأجور",
          href: undefined,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="wallet.pass.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={25} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="custody"
        options={{
          title: "أماناتي",
          href: isCaptain ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="shippingbox.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="captains"
        options={{
          title: "الكباتن",
          href: isCaptain ? null : undefined,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="person.2.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "الإعدادات",
          href: isCaptain ? undefined : null,
          tabBarIcon: ({ color }) => (
            <IconSymbol size={24} name="gearshape.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "المزيد",
          href: isCaptain ? null : undefined,
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="more-horiz" size={25} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "transparent",
    borderTopColor: "rgba(81,181,207,0.32)",
    borderTopWidth: 1,
    elevation: 0,
    paddingHorizontal: 8,
    paddingTop: 7,
    shadowColor: "#0B6E8E",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.12,
    shadowRadius: 15,
  },
  tabItem: {
    borderRadius: 17,
    marginHorizontal: 3,
    marginTop: 1,
    paddingTop: 1,
  },
  tabLabel: {
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    lineHeight: 15,
    marginTop: -1,
  },
});
