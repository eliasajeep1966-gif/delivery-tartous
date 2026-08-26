import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { FinancialDatePicker } from "@/components/ui/financial-date-picker";
import { MotionPressable } from "@/components/ui/motion-pressable";
import { useAppToast } from "@/contexts/app-toast-context";
import {
  useNativeOfficeExpenses,
  type NativeOfficeExpense,
} from "@/features/admin/use-admin-finance";
import { goBackOrReplace } from "@/lib/navigation/go-back-or-replace";

const BLUE = "#0060B8";
const money = (value: number) =>
  `${new Intl.NumberFormat("en-US").format(value)} ل.س`;
const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    dateStyle: "medium",
  }).format(new Date(`${value}T12:00:00Z`));

type ExpenseDay = {
  date: string;
  total: number;
  expenses: NativeOfficeExpense[];
};

type ExpenseBrowserPeriod = "daily" | "weekly" | "monthly";

type DateRange = { start: string; end: string };

const expenseBrowserPeriods: { id: ExpenseBrowserPeriod; label: string }[] = [
  { id: "daily", label: "يومي" },
  { id: "weekly", label: "أسبوعي" },
  { id: "monthly", label: "شهري" },
];

function dateFromKey(value: string): Date {
  return new Date(`${value}T12:00:00Z`);
}

function dateKeyFromDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: string, amount: number): string {
  const date = dateFromKey(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateKeyFromDate(date);
}

function addMonths(value: string, amount: number): string {
  const date = dateFromKey(value);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return dateKeyFromDate(date);
}

function rangeForPeriod(period: ExpenseBrowserPeriod, anchor: string): DateRange {
  if (period === "daily") return { start: anchor, end: anchor };

  const date = dateFromKey(anchor);
  if (period === "weekly") {
    // تبدأ أسابيع العرض يوم السبت، وهو تسلسل العمل المعتاد في الواجهة العربية.
    const daysSinceSaturday = (date.getUTCDay() + 1) % 7;
    date.setUTCDate(date.getUTCDate() - daysSinceSaturday);
    const start = dateKeyFromDate(date);
    return { start, end: addDays(start, 6) };
  }

  date.setUTCDate(1);
  const start = dateKeyFromDate(date);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return { start, end: dateKeyFromDate(date) };
}

function shiftPeriod(
  period: ExpenseBrowserPeriod,
  anchor: string,
  direction: -1 | 1,
): string {
  if (period === "daily") return addDays(anchor, direction);
  if (period === "weekly") return addDays(anchor, direction * 7);
  return addMonths(anchor, direction);
}

function periodRangeLabel(period: ExpenseBrowserPeriod, range: DateRange): string {
  if (period === "daily") return dateLabel(range.start);
  if (period === "weekly") return `${dateLabel(range.start)} — ${dateLabel(range.end)}`;
  return new Intl.DateTimeFormat("ar-SY", {
    month: "long",
    timeZone: "Asia/Damascus",
    year: "numeric",
  }).format(dateFromKey(range.start));
}

function groupExpensesByDay(expenses: readonly NativeOfficeExpense[]): ExpenseDay[] {
  const days = new Map<string, ExpenseDay>();
  for (const expense of expenses) {
    const current = days.get(expense.expense_date) ?? {
      date: expense.expense_date,
      total: 0,
      expenses: [],
    };
    current.total += Number(expense.amount);
    current.expenses.push(expense);
    days.set(expense.expense_date, current);
  }

  return [...days.values()]
    .map((day) => ({
      ...day,
      expenses: [...day.expenses].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      ),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function AdminOfficeExpenses() {
  const router = useRouter();
  const { showToast } = useAppToast();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [selectedDay, setSelectedDay] = useState<ExpenseDay | null>(null);
  const [browserPeriod, setBrowserPeriod] = useState<ExpenseBrowserPeriod>("daily");
  const [browserAnchor, setBrowserAnchor] = useState(today);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const expenses = useNativeOfficeExpenses();
  const expenseDays = useMemo(
    () => groupExpensesByDay(expenses.data ?? []),
    [expenses.data],
  );
  const dateRange = useMemo(
    () => rangeForPeriod(browserPeriod, browserAnchor),
    [browserAnchor, browserPeriod],
  );
  const visibleExpenseDays = useMemo(
    () => expenseDays.filter((day) => day.date >= dateRange.start && day.date <= dateRange.end),
    [dateRange.end, dateRange.start, expenseDays],
  );
  const latestSelectableDay = today();
  const canMoveNext = dateRange.end < latestSelectableDay;

  const selectPeriod = (period: ExpenseBrowserPeriod) => {
    setBrowserPeriod(period);
    setBrowserAnchor(latestSelectableDay);
  };

  const movePeriod = (direction: -1 | 1) => {
    setBrowserAnchor((current) => {
      const next = shiftPeriod(browserPeriod, current, direction);
      return direction === 1 && rangeForPeriod(browserPeriod, next).end > latestSelectableDay
        ? current
        : next;
    });
  };

  const submit = async () => {
    const parsed = Number(amount.replace(",", "."));
    if (!title.trim())
      return showToast({ message: "اكتب اسم المصروف أولاً.", tone: "error" });
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return showToast({
        message: "أدخل مبلغًا صحيحًا للمصروف.",
        tone: "error",
      });
    }
    try {
      await expenses.createExpense({ title, amount: parsed, expenseDate, notes });
      setTitle("");
      setAmount("");
      setNotes("");
      showToast({ message: "تم تسجيل مصروف المكتب." });
    } catch (error) {
      showToast({
        message:
          error instanceof Error ? error.message : "تعذر تسجيل المصروف.",
        tone: "error",
      });
    }
  };

  return (
    <ScreenContainer
      className="bg-[#F0F7FF]"
      containerClassName="bg-[#EAF5FF]"
    >
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "العودة إلى أرباح الشركة",
          icon: "arrow-forward",
          onPress: () => goBackOrReplace(router, "/company-wages"),
        }}
        trailingAction={{
          accessibilityLabel: "مصاريف المكتب",
          icon: "receipt-long",
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={expenses.isRefetching}
            onRefresh={() => void expenses.refetch()}
            tintColor={BLUE}
          />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="receipt-long" size={24} color="#B54708" />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>مصاريف المكتب</Text>
            <Text style={styles.muted}>
              سجّل المصاريف اليومية ثم افتح يومًا لرؤية مصاريفه.
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>إضافة مصروف جديد</Text>
          <MaterialIcons name="add-card" size={21} color={BLUE} />
        </View>
        <View style={styles.form}>
          <Field
            label="اسم المصروف"
            value={title}
            onChangeText={setTitle}
            placeholder="مثال: باكية متة"
          />
          <View style={styles.formRow}>
            <View style={styles.half}>
              <Field
                label="المبلغ"
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.half}>
              <Field
                label="التاريخ"
                value={expenseDate}
                onChangeText={setExpenseDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>
          <Field
            label="ملاحظة اختيارية"
            value={notes}
            onChangeText={setNotes}
            placeholder="تفاصيل إضافية"
          />
          <MotionPressable onPress={() => void submit()} style={styles.submit}>
            <MaterialIcons name="save" size={19} color="#FFF" />
            <Text style={styles.submitText}>حفظ المصروف</Text>
          </MotionPressable>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>سجل مصاريف المكتب</Text>
            <Text style={styles.muted}>اختر الفترة ثم اضغط اليوم لرؤية مصاريفه</Text>
          </View>
          <Text style={styles.dayCount}>{visibleExpenseDays.length} أيام</Text>
        </View>

        <View style={styles.periodButtons}>
          {expenseBrowserPeriods.map((item) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: browserPeriod === item.id }}
              key={item.id}
              onPress={() => selectPeriod(item.id)}
              style={({ pressed }) => [
                styles.periodButton,
                browserPeriod === item.id && styles.periodButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[
                styles.periodButtonText,
                browserPeriod === item.id && styles.periodButtonTextActive,
              ]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <MotionPressable
          onPress={() => setIsDatePickerOpen(true)}
          style={styles.datePickerButton}
        >
          <MaterialIcons name="event" size={19} color={BLUE} />
          <View style={styles.datePickerCopy}>
            <Text style={styles.datePickerKicker}>تحديد تاريخ</Text>
            <Text style={styles.datePickerValue}>{dateLabel(browserAnchor)}</Text>
          </View>
        </MotionPressable>

        <View style={styles.periodNavigator}>
          <Pressable
            accessibilityRole="button"
            onPress={() => movePeriod(-1)}
            style={({ pressed }) => [styles.navigatorButton, pressed && styles.pressed]}
          >
            <MaterialIcons name="chevron-right" size={21} color={BLUE} />
            <Text style={styles.navigatorButtonText}>السابق</Text>
          </Pressable>
          <Text numberOfLines={1} style={styles.periodRangeTitle}>{periodRangeLabel(browserPeriod, dateRange)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canMoveNext }}
            disabled={!canMoveNext}
            onPress={() => movePeriod(1)}
            style={({ pressed }) => [
              styles.navigatorButton,
              !canMoveNext && styles.navigatorButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.navigatorButtonText}>التالي</Text>
            <MaterialIcons name="chevron-left" size={21} color={BLUE} />
          </Pressable>
        </View>

        {expenses.isPending ? (
          <Message text="جارٍ تحميل سجل المصاريف..." />
        ) : expenses.error ? (
          <Message text="تعذر تحميل سجل المصاريف." />
        ) : visibleExpenseDays.length ? (
          visibleExpenseDays.map((day) => (
            <MotionPressable
              key={day.date}
              onPress={() => setSelectedDay(day)}
              style={({ pressed }) => [
                styles.dayCard,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.dayIcon}>
                <MaterialIcons name="calendar-today" size={19} color="#B54708" />
              </View>
              <View style={styles.dayCopy}>
                <Text style={styles.dayTitle}>{dateLabel(day.date)}</Text>
                <Text style={styles.muted}>
                  {day.expenses.length} {day.expenses.length === 1 ? "مصروف" : "مصاريف"}
                </Text>
              </View>
              <View style={styles.dayEnd}>
                <Text style={styles.expense}>{money(day.total)}</Text>
                <MaterialIcons name="chevron-left" size={21} color="#6C889A" />
              </View>
            </MotionPressable>
          ))
        ) : (
          <Message text="لا توجد مصاريف ضمن الفترة المختارة." />
        )}
      </ScrollView>

      <DayExpensesModal
        day={selectedDay}
        onClose={() => setSelectedDay(null)}
      />
      {isDatePickerOpen ? (
        <FinancialDatePicker
          visible
          value={dateFromKey(browserAnchor)}
          title="تحديد تاريخ سجل المصاريف"
          hint="اختر يوماً لبدء العرض اليومي من تاريخه"
          onClose={() => setIsDatePickerOpen(false)}
          onSelect={(date) => {
            setBrowserAnchor(dateKeyFromDate(date));
            setBrowserPeriod("daily");
            setIsDatePickerOpen(false);
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}

function DayExpensesModal({
  day,
  onClose,
}: {
  day: ExpenseDay | null;
  onClose: () => void;
}) {
  if (!day) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <MotionPressable onPress={onClose} style={styles.modalClose}>
              <MaterialIcons name="close" size={22} color="#52616B" />
            </MotionPressable>
            <View style={styles.modalTitleCopy}>
              <Text style={styles.modalTitle}>مصاريف {dateLabel(day.date)}</Text>
              <Text style={styles.muted}>
                {day.expenses.length} {day.expenses.length === 1 ? "مصروف" : "مصاريف"} · الإجمالي {money(day.total)}
              </Text>
            </View>
          </View>
          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {day.expenses.map((expense, index) => (
              <View
                key={expense.id}
                style={[
                  styles.modalExpense,
                  index !== day.expenses.length - 1 && styles.modalExpenseBorder,
                ]}
              >
                <View style={styles.expenseIcon}>
                  <MaterialIcons name="receipt" size={18} color="#B54708" />
                </View>
                <View style={styles.expenseCopy}>
                  <Text style={styles.rowTitle}>{expense.title}</Text>
                  {expense.notes ? (
                    <Text style={styles.muted}>{expense.notes}</Text>
                  ) : null}
                </View>
                <Text style={styles.expense}>{money(Number(expense.amount))}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "decimal-pad";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#98AAB8"
        keyboardType={keyboardType}
        style={styles.input}
        textAlign="right"
      />
    </View>
  );
}

function Message({ text }: { text: string }) {
  return (
    <View style={styles.message}>
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, padding: 18, paddingBottom: 36 },
  hero: { alignItems: "center", backgroundColor: "#FFF", borderColor: "#D3E3F0", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", padding: 16 },
  heroIcon: { alignItems: "center", backgroundColor: "#FFF1E8", borderRadius: 16, height: 44, justifyContent: "center", marginLeft: 12, width: 44 },
  heroText: { flex: 1 },
  heroTitle: { color: "#1C1B1B", fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right", writingDirection: "rtl" },
  muted: { color: "#66727E", fontFamily: "Cairo_400Regular", fontSize: 10, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  sectionHeading: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 4 },
  sectionTitle: { color: "#1C1B1B", fontFamily: "Cairo_700Bold", fontSize: 14, writingDirection: "rtl" },
  form: { backgroundColor: "#FFF", borderColor: "#D3E3F0", borderRadius: 16, borderWidth: 1, gap: 10, padding: 14 },
  field: { gap: 4 },
  fieldLabel: { color: "#527086", fontFamily: "Cairo_700Bold", fontSize: 10, textAlign: "right", writingDirection: "rtl" },
  input: { backgroundColor: "#F7FAFC", borderColor: "#D8E5ED", borderRadius: 10, borderWidth: 1, color: "#173B54", fontFamily: "Cairo_400Regular", fontSize: 12, minHeight: 42, paddingHorizontal: 11 },
  formRow: { flexDirection: "row-reverse", gap: 9 },
  half: { flex: 1 },
  submit: { alignItems: "center", backgroundColor: BLUE, borderRadius: 11, flexDirection: "row-reverse", gap: 7, justifyContent: "center", minHeight: 44, marginTop: 3 },
  submitText: { color: "#FFF", fontFamily: "Cairo_700Bold", fontSize: 12 },
  rowTitle: { color: "#1C1B1B", fontFamily: "Cairo_700Bold", fontSize: 12, textAlign: "right", writingDirection: "rtl" },
  end: { alignItems: "flex-end" },
  expense: { color: "#B54708", fontFamily: "Cairo_700Bold", fontSize: 12, writingDirection: "rtl" },
  dayCount: { backgroundColor: "#EAF4FF", borderRadius: 10, color: BLUE, fontFamily: "Cairo_700Bold", fontSize: 10, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 5, writingDirection: "rtl" },
  periodButtons: { flexDirection: "row-reverse", gap: 8 },
  periodButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#C8DCEB", borderRadius: 11, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 41 },
  periodButtonActive: { backgroundColor: "#E8F3FF", borderColor: BLUE },
  periodButtonText: { color: "#526F82", fontFamily: "Cairo_700Bold", fontSize: 11, writingDirection: "rtl" },
  periodButtonTextActive: { color: BLUE },
  datePickerButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#C8DCEB", borderRadius: 13, borderWidth: 1, flexDirection: "row-reverse", gap: 9, minHeight: 52, paddingHorizontal: 12 },
  datePickerCopy: { alignItems: "flex-end", flex: 1 },
  datePickerKicker: { color: "#527086", fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" },
  datePickerValue: { color: "#173B54", fontFamily: "Cairo_400Regular", fontSize: 11, marginTop: 1, writingDirection: "rtl" },
  periodNavigator: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D3E3F0", borderRadius: 14, borderWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", minHeight: 48, paddingHorizontal: 6 },
  navigatorButton: { alignItems: "center", flexDirection: "row-reverse", gap: 1, minHeight: 36, paddingHorizontal: 5 },
  navigatorButtonDisabled: { opacity: 0.32 },
  navigatorButtonText: { color: BLUE, fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" },
  periodRangeTitle: { color: "#244E69", flex: 1, fontFamily: "Cairo_700Bold", fontSize: 10, paddingHorizontal: 4, textAlign: "center", writingDirection: "rtl" },
  dayCard: { alignItems: "center", backgroundColor: "#FFF", borderColor: "#D3E3F0", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", gap: 10, minHeight: 70, padding: 12 },
  dayIcon: { alignItems: "center", backgroundColor: "#FFF1E8", borderRadius: 12, height: 40, justifyContent: "center", width: 40 },
  dayCopy: { alignItems: "flex-end", flex: 1 },
  dayTitle: { color: "#1C1B1B", fontFamily: "Cairo_700Bold", fontSize: 13, textAlign: "right", writingDirection: "rtl" },
  dayEnd: { alignItems: "flex-end", flexDirection: "row-reverse", gap: 3 },
  modalOverlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(4,31,50,0.36)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#F8FBFD", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "76%", minHeight: 220, overflow: "hidden" },
  modalHeader: { alignItems: "center", backgroundColor: "#FFFFFF", borderBottomColor: "#DCE8F0", borderBottomWidth: 1, flexDirection: "row-reverse", gap: 10, padding: 16 },
  modalClose: { alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 12, height: 38, justifyContent: "center", width: 38 },
  modalTitleCopy: { alignItems: "flex-end", flex: 1 },
  modalTitle: { color: "#163E5C", fontFamily: "Cairo_700Bold", fontSize: 15, textAlign: "right", writingDirection: "rtl" },
  modalContent: { padding: 14 },
  modalExpense: { alignItems: "center", backgroundColor: "#FFFFFF", flexDirection: "row-reverse", gap: 10, minHeight: 64, paddingVertical: 10 },
  modalExpenseBorder: { borderBottomColor: "#E4EDF3", borderBottomWidth: 1 },
  expenseIcon: { alignItems: "center", backgroundColor: "#FFF1E8", borderRadius: 11, height: 36, justifyContent: "center", width: 36 },
  expenseCopy: { alignItems: "flex-end", flex: 1 },
  message: { alignItems: "center", backgroundColor: "#FFF", borderColor: "#C7DAE8", borderRadius: 16, borderStyle: "dashed", borderWidth: 1, justifyContent: "center", minHeight: 70, padding: 16 },
  messageText: { color: "#58616B", fontFamily: "Cairo_700Bold", fontSize: 11, textAlign: "center", writingDirection: "rtl" },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
