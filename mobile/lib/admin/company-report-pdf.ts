import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { formatReportDate } from "@/lib/admin/report-period";

export type CompanyPdfReport = {
  title: string;
  startDate: string;
  endDate: string;
  grossTotal: number;
  orderCount: number;
  companyTotal: number;
  captainTotal: number;
  expenseTotal?: number;
  netTotal: number;
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

function amount(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${new Intl.NumberFormat("ar-SY-u-nu-latn", {
    maximumFractionDigits: 2,
  }).format(safeValue)} ل.س`;
}

function dateTime(value: Date): string {
  return new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Damascus",
  }).format(value);
}

function metric(label: string, value: string, highlighted = false): string {
  return `
    <div class="metric ${highlighted ? "metric-highlight" : ""}">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function buildCompanyReportHtml(report: CompanyPdfReport): string {
  const expenses = report.expenseTotal ?? 0;
  const hasExpenses = report.expenseTotal !== undefined;
  const period = `${formatReportDate(report.startDate)} — ${formatReportDate(report.endDate)}`;
  const preparedBy = report.generatedBy?.trim() || "إدارة Delivery Tartous";
  const metrics = [
    metric("إجمالي الأجور", amount(report.grossTotal)),
    metric("إجمالي الطلبات", `${new Intl.NumberFormat("ar-SY-u-nu-latn").format(report.orderCount)} طلب`),
    metric("حصة الكباتن", amount(report.captainTotal)),
    metric("صافي المكتب قبل المصاريف", amount(report.companyTotal)),
    ...(hasExpenses ? [metric("إجمالي المصاريف", amount(expenses))] : []),
    metric(hasExpenses ? "الصافي بعد المصاريف" : "صافي المكتب", amount(report.netTotal), true),
  ].join("");

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
      .period { font-size: 13px; margin-top: 9px; opacity: .94; }
      .content { padding: 20px; }
      .section-label { color: #5b7b92; font-size: 11px; font-weight: 700; margin-bottom: 7px; }
      .metrics { display: flex; flex-wrap: wrap; gap: 10px; }
      .metric { background: #f6fbff; border: 1px solid #dcecf6; border-radius: 12px; min-height: 75px; padding: 12px; width: calc(50% - 5px); }
      .metric-highlight { background: #e7f8ef; border-color: #b6e8cd; }
      .metric-label { color: #58758b; font-size: 11px; font-weight: 700; }
      .metric-value { color: #123d60; font-size: 17px; font-weight: 700; margin-top: 4px; }
      .metric-highlight .metric-value { color: #08755c; }
      .note { background: #fff9e8; border: 1px solid #f6e5b6; border-radius: 10px; color: #715b20; font-size: 10px; margin-top: 17px; padding: 10px 12px; }
      .footer { border-top: 1px solid #e4edf3; color: #69869a; font-size: 10px; margin-top: 18px; padding-top: 12px; }
    </style>
  </head>
  <body>
    <main class="sheet">
      <section class="header">
        <div class="brand">DELIVERY TARTOUS</div>
        <h1 class="title">${escapeHtml(report.title)}</h1>
        <div class="period">الفترة: ${escapeHtml(period)}</div>
      </section>
      <section class="content">
        <div class="section-label">ملخص الأداء المالي</div>
        <div class="metrics">${metrics}</div>
        ${hasExpenses ? '<div class="note">الصافي في هذا التقرير يساوي حصة المكتب من الطلبات ناقص مصاريف المكتب المسجلة ضمن الفترة.</div>' : ""}
        <div class="footer">أُنشئ بتاريخ ${escapeHtml(dateTime(new Date()))} بواسطة ${escapeHtml(preparedBy)}</div>
      </section>
    </main>
  </body>
</html>`;
}

export async function createAndShareCompanyReportPdf(
  report: CompanyPdfReport,
): Promise<void> {
  const html = buildCompanyReportHtml(report);

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
