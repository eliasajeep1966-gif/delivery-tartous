import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { FinancialDatePicker } from "@/components/ui/financial-date-picker";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { MotionPressable } from "@/components/ui/motion-pressable";
import { useAppToast } from "@/contexts/app-toast-context";
import {
  useNativeOfficeExpensePeriods,
  useNativeOfficeExpenses,
  type NativeFinancePeriod,
  type NativeOfficeExpenseDay,
  type NativeOfficeExpenseDayFilter,
} from "@/features/admin/use-admin-finance";
import { goBackOrReplace } from "@/lib/navigation/go-back-or-replace";

const BLUE = "#0060B8";
const money = (value: number) =>
  `${new Intl.NumberFormat("en-US").format(value)} ل.س`;

function dateKey(value: Date): string {
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

const today = () => dateKey(new Date());
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    dateStyle: "full",
  }).format(new Date(`${value}T12:00:00Z`));

const periodLabel = (value: Exclude<NativeFinancePeriod, "annual">) =>
  value === "daily" ? "يومي" : value === "weekly" ? "أسبوعي" : "شهري";

const expenseFilters: {
  id: Exclude<NativeOfficeExpenseDayFilter, "custom">;
  label: string;
}[] = [
  { id: "all", label: "الكل" },
  { id: "today", label: "اليوم" },
  { id: "week", label: "هذا الأسبوع" },
  { id: "month", label: "هذا الشهر" },
];

