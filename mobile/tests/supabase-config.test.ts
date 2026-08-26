import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

describe("Supabase Native configuration", () => {
  it("uses locked, persistent secure session storage on native devices", () => {
    const source = readFileSync(
      resolve(__dirname, "../lib/supabase/native-supabase.ts"),
      "utf8",
    );

    expect(source).toContain("lock: processLock");
    expect(source).toContain("persistSession: true");
    expect(source).toContain('storageKey: "delivery-tartous.auth.session"');
  });

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
