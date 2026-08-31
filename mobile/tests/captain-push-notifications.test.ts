import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const notificationsPath = new URL("../lib/notifications.ts", import.meta.url);
const layoutPath = new URL("../app/_layout.tsx", import.meta.url);
const assignmentFunctionPath = new URL(
  "../../supabase/functions/send-order-push/index.ts",
  import.meta.url,
);
const cancellationFunctionPath = new URL(
  "../../supabase/functions/send_order_cancellation_push/index.ts",
  import.meta.url,
);

describe("Captain push notifications", () => {
  it("keeps assignment and cancellation notifications high priority with sound channels", async () => {
    const [assignment, cancellation] = await Promise.all([
      readFile(assignmentFunctionPath, "utf8"),
      readFile(cancellationFunctionPath, "utf8"),
    ]);

    for (const source of [assignment, cancellation]) {
      expect(source).toContain('priority: "high"');
      expect(source).toContain("channelId:");
      expect(source).toContain("sound:");
    }
    expect(assignment).toContain('channelId: "new_order_alerts"');
    expect(cancellation).toContain('channelId: "cancelled_order_alerts"');
  });

  it("handles assignment sound in the foreground and notification receipt in the app root", async () => {
    const [notifications, layout] = await Promise.all([
      readFile(notificationsPath, "utf8"),
      readFile(layoutPath, "utf8"),
    ]);

    expect(notifications).toContain('data?.type !== "assigned_order"');
    expect(notifications).toContain("subscribeToCaptainOrderAssignment");
    expect(layout).toContain("subscribeToCaptainOrderAssignment");
    expect(layout).toContain('playSound("newOrder")');
    expect(layout).toContain("CaptainCancellationAlert");
  });
});
