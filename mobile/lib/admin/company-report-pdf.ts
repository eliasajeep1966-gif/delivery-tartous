import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { formatReportDate } from "@/lib/admin/report-period";

export type PdfReportMetric = {
  label: string;
  value: string;
  highlighted?: boolean;
};

export type SimplePdfReport = {
  title: string;
  subject?: string;
  startDate: string | null;
  endDate: string | null;
  metrics: PdfReportMetric[];
  generatedBy: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function money(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${new Intl.NumberFormat("ar-SY-u-nu-latn", {
    maximumFractionDigits: 2,
  }).format(safeValue)} ل.س`;
}

export function orderCount(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${new Intl.NumberFormat("ar-SY-u-nu-latn").format(safeValue)} طلب`;
}

function periodLabel(startDate: string | null, endDate: string | null): string {
  if (!startDate || !endDate) return "كامل السجل المسجل";
  if (startDate === endDate) return formatReportDate(startDate);
  return `من ${formatReportDate(startDate)} إلى ${formatReportDate(endDate)}`;
}

function generatedAt(value: Date): string {
  return new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Damascus",
  }).format(value);
}

function buildSimplePdfHtml(report: SimplePdfReport): string {
  const preparedBy = report.generatedBy?.trim() || "إدارة Delivery Tartous";
  const metrics = report.metrics
    .map(
      (item) => `
        <div class="metric ${item.highlighted ? "metric-highlight" : ""}">
          <div class="metric-label">${escapeHtml(item.label)}</div>
          <div class="metric-value">${escapeHtml(item.value)}</div>
        </div>
      `,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { margin: 24px; }
      * { box-sizing: border-box; }
      body { color: #173b59; direction: rtl; font-family: Arial, Tahoma, sans-serif; font-size: 12px; line-height: 1.65; margin: 0; }
      .sheet { border: 1px solid #cfe4f2; border-radius: 18px; overflow: hidden; }
      .header { background: #0878d1; color: #ffffff; padding: 24px; }
      .brand { font-size: 12px; font-weight: 700; opacity: .88; }
      .title { font-size: 24px; font-weight: 700; margin: 5px 0 0; }
      .subject { font-size: 14px; font-weight: 700; margin-top: 8px; }
      .period { font-size: 12px; margin-top: 6px; opacity: .94; }
      .content { padding: 20px; }
      .section-label { color: #5b7b92; font-size: 11px; font-weight: 700; margin-bottom: 7px; }
      .metrics { display: flex; flex-wrap: wrap; gap: 10px; }
      .metric { background: #f6fbff; border: 1px solid #dcecf6; border-radius: 12px; min-height: 75px; padding: 12px; width: calc(50% - 5px); }
      .metric-highlight { background: #e7f8ef; border-color: #b6e8cd; }
      .metric-label { color: #58758b; font-size: 11px; font-weight: 700; }
      .metric-value { color: #123d60; font-size: 17px; font-weight: 700; margin-top: 4px; }
      .metric-highlight .metric-value { color: #08755c; }
      .footer { border-top: 1px solid #e4edf3; color: #69869a; font-size: 10px; margin-top: 18px; padding-top: 12px; }
    </style>
  </head>
  <body>
    <main class="sheet">
      <section class="header">
        <div class="brand">DELIVERY TARTOUS</div>
        <h1 class="title">${escapeHtml(report.title)}</h1>
        ${report.subject ? `<div class="subject">${escapeHtml(report.subject)}</div>` : ""}
        <div class="period">الفترة: ${escapeHtml(periodLabel(report.startDate, report.endDate))}</div>
      </section>
      <section class="content">
        <div class="section-label">الملخص</div>
        <div class="metrics">${metrics}</div>
        <div class="footer">أُنشئ بتاريخ ${escapeHtml(generatedAt(new Date()))} بواسطة ${escapeHtml(preparedBy)}</div>
      </section>
    </main>
  </body>
</html>`;
}

export async function createAndShareSimplePdfReport(
  report: SimplePdfReport,
): Promise<void> {
  const html = buildSimplePdfHtml(report);

  if (Platform.OS === "web") {
    await Print.printToFileAsync({ html });
    return;
  }

  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      UTI: "com.adobe.pdf",
      mimeType: "application/pdf",
      dialogTitle: report.title,
    });
    return;
  }

  await Print.printAsync({ uri: file.uri });
}
