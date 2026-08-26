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
import { MotionPressable } from "@/components/ui/motion-pressable";
import { useAppToast } from "@/contexts/app-toast-context";
import {
  useNativeOfficeExpensePeriods,
  useNativeOfficeExpenses,
  type NativeFinancePeriod,
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
  const [period, setPeriod] = useState<Exclude<NativeFinancePeriod, "annual">>(
    "daily",
  );
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [selectedDay, setSelectedDay] = useState<ExpenseDay | null>(null);
  const periods = useNativeOfficeExpensePeriods(period);
  const expenses = useNativeOfficeExpenses();
  const expenseDays = useMemo(
    () => groupExpensesByDay(expenses.data ?? []),
    [expenses.data],
  );

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
            refreshing={periods.isRefetching || expenses.isRefetching}
            onRefresh={() => {
              void periods.refetch();
              void expenses.refetch();
            }}
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
          <Text style={styles.sectionTitle}>صافي الشركة حسب الفترة</Text>
          <Text style={styles.muted}>بعد خصم المصاريف</Text>
        </View>
        <View style={styles.periods}>
          {(["daily", "weekly", "monthly"] as const).map((value) => (
            <MotionPressable
              key={value}
              onPress={() => setPeriod(value)}
              style={[styles.period, period === value && styles.active]}
            >
              <Text
                style={[styles.periodText, period === value && styles.activeText]}
              >
                {value === "daily"
                  ? "يومي"
                  : value === "weekly"
                    ? "أسبوعي"
                    : "شهري"}
              </Text>
            </MotionPressable>
          ))}
        </View>
        {periods.isPending ? (
          <Message text="جارٍ تحميل ملخص المصاريف..." />
        ) : periods.error ? (
          <Message text="تعذر تحميل ملخص المصاريف." />
        ) : (
          (periods.data ?? []).map((row) => (
            <View key={row.period_start} style={styles.row}>
              <View>
                <Text style={styles.rowTitle}>
                  {dateLabel(row.period_start)}
                  {period !== "daily"
                    ? ` — ${dateLabel(row.period_end)}`
                    : ""}
                </Text>
                <Text style={styles.muted}>إجمالي مصاريف الفترة</Text>
              </View>
              <View style={styles.end}>
                <Text style={styles.expense}>
                  {money(Number(row.expense_total))}
                </Text>
                <Text style={styles.muted}>مصروف</Text>
              </View>
            </View>
          ))
        )}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>سجل مصاريف المكتب</Text>
            <Text style={styles.muted}>اختر يوماً لعرض مصاريفه</Text>
          </View>
          <Text style={styles.dayCount}>{expenseDays.length} أيام</Text>
        </View>
        {expenses.isPending ? (
          <Message text="جارٍ تحميل سجل المصاريف..." />
        ) : expenses.error ? (
          <Message text="تعذر تحميل سجل المصاريف." />
        ) : expenseDays.length ? (
          expenseDays.map((day) => (
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
          <Message text="لا توجد مصاريف مسجلة حالياً." />
        )}
      </ScrollView>

      <DayExpensesModal
        day={selectedDay}
        onClose={() => setSelectedDay(null)}
      />
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
  periods: { backgroundColor: "#FFF", borderColor: "#D3E3F0", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 5, padding: 5 },
  period: { alignItems: "center", borderRadius: 11, flex: 1, justifyContent: "center", minHeight: 40 },
  active: { backgroundColor: BLUE },
  periodText: { color: "#5C7C90", fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" },
  activeText: { color: "#FFF" },
  row: { backgroundColor: "#FFF", borderColor: "#D3E3F0", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", padding: 14 },
  rowTitle: { color: "#1C1B1B", fontFamily: "Cairo_700Bold", fontSize: 12, textAlign: "right", writingDirection: "rtl" },
  end: { alignItems: "flex-end" },
  expense: { color: "#B54708", fontFamily: "Cairo_700Bold", fontSize: 12, writingDirection: "rtl" },
  dayCount: { backgroundColor: "#EAF4FF", borderRadius: 10, color: BLUE, fontFamily: "Cairo_700Bold", fontSize: 10, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 5, writingDirection: "rtl" },
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
