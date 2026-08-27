import { describe, expect, it } from "vitest";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

describe("Owner user-password reset function", () => {
  it("rejects a non-user token without changing any password", async () => {
    expect(supabaseUrl).toMatch(/^https:\/\/.+/);
    expect(supabasePublishableKey).toBeTruthy();

    const response = await fetch(
      `${supabaseUrl}/functions/v1/owner-reset-user-password`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabasePublishableKey}`,
          apikey: supabasePublishableKey!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "00000000-0000-4000-8000-000000000000",
          password: "A-password-that-is-not-used",
          passwordConfirmation: "A-password-that-is-not-used",
        }),
      },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "PASSWORD_RESET_FAILED",
    });
  }, 15_000);
});
