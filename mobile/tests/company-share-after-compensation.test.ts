import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationPath = new URL(
  "../../supabase/migrations/20260831200000_fix_company_share_for_compensated_orders.sql",
  import.meta.url,
);
const detailViewPath = new URL(
  "../components/admin/admin-captain-wage-detail.tsx",
  import.meta.url,
);

describe("Net company share after captain compensation", () => {
  it("uses 30% gross share minus 70% compensation for medicine and false orders", async () => {
    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain("p_source_status = 'false_order' or p_order_kind = 'medicine'");
    expect(migration).toContain("round(coalesce(p_gross_fee, 0) * 0.30, 2) - coalesce(p_captain_amount, 0)");
    expect(migration).toContain("company_financial_result_for_order");
  });

  it("labels the captain detail metric as the company share", async () => {
    const view = await readFile(detailViewPath, "utf8");

    expect(view).toContain('["حصة الشركة (30%)", details.totals.company, BLUE]');
  });
});
