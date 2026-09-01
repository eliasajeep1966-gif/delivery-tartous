import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("company treasury net formula", () => {
  it("uses the actual company result and subtracts office expenses cumulatively", async () => {
    const source = await readFile(
      new URL(
        "../../supabase/migrations/20260831240000_link_treasury_to_cumulative_company_net.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(source).toContain("private.company_financial_result_for_order");
    expect(source).toContain("select sum(e.amount) from public.office_expenses e");
    expect(source).toContain("select private.sync_treasury_balance()");
    expect(source).toContain("v_company_result, 0) > 0");
    expect(source).not.toContain("new.company_amount > 0");
  });
});
