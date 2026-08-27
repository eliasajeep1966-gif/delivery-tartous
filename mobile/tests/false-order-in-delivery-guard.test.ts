import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const captainHomePath = new URL(
  "../components/captain/captain-home.tsx",
  import.meta.url,
);
const migrationPath = new URL(
  "../../supabase/migrations/20260828040000_restrict_false_order_to_in_delivery.sql",
  import.meta.url,
);

describe("False-order compensation guard", () => {
  it("shows the false-order action only while the captain is in delivery", async () => {
    const source = await readFile(captainHomePath, "utf8");

    expect(source).toContain('{current.status === "in_delivery" ? (');
    expect(source).not.toContain(
      'current.status === "received" ||\n                    current.status === "in_delivery"',
    );
  });

  it("rejects false-order transitions before in_delivery in the database", async () => {
    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      "and old.status <> 'in_delivery'::public.order_status then",
    );
    expect(migration).toContain(
      "Only an in-delivery order can be marked false",
    );
    expect(migration).toContain(
      "create trigger prevent_false_order_before_delivery",
    );
  });
});