export function AdminOfficeExpenses() {
  const router = useRouter();
  const { showToast } = useAppToast();
  const [period, setPeriod] = useState<Exclude<NativeFinancePeriod, "annual">>("daily");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [expandedDays, setExpandedDays] = useState<string[]>([]);
  const [pickerTarget, setPickerTarget] = useState<"expense" | "filter" | null>(null);
  const [filterDateValue, setFilterDateValue] = useState(new Date());
  const periods = useNativeOfficeExpensePeriods(period);
  const expenses = useNativeOfficeExpenses();

  const toggleDay = (day: string) => {
    setExpandedDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day],
    );
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
      setExpandedDays((current) =>
        current.includes(expenseDate) ? current : [expenseDate, ...current],
      );
      showToast({ message: "تم تسجيل مصروف المكتب." });
    } catch (error) {
      showToast({
        message:
          error instanceof Error ? error.message : "تعذر تسجيل المصروف.",
        tone: "error",
      });
    }
  };

  const selectFilter = (
    filter: Exclude<NativeOfficeExpenseDayFilter, "custom">,
  ) => {
    expenses.selectFilter(filter);
    setExpandedDays([]);
  };

  const selectCustomDate = (date: Date) => {
    const key = dateKey(date);
    setFilterDateValue(date);
    expenses.selectCustomDate(key);
    setExpandedDays([key]);
    setPickerTarget(null);
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
              سجّل المصاريف واعرضها مرتبة ضمن أيامها.
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
              <Text style={styles.fieldLabel}>التاريخ</Text>
              <MotionPressable
                onPress={() => setPickerTarget("expense")}
                style={styles.dateInput}
              >
                <MaterialIcons name="event" size={16} color={BLUE} />
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
          <MotionPressable onPress={() => void submit()} style={styles.submit}>
            <MaterialIcons name="save" size={19} color="#FFF" />
            <Text style={styles.submitText}>حفظ المصروف</Text>
          </MotionPressable>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>صافي الشركة حسب الفترة</Text>
          <Text style={styles.muted}>بعد خصم المصاريف</Text>
        </View>
        <View style={styles.periodButtons}>
          {(["daily", "weekly", "monthly"] as const).map((value) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: period === value }}
              key={value}
              onPress={() => setPeriod(value)}
              style={({ pressed }) => [
                styles.periodButton,
                period === value && styles.periodButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  period === value && styles.periodButtonTextActive,
                ]}
              >
                {periodLabel(value)}
              </Text>
            </Pressable>
          ))}
        </View>
        {periods.isPending ? (
          <Message text="جارٍ تحميل ملخص المصاريف..." />
        ) : periods.error ? (
          <Message text="تعذر تحميل ملخص المصاريف." />
        ) : (
          (periods.data ?? []).map((row) => (
            <View key={row.period_start} style={styles.summaryRow}>
              <View style={styles.summaryCopy}>
                <Text style={styles.rowTitle}>
                  {dateLabel(row.period_start)}
                  {period !== "daily" ? ` — ${dateLabel(row.period_end)}` : ""}
                </Text>
                <Text style={styles.muted}>إجمالي مصاريف الفترة</Text>
              </View>
              <View style={styles.end}>
                <Text style={styles.expense}>{money(Number(row.expense_total))}</Text>
                <Text style={styles.muted}>مصروف</Text>
              </View>
            </View>
          ))
        )}

        <View style={styles.historyHeading}>
          <View>
            <Text style={styles.sectionTitle}>سجل مصاريف المكتب</Text>
            <Text style={styles.muted}>
              خمس أيام فقط في كل صفحة للحفاظ على سرعة العرض.
            </Text>
          </View>
          <View style={styles.pageBadge}>
            <Text style={styles.pageBadgeText}>صفحة {expenses.pageNumber}</Text>
          </View>
        </View>

        <View style={styles.filterButtons}>
          {expenseFilters.map((item) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: expenses.filter === item.id }}
              key={item.id}
              onPress={() => selectFilter(item.id)}
              style={({ pressed }) => [
                styles.filterButton,
                expenses.filter === item.id && styles.filterButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  expenses.filter === item.id && styles.filterButtonTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <MotionPressable
          onPress={() => setPickerTarget("filter")}
          style={[
            styles.dateFilter,
            expenses.filter === "custom" && styles.dateFilterActive,
          ]}
        >
          <View style={styles.dateFilterCopy}>
            <Text style={styles.dateFilterKicker}>فلترة بتاريخ محدد</Text>
            <Text style={styles.dateFilterValue}>
              {expenses.customDate
                ? dateLabel(expenses.customDate)
                : "اختر يوماً لعرض مصاريفه فقط"}
            </Text>
          </View>
          <MaterialIcons name="event" size={20} color={BLUE} />
        </MotionPressable>

        {expenses.isPending ? (
          <Message text="جارٍ تحميل سجل المصاريف..." />
        ) : expenses.error ? (
          <Message text="تعذر تحميل سجل المصاريف. اسحب للتحديث ثم حاول مجدداً." />
        ) : !expenses.days.length ? (
          <Message text="لا توجد مصاريف مطابقة للفلتر المختار." />
        ) : (
          expenses.days.map((day) => (
            <ExpenseDayGroup
              day={day}
              expanded={expandedDays.includes(day.expenseDate)}
              key={day.expenseDate}
              onPress={() => toggleDay(day.expenseDate)}
            />
          ))
        )}

        {expenses.days.length ? (
          <View style={styles.pagination}>
            <Pressable
              accessibilityRole="button"
              disabled={!expenses.hasPreviousPage || expenses.isFetching}
              onPress={expenses.previousPage}
              style={({ pressed }) => [
                styles.paginationButton,
                (!expenses.hasPreviousPage || expenses.isFetching) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons name="chevron-right" size={20} color={BLUE} />
              <Text style={styles.paginationButtonText}>السابق</Text>
            </Pressable>
            <Text style={styles.paginationLabel}>كل صفحة: 5 أيام</Text>
            <Pressable
              accessibilityRole="button"
              disabled={!expenses.hasNextPage || expenses.isFetching}
              onPress={expenses.nextPage}
              style={({ pressed }) => [
                styles.paginationButton,
                (!expenses.hasNextPage || expenses.isFetching) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.paginationButtonText}>التالي</Text>
              <MaterialIcons name="chevron-left" size={20} color={BLUE} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {pickerTarget ? (
        <FinancialDatePicker
          visible
          value={
            pickerTarget === "expense"
              ? new Date(`${expenseDate}T12:00:00Z`)
              : filterDateValue
          }
          onClose={() => setPickerTarget(null)}
          onSelect={(date) => {
            if (pickerTarget === "expense") {
              setExpenseDate(dateKey(date));
              setPickerTarget(null);
              return;
            }
            selectCustomDate(date);
          }}
          title={
            pickerTarget === "expense" ? "تاريخ المصروف" : "فلترة سجل المصاريف"
          }
          hint={
            pickerTarget === "expense"
              ? "اختر اليوم الذي تم فيه دفع المصروف"
              : "اختر يوماً محدداً لعرض مصاريفه"
          }
        />
      ) : null}
    </ScreenContainer>
  );
}

function ExpenseDayGroup({
  day,
  expanded,
  onPress,
}: {
  day: NativeOfficeExpenseDay;
  expanded: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.dayGroup}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onPress}
        style={({ pressed }) => [styles.dayHeader, pressed && styles.pressed]}
      >
        <View style={styles.dayIcon}>
          <MaterialIcons name="calendar-today" size={18} color="#B54708" />
        </View>
        <View style={styles.dayCopy}>
          <Text style={styles.dayTitle}>{dateLabel(day.expenseDate)}</Text>
          <Text style={styles.dayMeta}>
            {day.expenseCount} {day.expenseCount === 1 ? "مصروف" : "مصاريف"}
          </Text>
        </View>
        <View style={styles.dayEnd}>
          <Text style={styles.dayTotal}>{money(day.expenseTotal)}</Text>
          <MaterialIcons
            name={expanded ? "expand-less" : "expand-more"}
            size={22}
            color="#5E7C90"
          />
        </View>
      </Pressable>
      {expanded ? (
        <View style={styles.dayExpenses}>
          {day.expenses.map((expense, index) => (
            <View
              key={expense.id}
              style={[
                styles.expenseRow,
                index !== day.expenses.length - 1 && styles.expenseRowBorder,
              ]}
            >
              <View style={styles.expenseIcon}>
                <MaterialIcons name="receipt" size={17} color="#B54708" />
              </View>
              <View style={styles.expenseCopy}>
                <Text style={styles.rowTitle}>{expense.title}</Text>
                {expense.notes ? <Text style={styles.muted}>{expense.notes}</Text> : null}
              </View>
              <Text style={styles.expense}>{money(expense.amount)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
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
    marginTop: 4,
    minHeight: 42,
    paddingHorizontal: 10,
  },
  dateInputText: {
    color: "#173B54",
    flex: 1,
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    textAlign: "right",
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
  submitText: { color: "#FFF", fontFamily: "Cairo_700Bold", fontSize: 12 },
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
  summaryRow: {
    alignItems: "center",
    backgroundColor: "#FFF",
    borderColor: "#D3E3F0",
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    padding: 14,
  },
  summaryCopy: { flex: 1, marginLeft: 12 },
  rowTitle: {
    color: "#1C1B1B",
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
  end: { alignItems: "flex-end" },
  expense: {
    color: "#B54708",
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
    writingDirection: "rtl",
  },
  historyHeading: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 8,
  },
  pageBadge: { backgroundColor: "#EAF4FF", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 },
  pageBadgeText: { color: BLUE, fontFamily: "Cairo_700Bold", fontSize: 9, writingDirection: "rtl" },
  filterButtons: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  filterButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#C8DCEB",
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 37,
    paddingHorizontal: 12,
  },
  filterButtonActive: { backgroundColor: BLUE, borderColor: BLUE },
  filterButtonText: { color: "#526F82", fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" },
  filterButtonTextActive: { color: "#FFFFFF" },
  dateFilter: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#C8DCEB",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    padding: 12,
  },
  dateFilterActive: { backgroundColor: "#F1F8FF", borderColor: BLUE },
  dateFilterCopy: { alignItems: "flex-end", flex: 1, marginLeft: 10 },
  dateFilterKicker: { color: "#527086", fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" },
  dateFilterValue: { color: "#173B54", fontFamily: "Cairo_400Regular", fontSize: 11, marginTop: 2, writingDirection: "rtl" },
  dayGroup: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D3E3F0",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  dayHeader: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: 10,
    minHeight: 66,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dayIcon: {
    alignItems: "center",
    backgroundColor: "#FFF1E8",
    borderRadius: 12,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  dayCopy: { alignItems: "flex-end", flex: 1 },
  dayTitle: { color: "#1C1B1B", fontFamily: "Cairo_700Bold", fontSize: 12, textAlign: "right", writingDirection: "rtl" },
  dayMeta: { color: "#66727E", fontFamily: "Cairo_400Regular", fontSize: 10, marginTop: 2, writingDirection: "rtl" },
  dayEnd: { alignItems: "flex-end", gap: 1 },
  dayTotal: { color: "#B54708", fontFamily: "Cairo_700Bold", fontSize: 12, writingDirection: "rtl" },
  dayExpenses: { backgroundColor: "#FBFDFF", borderTopColor: "#E0EBF2", borderTopWidth: 1, paddingHorizontal: 12 },
  expenseRow: { alignItems: "center", flexDirection: "row-reverse", gap: 9, minHeight: 59, paddingVertical: 9 },
  expenseRowBorder: { borderBottomColor: "#E7EEF3", borderBottomWidth: 1 },
  expenseIcon: { alignItems: "center", backgroundColor: "#FFF1E8", borderRadius: 10, height: 32, justifyContent: "center", width: 32 },
  expenseCopy: { alignItems: "flex-end", flex: 1 },
  pagination: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D3E3F0",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 6,
    justifyContent: "space-between",
    padding: 7,
  },
  paginationButton: { alignItems: "center", flexDirection: "row-reverse", gap: 2, minHeight: 36, paddingHorizontal: 6 },
  paginationButtonText: { color: BLUE, fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" },
  paginationLabel: { color: "#66727E", fontFamily: "Cairo_400Regular", fontSize: 9, writingDirection: "rtl" },
  disabled: { opacity: 0.35 },
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
  messageText: { color: "#58616B", fontFamily: "Cairo_700Bold", fontSize: 11, textAlign: "center", writingDirection: "rtl" },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
