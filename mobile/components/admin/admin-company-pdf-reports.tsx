import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FinancialDatePicker } from "@/components/ui/financial-date-picker";
import {
  createAndShareCompanyReportPdf,
} from "@/lib/admin/company-report-pdf";
import {
  assertDateRange,
  currentDamascusDateKey,
  damascusDateKey,
  formatReportDate,
  periodLabel,
  rangeForPeriod,
  type CompanyReportPeriod,
} from "@/lib/admin/report-period";
import { nativeCompanyPdfReportContract } from "@/features/admin/use-admin-finance";

type ReportMode = "period" | "company";
type PickerTarget = "period" | "start" | "end" | null;

const PERIODS: { id: CompanyReportPeriod; label: string }[] = [
  { id: "daily", label: "يومي" },
  { id: "weekly", label: "أسبوعي" },
  { id: "monthly", label: "شهري" },
  { id: "annual", label: "سنوي" },
];

function displayDate(value: string) {
  return formatReportDate(value);
}

function pickerValue(value: string): Date {
  return new Date(`${value}T12:00:00Z`);
}

function reportTitle(mode: ReportMode, period: CompanyReportPeriod): string {
  return mode === "period"
    ? `ملخص مالي ${periodLabel(period)}`
    : "تقرير الشركة المالي";
}

