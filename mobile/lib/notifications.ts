import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

import { getNativeSupabaseClient } from "@/lib/supabase/native-supabase";

// Expo Go SDK 53+ throws while importing expo-notifications on Android. Keep the
// module out of startup evaluation and load it only in a supported native build.
type NotificationsModule = typeof import("expo-notifications");

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
let notificationsModule: NotificationsModule | null = null;
let notificationSetupComplete = false;

function getNotifications(): NotificationsModule | null {
  if (Platform.OS === "web" || isExpoGo) return null;
  if (!notificationsModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsModule = require("expo-notifications") as NotificationsModule;
  }
  return notificationsModule;
}

function setupNotifications(): NotificationsModule | null {
  const Notifications = getNotifications();
  if (!Notifications || notificationSetupComplete) return Notifications;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  notificationSetupComplete = true;
  return Notifications;
}

export async function registerCaptainPushNotifications(
  userId: string,
): Promise<string | null> {
  const Notifications = setupNotifications();
  if (!Notifications) return null;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("orders-v2", {
        name: "Orders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: "new-order.mp3",
      });
    }

    const permissions = await Notifications.getPermissionsAsync();
    let status = permissions.status;
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") {
      console.warn("Push notification permission was not granted.");
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const token = (
      await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      )
    ).data;
    if (!token) return null;

    const result = await getNativeSupabaseClient()
      .from("push_tokens")
      .upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,token" },
      );
    if (result.error) throw new Error(result.error.message);
    return token;
  } catch (error) {
    console.warn("Push notification registration is unavailable.", error);
    return null;
  }
}

export async function unregisterPushNotifications(
  userId: string,
): Promise<void | null> {
  try {
    const result = await getNativeSupabaseClient()
      .from("push_tokens")
      .delete()
      .eq("user_id", userId);
    if (result.error) throw new Error(result.error.message);
  } catch (error) {
    console.warn("Push notification cleanup is unavailable.", error);
    return null;
  }
}

export async function notifyCaptainOfOrder(
  orderId: string,
): Promise<void | null> {
  try {
    const { error } = await getNativeSupabaseClient().functions.invoke(
      "send-order-push",
      { body: { orderId } },
    );
    if (error) throw new Error(error.message);
  } catch (error) {
    console.warn("Push notification delivery is unavailable.", error);
    return null;
  }
}
