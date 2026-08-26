import { describe, expect, it } from "vitest";

import {
  deriveDeliveryTiming,
  formatDeliveryDuration,
  presentDeliveryTiming,
} from "../lib/admin/delivery-duration";

describe("delivery duration", () => {
  const receivedAt = "2026-08-26T08:04:00.000Z";
  const completedAt = "2026-08-26T08:29:00.000Z";

  it("derives a completed delivery only from receive and complete history events", () => {
    const timing = deriveDeliveryTiming("completed", completedAt, [
      { status: "assigned", timestamp: "2026-08-26T07:58:00.000Z" },
      { status: "received", timestamp: receivedAt },
      { status: "in_delivery", timestamp: "2026-08-26T08:10:00.000Z" },
      { status: "completed", timestamp: completedAt },
    ]);

    expect(timing).toEqual({ receivedAt, completedAt });
    expect(formatDeliveryDuration(receivedAt, completedAt)).toBe("٢٥ د");
  });

  it("uses an elapsed label only for an active order with a recorded receive event", () => {
    const timing = deriveDeliveryTiming(
      "in_delivery",
      "2026-08-26T08:15:00.000Z",
      [{ status: "received", timestamp: receivedAt }],
    );

    expect(timing).toEqual({ receivedAt, completedAt: null });
    expect(
      presentDeliveryTiming(timing!, Date.parse("2026-08-26T08:22:00.000Z")),
    ).toMatchObject({
      mode: "active",
      label: "منذ ١٨ د",
      completedTime: null,
    });
  });

  it("does not fabricate a duration when the receipt event is absent or after completion", () => {
    expect(
      deriveDeliveryTiming("completed", completedAt, [
        { status: "completed", timestamp: completedAt },
      ]),
    ).toBeNull();
    expect(
      deriveDeliveryTiming("completed", completedAt, [
        { status: "received", timestamp: "2026-08-26T08:45:00.000Z" },
        { status: "completed", timestamp: completedAt },
      ]),
    ).toBeNull();
  });
});
