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
  if (!Notifications) {
    throw new Error("وحدة الإشعارات غير متاحة في هذه النسخة من التطبيق.");
  }

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("orders-v3", {
        name: "Orders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: "new_order.mp3",
      });
    }

    const permissions = await Notifications.getPermissionsAsync();
    let status = permissions.status;
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") {
      throw new Error(`صلاحية الإشعارات غير مفعّلة: ${status}`);
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      throw new Error("معرّف EAS غير موجود داخل نسخة التطبيق.");
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (!token) {
      throw new Error("لم يتم إنشاء Expo Push Token للجهاز.");
    }

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
    console.error("Push notification registration failed.", error);
    throw error instanceof Error ? error : new Error("فشل تسجيل إشعارات الطلبات.");
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

export async function notifyCaptainOfOrder(orderId: string): Promise<number> {
  const { data, error } = await getNativeSupabaseClient().functions.invoke(
    "send-order-push",
    { body: { orderId } },
  );
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(String(data.error));
  return Number(data?.sent ?? 0);
}
