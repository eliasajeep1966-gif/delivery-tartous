// @ts-nocheck
// Supabase Edge Function. Types are supplied by the Supabase/Deno runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Unauthorized");
    const admin = createClient(supabaseUrl, serviceKey);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) throw new Error("Unauthorized");
    const { orderId } = await req.json() as { orderId?: string };
    if (!orderId) throw new Error("orderId is required");

    const { data: order, error: orderError } = await admin.from("orders").select("id,order_number,customer_name,assigned_captain_id").eq("id", orderId).single();
    if (orderError || !order?.assigned_captain_id) throw new Error("Assigned order not found");
    const { data: tokens, error: tokenError } = await admin.from("push_tokens").select("token").eq("user_id", order.assigned_captain_id);
    if (tokenError) throw tokenError;
    const messages = (tokens ?? []).map((row: { token: string }) => ({ to: row.token, sound: "new_order", title: "طلب جديد", body: `تم إسناد الطلب #${order.order_number} إليك`, data: { orderId: order.id, type: "assigned_order" }, priority: "high", channelId: "orders-v2" }));
    if (messages.length) {
      const response = await fetch("https://exp.host/--/api/v2/push/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(messages) });
      if (!response.ok) throw new Error(`Expo Push API failed: ${response.status}`);
    }
    return new Response(JSON.stringify({ sent: messages.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Push notification failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
