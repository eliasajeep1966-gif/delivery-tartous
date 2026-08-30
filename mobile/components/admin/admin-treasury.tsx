import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { MotionPressable } from "@/components/ui/motion-pressable";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import {
  useNativeTreasury,
  type NativeTreasuryFilter,
  type NativeTreasuryTransactionType,
} from "@/features/admin/use-admin-finance";
import { useAppToast } from "@/contexts/app-toast-context";
import { goBackOrReplace } from "@/lib/navigation/go-back-or-replace";

const BLUE = "#0878D1";
const GREEN = "#07875D";
const RED = "#B54708";

const money = (value: number) =>
  `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)} ل.س`;

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("ar-SY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Damascus",
  }).format(new Date(value));
}

function transactionLabel(type: NativeTreasuryTransactionType) {
  if (type === "company_profit_in") return "وارد نقدي · ربح الأجور";
  if (type === "capital_in") return "وارد نقدي · إيداع";
  return "صادر نقدي · سحب";
}

function transactionIcon(type: NativeTreasuryTransactionType) {
  if (type === "withdrawal_out") return "south-west" as const;
  if (type === "capital_in") return "north-east" as const;
  return "trending-up" as const;
}

export function AdminTreasury() {
  const router = useRouter();
  const { profile } = useDeliveryAuth();
  const { showToast } = useAppToast();
  const [transactionFilter, setTransactionFilter] = useState<NativeTreasuryFilter>("all");
  const treasury = useNativeTreasury(transactionFilter);
  const [editorType, setEditorType] = useState<"deposit" | "withdrawal" | null>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAdmin = profile?.role === "admin";
  const overview = treasury.overview;

  const resetEditor = useCallback(() => {
    setEditorType(null);
    setAmount("");
    setNotes("");
  }, []);

  const submit = async () => {
    const parsedAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showToast({ message: "أدخل مبلغاً موجباً وصحيحاً.", tone: "error" });
      return;
    }
    setIsSubmitting(true);
    try {
      if (editorType === "deposit") await treasury.deposit(parsedAmount, notes);
      else if (editorType === "withdrawal") await treasury.withdraw(parsedAmount, notes);
      showToast({
        message: editorType === "deposit" ? "تم تسجيل الإيداع." : "تم تسجيل السحب.",
      });
      resetEditor();
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "تعذر تسجيل حركة الصندوق.",
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const headerTitle = editorType === "deposit" ? "إيداع نقدي" : "سحب نقدي";
  const errorText = treasury.error instanceof Error ? treasury.error.message : null;

  if (!profile || (profile.role !== "admin" && profile.role !== "supervisor")) {
    return (
      <ScreenContainer className="p-5">
        <View style={styles.roleNotice}>
          <Text style={styles.roleNoticeTitle}>لا تملك صلاحية الصندوق</Text>
          <Text style={styles.roleNoticeText}>واجهة الصندوق مخصصة للإدارة والمشرف فقط.</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-[#F4F7FB]" containerClassName="bg-[#F4F7FB]">
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "العودة",
          icon: "arrow-forward",
          onPress: () => goBackOrReplace(router, "/wages"),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={treasury.isFetching} onRefresh={treasury.refetch} tintColor={BLUE} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Text style={styles.title}>الصندوق المالي</Text>
          <Text style={styles.subtitle}>الرصيد الكلي للشركة من الأرباح والإيداعات بعد المسحوبات</Text>
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.balanceCardTop}>
            <View style={styles.balanceIcon}>
              <MaterialIcons name="account-balance-wallet" size={25} color="#FFFFFF" />
            </View>
            <Text style={styles.balanceKicker}>الرصيد الحالي للصندوق</Text>
          </View>
          {treasury.isPending && !overview ? (
            <ActivityIndicator color="#FFFFFF" style={styles.balanceLoader} />
          ) : (
            <Text style={styles.balanceValue}>{money(overview?.current_balance ?? 0)}</Text>
          )}
          <Text style={styles.balanceHint}>الرصيد النهائي المتراكم: أرباح الشركة + الوارد النقدي − الصادر النقدي</Text>
        </View>

        {errorText ? <Message text={errorText} tone="error" /> : null}

        <View style={styles.metricsRow}>
          <Metric
            label="صافي ربح الشركة اليوم"
            value={money(overview?.company_profit_today ?? 0)}
            color={GREEN}
          />
          <Metric
            label="حركة الصندوق"
            value={money(overview?.cash_flow_total ?? 0)}
            color={(overview?.cash_flow_total ?? 0) >= 0 ? BLUE : RED}
          />
        </View>

        {isAdmin ? (
          <View style={styles.actionsRow}>
            <MotionPressable
              onPress={() => setEditorType("deposit")}
              style={({ pressed }) => [styles.actionButton, styles.depositButton, pressed && styles.pressed]}
            >
              <MaterialIcons name="add-circle-outline" size={21} color={GREEN} />
              <Text style={[styles.actionText, { color: GREEN }]}>إيداع نقدي</Text>
            </MotionPressable>
            <MotionPressable
              onPress={() => setEditorType("withdrawal")}
              style={({ pressed }) => [styles.actionButton, styles.withdrawButton, pressed && styles.pressed]}
            >
              <MaterialIcons name="remove-circle-outline" size={21} color={RED} />
              <Text style={[styles.actionText, { color: RED }]}>سحب نقدي</Text>
            </MotionPressable>
          </View>
        ) : (
          <Message text="المشرف يستطيع مشاهدة الصندوق، أما الإيداع والسحب فمتاحان للأدمن فقط." />
        )}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>سجل حركات الصندوق</Text>
            <Text style={styles.sectionHint}>{overview?.transaction_count ?? 0} حركة مسجلة بشكل دائم</Text>
          </View>
          <MaterialIcons name="receipt-long" size={22} color={BLUE} />
                </View>
        <View style={styles.filterRow}>
          {([
            ["all", "الكل"],
            ["wages", "حركة الأجور"],
            ["cash", "حركة الصندوق"],
          ] as const).map(([value, label]) => (
            <MotionPressable
              key={value}
              onPress={() => setTransactionFilter(value)}
              style={[styles.filterButton, transactionFilter === value && styles.activeFilterButton]}
            >
              <Text style={[styles.filterText, transactionFilter === value && styles.activeFilterText]}>{label}</Text>
            </MotionPressable>
          ))}
        </View>
        {treasury.transactions.length === 0 && !treasury.isPending ? (
          <Message text="لا توجد حركات مسجلة في الصندوق حتى الآن." />
        ) : null}
        {treasury.transactions.map((transaction) => {
          const isWithdrawal = transaction.transaction_type === "withdrawal_out";
          return (
            <View key={transaction.id} style={styles.transactionCard}>
              <View style={[styles.transactionIcon, { backgroundColor: isWithdrawal ? "#FFF1E8" : "#EAF8F2" }]}>
                <MaterialIcons
                  name={transactionIcon(transaction.transaction_type)}
                  size={21}
                  color={isWithdrawal ? RED : GREEN}
                />
              </View>
              <View style={styles.transactionCopy}>
                <Text style={styles.transactionTitle}>{transactionLabel(transaction.transaction_type)}</Text>
                <Text style={styles.transactionMeta}>
                  {transaction.admin_name ? `بواسطة ${transaction.admin_name} · ` : "نظامياً · "}
                  {dateLabel(transaction.created_at)}
                </Text>
                {transaction.notes ? <Text style={styles.transactionNotes}>{transaction.notes}</Text> : null}
              </View>
              <View style={styles.transactionAmounts}>
                <Text style={[styles.transactionAmount, { color: isWithdrawal ? RED : GREEN }]}>
                  {isWithdrawal ? "−" : "+"}{money(transaction.amount)}
                </Text>
                <Text style={styles.runningBalance}>الرصيد {money(transaction.running_balance)}</Text>
              </View>
            </View>
          );
        })}

        <View style={styles.paginationRow}>
          <MotionPressable
            disabled={!treasury.hasPreviousPage || treasury.isFetching}
            onPress={treasury.previousPage}
            style={({ pressed }) => [styles.pageButton, (!treasury.hasPreviousPage || treasury.isFetching) && styles.disabledButton, pressed && styles.pressed]}
          >
            <MaterialIcons name="chevron-right" size={21} color={BLUE} />
            <Text style={styles.pageButtonText}>السابق</Text>
          </MotionPressable>
          <Text style={styles.pageNumber}>صفحة {treasury.pageNumber}</Text>
          <MotionPressable
            disabled={!treasury.hasNextPage || treasury.isFetching}
            onPress={treasury.nextPage}
            style={({ pressed }) => [styles.pageButton, (!treasury.hasNextPage || treasury.isFetching) && styles.disabledButton, pressed && styles.pressed]}
          >
            <Text style={styles.pageButtonText}>التالي</Text>
            <MaterialIcons name="chevron-left" size={21} color={BLUE} />
          </MotionPressable>
        </View>
      </ScrollView>

      <Modal visible={Boolean(editorType)} transparent animationType="fade" onRequestClose={resetEditor}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={resetEditor} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeading}>
              <Text style={styles.modalTitle}>{headerTitle}</Text>
              <MotionPressable onPress={resetEditor} style={styles.closeButton}>
                <MaterialIcons name="close" size={22} color="#52616B" />
              </MotionPressable>
            </View>
            <Text style={styles.fieldLabel}>المبلغ</Text>
            <TextInput
              autoFocus
              keyboardType="decimal-pad"
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="#98AAB8"
              returnKeyType="done"
              style={styles.input}
              value={amount}
            />
            <Text style={styles.fieldLabel}>ملاحظة (اختياري)</Text>
            <TextInput
              multiline
              onChangeText={setNotes}
              placeholder={editorType === "deposit" ? "مثلاً: إيداع من الشريك" : "مثلاً: دفع فاتورة"}
              placeholderTextColor="#98AAB8"
              style={[styles.input, styles.notesInput]}
              value={notes}
            />
            <MotionPressable disabled={isSubmitting} onPress={submit} style={({ pressed }) => [styles.submitButton, isSubmitting && styles.disabledButton, pressed && styles.pressed]}>
              {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>تأكيد الحركة</Text>}
            </MotionPressable>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Message({ text, tone = "info" }: { text: string; tone?: "info" | "error" }) {
  return (
    <View style={[styles.message, tone === "error" && styles.errorMessage]}>
      <Text style={[styles.messageText, tone === "error" && styles.errorMessageText]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 36 },
  intro: { marginBottom: 14 },
  title: { color: "#163B53", fontSize: 24, fontWeight: "800", textAlign: "right" },
  subtitle: { color: "#6A8799", fontSize: 13, lineHeight: 20, marginTop: 4, textAlign: "right" },
  balanceCard: { backgroundColor: "#0878D1", borderRadius: 20, padding: 19, marginBottom: 12, shadowColor: "#0878D1", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  balanceCardTop: { alignItems: "center", flexDirection: "row-reverse", gap: 10 },
  balanceIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 13, height: 45, justifyContent: "center", width: 45 },
  balanceKicker: { color: "#DDF1FF", fontSize: 14, fontWeight: "700" },
  balanceValue: { color: "#FFFFFF", fontSize: 31, fontWeight: "900", marginTop: 17, textAlign: "right" },
  balanceLoader: { marginVertical: 22 },
  balanceHint: { color: "#DDF1FF", fontSize: 12, marginTop: 6, textAlign: "right" },
  metricsRow: { backgroundColor: "#FFFFFF", borderColor: "#E2ECF2", borderRadius: 16, borderWidth: 1, flexDirection: "row-reverse", marginBottom: 12, overflow: "hidden" },
  metric: { alignItems: "center", flex: 1, paddingHorizontal: 7, paddingVertical: 14 },
  metricValue: { fontSize: 13, fontWeight: "800", textAlign: "center" },
  metricLabel: { color: "#7892A1", fontSize: 11, marginTop: 4, textAlign: "center" },
  actionsRow: { flexDirection: "row-reverse", gap: 10, marginBottom: 18 },
  actionButton: { alignItems: "center", borderRadius: 14, borderWidth: 1, flex: 1, flexDirection: "row-reverse", gap: 9, justifyContent: "center", minHeight: 56, minWidth: 0, paddingHorizontal: 10, paddingVertical: 14 },
  depositButton: { backgroundColor: "#EAF8F2", borderColor: "#BFE7D3" },
  withdrawButton: { backgroundColor: "#FFF1E8", borderColor: "#F1D0BA" },
  actionText: { fontSize: 15, fontWeight: "800" },
  sectionHeading: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 10, marginTop: 3 },
  sectionTitle: { color: "#163B53", fontSize: 17, fontWeight: "800", textAlign: "right" },
  sectionHint: { color: "#7892A1", fontSize: 12, marginTop: 3, textAlign: "right" },
  filterRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 12 },
  filterButton: { alignItems: "center", backgroundColor: "#F3F7FA", borderColor: "#DDE8EE", borderRadius: 12, borderWidth: 1, flex: 1, minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  activeFilterButton: { backgroundColor: "#E4F1FB", borderColor: BLUE },
  filterText: { color: "#617887", fontSize: 13, fontWeight: "700", textAlign: "center" },
  activeFilterText: { color: BLUE },
  transactionCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E2ECF2", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginBottom: 9, padding: 12 },
  transactionIcon: { alignItems: "center", borderRadius: 11, height: 42, justifyContent: "center", width: 42 },
  transactionCopy: { flex: 1 },
  transactionTitle: { color: "#214A61", fontSize: 14, fontWeight: "800", textAlign: "right" },
  transactionMeta: { color: "#7892A1", fontSize: 10, marginTop: 4, textAlign: "right" },
  transactionNotes: { color: "#52616B", fontSize: 11, marginTop: 4, textAlign: "right" },
  transactionAmounts: { alignItems: "flex-start", minWidth: 113 },
  transactionAmount: { fontSize: 12, fontWeight: "900", textAlign: "left" },
  runningBalance: { color: "#7892A1", fontSize: 10, marginTop: 4, textAlign: "left" },
  paginationRow: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginTop: 8 },
  pageButton: { alignItems: "center", borderColor: "#BFDCEB", borderRadius: 11, borderWidth: 1, flexDirection: "row-reverse", gap: 3, paddingHorizontal: 11, paddingVertical: 9 },
  pageButtonText: { color: BLUE, fontSize: 12, fontWeight: "800" },
  pageNumber: { color: "#52616B", fontSize: 12, fontWeight: "700" },
  disabledButton: { opacity: 0.4 },
  message: { backgroundColor: "#EEF7FC", borderRadius: 12, marginBottom: 12, padding: 12 },
  messageText: { color: "#52616B", fontSize: 12, textAlign: "right" },
  errorMessage: { backgroundColor: "#FFF1E8" },
  errorMessageText: { color: "#A63D00" },
  roleNotice: { backgroundColor: "#FFF1E8", borderRadius: 15, padding: 18 },
  roleNoticeTitle: { color: "#A63D00", fontSize: 18, fontWeight: "800", textAlign: "right" },
  roleNoticeText: { color: "#7E4A2E", fontSize: 13, marginTop: 7, textAlign: "right" },
  modalOverlay: { alignItems: "center", backgroundColor: "rgba(22,59,83,0.42)", flex: 1, justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, width: "100%" },
  modalHeading: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 18 },
  modalTitle: { color: "#163B53", fontSize: 19, fontWeight: "800", textAlign: "right" },
  closeButton: { padding: 3 },
  fieldLabel: { color: "#52616B", fontSize: 13, fontWeight: "700", marginBottom: 6, marginTop: 10, textAlign: "right" },
  input: { backgroundColor: "#F7FAFC", borderColor: "#DCE8EF", borderRadius: 11, borderWidth: 1, color: "#163B53", fontSize: 16, paddingHorizontal: 13, paddingVertical: 12, textAlign: "right" },
  notesInput: { minHeight: 76, textAlignVertical: "top" },
  submitButton: { alignItems: "center", backgroundColor: BLUE, borderRadius: 12, justifyContent: "center", marginTop: 20, minHeight: 48, paddingHorizontal: 16 },
  submitText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
