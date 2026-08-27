import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationPath = new URL(
  "../../supabase/migrations/20260828060000_account_for_captain_free_order_compensation.sql",
  import.meta.url,
);
const companyWagesPath = new URL(
  "../components/admin/admin-company-wages.tsx",
  import.meta.url,
);
const adminWagesPath = new URL(
  "../components/admin/admin-wages.tsx",
  import.meta.url,
);
const adminOrdersPath = new URL(
  "../components/admin/admin-orders.tsx",
  import.meta.url,
);
const adminOrdersDataPath = new URL(
  "../features/admin/use-admin-orders.ts",
  import.meta.url,
);

describe("Captain free-order compensation accounting", () => {
  it("treats the captain's 70% free-order wage as a company cost", async () => {
    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      "when p_financial_treatment = 'false_order' then -coalesce(p_captain_amount, 0)",
    );
    expect(migration).toContain("as captain_compensation_amount");
    expect(migration).toContain("when fl.financial_treatment = 'false_order' then fl.captain_amount");
    expect(migration).toContain("create or replace function public.get_company_report_range_summary");
    expect(migration).toContain("create or replace function public.get_company_expense_period_summary");
  });

  it("shows compensation and concise net-profit labels in the company views", async () => {
    const [companyWages, adminWages] = await Promise.all([
      readFile(companyWagesPath, "utf8"),
      readFile(adminWagesPath, "utf8"),
    ]);

    expect(companyWages).toContain('["تعويض الكباتن", totals.compensation, BLUE]');
    expect(companyWages).not.toContain('["طلبات الفترة", totals.orders, BLUE]');
    expect(companyWages).toContain('["الصافي", totals.company - expenseRows.reduce');
    expect(adminWages).toContain(
      '<Text style={styles.profitKicker}>الصافي</Text>',
    );
  });

  it("replaces inactive-status filters with a medicine-order filter", async () => {
    const [ordersView, ordersData] = await Promise.all([
      readFile(adminOrdersPath, "utf8"),
      readFile(adminOrdersDataPath, "utf8"),
    ]);

    expect(ordersView).toContain('{ id: "medicine", label: "طلبات دواء" }');
    expect(ordersView).not.toContain('{ id: "pending", label: "قيد الانتظار" }');
    expect(ordersView).not.toContain('{ id: "assigned", label: "تم تعيين كابتن" }');
    expect(ordersView).not.toContain('{ id: "in_delivery", label: "قيد التوصيل" }');
    expect(ordersData).toContain('query = query.eq("order_kind", "medicine")');
  });
});
