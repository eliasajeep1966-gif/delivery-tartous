import { describe, expect, it } from "vitest";

import config from "../app.config";

describe("Expo Supabase manifest configuration", () => {
  it("includes the configured public Supabase connection in Expo extra", () => {
    expect(config.extra?.supabaseUrl).toMatch(/^https:\/\/.+/);
    expect(config.extra?.supabasePublishableKey).toBeTruthy();
  });
});
