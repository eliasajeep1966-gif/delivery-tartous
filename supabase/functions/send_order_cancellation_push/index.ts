// @ts-nocheck
// Supabase Edge Function. Types are supplied by the Supabase/Deno runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

type PushResponse = Readonly<{
  sent: number;
  failed?: number;
  error?: string;
}>;

type ExpoTicket = Readonly<{
  status?: string;
  message?: string;
  details?: { error?: string };
}>;

function jsonResponse(body: PushResponse) {
  return new Response(JSON.stringify(body), {
    status: body.error ? 500 : 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Unauthorized");

    const accessToken = auth.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) throw new Error("Unauthorized");

    const admin = createClient(supabaseUrl, serviceKey);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
    if (userError || !userData.user) throw new Error("Unauthorized");

    const { data: canSend, error: permissionError } = await userClient.rpc(
      "can_send_order_cancellation_push",
    );
    if (permissionError) {
      throw new Error(
        `Cancellation push permission check failed: ${permissionError.message}`,
      );
    }
    if (canSend !== true) {
      throw new Error("Current user is not allowed to send cancellation notifications");
    }

    const payload = await req.json().catch(() => null);
    const orderId = typeof payload?.orderId === "string" ? payload.orderId : null;
    if (!orderId) throw new Error("orderId is required");

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id,order_number,assigned_captain_id,status")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw new Error(`Order lookup failed: ${orderError.message}`);
    if (!order) throw new Error("Order not found");
    if (order.status !== "cancelled") {
      throw new Error("Order must be cancelled before notifying its captain");
    }
    if (!order.assigned_captain_id) return jsonResponse({ sent: 0 });

    const { data: tokens, error: tokenError } = await admin
      .from("push_tokens")
      .select("token")
      .eq("user_id", order.assigned_captain_id);
    if (tokenError) {
      throw new Error(`Push token lookup failed: ${tokenError.message}`);
    }

    const uniqueTokens = [...new Set(
      (tokens ?? [])
        .map((row: { token?: unknown }) => row.token)
        .filter((token): token is string => typeof token === "string" && token.length > 0),
    )];
    if (!uniqueTokens.length) return jsonResponse({ sent: 0 });

    const messages = uniqueTokens.map((token) => ({
      to: token,
      sound: "order_cancelled.mp3",
      title: "تم إلغاء الطلب",
      body: `تم إلغاء الطلب #${order.order_number} قبل بدء التوصيل.`,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        type: "order_cancelled",
      },
      priority: "high",
      channelId: "cancelled_order_alerts",
    }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    const responseBody = await response.text();
    if (!response.ok) {
      throw new Error(
        `Expo Push API failed: ${response.status} ${responseBody}`,
      );
    }

    let ticketResult: { data?: ExpoTicket[] } | null = null;
    try {
      ticketResult = JSON.parse(responseBody) as { data?: ExpoTicket[] };
    } catch {
      throw new Error("Expo Push API returned an invalid response");
    }

    const tickets = Array.isArray(ticketResult?.data) ? ticketResult.data : [];
    const failed = tickets.filter((ticket) => ticket.status === "error");
    if (failed.length === tickets.length) {
      const first = failed[0];
      throw new Error(
        `Expo rejected cancellation notification: ${first?.message ?? first?.details?.error ?? "unknown error"}`,
      );
    }
    if (failed.length) {
      console.warn("Some cancellation notifications were rejected", {
        failed: failed.length,
        orderId,
      });
    }

    return jsonResponse({ sent: messages.length - failed.length, failed: failed.length });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cancellation push notification failed";
    console.error("send_order_cancellation_push failed", { message });
    return jsonResponse({ sent: 0, error: message });
  }
});
