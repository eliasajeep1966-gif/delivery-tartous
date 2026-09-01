import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const adminHomePath = new URL("../components/admin/admin-home.tsx", import.meta.url);
const sortMigrationPath = new URL(
  "../../supabase/migrations/20260830210000_stabilize_captain_active_order_sort.sql",
  import.meta.url,
);

describe("Order editing and stable captain order sort", () => {
  it("shows edit beside cancel under the same eligibility condition", async () => {
    const source = await readFile(adminHomePath, "utf8");
    const condition = 'item.title.startsWith("تم إنشاء الطلب") &&\n    ["pending", "assigned", "received"].includes(item.currentOrderStatus ?? "")';

    expect(source).toContain(condition);
    expect(source).toContain("onRequestEdit(item)");
    expect(source).toContain("تعديل الطلب");
    expect(source).toContain("editableOrder(activity.orderId)");
  });

  it("orders active captain cards by assignment time instead of updated time", async () => {
    const source = await readFile(sortMigrationPath, "utf8");

    expect(source).toContain("order by o.assigned_at asc nulls last, o.created_at asc, o.id asc");
    expect(source).toContain("order by ao.assigned_at asc nulls last, ao.created_at asc, ao.id asc");
    expect(source).not.toContain("order by o.updated_at desc");
  });
});
