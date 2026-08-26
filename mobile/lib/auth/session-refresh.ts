import type { Session } from "@supabase/supabase-js";

export const SESSION_REFRESH_MARGIN_SECONDS = 90;

export function sessionNeedsRefresh(
  session: Pick<Session, "expires_at">,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  return (
    typeof session.expires_at !== "number" ||
    session.expires_at <= nowSeconds + SESSION_REFRESH_MARGIN_SECONDS
  );
}
