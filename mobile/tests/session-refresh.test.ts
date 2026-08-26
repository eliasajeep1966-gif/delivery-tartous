import type { Session } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  SESSION_REFRESH_MARGIN_SECONDS,
  sessionNeedsRefresh,
} from "../lib/auth/session-refresh";

const now = 1_800_000_000;

describe("native session refresh timing", () => {
  it("keeps a session whose access token has sufficient remaining lifetime", () => {
    expect(
      sessionNeedsRefresh(
        { expires_at: now + SESSION_REFRESH_MARGIN_SECONDS + 1 } as Pick<
          Session,
          "expires_at"
        >,
        now,
      ),
    ).toBe(false);
  });

  it("refreshes an expired or soon-to-expire access token", () => {
    expect(
      sessionNeedsRefresh(
        { expires_at: now } as Pick<Session, "expires_at">,
        now,
      ),
    ).toBe(true);
    expect(
      sessionNeedsRefresh(
        { expires_at: now + SESSION_REFRESH_MARGIN_SECONDS } as Pick<
          Session,
          "expires_at"
        >,
        now,
      ),
    ).toBe(true);
  });

  it("refreshes when expiry information is unavailable", () => {
    expect(
      sessionNeedsRefresh(
        { expires_at: undefined } as Pick<Session, "expires_at">,
        now,
      ),
    ).toBe(true);
  });
});
