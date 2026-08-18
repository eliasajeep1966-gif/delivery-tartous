import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AppRole = "admin" | "supervisor" | "captain";

type InviteRequest = {
  email?: unknown;
  fullName?: unknown;
  role?: unknown;
  custodyItemsText?: unknown;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isAppRole(value: string): value is AppRole {
  return value === "admin" || value === "supervisor" || value === "captain";
}

function parseCustodyItems(value: unknown): string[] {
  if (typeof value !== "string" || value.trim() === "") return [];

  const items = value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (items.length > 20) {
    throw new Error("Maximum 20 custody items are allowed per invitation");
  }

  if (items.some((item) => item.length > 160)) {
    throw new Error("Each custody item must be 160 characters or fewer");
  }

  return [...new Set(items)];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Authentication is required" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Required Supabase server environment variables are missing");
      return json({ error: "Server configuration error" }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const accessToken = authorization.slice("Bearer ".length);
    const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return json({ error: "Invalid or expired session" }, 401);
    }

    const actorId = authData.user.id;
    const { data: actorProfile, error: actorError } = await adminClient
      .from("profiles")
      .select("role, is_active")
      .eq("id", actorId)
      .maybeSingle();

    if (actorError || !actorProfile || actorProfile.is_active !== true || actorProfile.role !== "admin") {
      return json({ error: "Only an active admin can invite users" }, 403);
    }

    const payload = (await req.json()) as InviteRequest;
    const email = asTrimmedString(payload.email).toLowerCase();
    const fullName = asTrimmedString(payload.fullName);
    const role = asTrimmedString(payload.role);
    const custodyItems = parseCustodyItems(payload.custodyItemsText);

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return json({ error: "A valid email is required" }, 400);
    }

    if (!isAppRole(role)) {
      return json({ error: "Role must be admin, supervisor, or captain" }, 400);
    }

    if (fullName.length > 120) {
      return json({ error: "Full name must be 120 characters or fewer" }, 400);
    }

    if (role !== "captain" && custodyItems.length > 0) {
      return json({ error: "Custody items can only be assigned to a captain" }, 400);
    }

    const inviteOptions: { data: Record<string, string>; redirectTo?: string } = {
      data: fullName ? { full_name: fullName } : {},
    };
    const inviteRedirectUrl = Deno.env.get("INVITE_REDIRECT_URL");
    if (inviteRedirectUrl) inviteOptions.redirectTo = inviteRedirectUrl;

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      inviteOptions,
    );

    if (inviteError || !inviteData.user) {
      console.error("Auth invitation failed", inviteError);
      return json({ error: inviteError?.message ?? "Could not create invitation" }, 400);
    }

    const invitedUserId = inviteData.user.id;
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ role, full_name: fullName || null, is_active: true })
      .eq("id", invitedUserId);

    if (profileError) {
      console.error("Profile update failed after invitation", profileError);
      return json({ error: "Invitation was created, but profile setup failed. Contact an administrator." }, 500);
    }

    if (role === "captain") {
      const { error: captainStatusError } = await adminClient
        .from("captain_status")
        .upsert({ captain_id: invitedUserId, availability: "unavailable" }, { onConflict: "captain_id" });
      if (captainStatusError) {
        console.error("Captain status setup failed", captainStatusError);
        return json({ error: "Invitation was created, but captain setup failed. Contact an administrator." }, 500);
      }

      if (custodyItems.length > 0) {
        const custodyRows = custodyItems.map((itemName) => ({
          captain_id: invitedUserId,
          item_name: itemName,
          assigned_by_user_id: actorId,
        }));
        const { error: custodyError } = await adminClient.from("captain_custody").insert(custodyRows);
        if (custodyError) {
          console.error("Custody setup failed", custodyError);
          return json({ error: "Invitation was created, but custody setup failed. Contact an administrator." }, 500);
        }
      }
    }

    const { error: auditError } = await adminClient.from("audit_logs").insert({
      actor_user_id: actorId,
      action: "user_invited",
      entity_type: "profile",
      entity_id: invitedUserId,
      metadata: {
        email,
        role,
        custody_item_count: custodyItems.length,
      },
    });
    if (auditError) console.error("Audit log write failed", auditError);

    return json(
      {
        userId: invitedUserId,
        email,
        role,
        custodyItemCount: custodyItems.length,
        message: "Invitation sent successfully",
      },
      201,
    );
  } catch (error) {
    console.error("Unexpected invite-user error", error);
    return json({ error: "Unexpected server error" }, 500);
  }
});
