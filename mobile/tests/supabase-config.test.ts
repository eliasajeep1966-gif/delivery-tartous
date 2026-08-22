import { describe, expect, it } from "vitest";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

describe("Supabase Native configuration", () => {
  it("reaches the Auth settings endpoint with the configured publishable key", async () => {
    expect(supabaseUrl).toMatch(/^https:\/\/.+/);
    expect(supabasePublishableKey).toBeTruthy();

    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: {
        apikey: supabasePublishableKey!,
      },
    });

    expect(response.ok).toBe(true);
  }, 15_000);
});