export function AdminCompanyPdfReports({
  visible,
  onClose,
  userName,
}: {
  visible: boolean;
  onClose: () => void;
  userName: string | null;
}) {
  const today = currentDamascusDateKey();
  const [mode, setMode] = useState<ReportMode>("period");
  const [period, setPeriod] = useState<CompanyReportPeriod>("monthly");
  const [periodDate, setPeriodDate] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedDate =
    pickerTarget === "period"
      ? periodDate
      : pickerTarget === "start"
        ? startDate
        : endDate;

  const selectCalendarDate = (date: Date) => {
    const value = damascusDateKey(date);
    if (pickerTarget === "period") setPeriodDate(value);
    if (pickerTarget === "start") setStartDate(value);
    if (pickerTarget === "end") setEndDate(value);
    setPickerTarget(null);
  };

  const createReport = async () => {
    if (isGenerating) return;

    try {
      const range =
        mode === "period"
          ? rangeForPeriod(period, periodDate)
          : assertDateRange(startDate, endDate);
      setIsGenerating(true);

      const summary = await nativeCompanyPdfReportContract.reads.rangeSummary(
        range,
      );
      const companyReport = mode === "company";
      await createAndShareCompanyReportPdf({
        title: reportTitle(mode, period),
        startDate: summary.period_start,
        endDate: summary.period_end,
        grossTotal: summary.gross_total,
        orderCount: summary.order_count,
        companyTotal: summary.company_total,
        captainTotal: summary.captain_net_total,
        expenseTotal: companyReport ? summary.expense_total : undefined,
        netTotal: companyReport
          ? summary.net_company_total
          : summary.company_total,
        generatedBy: userName,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "تعذر إعداد ملف التقرير. حاول مرة أخرى.";
      Alert.alert("تعذر إنشاء التقرير", message);
    } finally {
      setIsGenerating(false);
    }
  };

  const rangePreview =
    mode === "period"
      ? rangeForPeriod(period, periodDate)
      : (() => {
          try {
            return assertDateRange(startDate, endDate);
          } catch {
            return null;
          }
        })();

  return (
    <>
      <Modal
        animationType="slide"
        onRequestClose={onClose}
        presentationStyle="pageSheet"
        visible={visible}
      >
        <View style={styles.screen}>
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="إغلاق طباعة التقارير"
              disabled={isGenerating}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
                isGenerating && styles.disabled,
              ]}
            >
              <MaterialIcons name="close" size={22} color="#315C73" />
            </Pressable>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>طباعة تقارير PDF</Text>
              <Text style={styles.headerSubtitle}>
                متاحة للمدير والمشرف فقط
              </Text>
            </View>
            <View style={styles.headerIcon}>
              <MaterialIcons name="picture-as-pdf" size={22} color="#FFFFFF" />
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.introCard}>
              <View style={styles.introIcon}>
                <MaterialIcons name="print" size={23} color="#0878D1" />
              </View>
              <View style={styles.introText}>
                <Text style={styles.introTitle}>اختر شكل التقرير</Text>
                <Text style={styles.introDescription}>
                  سيُنشأ الملف من الأرقام المالية المعتمدة في النظام ثم يفتح خيار الطباعة أو المشاركة.
                </Text>
              </View>
            </View>

            <View style={styles.modeRow}>
              <ModeCard
                active={mode === "period"}
                description="الأجور والطلبات وصافي المكتب"
                icon="calendar-month"
                onPress={() => setMode("period")}
                title="ملخص فترة محددة"
              />
              <ModeCard
                active={mode === "company"}
                description="الطلبات والمصاريف والصافي"
                icon="date-range"
                onPress={() => setMode("company")}
                title="تقرير الشركة"
              />
            </View>

            {mode === "period" ? (
              <View style={styles.formCard}>
                <Text style={styles.sectionTitle}>ملخص مالي لفترة محددة</Text>
                <Text style={styles.sectionDescription}>
                  اختر نوع الفترة ثم أي تاريخ داخلها. سيحسب النظام حدود الفترة تلقائياً.
                </Text>
                <View style={styles.periodChoices}>
                  {PERIODS.map((item) => {
                    const selected = item.id === period;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => setPeriod(item.id)}
                        style={({ pressed }) => [
                          styles.periodChoice,
                          selected && styles.periodChoiceActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.periodChoiceText,
                            selected && styles.periodChoiceTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <DateRow
                  label="تاريخ ضمن الفترة"
                  onPress={() => setPickerTarget("period")}
                  value={displayDate(periodDate)}
                />
                {rangePreview ? (
                  <View style={styles.preview}>
                    <MaterialIcons name="info-outline" size={17} color="#397095" />
                    <Text style={styles.previewText}>
                      ستُطبع الفترة من {displayDate(rangePreview.startDate)} إلى {displayDate(rangePreview.endDate)}.
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.formCard}>
                <Text style={styles.sectionTitle}>تقرير الشركة بين تاريخين</Text>
                <Text style={styles.sectionDescription}>
                  يتضمن إجمالي الطلبات والأجور، المصاريف المسجلة، والصافي بعد المصاريف.
                </Text>
                <DateRow
                  label="من تاريخ"
                  onPress={() => setPickerTarget("start")}
                  value={displayDate(startDate)}
                />
                <DateRow
                  label="إلى تاريخ"
                  onPress={() => setPickerTarget("end")}
                  value={displayDate(endDate)}
                />
                {rangePreview ? (
                  <View style={styles.preview}>
                    <MaterialIcons name="info-outline" size={17} color="#397095" />
                    <Text style={styles.previewText}>
                      سيُحسب صافي الشركة بعد خصم مصاريف المكتب المسجلة ضمن هذا المدى.
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.validationText}>
                    يجب أن يكون تاريخ البداية قبل تاريخ النهاية أو مساوياً له.
                  </Text>
                )}
              </View>
            )}

            <View style={styles.includedCard}>
              <Text style={styles.includedTitle}>ماذا سيتضمن الملف؟</Text>
              <Text style={styles.includedText}>
                {mode === "period"
                  ? "إجمالي الأجور، إجمالي الطلبات، حصة الكباتن، وصافي المكتب للفترة المحددة."
                  : "إجمالي الأجور والطلبات، حصة الكباتن، مصاريف المكتب، والصافي النهائي للفترة."}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              disabled={isGenerating || !rangePreview}
              onPress={() => void createReport()}
              style={({ pressed }) => [
                styles.printButton,
                pressed && styles.pressed,
                (isGenerating || !rangePreview) && styles.printButtonDisabled,
              ]}
            >
              {isGenerating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <MaterialIcons name="print" size={21} color="#FFFFFF" />
              )}
              <Text style={styles.printButtonText}>
                {isGenerating ? "جارٍ إعداد التقرير..." : "إنشاء وطباعة PDF"}
              </Text>
            </Pressable>
            {Platform.OS === "web" ? (
              <Text style={styles.webHint}>
                في الويب سيفتح مربع الطباعة في المتصفح.
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>

      <FinancialDatePicker
        key={`${pickerTarget ?? "closed"}:${selectedDate}`}
        hint="اختر التاريخ الذي ستُبنى عليه الفترة أو بداية ونهاية تقرير الشركة."
        onClose={() => setPickerTarget(null)}
        onSelect={selectCalendarDate}
        title="اختيار تاريخ التقرير"
        value={pickerValue(selectedDate)}
        visible={pickerTarget !== null}
      />
    </>
  );
}

function DateRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.dateRow, pressed && styles.pressed]}
    >
      <View style={styles.dateIcon}>
        <MaterialIcons name="calendar-today" size={17} color="#0878D1" />
      </View>
      <View style={styles.dateText}>
        <Text style={styles.dateLabel}>{label}</Text>
        <Text style={styles.dateValue}>{value}</Text>
      </View>
      <MaterialIcons name="chevron-left" size={22} color="#7894A7" />
    </Pressable>
  );
}

