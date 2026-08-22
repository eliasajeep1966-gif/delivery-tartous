import { describe, expect, it } from "vitest";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

describe("Pending account activation function", () => {
  it("reaches the deployed function and rejects an intentionally invalid payload without creating an account", async () => {
    expect(supabaseUrl).toMatch(/^https:\/\/.+/);
    expect(supabasePublishableKey).toBeTruthy();

    const response = await fetch(`${supabaseUrl}/functions/v1/activate-pending-account`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabasePublishableKey}`,
        apikey: supabasePublishableKey!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "invalid-email",
        password: "short",
        passwordConfirmation: "different",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "ACTIVATION_FAILED" });
  }, 15_000);
});
