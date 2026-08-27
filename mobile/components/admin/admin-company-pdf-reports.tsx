import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
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

import { useAdminCaptains } from "@/features/admin/use-admin-captains";
import { nativeCompanyPdfReportContract } from "@/features/admin/use-admin-finance";
import { FinancialDatePicker } from "@/components/ui/financial-date-picker";
import {
  createAndShareSimplePdfReport,
  money,
  orderCount,
} from "@/lib/admin/company-report-pdf";
import {
  currentDamascusDateKey,
  damascusDateKey,
  formatReportDate,
  optionalDateRange,
} from "@/lib/admin/report-period";

type ReportMode = "captain" | "company";
type PickerTarget = "start" | "end" | null;

function pickerValue(value: string): Date {
  return new Date(`${value}T12:00:00Z`);
}

function dateLabel(value: string): string {
  return formatReportDate(value);
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
  const { captains, error: captainsError, isLoading: isLoadingCaptains } =
    useAdminCaptains();
  const [mode, setMode] = useState<ReportMode>("captain");
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [showCaptains, setShowCaptains] = useState(false);
  const [useDateFilter, setUseDateFilter] = useState(false);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedCaptain = useMemo(
    () => captains.find((captain) => captain.id === captainId) ?? null,
    [captainId, captains],
  );

  const selectDate = (date: Date) => {
    const value = damascusDateKey(date);
    if (pickerTarget === "start") setStartDate(value);
    if (pickerTarget === "end") setEndDate(value);
    setPickerTarget(null);
  };

  const createReport = async () => {
    if (isGenerating) return;
    if (mode === "captain" && !selectedCaptain) {
      Alert.alert("اختر الكابتن", "اختر كابتناً أولاً قبل طباعة التقرير.");
      return;
    }

    try {
      const range = optionalDateRange(useDateFilter, startDate, endDate);
      setIsGenerating(true);

      if (mode === "captain" && selectedCaptain) {
        const summary =
          await nativeCompanyPdfReportContract.reads.captainSummary({
            captainId: selectedCaptain.id,
            startDate: range.startDate,
            endDate: range.endDate,
          });
        await createAndShareSimplePdfReport({
          title: "كشف كابتن مختصر",
          subject: summary.captain_name,
          startDate: summary.period_start,
          endDate: summary.period_end,
          metrics: [
            { label: "إجمالي الطلبات", value: orderCount(summary.order_count) },
            { label: "إجمالي أجر الطلبات", value: money(summary.gross_total) },
            {
              label: "صافي الكابتن",
              value: money(summary.captain_total),
              highlighted: true,
            },
            {
              label: "المبلغ المستحق للشركة (30٪)",
              value: money(summary.company_total),
            },
          ],
          generatedBy: userName,
        });
        return;
      }

      const summary = await nativeCompanyPdfReportContract.reads.rangeSummary(
        range,
      );
      await createAndShareSimplePdfReport({
        title: "تقرير الشركة المختصر",
        startDate: summary.period_start,
        endDate: summary.period_end,
        metrics: [
          { label: "إجمالي الطلبات", value: orderCount(summary.order_count) },
          { label: "إجمالي أجر الطلبات", value: money(summary.gross_total) },
          { label: "أجور الكباتن", value: money(summary.captain_net_total) },
          { label: "مصاريف المكتب", value: money(summary.expense_total) },
          {
            label: "صافي الشركة",
            value: money(summary.net_company_total),
            highlighted: true,
          },
        ],
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

  const selectedDate = pickerTarget === "start" ? startDate : endDate;

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
              <Text style={styles.headerSubtitle}>تقارير مختصرة فقط</Text>
            </View>
            <View style={styles.headerIcon}>
              <MaterialIcons name="picture-as-pdf" size={22} color="#FFFFFF" />
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.modeRow}>
              <ReportChoice
                active={mode === "captain"}
                description="كابتن واحد: الطلبات، الصافي، ومبلغ الشركة"
                icon="person"
                onPress={() => setMode("captain")}
                title="تقرير كابتن"
              />
              <ReportChoice
                active={mode === "company"}
                description="طلبات الشركة، أجور الكباتن، المصاريف، والصافي"
                icon="business"
                onPress={() => setMode("company")}
                title="تقرير الشركة"
              />
            </View>

            <View style={styles.formCard}>
              {mode === "captain" ? (
                <>
                  <Text style={styles.sectionTitle}>اختر الكابتن</Text>
                  <Pressable
                    disabled={isLoadingCaptains}
                    onPress={() => setShowCaptains(true)}
                    style={({ pressed }) => [
                      styles.selectRow,
                      pressed && styles.pressed,
                      isLoadingCaptains && styles.disabled,
                    ]}
                  >
                    <View style={styles.selectIcon}>
                      {isLoadingCaptains ? (
                        <ActivityIndicator color="#0878D1" size="small" />
                      ) : (
                        <MaterialIcons name="person-search" size={20} color="#0878D1" />
                      )}
                    </View>
                    <View style={styles.selectText}>
                      <Text style={styles.selectLabel}>الكابتن</Text>
                      <Text style={styles.selectValue} numberOfLines={1}>
                        {selectedCaptain?.name ??
                          (isLoadingCaptains ? "جارٍ تحميل الكباتن..." : "اضغط لاختيار كابتن")}
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-left" size={22} color="#7894A7" />
                  </Pressable>
                  {captainsError ? (
                    <Text style={styles.errorText}>{captainsError}</Text>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>ملخص الشركة</Text>
                  <Text style={styles.sectionDescription}>
                    يطبع الأرقام الأساسية للشركة فقط دون تفصيل الطلبات.
                  </Text>
                </>
              )}

              <Pressable
                onPress={() => setUseDateFilter((value) => !value)}
                style={({ pressed }) => [styles.filterRow, pressed && styles.pressed]}
              >
                <View
                  style={[
                    styles.checkbox,
                    useDateFilter && styles.checkboxSelected,
                  ]}
                >
                  {useDateFilter ? (
                    <MaterialIcons name="check" size={16} color="#FFFFFF" />
                  ) : null}
                </View>
                <View style={styles.filterText}>
                  <Text style={styles.filterTitle}>تحديد فترة</Text>
                  <Text style={styles.filterDescription}>
                    {useDateFilter
                      ? "سيقتصر التقرير على المدة التي تحددها."
                      : "بدون تحديد سيظهر كامل السجل المسجل."}
                  </Text>
                </View>
              </Pressable>

              {useDateFilter ? (
                <View style={styles.dates}>
                  <DateRow
                    label="من تاريخ"
                    onPress={() => setPickerTarget("start")}
                    value={dateLabel(startDate)}
                  />
                  <DateRow
                    label="إلى تاريخ"
                    onPress={() => setPickerTarget("end")}
                    value={dateLabel(endDate)}
                  />
                </View>
              ) : null}
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>ما سيظهر في PDF</Text>
              <Text style={styles.summaryText}>
                {mode === "captain"
                  ? "اسم الكابتن، عدد الطلبات، إجمالي أجر الطلبات، صافي الكابتن، والمبلغ المستحق للشركة (30٪)."
                  : "إجمالي الطلبات، إجمالي أجر الطلبات، أجور الكباتن، مصاريف المكتب، وصافي الشركة."}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              disabled={isGenerating}
              onPress={() => void createReport()}
              style={({ pressed }) => [
                styles.printButton,
                pressed && styles.pressed,
                isGenerating && styles.disabled,
              ]}
            >
              {isGenerating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <MaterialIcons name="print" size={20} color="#FFFFFF" />
              )}
              <Text style={styles.printButtonText}>
                {isGenerating ? "جارٍ تجهيز التقرير..." : "إنشاء وطباعة PDF"}
              </Text>
            </Pressable>
            {Platform.OS === "web" ? (
              <Text style={styles.webHint}>سيظهر مربع الطباعة في المتصفح.</Text>
            ) : null}
          </View>
        </View>
      </Modal>

      <CaptainPicker
        captains={captains}
        onClose={() => setShowCaptains(false)}
        onSelect={(nextCaptainId) => {
          setCaptainId(nextCaptainId);
          setShowCaptains(false);
        }}
        selectedCaptainId={captainId}
        visible={showCaptains}
      />
      <FinancialDatePicker
        key={`${pickerTarget ?? "closed"}:${selectedDate}`}
        hint="اختر بداية ونهاية الفترة التي تريدها في التقرير."
        onClose={() => setPickerTarget(null)}
        onSelect={selectDate}
        title="اختيار تاريخ التقرير"
        value={pickerValue(selectedDate)}
        visible={pickerTarget !== null}
      />
    </>
  );
}

function CaptainPicker({
  captains,
  selectedCaptainId,
  visible,
  onSelect,
  onClose,
}: {
  captains: { id: string; name: string; isActive: boolean }[];
  selectedCaptainId: string | null;
  visible: boolean;
  onSelect: (captainId: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.pickerBackdrop}>
        <View style={styles.pickerCard}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={onClose} style={styles.closeSmallButton}>
              <MaterialIcons name="close" size={19} color="#496B81" />
            </Pressable>
            <Text style={styles.pickerTitle}>اختر الكابتن</Text>
            <View style={styles.closeSmallButton} />
          </View>
          <ScrollView contentContainerStyle={styles.captainList}>
            {captains.map((captain) => {
              const selected = captain.id === selectedCaptainId;
              return (
                <Pressable
                  key={captain.id}
                  onPress={() => onSelect(captain.id)}
                  style={({ pressed }) => [
                    styles.captainRow,
                    selected && styles.captainRowSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.avatar, selected && styles.avatarSelected]}>
                    <Text style={[styles.avatarText, selected && styles.avatarTextSelected]}>
                      {captain.name.slice(0, 1)}
                    </Text>
                  </View>
                  <View style={styles.captainText}>
                    <Text style={styles.captainName}>{captain.name}</Text>
                    <Text style={styles.captainState}>
                      {captain.isActive ? "حساب فعّال" : "حساب غير فعّال"}
                    </Text>
                  </View>
                  {selected ? (
                    <MaterialIcons name="check-circle" size={20} color="#0878D1" />
                  ) : null}
                </Pressable>
              );
            })}
            {!captains.length ? (
              <Text style={styles.emptyCaptains}>لا يوجد كباتن متاحون حالياً.</Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
        <Text style={styles.selectLabel}>{label}</Text>
        <Text style={styles.dateValue}>{value}</Text>
      </View>
      <MaterialIcons name="chevron-left" size={22} color="#7894A7" />
    </Pressable>
  );
}

function ReportChoice({
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
  modeRow: { flexDirection: "row-reverse", gap: 9 },
  modeCard: { backgroundColor: "#FFFFFF", borderColor: "#D7E6F0", borderRadius: 17, borderWidth: 1, flex: 1, minHeight: 126, padding: 12 },
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
  selectRow: { alignItems: "center", backgroundColor: "#F9FCFE", borderColor: "#DCEAF3", borderRadius: 13, borderWidth: 1, flexDirection: "row-reverse", gap: 9, marginTop: 11, minHeight: 60, paddingHorizontal: 10 },
  selectIcon: { alignItems: "center", backgroundColor: "#EAF5FC", borderRadius: 10, height: 34, justifyContent: "center", width: 34 },
  selectText: { flex: 1 },
  selectLabel: { color: "#7894A7", fontFamily: "Cairo_400Regular", fontSize: 9, textAlign: "right", writingDirection: "rtl" },
  selectValue: { color: "#17445F", fontFamily: "Cairo_700Bold", fontSize: 11, marginTop: 1, textAlign: "right", writingDirection: "rtl" },
  errorText: { color: "#A13C47", fontFamily: "Cairo_700Bold", fontSize: 9, marginTop: 8, textAlign: "right", writingDirection: "rtl" },
  filterRow: { alignItems: "center", backgroundColor: "#F5FAFD", borderRadius: 13, flexDirection: "row-reverse", gap: 10, marginTop: 14, padding: 11 },
  checkbox: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#9DBFD4", borderRadius: 6, borderWidth: 1, height: 21, justifyContent: "center", width: 21 },
  checkboxSelected: { backgroundColor: "#0878D1", borderColor: "#0878D1" },
  filterText: { flex: 1 },
  filterTitle: { color: "#1A4967", fontFamily: "Cairo_700Bold", fontSize: 11, textAlign: "right", writingDirection: "rtl" },
  filterDescription: { color: "#6D899B", fontFamily: "Cairo_400Regular", fontSize: 9, marginTop: 1, textAlign: "right", writingDirection: "rtl" },
  dates: { marginTop: 2 },
  dateRow: { alignItems: "center", backgroundColor: "#F9FCFE", borderColor: "#DCEAF3", borderRadius: 13, borderWidth: 1, flexDirection: "row-reverse", gap: 9, marginTop: 10, minHeight: 58, paddingHorizontal: 10 },
  dateIcon: { alignItems: "center", backgroundColor: "#EAF5FC", borderRadius: 10, height: 32, justifyContent: "center", width: 32 },
  dateText: { flex: 1 },
  dateValue: { color: "#17445F", fontFamily: "Cairo_700Bold", fontSize: 11, marginTop: 1, textAlign: "right", writingDirection: "rtl" },
  summaryCard: { backgroundColor: "#FFFBEE", borderColor: "#F4E6B4", borderRadius: 15, borderWidth: 1, marginTop: 14, padding: 13 },
  summaryTitle: { color: "#77621E", fontFamily: "Cairo_700Bold", fontSize: 11, textAlign: "right", writingDirection: "rtl" },
  summaryText: { color: "#867541", fontFamily: "Cairo_400Regular", fontSize: 10, lineHeight: 17, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  footer: { backgroundColor: "#FFFFFF", borderTopColor: "#DCEAF3", borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  printButton: { alignItems: "center", backgroundColor: "#0878D1", borderRadius: 15, flexDirection: "row-reverse", gap: 8, justifyContent: "center", minHeight: 52 },
  printButtonText: { color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 13, writingDirection: "rtl" },
  webHint: { color: "#718FA1", fontFamily: "Cairo_400Regular", fontSize: 9, marginTop: 6, textAlign: "center", writingDirection: "rtl" },
  pickerBackdrop: { alignItems: "center", backgroundColor: "rgba(8,35,54,0.46)", flex: 1, justifyContent: "center", padding: 18 },
  pickerCard: { backgroundColor: "#FFFFFF", borderColor: "#BCEBFA", borderRadius: 22, borderWidth: 1, maxHeight: "76%", maxWidth: 440, padding: 15, width: "100%" },
  pickerHeader: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  closeSmallButton: { alignItems: "center", backgroundColor: "#F0F8FC", borderRadius: 11, height: 38, justifyContent: "center", width: 38 },
  pickerTitle: { color: "#063B78", fontFamily: "Cairo_700Bold", fontSize: 14, textAlign: "center", writingDirection: "rtl" },
  captainList: { gap: 7, paddingTop: 12 },
  captainRow: { alignItems: "center", backgroundColor: "#F9FCFE", borderColor: "#DCEAF3", borderRadius: 13, borderWidth: 1, flexDirection: "row-reverse", gap: 9, minHeight: 60, paddingHorizontal: 10 },
  captainRowSelected: { backgroundColor: "#EEF8FF", borderColor: "#0878D1" },
  avatar: { alignItems: "center", backgroundColor: "#EAF5FC", borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
  avatarSelected: { backgroundColor: "#0878D1" },
  avatarText: { color: "#0878D1", fontFamily: "Cairo_700Bold", fontSize: 13 },
  avatarTextSelected: { color: "#FFFFFF" },
  captainText: { flex: 1 },
  captainName: { color: "#17445F", fontFamily: "Cairo_700Bold", fontSize: 11, textAlign: "right", writingDirection: "rtl" },
  captainState: { color: "#718FA1", fontFamily: "Cairo_400Regular", fontSize: 9, marginTop: 1, textAlign: "right", writingDirection: "rtl" },
  emptyCaptains: { color: "#75818E", fontFamily: "Cairo_400Regular", fontSize: 11, paddingVertical: 18, textAlign: "center", writingDirection: "rtl" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
});
