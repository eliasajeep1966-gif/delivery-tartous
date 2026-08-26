import { describe, expect, it } from "vitest";

import {
  assertDateRange,
  rangeForPeriod,
} from "../lib/admin/report-period";

describe("rangeForPeriod", () => {
  it("keeps a daily report within the selected day", () => {
    expect(rangeForPeriod("daily", "2026-08-26")).toEqual({
      startDate: "2026-08-26",
      endDate: "2026-08-26",
    });
  });

  it("starts weekly reports on Monday and ends them on Sunday", () => {
    expect(rangeForPeriod("weekly", "2026-08-26", "2026-12-31")).toEqual({
      startDate: "2026-08-24",
      endDate: "2026-08-30",
    });
  });

  it("uses the full month for a monthly report", () => {
    expect(rangeForPeriod("monthly", "2026-02-12", "2026-12-31")).toEqual({
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });
  });

  it("uses the full year for an annual report", () => {
    expect(rangeForPeriod("annual", "2026-08-26", "2026-12-31")).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
  });

  it("does not include dates after today for the current calendar period", () => {
    expect(rangeForPeriod("monthly", "2026-08-26", "2026-08-26")).toEqual({
      startDate: "2026-08-01",
      endDate: "2026-08-26",
    });
  });
});

describe("assertDateRange", () => {
  it("accepts an inclusive range", () => {
    expect(assertDateRange("2026-08-01", "2026-08-26")).toEqual({
      startDate: "2026-08-01",
      endDate: "2026-08-26",
    });
  });

  it("rejects a reversed range", () => {
    expect(() => assertDateRange("2026-08-26", "2026-08-01")).toThrow(
      "يجب أن يكون تاريخ البداية قبل تاريخ النهاية أو مساوياً له.",
    );
  });
});