function ModeCard({
  active,
  title,
  description,
  icon,
  onPress,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeCard,
        active && styles.modeCardActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.modeIcon, active && styles.modeIconActive]}>
        <MaterialIcons name={icon} size={20} color={active ? "#FFFFFF" : "#0878D1"} />
      </View>
      <Text style={[styles.modeTitle, active && styles.modeTitleActive]}>{title}</Text>
      <Text style={[styles.modeDescription, active && styles.modeDescriptionActive]}>
        {description}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#F4F7FB", flex: 1 },
  header: { alignItems: "center", backgroundColor: "#FFFFFF", borderBottomColor: "#DCEBF5", borderBottomWidth: 1, flexDirection: "row-reverse", gap: 11, paddingHorizontal: 16, paddingVertical: 14 },
  closeButton: { alignItems: "center", backgroundColor: "#F0F8FC", borderRadius: 13, height: 42, justifyContent: "center", width: 42 },
  headerText: { alignItems: "flex-end", flex: 1 },
  headerTitle: { color: "#123D60", fontFamily: "Cairo_700Bold", fontSize: 17, textAlign: "right", writingDirection: "rtl" },
  headerSubtitle: { color: "#6B899C", fontFamily: "Cairo_400Regular", fontSize: 10, marginTop: 1, textAlign: "right", writingDirection: "rtl" },
  headerIcon: { alignItems: "center", backgroundColor: "#0878D1", borderRadius: 13, height: 42, justifyContent: "center", width: 42 },
  content: { padding: 16, paddingBottom: 24 },
  introCard: { alignItems: "center", backgroundColor: "#EAF6FF", borderColor: "#C9E4F7", borderRadius: 19, borderWidth: 1, flexDirection: "row-reverse", gap: 11, padding: 14 },
  introIcon: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 13, height: 43, justifyContent: "center", width: 43 },
  introText: { flex: 1 },
  introTitle: { color: "#164866", fontFamily: "Cairo_700Bold", fontSize: 14, textAlign: "right", writingDirection: "rtl" },
  introDescription: { color: "#587990", fontFamily: "Cairo_400Regular", fontSize: 10, lineHeight: 17, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  modeRow: { flexDirection: "row-reverse", gap: 9, marginTop: 14 },
  modeCard: { backgroundColor: "#FFFFFF", borderColor: "#D7E6F0", borderRadius: 17, borderWidth: 1, flex: 1, minHeight: 132, padding: 12 },
  modeCardActive: { backgroundColor: "#0878D1", borderColor: "#0878D1" },
  modeIcon: { alignItems: "center", backgroundColor: "#EAF5FC", borderRadius: 11, height: 34, justifyContent: "center", width: 34 },
  modeIconActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  modeTitle: { color: "#164866", fontFamily: "Cairo_700Bold", fontSize: 12, marginTop: 11, textAlign: "right", writingDirection: "rtl" },
  modeTitleActive: { color: "#FFFFFF" },
  modeDescription: { color: "#6D899B", fontFamily: "Cairo_400Regular", fontSize: 9, lineHeight: 15, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  modeDescriptionActive: { color: "rgba(255,255,255,0.86)" },
  formCard: { backgroundColor: "#FFFFFF", borderColor: "#DCE9F2", borderRadius: 19, borderWidth: 1, marginTop: 14, padding: 15 },
  sectionTitle: { color: "#163E5C", fontFamily: "Cairo_700Bold", fontSize: 15, textAlign: "right", writingDirection: "rtl" },
  sectionDescription: { color: "#6A879A", fontFamily: "Cairo_400Regular", fontSize: 10, lineHeight: 17, marginTop: 4, textAlign: "right", writingDirection: "rtl" },
  periodChoices: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, marginTop: 14 },
  periodChoice: { alignItems: "center", backgroundColor: "#F4F8FB", borderColor: "#D8E7F0", borderRadius: 11, borderWidth: 1, flexGrow: 1, minWidth: "21%", paddingHorizontal: 8, paddingVertical: 8 },
  periodChoiceActive: { backgroundColor: "#EAF6FF", borderColor: "#0878D1" },
  periodChoiceText: { color: "#68859A", fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" },
  periodChoiceTextActive: { color: "#0878D1" },
  dateRow: { alignItems: "center", backgroundColor: "#F9FCFE", borderColor: "#DCEAF3", borderRadius: 13, borderWidth: 1, flexDirection: "row-reverse", gap: 9, marginTop: 11, minHeight: 59, paddingHorizontal: 10 },
  dateIcon: { alignItems: "center", backgroundColor: "#EAF5FC", borderRadius: 10, height: 32, justifyContent: "center", width: 32 },
  dateText: { flex: 1 },
  dateLabel: { color: "#7894A7", fontFamily: "Cairo_400Regular", fontSize: 9, textAlign: "right", writingDirection: "rtl" },
  dateValue: { color: "#17445F", fontFamily: "Cairo_700Bold", fontSize: 11, marginTop: 1, textAlign: "right", writingDirection: "rtl" },
  preview: { alignItems: "center", backgroundColor: "#F0F9FE", borderRadius: 10, flexDirection: "row-reverse", gap: 6, marginTop: 12, padding: 10 },
  previewText: { color: "#3E6D88", flex: 1, fontFamily: "Cairo_400Regular", fontSize: 9, lineHeight: 16, textAlign: "right", writingDirection: "rtl" },
  validationText: { color: "#A13C47", fontFamily: "Cairo_700Bold", fontSize: 9, marginTop: 10, textAlign: "right", writingDirection: "rtl" },
  includedCard: { backgroundColor: "#FFFBEE", borderColor: "#F4E6B4", borderRadius: 15, borderWidth: 1, marginTop: 14, padding: 13 },
  includedTitle: { color: "#77621E", fontFamily: "Cairo_700Bold", fontSize: 11, textAlign: "right", writingDirection: "rtl" },
  includedText: { color: "#867541", fontFamily: "Cairo_400Regular", fontSize: 10, lineHeight: 17, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  footer: { backgroundColor: "#FFFFFF", borderTopColor: "#DCEAF3", borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  printButton: { alignItems: "center", backgroundColor: "#0878D1", borderRadius: 15, flexDirection: "row-reverse", gap: 8, justifyContent: "center", minHeight: 52 },
  printButtonDisabled: { opacity: 0.6 },
  printButtonText: { color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 13, writingDirection: "rtl" },
  webHint: { color: "#718FA1", fontFamily: "Cairo_400Regular", fontSize: 9, marginTop: 6, textAlign: "center", writingDirection: "rtl" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
});
