import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

import { getNativeSupabaseClient } from "@/lib/supabase/native-supabase";

// Expo Go SDK 53+ throws while importing expo-notifications on Android. Keep the
// module out of startup evaluation and load it only in a supported native build.
type NotificationsModule = typeof import("expo-notifications");

type CaptainOrderCancellationNotification = Readonly<{
  orderId: string | null;
  orderNumber: string | null;
}>;

type PushResponse = Readonly<{
  sent: number;
  failed?: number;
  error?: string;
}>;

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
    handleNotification: async (notification) => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound:
        notification.request.content.data?.type !== "order_cancelled",
      shouldSetBadge: true,
    }),
  });
  notificationSetupComplete = true;
  return Notifications;
}

async function configureCaptainNotificationChannels(
  Notifications: NotificationsModule,
): Promise<void> {
  if (Platform.OS !== "android") return;

  await Promise.all([
    Notifications.setNotificationChannelAsync("new_order_alerts", {
      name: "طلبات جديدة",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: "new_order.mp3",
    }),
    Notifications.setNotificationChannelAsync("cancelled_order_alerts", {
      name: "طلبات ملغاة",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 350, 130, 350],
      sound: "order_cancelled.mp3",
    }),
  ]);
}

function readCancellationNotification(
  notification: import("expo-notifications").Notification,
): CaptainOrderCancellationNotification | null {
  const data = notification.request.content.data;
  if (data?.type !== "order_cancelled") return null;

  return {
    orderId: typeof data.orderId === "string" ? data.orderId : null,
    orderNumber:
      typeof data.orderNumber === "string" || typeof data.orderNumber === "number"
        ? String(data.orderNumber)
        : null,
  };
}

export async function registerCaptainPushNotifications(
  userId: string,
): Promise<string | null> {
  const Notifications = setupNotifications();
  if (!Notifications) return null;

  try {
    await configureCaptainNotificationChannels(Notifications);

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
    console.error("Push notification registration failed.", error);
    throw error instanceof Error
      ? error
      : new Error("فشل تسجيل إشعارات الطلبات.");
  }
}

export function subscribeToCaptainOrderCancellation(
  onCancellation: (event: CaptainOrderCancellationNotification) => void,
): () => void {
  const Notifications = setupNotifications();
  if (!Notifications) return () => undefined;

  const subscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      const event = readCancellationNotification(notification);
      if (event) onCancellation(event);
    },
  );

  return () => subscription.remove();
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

export async function notifyCaptainOfOrderCancellation(
  orderId: string,
): Promise<PushResponse> {
  const { data, error } = await getNativeSupabaseClient().functions.invoke(
    "send_order_cancellation_push",
    { body: { orderId } },
  );
  if (error) {
    throw new Error("تعذر إرسال إشعار إلغاء الطلب للكابتن.");
  }
  if (!data || typeof data !== "object") {
    throw new Error("استجابة إشعار إلغاء الطلب غير صالحة.");
  }

  const response = data as PushResponse;
  if (response.error) throw new Error(response.error);
  if (!Number.isFinite(response.sent) || response.sent < 0) {
    throw new Error("استجابة إشعار إلغاء الطلب غير صالحة.");
  }

  return response;
}
