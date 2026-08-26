import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { goBackOrReplace } from "@/lib/navigation/go-back-or-replace";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { MotionPressable } from "@/components/ui/motion-pressable";
import { useAppToast } from "@/contexts/app-toast-context";
import {
  useNativeOfficeExpensePeriods,
  useNativeOfficeExpenses,
  type NativeFinancePeriod,
} from "@/features/admin/use-admin-finance";

const BLUE = "#0060B8";
const money = (value: number) => `${new Intl.NumberFormat("en-US").format(value)} ل.س`;
const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("ar-SY", { timeZone: "Asia/Damascus", dateStyle: "medium" }).format(
    new Date(`${value}T12:00:00Z`),
  );

export function AdminOfficeExpenses() {
  const router = useRouter();
  const { showToast } = useAppToast();
  const [period, setPeriod] = useState<Exclude<NativeFinancePeriod, "annual">>("daily");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today);
  const [notes, setNotes] = useState("");
  const periods = useNativeOfficeExpensePeriods(period);
  const expenses = useNativeOfficeExpenses();
  const submit = async () => {
    const parsed = Number(amount.replace(",", "."));
    if (!title.trim()) return showToast({ message: "اكتب اسم المصروف أولاً.", tone: "error" });
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return showToast({ message: "أدخل مبلغًا صحيحًا للمصروف.", tone: "error" });
    }
    try {
      await expenses.createExpense({ title, amount: parsed, expenseDate, notes });
      setTitle("");
      setAmount("");
      setNotes("");
      showToast({ message: "تم تسجيل مصروف المكتب." });
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "تعذر تسجيل المصروف.",
        tone: "error",
      });
    }
  };

  return (
    <ScreenContainer className="bg-[#F0F7FF]" containerClassName="bg-[#EAF5FF]">
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "العودة إلى أرباح الشركة",
          icon: "arrow-forward",
          onPress: () => goBackOrReplace(router, "/company-wages"),
        }}
        trailingAction={{ accessibilityLabel: "مصاريف المكتب", icon: "receipt-long" }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
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
          <View style={styles.heroIcon}><MaterialIcons name="receipt-long" size={24} color="#B54708" /></View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>مصاريف المكتب</Text>
            <Text style={styles.muted}>سجّل مصاريف المكتب اليومية واعرض سجلها حسب الفترة.</Text>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>إضافة مصروف جديد</Text>
          <MaterialIcons name="add-card" size={21} color={BLUE} />
        </View>
        <View style={styles.form}>
          <Field label="اسم المصروف" value={title} onChangeText={setTitle} placeholder="مثال: باكية متة" />
          <View style={styles.formRow}>
            <View style={styles.half}><Field label="المبلغ" value={amount} onChangeText={setAmount} placeholder="0" keyboardType="decimal-pad" /></View>
            <View style={styles.half}><Field label="التاريخ" value={expenseDate} onChangeText={setExpenseDate} placeholder="YYYY-MM-DD" /></View>
          </View>
          <Field label="ملاحظة اختيارية" value={notes} onChangeText={setNotes} placeholder="تفاصيل إضافية" />
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
            <MotionPressable key={value} onPress={() => setPeriod(value)} style={[styles.period, period === value && styles.active]}>
              <Text style={[styles.periodText, period === value && styles.activeText]}>
                {value === "daily" ? "يومي" : value === "weekly" ? "أسبوعي" : "شهري"}
              </Text>
            </MotionPressable>
          ))}
        </View>
        {periods.isPending ? <Message text="جارٍ تحميل ملخص المصاريف..." /> : periods.error ? <Message text="تعذر تحميل ملخص المصاريف." /> : (periods.data ?? []).map((row) => (
          <View key={row.period_start} style={styles.row}>
            <View><Text style={styles.rowTitle}>{dateLabel(row.period_start)}{period !== "daily" ? ` — ${dateLabel(row.period_end)}` : ""}</Text><Text style={styles.muted}>إجمالي مصاريف الفترة</Text></View>
            <View style={styles.end}><Text style={styles.expense}>{money(Number(row.expense_total))}</Text><Text style={styles.muted}>مصروف</Text></View>
          </View>
        ))}

        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>سجل مصاريف المكتب</Text><Text style={styles.muted}>{expenses.data?.length ?? 0} مصاريف</Text></View>
        {expenses.isPending ? <Message text="جارٍ تحميل السجل..." /> : expenses.error ? <Message text="تعذر تحميل سجل المصاريف." /> : (expenses.data ?? []).map((expense) => (
          <View key={expense.id} style={styles.expenseRow}>
            <View style={styles.expenseIcon}><MaterialIcons name="receipt" size={19} color="#B54708" /></View>
            <View style={styles.expenseCopy}><Text style={styles.rowTitle}>{expense.title}</Text><Text style={styles.muted}>{dateLabel(expense.expense_date)}{expense.notes ? ` · ${expense.notes}` : ""}</Text></View>
            <Text style={styles.expense}>{money(Number(expense.amount))}</Text>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType = "default" }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: "default" | "decimal-pad" }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#98AAB8" keyboardType={keyboardType} style={styles.input} textAlign="right" /></View>;
}
function Message({ text }: { text: string }) { return <View style={styles.message}><Text style={styles.messageText}>{text}</Text></View>; }

