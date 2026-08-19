import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const genericActivationFailure = {
  error: "ACTIVATION_FAILED",
  message: "Activation could not be completed. Check your details and contact an administrator.",
};

type ActivationRequest = {
  email?: unknown;
  password?: unknown;
  passwordConfirmation?: unknown;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizedEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(genericActivationFailure, 400);
  }

  try {
    const payload = (await req.json()) as ActivationRequest;
    const email = normalizedEmail(payload.email);
    const password = stringValue(payload.password);
    const passwordConfirmation = stringValue(payload.passwordConfirmation);

    // This public entry point deliberately returns one failure shape for all invalid states.
    if (!validEmail(email) || password.length < 12 || password !== passwordConfirmation) {
      return json(genericActivationFailure, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase server configuration");
      return json(genericActivationFailure, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Pre-check avoids creating an Auth user for a non-pending email.
    // The final server-only RPC locks the row and repeats the state check atomically.
    const { data: pending, error: pendingError } = await adminClient
      .from("pending_account_activations")
      .select("id")
      .eq("email", email)
      .is("activated_at", null)
      .is("cancelled_at", null)
      .maybeSingle();

    if (pendingError || !pending) {
      return json(genericActivationFailure, 400);
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !created.user) {
      console.error("Pending activation createUser failed", createError);
      return json(genericActivationFailure, 400);
    }

    const authUserId = created.user.id;
    const { data: profile, error: finalizeError } = await adminClient.rpc(
      "finalize_pending_account_activation",
      {
        p_email: email,
        p_auth_user_id: authUserId,
      },
    );

    if (finalizeError || !profile) {
      console.error("Pending activation finalization failed", finalizeError);

      // Best-effort compensation: auth.users -> profiles is cascade-linked.
      // A failed finalization must not leave a usable Auth account behind.
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(authUserId);
      if (deleteError) console.error("Failed activation compensation delete", deleteError);

      return json(genericActivationFailure, 400);
    }

    return json({
      message: "Account activated successfully.",
      profile: {
        id: profile.id,
        role: profile.role,
      },
    }, 201);
  } catch (error) {
    console.error("Unexpected pending account activation error", error);
    return json(genericActivationFailure, 400);
  }
});
