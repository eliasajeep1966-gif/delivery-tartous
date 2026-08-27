import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getInfoAsync: vi.fn(),
  isAvailableAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(),
  printToFileAsync: vi.fn(),
  shareAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
}));

vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///documents/",
  EncodingType: { Base64: "base64" },
  getInfoAsync: mocks.getInfoAsync,
  makeDirectoryAsync: mocks.makeDirectoryAsync,
  writeAsStringAsync: mocks.writeAsStringAsync,
}));
vi.mock("expo-print", () => ({
  printToFileAsync: mocks.printToFileAsync,
  printAsync: vi.fn(),
}));
vi.mock("expo-sharing", () => ({
  isAvailableAsync: mocks.isAvailableAsync,
  shareAsync: mocks.shareAsync,
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

import { createAndShareSimplePdfReport } from "../lib/admin/company-report-pdf";

afterEach(() => {
  vi.clearAllMocks();
});

describe("createAndShareSimplePdfReport", () => {
  it("copies the generated PDF into Documents before sharing it", async () => {
    mocks.printToFileAsync.mockResolvedValue({
      base64: "PDF-BASE64",
      uri: "file:///cache/Print/temporary.pdf",
    });
    mocks.getInfoAsync.mockResolvedValue({ exists: true, size: 32 });
    mocks.isAvailableAsync.mockResolvedValue(true);

    await createAndShareSimplePdfReport({
      title: "تقرير الشركة",
      startDate: null,
      endDate: null,
      metrics: [{ label: "إجمالي الطلبات", value: "1 طلب" }],
      generatedBy: "مدير",
    });

    expect(mocks.printToFileAsync).toHaveBeenCalledWith(
      expect.objectContaining({ base64: true }),
    );
    expect(mocks.makeDirectoryAsync).toHaveBeenCalledWith(
      "file:///documents/delivery-tartous-reports/",
      { intermediates: true },
    );
    expect(mocks.writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/documents\/delivery-tartous-reports\/.+\.pdf$/),
      "PDF-BASE64",
      { encoding: "base64" },
    );
    expect(mocks.shareAsync).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/documents\/delivery-tartous-reports\/.+\.pdf$/),
      expect.objectContaining({ mimeType: "application/pdf" }),
    );
    expect(mocks.shareAsync).not.toHaveBeenCalledWith(
      "file:///cache/Print/temporary.pdf",
      expect.anything(),
    );
  });

  it("includes a financial breakdown chart with the supplied labels and amounts", async () => {
    mocks.printToFileAsync.mockResolvedValue({
      base64: "PDF-BASE64",
      uri: "file:///cache/Print/temporary.pdf",
    });
    mocks.getInfoAsync.mockResolvedValue({ exists: true, size: 32 });
    mocks.isAvailableAsync.mockResolvedValue(true);

    await createAndShareSimplePdfReport({
      title: "تقرير مالي للمكتب",
      startDate: "2026-08-22",
      endDate: "2026-08-28",
      metrics: [{ label: "صافي الشركة", value: "3,000 ل.س", highlighted: true }],
      breakdown: [
        { label: "أجور الكباتن", value: 7_000, color: "#1677C8" },
        { label: "تعويض الكباتن", value: 7_000, color: "#8B5CF6" },
        { label: "مصاريف المكتب", value: 1_234.5, color: "#F59E0B" },
        { label: "نتيجة الشركة", value: -4_000, color: "#E05252" },
      ],
      generatedBy: "مدير",
    });

    const html = mocks.printToFileAsync.mock.calls[0]?.[0]?.html as string;
    expect(html).toContain("توزيع البنود المالية");
    expect(html).toContain("أجور الكباتن");
    expect(html).toContain("تعويض الكباتن");
    expect(html).toContain("مصاريف المكتب");
    expect(html).toContain("نتيجة الشركة");
    expect(html).toContain("stroke-dasharray");
  });
});
