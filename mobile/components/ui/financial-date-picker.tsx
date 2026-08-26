import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";

import { MotionPressable } from "@/components/ui/motion-pressable";

const BLUE = "#0878D1";
const WEEKDAY_LABELS = ["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];

function damascusDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Damascus",
    year: "numeric",
  }).formatToParts(value);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function monthStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1, 12));
}

function shiftMonth(value: Date, amount: number) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + amount, 1, 12),
  );
}

function calendarDays(value: Date) {
  const firstDay = monthStart(value);
  const leadingEmptyDays = firstDay.getUTCDay();
  const dayCount = new Date(
    Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();
  return [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...Array.from(
      { length: dayCount },
      (_, index) =>
        new Date(
          Date.UTC(
            firstDay.getUTCFullYear(),
            firstDay.getUTCMonth(),
            index + 1,
            12,
          ),
        ),
    ),
  ];
}

function calendarMonthLabel(value: Date) {
  return new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
    month: "long",
    timeZone: "Asia/Damascus",
    year: "numeric",
  }).format(value);
}

export function FinancialDatePicker({
  visible,
  value,
  onSelect,
  onClose,
  title = "اختيار تاريخ الأجور",
  hint = "اختر يومًا لعرض سجل الأجور المسجل فعليًا في ذلك التاريخ.",
}: {
  visible: boolean;
  value: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
  title?: string;
  hint?: string;
}) {
  const [displayMonth, setDisplayMonth] = useState(() => monthStart(value));
  const monthDays = useMemo(() => calendarDays(displayMonth), [displayMonth]);
  const todayKey = damascusDateKey(new Date());
  const latestMonth = monthStart(new Date());
  const canAdvanceMonth = displayMonth.getTime() < latestMonth.getTime();

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <MotionPressable
              accessibilityLabel="إغلاق التقويم"
              onPress={onClose}
              style={styles.closeButton}
            >
              <MaterialIcons name="close" size={19} color="#496B81" />
            </MotionPressable>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.headerSpace} />
          </View>
          <View style={styles.monthRow}>
            <MotionPressable
              accessibilityLabel="الشهر السابق"
              onPress={() =>
                setDisplayMonth((current) => shiftMonth(current, -1))
              }
              style={styles.monthNavigation}
            >
              <MaterialIcons name="chevron-right" size={22} color={BLUE} />
            </MotionPressable>
            <Text style={styles.monthTitle}>
              {calendarMonthLabel(displayMonth)}
            </Text>
            <MotionPressable
              accessibilityLabel="الشهر التالي"
              disabled={!canAdvanceMonth}
              onPress={() =>
                setDisplayMonth((current) => shiftMonth(current, 1))
              }
              style={[
                styles.monthNavigation,
                !canAdvanceMonth && styles.monthNavigationDisabled,
              ]}
            >
              <MaterialIcons name="chevron-left" size={22} color={BLUE} />
            </MotionPressable>
          </View>
          <View style={styles.weekdays}>
            {WEEKDAY_LABELS.map((label) => (
              <Text key={label} style={styles.weekday}>
                {label}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {monthDays.map((day, index) => {
              if (!day) return <View key={`empty-${index}`} style={styles.daySlot} />;
              const dayKey = damascusDateKey(day);
              const isFuture = dayKey > todayKey;
              const selected = dayKey === damascusDateKey(value);
              return (
                <View key={dayKey} style={styles.daySlot}>
                  <MotionPressable
                    disabled={isFuture}
                    onPress={() => onSelect(day)}
                    style={[
                      styles.day,
                      selected && styles.daySelected,
                      isFuture && styles.dayDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        selected && styles.dayTextSelected,
                        isFuture && styles.dayTextDisabled,
                      ]}
                    >
                      {new Intl.NumberFormat("en-US").format(day.getUTCDate())}
                    </Text>
                  </MotionPressable>
                </View>
              );
            })}
          </View>
          <Text style={styles.hint}>{hint}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(8,35,54,0.46)",
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#BCEBFA",
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: 440,
    padding: 15,
    width: "100%",
  },
  header: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: "#F0F8FC",
    borderRadius: 13,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  headerSpace: { height: 42, width: 42 },
  title: {
    color: "#063B78",
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    textAlign: "center",
    writingDirection: "rtl",
  },
  monthRow: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 14,
  },
  monthNavigation: {
    alignItems: "center",
    backgroundColor: "#EAF9FF",
    borderColor: "#BCEBFA",
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  monthNavigationDisabled: { opacity: 0.4 },
  monthTitle: {
    color: "#164866",
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    textAlign: "center",
    writingDirection: "rtl",
  },
  weekdays: {
    flexDirection: "row-reverse",
    marginTop: 14,
  },
  weekday: {
    color: "#6B8798",
    flex: 1,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 9,
    textAlign: "center",
    writingDirection: "rtl",
  },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", marginTop: 7 },
  daySlot: { alignItems: "center", aspectRatio: 1, justifyContent: "center", width: "14.285%" },
  day: {
    alignItems: "center",
    borderRadius: 15,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  daySelected: { backgroundColor: BLUE },
  dayDisabled: { opacity: 0.32 },
  dayText: {
    color: "#315C73",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
  },
  dayTextSelected: { color: "#FFFFFF" },
  dayTextDisabled: { color: "#8FA6B2" },
  hint: {
    color: "#6A8798",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    lineHeight: 16,
    marginTop: 9,
    textAlign: "center",
    writingDirection: "rtl",
  },
});
