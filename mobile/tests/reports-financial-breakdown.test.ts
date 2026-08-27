import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const reportsScreenPath = new URL("../app/(admin)/reports.tsx", import.meta.url);
const pdfReportPath = new URL("../lib/admin/company-report-pdf.ts", import.meta.url);

describe("Reports financial breakdown", () => {
  it("shows the four requested coloured totals and rotates the in-app chart", async () => {
    const screen = await readFile(reportsScreenPath, "utf8");

    expect(screen).toContain('import Svg, { Circle } from "react-native-svg";');
    expect(screen).toContain("function FinancialBreakdownChart");
    expect(screen).toContain("مصاريف المكتب");
    expect(screen).toContain("أجور الكباتن العادية");
    expect(screen).toContain("تعويضات الكباتن");
    expect(screen).toContain("صافي الشركة");
    expect(screen).toContain('color: "#1677C8"');
    expect(screen).toContain('color: "#8B5CF6"');
    expect(screen).toContain('color: "#F59E0B"');
    expect(screen).toContain("Animated.timing(rotation");
    expect(screen).toContain("duration: 850");
    expect(screen).toContain("animationKey={`${period}:${summary.periodStart}:${summary.periodEnd}`}");
    expect(screen).toContain("useNativeOfficeExpensePeriods(period)");
    expect(screen).toContain("wages.changePeriod(item.id)");
    expect(screen).not.toContain("نتيجة الشركة قبل المصاريف");
    expect(screen).not.toContain("الدائرة للمقارنة البصرية");
  });

  it("keeps the PDF as a clean printable summary without the in-app chart", async () => {
    const pdf = await readFile(pdfReportPath, "utf8");

    expect(pdf).not.toContain("PdfReportChartSlice");
    expect(pdf).not.toContain("buildFinancialBreakdown");
    expect(pdf).not.toContain("stroke-dasharray");
  });
});
