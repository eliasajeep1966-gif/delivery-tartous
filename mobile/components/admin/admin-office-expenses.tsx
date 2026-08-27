import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
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
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
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
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} ل.س`;

function damascusDateKey(value: Date): string {
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

const today = () => damascusDateKey(new Date());
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    dateStyle: "medium",
  }).format(new Date(`${value}T12:00:00Z`));

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function parseExpenseAmount(value: string): number | null {
  let normalized = value.trim();
  for (let index = 0; index < 10; index += 1) {
    normalized = normalized
      .replaceAll(ARABIC_DIGITS[index]!, String(index))
      .replaceAll(EASTERN_ARABIC_DIGITS[index]!, String(index));
  }
  normalized = normalized.replace(/[\s٬]/g, "").replaceAll("٫", ".");
  const commaIndex = normalized.lastIndexOf(",");
  const dotIndex = normalized.lastIndexOf(".");

  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalIndex = Math.max(commaIndex, dotIndex);
    const decimalSeparator = normalized[decimalIndex]!;
    normalized = normalized.replace(/[,.]/g, (character) =>
      character === decimalSeparator ? "." : "",
    );
  } else if (commaIndex >= 0) {
    const decimalPart = normalized.slice(commaIndex + 1);
    normalized =
      decimalPart.length <= 2
        ? `${normalized.slice(0, commaIndex).replaceAll(",", "")}.${decimalPart}`
        : normalized.replaceAll(",", "");
  } else if (dotIndex >= 0) {
    const decimalPart = normalized.slice(dotIndex + 1);
    normalized =
      decimalPart.length <= 2
        ? `${normalized.slice(0, dotIndex).replaceAll(".", "")}.${decimalPart}`
        : normalized.replaceAll(".", "");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  if (Math.abs(parsed * 100 - Math.round(parsed * 100)) > 0.000001) return null;
  return Number(parsed.toFixed(2));
}

function amountInputValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function dateFromKey(value: string): Date {
  return new Date(`${value}T12:00:00Z`);
}

function dateKeyFromDate(value: Date): string {
  return damascusDateKey(value);
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return damascusDateKey(dateFromKey(value)) === value;
}

type ExpenseDay = {
  date: string;
  total: number;
  expenses: NativeOfficeExpense[];
};

type ExpenseBrowserPeriod = "daily" | "weekly" | "monthly";
type DateRange = { start: string; end: string };
type DatePickerTarget = "browser" | "expense" | null;

const expenseBrowserPeriods: { id: ExpenseBrowserPeriod; label: string }[] = [
  { id: "daily", label: "يومي" },
  { id: "weekly", label: "أسبوعي" },
  { id: "monthly", label: "شهري" },
];

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

export function AdminOfficeExpenses() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const { showToast } = useAppToast();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [editingExpense, setEditingExpense] =
    useState<NativeOfficeExpense | null>(null);
  const [selectedDay, setSelectedDay] = useState<ExpenseDay | null>(null);
  const [expenseToDelete, setExpenseToDelete] =
    useState<NativeOfficeExpense | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [browserPeriod, setBrowserPeriod] =
    useState<ExpenseBrowserPeriod>("daily");
  const [browserAnchor, setBrowserAnchor] = useState(today);
  const [datePickerTarget, setDatePickerTarget] =
    useState<DatePickerTarget>(null);
  const dateRange = useMemo(
    () => rangeForPeriod(browserPeriod, browserAnchor),
    [browserAnchor, browserPeriod],
  );
  const expenses = useNativeOfficeExpenses({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });
  const expenseDays = useMemo<ExpenseDay[]>(
    () =>
      expenses.days.map((day) => ({
        date: day.expenseDate,
        total: day.expenseTotal,
        expenses: day.expenses,
      })),
    [expenses.days],
  );
  const latestSelectableDay = today();
  const canMoveNext = dateRange.end < latestSelectableDay;

  const resetEditor = () => {
    setEditingExpense(null);
    setTitle("");
    setAmount("");
    setExpenseDate(today());
    setNotes("");
  };

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
    const parsedAmount = parseExpenseAmount(amount);
    if (!title.trim()) {
      showToast({ message: "اكتب اسم المصروف أولاً.", tone: "error" });
      return;
    }
    if (!parsedAmount) {
      showToast({
        message: "أدخل مبلغًا موجبًا صحيحًا، بمنزلتين عشريتين كحد أقصى.",
        tone: "error",
      });
      return;
    }
    if (!isDateKey(expenseDate) || expenseDate > today()) {
      showToast({
        message: "اختر تاريخًا صحيحًا لا يتجاوز اليوم.",
        tone: "error",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (editingExpense) {
        await expenses.updateExpense({
          id: editingExpense.id,
          title,
          amount: parsedAmount,
          expenseDate,
          notes,
        });
        showToast({ message: "تم تعديل المصروف وتحديث الأجور." });
      } else {
        await expenses.createExpense({
          title,
          amount: parsedAmount,
          expenseDate,
          notes,
        });
        showToast({ message: "تم تسجيل مصروف المكتب وتحديث الأجور." });
      }
      resetEditor();
    } catch (error) {
      showToast({
        message:
          error instanceof Error
            ? error.message
            : editingExpense
              ? "تعذر تعديل المصروف."
              : "تعذر تسجيل المصروف.",
        tone: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (expense: NativeOfficeExpense) => {
    setSelectedDay(null);
    setEditingExpense(expense);
    setTitle(expense.title);
    setAmount(amountInputValue(Number(expense.amount)));
    setExpenseDate(expense.expense_date);
    setNotes(expense.notes ?? "");
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
  };

  const confirmDelete = async () => {
    if (!expenseToDelete) return;
    setIsDeleting(true);
    try {
      await expenses.deleteExpense(expenseToDelete.id);
      showToast({ message: "تم حذف المصروف وتحديث الأجور." });
      if (editingExpense?.id === expenseToDelete.id) resetEditor();
      setExpenseToDelete(null);
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "تعذر حذف المصروف.",
        tone: "error",
      });
    } finally {
      setIsDeleting(false);
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
        ref={scrollRef}
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
              سجّل المصاريف اليومية وعدّل أي سجل ليُعاد احتساب الأجور فورًا.
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>
            {editingExpense ? "تعديل المصروف" : "إضافة مصروف جديد"}
          </Text>
          <MaterialIcons
            name={editingExpense ? "edit-note" : "add-card"}
            size={21}
            color={BLUE}
          />
        </View>
        <View style={styles.form}>
          {editingExpense ? (
            <View style={styles.editingNotice}>
              <View style={styles.editingNoticeCopy}>
                <Text style={styles.editingNoticeTitle}>تعديل محفوظ فعليًا</Text>
                <Text style={styles.editingNoticeText}>
                  حفظ التعديل يعيد احتساب ربح الشركة والأجور.
                </Text>
              </View>
              <MotionPressable
                accessibilityLabel="إلغاء تعديل المصروف"
                onPress={resetEditor}
                style={styles.cancelEditButton}
              >
                <Text style={styles.cancelEditText}>إلغاء</Text>
              </MotionPressable>
            </View>
          ) : null}
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
              <Text style={styles.fieldLabel}>التاريخ</Text>
              <MotionPressable
                accessibilityLabel="اختيار تاريخ المصروف"
                onPress={() => setDatePickerTarget("expense")}
                style={styles.dateInput}
              >
                <MaterialIcons name="calendar-month" size={18} color={BLUE} />
                <Text style={styles.dateInputText}>{dateLabel(expenseDate)}</Text>
              </MotionPressable>
            </View>
          </View>
          <Field
            label="ملاحظة اختيارية"
            value={notes}
            onChangeText={setNotes}
            placeholder="تفاصيل إضافية"
          />
          <MotionPressable
            disabled={isSaving}
            onPress={() => void submit()}
            style={({ pressed }) => [
              styles.submit,
              isSaving && styles.submitDisabled,
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons
              name={editingExpense ? "save-as" : "save"}
              size={19}
              color="#FFF"
            />
            <Text style={styles.submitText}>
              {isSaving
                ? "جارٍ الحفظ..."
                : editingExpense
                  ? "حفظ التعديل"
                  : "حفظ المصروف"}
            </Text>
          </MotionPressable>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>سجل مصاريف المكتب</Text>
            <Text style={styles.muted}>
              اختر فترة أو يومًا لعرض مصاريفه وتعديلها.
            </Text>
          </View>
          <Text style={styles.dayCount}>
            {expenseDays.length} أيام بالصفحة
          </Text>
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
              <Text
                style={[
                  styles.periodButtonText,
                  browserPeriod === item.id && styles.periodButtonTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
          <MotionPressable
            accessibilityLabel="تحديد تاريخ سجل المصاريف"
            onPress={() => setDatePickerTarget("browser")}
            style={styles.calendarIconButton}
          >
            <MaterialIcons name="event" size={20} color={BLUE} />
          </MotionPressable>
        </View>

        <View style={styles.periodNavigator}>
          <Pressable
            accessibilityRole="button"
            onPress={() => movePeriod(-1)}
            style={({ pressed }) => [styles.navigatorButton, pressed && styles.pressed]}
          >
            <MaterialIcons name="chevron-right" size={21} color={BLUE} />
            <Text style={styles.navigatorButtonText}>فترة أقدم</Text>
          </Pressable>
          <Text numberOfLines={1} style={styles.periodRangeTitle}>
            {periodRangeLabel(browserPeriod, dateRange)}
          </Text>
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
            <Text style={styles.navigatorButtonText}>فترة أحدث</Text>
            <MaterialIcons name="chevron-left" size={21} color={BLUE} />
          </Pressable>
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
              style={({ pressed }) => [styles.dayCard, pressed && styles.pressed]}
            >
              <View style={styles.dayIcon}>
                <MaterialIcons name="calendar-today" size={19} color="#B54708" />
              </View>
              <View style={styles.dayCopy}>
                <Text style={styles.dayTitle}>{dateLabel(day.date)}</Text>
                <Text style={styles.muted}>
                  {day.expenses.length}{" "}
                  {day.expenses.length === 1 ? "مصروف" : "مصاريف"}
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
        {expenseDays.length ? (
          <View style={styles.pagination}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !expenses.hasPreviousPage }}
              disabled={!expenses.hasPreviousPage || expenses.isFetching}
              onPress={expenses.previousPage}
              style={({ pressed }) => [
                styles.paginationButton,
                (!expenses.hasPreviousPage || expenses.isFetching) &&
                  styles.paginationButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons name="chevron-right" size={21} color={BLUE} />
              <Text style={styles.paginationButtonText}>السابق</Text>
            </Pressable>
            <Text style={styles.paginationLabel}>
              صفحة {expenses.pageNumber} · حتى 5 أيام
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !expenses.hasNextPage }}
              disabled={!expenses.hasNextPage || expenses.isFetching}
              onPress={expenses.nextPage}
              style={({ pressed }) => [
                styles.paginationButton,
                (!expenses.hasNextPage || expenses.isFetching) &&
                  styles.paginationButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.paginationButtonText}>التالي</Text>
              <MaterialIcons name="chevron-left" size={21} color={BLUE} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <DayExpensesModal
        day={selectedDay}
        onClose={() => setSelectedDay(null)}
        onEdit={startEditing}
        onDelete={(expense) => {
          setSelectedDay(null);
          setExpenseToDelete(expense);
        }}
      />
      {datePickerTarget ? (
        <FinancialDatePicker
          visible
          value={dateFromKey(
            datePickerTarget === "expense" ? expenseDate : browserAnchor,
          )}
          title={
            datePickerTarget === "expense"
              ? "تاريخ المصروف"
              : "تحديد تاريخ سجل المصاريف"
          }
          hint={
            datePickerTarget === "expense"
              ? "اختر يوم تسجيل المصروف؛ لا يمكن اختيار يوم لاحق."
              : "اختر يومًا لبدء العرض اليومي من تاريخه."
          }
          onClose={() => setDatePickerTarget(null)}
          onSelect={(date) => {
            const dateKey = dateKeyFromDate(date);
            if (datePickerTarget === "expense") {
              setExpenseDate(dateKey);
            } else {
              setBrowserAnchor(dateKey);
              setBrowserPeriod("daily");
            }
            setDatePickerTarget(null);
          }}
        />
      ) : null}
      <ActionConfirmationDialog
        confirmLabel="حذف المصروف"
        description={
          expenseToDelete
            ? `سيُحذف «${expenseToDelete.title}» بقيمة ${money(Number(expenseToDelete.amount))}، وسيُعاد احتساب أرباح الشركة والأجور فورًا.`
            : ""
        }
        icon="delete-outline"
        isConfirming={isDeleting}
        onClose={() => setExpenseToDelete(null)}
        onConfirm={() => void confirmDelete()}
        title="حذف مصروف المكتب؟"
        visible={Boolean(expenseToDelete)}
      />
    </ScreenContainer>
  );
}

function DayExpensesModal({
  day,
  onClose,
  onEdit,
  onDelete,
}: {
  day: ExpenseDay | null;
  onClose: () => void;
  onEdit: (expense: NativeOfficeExpense) => void;
  onDelete: (expense: NativeOfficeExpense) => void;
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
                {day.expenses.length}{" "}
                {day.expenses.length === 1 ? "مصروف" : "مصاريف"} · الإجمالي{" "}
                {money(day.total)}
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
                <View style={styles.modalExpenseEnd}>
                  <Text style={styles.expense}>{money(Number(expense.amount))}</Text>
                  <View style={styles.modalExpenseActions}>
                    <MotionPressable
                      accessibilityLabel={`تعديل ${expense.title}`}
                      onPress={() => onEdit(expense)}
                      style={styles.editAction}
                    >
                      <MaterialIcons name="edit" size={16} color={BLUE} />
                    </MotionPressable>
                    <MotionPressable
                      accessibilityLabel={`حذف ${expense.title}`}
                      onPress={() => onDelete(expense)}
                      style={styles.deleteAction}
                    >
                      <MaterialIcons name="delete-outline" size={16} color="#BA1A1A" />
                    </MotionPressable>
                  </View>
                </View>
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
        returnKeyType="done"
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
  hero: {
    alignItems: "center",
    backgroundColor: "#FFF",
    borderColor: "#D3E3F0",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row-reverse",
    padding: 16,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1E8",
    borderRadius: 16,
    height: 44,
    justifyContent: "center",
    marginLeft: 12,
    width: 44,
  },
  heroText: { flex: 1 },
  heroTitle: {
    color: "#1C1B1B",
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    textAlign: "right",
    writingDirection: "rtl",
  },
  muted: {
    color: "#66727E",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    marginTop: 3,
    textAlign: "right",
    writingDirection: "rtl",
  },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sectionTitle: {
    color: "#1C1B1B",
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    writingDirection: "rtl",
  },
  form: {
    backgroundColor: "#FFF",
    borderColor: "#D3E3F0",
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  editingNotice: {
    alignItems: "center",
    backgroundColor: "#EAF5FF",
    borderColor: "#C4E5F6",
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 8,
    justifyContent: "space-between",
    padding: 9,
  },
  editingNoticeCopy: { alignItems: "flex-end", flex: 1 },
  editingNoticeTitle: {
    color: "#075D98",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    writingDirection: "rtl",
  },
  editingNoticeText: {
    color: "#51758B",
    fontFamily: "Cairo_400Regular",
    fontSize: 8,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  cancelEditButton: {
    alignItems: "center",
    backgroundColor: "#FFF",
    borderColor: "#C7DEEC",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 30,
    paddingHorizontal: 8,
  },
  cancelEditText: { color: "#456C85", fontFamily: "Cairo_700Bold", fontSize: 9 },
  field: { gap: 4 },
  fieldLabel: {
    color: "#527086",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  input: {
    backgroundColor: "#F7FAFC",
    borderColor: "#D8E5ED",
    borderRadius: 10,
    borderWidth: 1,
    color: "#173B54",
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    minHeight: 42,
    paddingHorizontal: 11,
  },
  dateInput: {
    alignItems: "center",
    backgroundColor: "#F7FAFC",
    borderColor: "#D8E5ED",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 6,
    justifyContent: "flex-start",
    minHeight: 42,
    paddingHorizontal: 10,
  },
  dateInputText: {
    color: "#173B54",
    fontFamily: "Cairo_600SemiBold",
    fontSize: 10,
    writingDirection: "rtl",
  },
  formRow: { flexDirection: "row-reverse", gap: 9 },
  half: { flex: 1 },
  submit: {
    alignItems: "center",
    backgroundColor: BLUE,
    borderRadius: 11,
    flexDirection: "row-reverse",
    gap: 7,
    justifyContent: "center",
    marginTop: 3,
    minHeight: 44,
  },
  submitDisabled: { opacity: 0.58 },
  submitText: { color: "#FFF", fontFamily: "Cairo_700Bold", fontSize: 12 },
  rowTitle: {
    color: "#1C1B1B",
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
  expense: {
    color: "#B54708",
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
    writingDirection: "rtl",
  },
  dayCount: {
    backgroundColor: "#EAF4FF",
    borderRadius: 10,
    color: BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
    writingDirection: "rtl",
  },
  periodButtons: { flexDirection: "row-reverse", gap: 8 },
  periodButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#C8DCEB",
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 41,
  },
  periodButtonActive: { backgroundColor: "#E8F3FF", borderColor: BLUE },
  periodButtonText: {
    color: "#526F82",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    writingDirection: "rtl",
  },
  periodButtonTextActive: { color: BLUE },
  calendarIconButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#C8DCEB",
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 41,
    width: 43,
  },
  periodNavigator: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D3E3F0",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 6,
  },
  navigatorButton: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: 1,
    minHeight: 36,
    paddingHorizontal: 5,
  },
  navigatorButtonDisabled: { opacity: 0.32 },
  navigatorButtonText: {
    color: BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    writingDirection: "rtl",
  },
  periodRangeTitle: {
    color: "#244E69",
    flex: 1,
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    paddingHorizontal: 4,
    textAlign: "center",
    writingDirection: "rtl",
  },
  pagination: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D3E3F0",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 7,
  },
  paginationButton: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: 1,
    minHeight: 36,
    paddingHorizontal: 5,
  },
  paginationButtonDisabled: { opacity: 0.32 },
  paginationButtonText: {
    color: BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    writingDirection: "rtl",
  },
  paginationLabel: {
    color: "#66727E",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    writingDirection: "rtl",
  },
  dayCard: {
    alignItems: "center",
    backgroundColor: "#FFF",
    borderColor: "#D3E3F0",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 10,
    minHeight: 70,
    padding: 12,
  },
  dayIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1E8",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  dayCopy: { alignItems: "flex-end", flex: 1 },
  dayTitle: {
    color: "#1C1B1B",
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
  },
  dayEnd: { alignItems: "flex-end", flexDirection: "row-reverse", gap: 3 },
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(4,31,50,0.36)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#F8FBFD",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "76%",
    minHeight: 220,
    overflow: "hidden",
  },
  modalHeader: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomColor: "#DCE8F0",
    borderBottomWidth: 1,
    flexDirection: "row-reverse",
    gap: 10,
    padding: 16,
  },
  modalClose: {
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  modalTitleCopy: { alignItems: "flex-end", flex: 1 },
  modalTitle: {
    color: "#163E5C",
    fontFamily: "Cairo_700Bold",
    fontSize: 15,
    textAlign: "right",
    writingDirection: "rtl",
  },
  modalContent: { padding: 14 },
  modalExpense: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    flexDirection: "row-reverse",
    gap: 10,
    minHeight: 64,
    paddingVertical: 10,
  },
  modalExpenseBorder: { borderBottomColor: "#E4EDF3", borderBottomWidth: 1 },
  expenseIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1E8",
    borderRadius: 11,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  expenseCopy: { alignItems: "flex-end", flex: 1 },
  modalExpenseEnd: { alignItems: "flex-end", gap: 5 },
  modalExpenseActions: { flexDirection: "row-reverse", gap: 5 },
  editAction: {
    alignItems: "center",
    backgroundColor: "#EAF5FF",
    borderRadius: 8,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  deleteAction: {
    alignItems: "center",
    backgroundColor: "#FFF0F1",
    borderRadius: 8,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  message: {
    alignItems: "center",
    backgroundColor: "#FFF",
    borderColor: "#C7DAE8",
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 70,
    padding: 16,
  },
  messageText: {
    color: "#58616B",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    textAlign: "center",
    writingDirection: "rtl",
  },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
