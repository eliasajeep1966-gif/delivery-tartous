import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationPath = new URL(
  "../../supabase/migrations/20260828050000_use_saturday_for_company_finance_weeks.sql",
  import.meta.url,
);

function saturdayWeekStart(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const daysSinceSaturday = (date.getUTCDay() + 1) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceSaturday);
  return date.toISOString().slice(0, 10);
}

describe("Company finance Saturday-to-Friday weeks", () => {
  it("groups each business day into the correct Saturday-started week", () => {
    expect(saturdayWeekStart("2026-08-22")).toBe("2026-08-22");
    expect(saturdayWeekStart("2026-08-24")).toBe("2026-08-22");
    expect(saturdayWeekStart("2026-08-28")).toBe("2026-08-22");
    expect(saturdayWeekStart("2026-08-29")).toBe("2026-08-29");
  });

  it("uses the same Saturday-start helper for company profits and office expenses", async () => {
    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain("create or replace function private.saturday_week_start");
    expect(migration).toContain("private.saturday_week_start(ld.business_day)");
    expect(migration).toContain("private.saturday_week_start(business_day)");
    expect(migration).toContain("when 'weekly' then pl.period_start + 6");
    expect(migration).toContain("when 'weekly' then g.period_start + 6");
  });
});
