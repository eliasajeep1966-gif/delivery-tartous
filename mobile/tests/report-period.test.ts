import { describe, expect, it } from "vitest";

import {
  assertDateRange,
  optionalDateRange,
} from "../lib/admin/report-period";

describe("optionalDateRange", () => {
  it("uses no date bounds when the manager does not choose a period", () => {
    expect(optionalDateRange(false, "2026-08-01", "2026-08-26")).toEqual({
      startDate: null,
      endDate: null,
    });
  });

  it("uses the selected inclusive date range when enabled", () => {
    expect(optionalDateRange(true, "2026-08-01", "2026-08-26")).toEqual({
      startDate: "2026-08-01",
      endDate: "2026-08-26",
    });
  });
});

describe("assertDateRange", () => {
  it("accepts a same-day report", () => {
    expect(assertDateRange("2026-08-26", "2026-08-26")).toEqual({
      startDate: "2026-08-26",
      endDate: "2026-08-26",
    });
  });

  it("rejects a reversed range", () => {
    expect(() => assertDateRange("2026-08-26", "2026-08-01")).toThrow(
      "يجب أن يكون تاريخ البداية قبل تاريخ النهاية أو مساوياً له.",
    );
  });
});
