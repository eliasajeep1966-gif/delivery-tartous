import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const resetFailure = {
  error: "PASSWORD_RESET_FAILED",
  message: "تعذر تعيين كلمة المرور للمستخدم.",
};

type ResetPasswordRequest = {
  userId?: unknown;
  password?: unknown;
  passwordConfirmation?: unknown;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function validUserId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(resetFailure, 405);

  try {
    const authorization = req.headers.get("authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(resetFailure, 401);

    const payload = (await req.json()) as ResetPasswordRequest;
    const userId = stringValue(payload.userId);
    const password = stringValue(payload.password);
    const passwordConfirmation = stringValue(payload.passwordConfirmation);

    if (!validUserId(userId) || password.length < 12 || password !== passwordConfirmation)
      return json(resetFailure, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Missing Supabase server configuration");
      return json(resetFailure, 500);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
    if (callerError || !callerData.user) return json(resetFailure, 401);

    const { data: isOwner, error: ownerError } = await callerClient.rpc(
      "is_application_owner",
    );
    if (ownerError || isOwner !== true) return json(resetFailure, 403);

    // The Owner changes their own password from account settings, not this management action.
    if (userId === callerData.user.id) return json(resetFailure, 400);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: targetProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError || !targetProfile) return json(resetFailure, 404);

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      password,
    });
    if (updateError) {
      console.error("Managed password reset failed", updateError);
      return json(resetFailure, 400);
    }

    return json({ message: "تم تعيين كلمة المرور الجديدة للمستخدم." });
  } catch (error) {
    console.error("Unexpected managed password reset error", error);
    return json(resetFailure, 400);
  }
});
