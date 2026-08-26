import { describe, expect, it } from "vitest";

import {
  deriveDeliveryTiming,
  formatDeliveryDuration,
  presentDeliveryTiming,
} from "../lib/admin/delivery-duration";

describe("delivery duration", () => {
  const receivedAt = "2026-08-26T08:04:00.000Z";
  const inDeliveryAt = "2026-08-26T08:10:00.000Z";
  const completedAt = "2026-08-26T08:29:00.000Z";

  it("derives a completed delivery only from receive, in-delivery, and complete history events", () => {
    const timing = deriveDeliveryTiming("completed", completedAt, [
      { status: "assigned", timestamp: "2026-08-26T07:58:00.000Z" },
      { status: "received", timestamp: receivedAt },
      { status: "in_delivery", timestamp: inDeliveryAt },
      { status: "completed", timestamp: completedAt },
    ]);

    expect(timing).toEqual({ receivedAt, inDeliveryAt, completedAt });
    expect(formatDeliveryDuration(receivedAt, completedAt)).toBe("٢٥ د");
    expect(presentDeliveryTiming(timing!)).toMatchObject({
      mode: "completed",
      inDeliveryTime: "١١:١٠ ص",
      label: "٢٥ د",
    });
  });

  it("shows both receive and in-delivery timestamps for an active delivery", () => {
    const timing = deriveDeliveryTiming(
      "in_delivery",
      "2026-08-26T08:15:00.000Z",
      [
        { status: "received", timestamp: receivedAt },
        { status: "in_delivery", timestamp: inDeliveryAt },
      ],
    );

    expect(timing).toEqual({ receivedAt, inDeliveryAt, completedAt: null });
    expect(
      presentDeliveryTiming(timing!, Date.parse("2026-08-26T08:22:00.000Z")),
    ).toMatchObject({
      mode: "in_delivery",
      label: "منذ ١٢ د",
      completedTime: null,
      inDeliveryTime: "١١:١٠ ص",
    });
  });

  it("shows receipt time without fabricating a delivery-start time", () => {
    const timing = deriveDeliveryTiming("received", "2026-08-26T08:07:00.000Z", [
      { status: "received", timestamp: receivedAt },
    ]);

    expect(timing).toEqual({
      receivedAt,
      inDeliveryAt: null,
      completedAt: null,
    });
    expect(presentDeliveryTiming(timing!)).toMatchObject({
      mode: "received",
      label: null,
      receivedTime: "١١:٠٤ ص",
    });
  });

  it("does not fabricate a journey when a required transition is absent or out of order", () => {
    expect(
      deriveDeliveryTiming("completed", completedAt, [
        { status: "received", timestamp: receivedAt },
        { status: "completed", timestamp: completedAt },
      ]),
    ).toBeNull();
    expect(
      deriveDeliveryTiming("completed", completedAt, [
        { status: "received", timestamp: receivedAt },
        { status: "in_delivery", timestamp: "2026-08-26T08:45:00.000Z" },
        { status: "completed", timestamp: completedAt },
      ]),
    ).toBeNull();
  });
});
