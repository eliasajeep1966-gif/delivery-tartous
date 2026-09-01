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

type PushResponse = { sent: number; error?: string };

function jsonResponse(body: PushResponse) {
  return new Response(JSON.stringify(body), {
    status: body.error ? 500 : 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

    const { data: canSend, error: permissionError } = await userClient.rpc("can_send_order_push");
    if (permissionError) {
      throw new Error(`Push permission check failed: ${permissionError.message}`);
    }
    if (canSend !== true) {
      throw new Error("Only active administrators can send assignment notifications");
    }

    const payload = await req.json().catch(() => null);
    const orderId = typeof payload?.orderId === "string" ? payload.orderId : null;
    if (!orderId) throw new Error("orderId is required");

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id,order_number,assigned_captain_id")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw new Error(`Order lookup failed: ${orderError.message}`);
    if (!order) throw new Error("Order not found");
    if (!order.assigned_captain_id) throw new Error("Order is not assigned to a captain");

    const { data: tokens, error: tokenError } = await admin
      .from("push_tokens")
      .select("token")
      .eq("user_id", order.assigned_captain_id);
    if (tokenError) throw new Error(`Push token lookup failed: ${tokenError.message}`);

    const messages = (tokens ?? []).map((row: { token: string }) => ({
      to: row.token,
      sound: "new_order.mp3",
      title: "طلب جديد",
      body: `تم إسناد الطلب #${order.order_number} إليك`,
      data: { orderId: order.id, type: "assigned_order" },
      priority: "high",
      channelId: "new_order_alerts",
    }));

    if (messages.length) {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      });
      const responseBody = await response.text();
      if (!response.ok) {
        throw new Error(`Expo Push API failed: ${response.status} ${responseBody}`);
      }

      let ticketResult: unknown;
      try {
        ticketResult = JSON.parse(responseBody);
      } catch {
        ticketResult = null;
      }
      const ticketErrors = Array.isArray((ticketResult as { data?: unknown })?.data)
        ? ((ticketResult as {
            data: Array<{ status?: string; message?: string; details?: { error?: string } }>;
          }).data).filter((ticket) => ticket.status === "error")
        : [];
      if (ticketErrors.length) {
        const first = ticketErrors[0];
        throw new Error(
          `Expo rejected notification: ${first.message ?? first.details?.error ?? "unknown error"}`,
        );
      }
    }

    return jsonResponse({ sent: messages.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Push notification failed";
    console.error("send-order-push failed", { message });
    return jsonResponse({ sent: 0, error: message });
  }
});
