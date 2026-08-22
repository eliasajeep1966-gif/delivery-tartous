import { describe, expect, it } from "vitest";

import { mapAdminHomeActivities } from "../lib/admin/admin-home-mappers";

describe("Admin Home RPC activity mapper", () => {
  it("maps known order activity fields into the Arabic Home card contract", () => {
    const rows = mapAdminHomeActivities([
      {
        id: "activity-1",
        action: "تم التوصيل",
        order_number: 42,
        actor_name: "أحمد",
        created_at: "2026-08-22T12:00:00.000Z",
        to_status: "completed",
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "activity-1",
      title: "تم تسليم الطلب #42",
      subtitle: "بواسطة أحمد",
      status: "completed",
    });
  });

  it("drops incomplete or malformed activity rows instead of rendering fake data", () => {
    expect(mapAdminHomeActivities([{ id: "missing" }, null, "invalid"])).toEqual([]);
  });
});
