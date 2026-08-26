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
});
