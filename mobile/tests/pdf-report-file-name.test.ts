import { describe, expect, it, vi } from "vitest";

vi.mock("expo-file-system/legacy", () => ({}));
vi.mock("expo-print", () => ({}));
vi.mock("expo-sharing", () => ({}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

import { pdfReportFileName } from "../lib/admin/company-report-pdf";

describe("pdfReportFileName", () => {
  it("creates a local PDF filename without unsafe path characters", () => {
    const name = pdfReportFileName(
      "تقرير الشركة / آب 2026",
      new Date("2026-08-26T10:20:30.456Z"),
    );

    expect(name).toMatch(/^تقرير-الشركة-آب-2026-2026-08-26T10-20-30-456Z\.pdf$/);
    expect(name).not.toContain("/");
  });

  it("uses a fallback title when the report title has no valid characters", () => {
    expect(pdfReportFileName("---", new Date("2026-08-26T00:00:00Z"))).toBe(
      "delivery-tartous-report-2026-08-26T00-00-00-000Z.pdf",
    );
  });
});
