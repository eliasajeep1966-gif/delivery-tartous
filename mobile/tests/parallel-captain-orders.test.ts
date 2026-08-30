import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationPath = new URL(
  "../../supabase/migrations/20260830183000_allow_parallel_captain_orders.sql",
  import.meta.url,
);
const dashboardPath = new URL(
  "../features/captain/use-native-captain-dashboard.ts",
  import.meta.url,
);
const captainHomePath = new URL(
  "../components/captain/captain-home.tsx",
  import.meta.url,
);
const notificationsPath = new URL("../lib/notifications.ts", import.meta.url);

describe("Parallel captain orders", () => {
  it("keeps manual availability as the only assignment gate", async () => {
    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      "cs.availability = 'available'::public.captain_availability",
    );
    expect(migration).not.toContain("v_captain_is_busy");
    expect(migration).not.toContain("busy with an active order");
  });

  it("returns and operates every active order independently", async () => {
    const [migration, dashboard] = await Promise.all([
      readFile(migrationPath, "utf8"),
      readFile(dashboardPath, "utf8"),
    ]);

    expect(migration).toContain("'active_orders'");
    expect(dashboard).toContain("const [activeOrders, setActiveOrders]");
    expect(dashboard).toContain("orderTransitionInFlight.current.has(orderId)");
    expect(dashboard).toContain("setSavingOrderIds");
  });

  it("queues a full new-order experience for realtime assignments", async () => {
    const [dashboard, home, notifications] = await Promise.all([
      readFile(dashboardPath, "utf8"),
      readFile(captainHomePath, "utf8"),
      readFile(notificationsPath, "utf8"),
    ]);

    expect(dashboard).toContain("setNewOrderQueue");
    expect(home).toContain("activeOrders.map((order, index)");
    expect(home).toContain('visible={Boolean(presentedNewOrderId)}');
    expect(home).toContain("subscribeToCaptainOrderAssignment");
    expect(notifications).toContain('data?.type !== "assigned_order"');
    expect(notifications).toContain('"new_order_alerts"');
  });
});