const styles = StyleSheet.create({
  content: { gap: 12, padding: 18, paddingBottom: 36 },
  hero: { alignItems: "center", backgroundColor: "#FFF", borderColor: "#D3E3F0", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", padding: 16 },
  heroIcon: { alignItems: "center", backgroundColor: "#FFF1E8", borderRadius: 16, height: 44, justifyContent: "center", marginLeft: 12, width: 44 },
  heroText: { flex: 1 }, heroTitle: { color: "#1C1B1B", fontFamily: "Cairo_700Bold", fontSize: 16, textAlign: "right", writingDirection: "rtl" },
  muted: { color: "#66727E", fontFamily: "Cairo_400Regular", fontSize: 10, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  netCard: { backgroundColor: BLUE, borderRadius: 17, padding: 18 }, kicker: { color: "#D9EEFF", fontFamily: "Cairo_600SemiBold", fontSize: 10, textAlign: "right", writingDirection: "rtl" }, netAmount: { color: "#FFF", fontFamily: "Cairo_700Bold", fontSize: 25, marginTop: 4, textAlign: "right", writingDirection: "rtl" }, netHint: { color: "#D9EEFF", fontFamily: "Cairo_400Regular", fontSize: 10, marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  metrics: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 }, metric: { backgroundColor: "#FFF", borderColor: "#D3E3F0", borderRadius: 14, borderWidth: 1, minHeight: 78, padding: 12, width: "31.8%" }, metricValue: { fontFamily: "Cairo_700Bold", fontSize: 12, textAlign: "right", writingDirection: "rtl" },
  sectionHeading: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 4 }, sectionTitle: { color: "#1C1B1B", fontFamily: "Cairo_700Bold", fontSize: 14, writingDirection: "rtl" },
  form: { backgroundColor: "#FFF", borderColor: "#D3E3F0", borderRadius: 16, borderWidth: 1, gap: 10, padding: 14 }, field: { gap: 4 }, fieldLabel: { color: "#527086", fontFamily: "Cairo_700Bold", fontSize: 10, textAlign: "right", writingDirection: "rtl" }, input: { backgroundColor: "#F7FAFC", borderColor: "#D8E5ED", borderRadius: 10, borderWidth: 1, color: "#173B54", fontFamily: "Cairo_400Regular", fontSize: 12, minHeight: 42, paddingHorizontal: 11 }, formRow: { flexDirection: "row-reverse", gap: 9 }, half: { flex: 1 }, submit: { alignItems: "center", backgroundColor: BLUE, borderRadius: 11, flexDirection: "row-reverse", gap: 7, justifyContent: "center", minHeight: 44, marginTop: 3 }, submitText: { color: "#FFF", fontFamily: "Cairo_700Bold", fontSize: 12 },
  periods: { backgroundColor: "#FFF", borderColor: "#D3E3F0", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 5, padding: 5 }, period: { alignItems: "center", borderRadius: 11, flex: 1, justifyContent: "center", minHeight: 40 }, active: { backgroundColor: BLUE }, periodText: { color: "#5C7C90", fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" }, activeText: { color: "#FFF" },
  row: { backgroundColor: "#FFF", borderColor: "#D3E3F0", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", justifyContent: "space-between", padding: 14 }, rowTitle: { color: "#1C1B1B", fontFamily: "Cairo_700Bold", fontSize: 12, textAlign: "right", writingDirection: "rtl" }, end: { alignItems: "flex-end" }, expense: { color: "#B54708", fontFamily: "Cairo_700Bold", fontSize: 12, writingDirection: "rtl" }, net: { color: "#047857", fontFamily: "Cairo_700Bold", fontSize: 11, marginTop: 3, writingDirection: "rtl" },
  expenseRow: { alignItems: "center", backgroundColor: "#FFF", borderColor: "#D3E3F0", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 10, padding: 12 }, expenseIcon: { alignItems: "center", backgroundColor: "#FFF1E8", borderRadius: 11, height: 36, justifyContent: "center", width: 36 }, expenseCopy: { flex: 1 }, message: { alignItems: "center", backgroundColor: "#FFF", borderColor: "#C7DAE8", borderRadius: 16, borderStyle: "dashed", borderWidth: 1, minHeight: 70, justifyContent: "center", padding: 16 }, messageText: { color: "#58616B", fontFamily: "Cairo_700Bold", fontSize: 11, textAlign: "center", writingDirection: "rtl" },
});
