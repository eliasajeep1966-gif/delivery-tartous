import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { formatReportDate } from "./report-period";

export type PdfReportMetric = {
  label: string;
  value: string;
  highlighted?: boolean;
};

export type PdfReportChartSlice = {
  label: string;
  value: number;
  color: string;
};

export type SimplePdfReport = {
  title: string;
  subject?: string;
  startDate: string | null;
  endDate: string | null;
  metrics: PdfReportMetric[];
  breakdown?: PdfReportChartSlice[];
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

function buildFinancialBreakdown(breakdown: PdfReportChartSlice[]): string {
  const slices = breakdown
    .filter((item) => Number.isFinite(item.value) && Math.abs(item.value) > 0.005)
    .map((item) => ({ ...item, magnitude: Math.abs(item.value) }));
  const total = slices.reduce((sum, item) => sum + item.magnitude, 0);

  if (!slices.length || total <= 0) {
    return `
      <section class="breakdown-card">
        <div class="section-label">توزيع البنود المالية</div>
        <div class="empty-breakdown">لا توجد مبالغ مالية قابلة للعرض ضمن هذه الفترة.</div>
      </section>
    `;
  }

  const radius = 53;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const chartSegments = slices
    .map((item) => {
      const length = (item.magnitude / total) * circumference;
      const segment = `<circle cx="70" cy="70" r="${radius}" fill="none" stroke="${escapeHtml(item.color)}" stroke-width="18" stroke-linecap="butt" stroke-dasharray="${length} ${circumference}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)" />`;
      offset += length;
      return segment;
    })
    .join("");

  const legend = slices
    .map(
      (item) => `
        <div class="legend-item">
          <span class="legend-dot" style="background:${escapeHtml(item.color)}"></span>
          <div class="legend-text">
            <div class="legend-label">${escapeHtml(item.label)}</div>
            <div class="legend-value">${escapeHtml(money(item.value))}</div>
          </div>
        </div>
      `,
    )
    .join("");

  return `
    <section class="breakdown-card">
      <div class="section-label">توزيع البنود المالية</div>
      <div class="breakdown-layout">
        <div class="chart-wrap">
          <svg class="donut" viewBox="0 0 140 140" role="img" aria-label="توزيع البنود المالية">
            <circle cx="70" cy="70" r="${radius}" fill="none" stroke="#e8f0f5" stroke-width="18" />
            ${chartSegments}
            <text x="70" y="66" text-anchor="middle" class="chart-title">توزيع</text>
            <text x="70" y="82" text-anchor="middle" class="chart-subtitle">البنود</text>
          </svg>
        </div>
        <div class="legend">${legend}</div>
      </div>
      <div class="breakdown-note">الدائرة تقارن حجم البنود، أما صافي الشركة فيُقرأ من بطاقة النتيجة النهائية أدناه.</div>
    </section>
  `;
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
      @page { margin: 22px; }
      * { box-sizing: border-box; }
      body { color: #173b59; direction: rtl; font-family: Arial, Tahoma, sans-serif; font-size: 12px; line-height: 1.65; margin: 0; }
      .sheet { border: 1px solid #cfe4f2; border-radius: 18px; overflow: hidden; }
      .header { background: linear-gradient(135deg, #075f9f, #0878d1); color: #ffffff; padding: 24px; }
      .brand { font-size: 12px; font-weight: 700; letter-spacing: .6px; opacity: .9; }
      .title { font-size: 24px; font-weight: 700; margin: 5px 0 0; }
      .subject { font-size: 14px; font-weight: 700; margin-top: 8px; }
      .period { font-size: 12px; margin-top: 6px; opacity: .94; }
      .content { padding: 20px; }
      .section-label { color: #315f7b; font-size: 11px; font-weight: 700; margin-bottom: 8px; }
      .metrics { display: flex; flex-wrap: wrap; gap: 10px; }
      .metric { background: #f6fbff; border: 1px solid #dcecf6; border-radius: 12px; min-height: 76px; padding: 12px; width: calc(50% - 5px); }
      .metric-highlight { background: #e7f8ef; border-color: #b6e8cd; }
      .metric-label { color: #58758b; font-size: 11px; font-weight: 700; }
      .metric-value { color: #123d60; font-size: 17px; font-weight: 700; margin-top: 4px; }
      .metric-highlight .metric-value { color: #08755c; }
      .breakdown-card { background: #fbfdff; border: 1px solid #dcecf6; border-radius: 14px; margin-top: 16px; padding: 14px; }
      .breakdown-layout { align-items: center; display: flex; gap: 18px; }
      .chart-wrap { flex: 0 0 142px; text-align: center; }
      .donut { height: 140px; overflow: visible; width: 140px; }
      .chart-title { fill: #204a66; font-family: Arial, Tahoma, sans-serif; font-size: 13px; font-weight: 700; }
      .chart-subtitle { fill: #6a879a; font-family: Arial, Tahoma, sans-serif; font-size: 10px; }
      .legend { flex: 1; }
      .legend-item { align-items: center; border-bottom: 1px solid #e8f0f5; display: flex; gap: 8px; min-height: 35px; padding: 4px 0; }
      .legend-item:last-child { border-bottom: 0; }
      .legend-dot { border-radius: 50%; display: inline-block; flex: 0 0 10px; height: 10px; width: 10px; }
      .legend-text { display: flex; flex: 1; justify-content: space-between; gap: 10px; }
      .legend-label { color: #496b81; font-size: 10px; font-weight: 700; }
      .legend-value { color: #173b59; direction: rtl; font-size: 10px; font-weight: 700; white-space: nowrap; }
      .breakdown-note { color: #6a879a; font-size: 9px; line-height: 1.6; margin-top: 10px; }
      .empty-breakdown { color: #6a879a; font-size: 11px; padding: 10px 0 2px; }
      .interpretation { background: #fff8e8; border: 1px solid #f3dfaa; border-radius: 11px; color: #735f28; font-size: 10px; line-height: 1.7; margin-top: 14px; padding: 10px 12px; }
      .footer { border-top: 1px solid #e4edf3; color: #69869a; font-size: 9px; line-height: 1.7; margin-top: 18px; padding-top: 12px; }
      @media print { .sheet { break-inside: avoid; } }
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
        <div class="section-label">الملخص المالي</div>
        <div class="metrics">${metrics}</div>
        ${report.breakdown ? buildFinancialBreakdown(report.breakdown) : ""}
        <div class="interpretation">هذا ملخص مالي وتشغيلي داخلي. صافي الشركة يعكس نتيجة الطلبات بعد تعويضات الكباتن للطلبات المجانية ثم بعد مصاريف المكتب.</div>
        <div class="footer">أُنشئ بتاريخ ${escapeHtml(generatedAt(new Date()))} بواسطة ${escapeHtml(preparedBy)}<br />للمراجعة الإدارية الداخلية؛ لا يحل محل القيود المحاسبية أو المتطلبات الضريبية الرسمية.</div>
      </section>
    </main>
  </body>
</html>`;
}

export function pdfReportFileName(title: string, now = new Date()): string {
  const normalizedTitle = title
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  return `${normalizedTitle || "delivery-tartous-report"}-${timestamp}.pdf`;
}

async function savePdfForSharing(
  title: string,
  base64: string | undefined,
): Promise<string> {
  if (!base64) {
    throw new Error("تعذر قراءة ملف PDF الذي أنشأه التطبيق.");
  }

  const documentsDirectory = FileSystem.documentDirectory;
  if (!documentsDirectory) {
    throw new Error("مساحة حفظ ملفات PDF غير متاحة على هذا الجهاز.");
  }

  const reportsDirectory = `${documentsDirectory}delivery-tartous-reports/`;
  await FileSystem.makeDirectoryAsync(reportsDirectory, { intermediates: true });
  const destinationUri = `${reportsDirectory}${pdfReportFileName(title)}`;
  await FileSystem.writeAsStringAsync(destinationUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const info = await FileSystem.getInfoAsync(destinationUri);
  if (!info.exists || info.size === 0) {
    throw new Error("تعذر حفظ ملف PDF في ملفات التطبيق.");
  }

  return destinationUri;
}

export async function createAndShareSimplePdfReport(
  report: SimplePdfReport,
): Promise<void> {
  const html = buildSimplePdfHtml(report);

  if (Platform.OS === "web") {
    await Print.printToFileAsync({ html });
    return;
  }

  const generated = await Print.printToFileAsync({ html, base64: true });
  const shareableUri = await savePdfForSharing(report.title, generated.base64);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(shareableUri, {
      UTI: "com.adobe.pdf",
      mimeType: "application/pdf",
      dialogTitle: report.title,
    });
    return;
  }

  await Print.printAsync({ uri: shareableUri });
}
