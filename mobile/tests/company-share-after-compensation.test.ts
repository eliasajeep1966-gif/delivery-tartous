import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationPath = new URL(
  "../../supabase/migrations/20260831220000_fix_compensation_company_balance.sql",
  import.meta.url,
);
const detailViewPath = new URL(
  "../components/admin/admin-captain-wage-detail.tsx",
  import.meta.url,
);

describe("Net company share after captain compensation", () => {
  it("uses negative 70% company share for medicine and false orders", async () => {
    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain("p_source_status = 'false_order' or p_order_kind = 'medicine'");
    expect(migration).toContain("then -coalesce(p_captain_amount, 0)");
    expect(migration).toContain("company_financial_result_for_order");
    expect(migration).toContain("then -captain_amount");
    expect(migration).toContain("then -page_rows.captain_amount");
  });

  it("labels the captain detail metric as the company share", async () => {
    const view = await readFile(detailViewPath, "utf8");

    expect(view).toContain('["حصة الشركة (30%)", details.totals.company, BLUE]');
  });
});
