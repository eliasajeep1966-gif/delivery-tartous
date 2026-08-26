import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useMemo, useState } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { MotionPressable } from "@/components/ui/motion-pressable";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import { useNativeCaptainDashboard } from "@/features/captain/use-native-captain-dashboard";
import {
  nativeCaptainContract,
  type CaptainCustody,
  type CaptainWageRow,
} from "@/lib/supabase/native-captain-contract";

const DEEP_BLUE = "#063B78";
const BLUE = "#0878D1";
const NEON = "#16CEFF";
const money = (value: number) =>
  `${new Intl.NumberFormat("en-US").format(value)} ل.س`;
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("ar-SY", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "غير مسجل";

type Period = "daily" | "weekly" | "monthly";
function inPeriod(value: string, period: Period) {
  const time = new Date(value).getTime();
  const now = new Date();
  const start = new Date(now);
  if (period === "daily") start.setHours(0, 0, 0, 0);
  if (period === "weekly") {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  }
  if (period === "monthly") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return time >= start.getTime() && time <= now.getTime();
}

export function CaptainOrders() {
  const data = useNativeCaptainDashboard();
  return (
    <Page
      title="طلباتي"
      subtitle="كل الطلبات المسندة إلى حسابك"
      refreshing={data.refreshing}
      onRefresh={() => void data.reload(true)}
    >
      {data.error ? (
        <Message text={data.error} />
      ) : (
        data.orders.map((order, index) => (
          <Animated.View
            entering={FadeInDown.delay(70 + index * 30).duration(190)}
            key={order.id}
            style={styles.card}
          >
            <View style={styles.between}>
              <View>
                <Text style={styles.muted}>الطلب #{order.order_number}</Text>
                <Text style={styles.title}>{order.customer_name}</Text>
                <MotionPressable
                  onPress={() =>
                    void Linking.openURL(`tel:${order.customer_phone}`)
                  }
                >
                  <Text style={styles.phone}>{order.customer_phone}</Text>
                </MotionPressable>
              </View>
              <View style={styles.left}>
                <Text style={styles.badge}>{order.status}</Text>
                <Text style={styles.amount}>{money(order.fee)}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <Text style={styles.line}>المصدر: {order.pickup_address}</Text>
            <Text style={styles.line}>الوجهة: {order.delivery_address}</Text>
            <Text style={styles.muted}>{date(order.updated_at)}</Text>
          </Animated.View>
        ))
      )}
    </Page>
  );
}

export function CaptainWages() {
  const { profile } = useDeliveryAuth();
  const [rows, setRows] = useState<CaptainWageRow[]>([]);
  const [period, setPeriod] = useState<Period>("daily");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await nativeCaptainContract.reads.wages(profile.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل الأجور.");
    } finally {
      setLoading(false);
    }
  }, [profile]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);
  const visible = useMemo(
    () => rows.filter((row) => inPeriod(row.completed_at, period)),
    [period, rows],
  );
  const totals = useMemo(
    () =>
      visible.reduce(
        (sum, row) => ({
          gross: sum.gross + row.gross_fee,
          captain: sum.captain + row.captain_amount,
          company: sum.company + row.company_amount,
          settlement: sum.settlement + row.settlement_amount,
          paid: sum.paid + row.paid_amount,
          unpaid: sum.unpaid + row.unpaid_amount,
        }),
        { gross: 0, captain: 0, company: 0, settlement: 0, paid: 0, unpaid: 0 },
      ),
    [visible],
  );
  return (
    <Page
      title="أجوري"
      subtitle="تفاصيل الأجور من السجلات الفعلية"
      refreshing={loading}
      onRefresh={() => void load()}
    >
      <View style={styles.periods}>
        {(["daily", "weekly", "monthly"] as const).map((value) => (
          <MotionPressable
            key={value}
            onPress={() => setPeriod(value)}
            style={[styles.period, period === value && styles.periodActive]}
          >
            <Text
              style={[
                styles.periodText,
                period === value && styles.periodTextActive,
              ]}
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
      {error ? (
        <Message text={error} />
      ) : (
        <>
          <View style={styles.metrics}>
            <Metric label="الإجمالي" value={money(totals.gross)} />
            <Metric label="صافي الكابتن (70%)" value={money(totals.captain)} />
            <Metric label="حصة الشركة" value={money(totals.company)} />
            <Metric label="التسوية" value={money(totals.settlement)} />
            <Metric label="المسدّد" value={money(totals.paid)} />
            <Metric label="المتبقي" value={money(totals.unpaid)} />
          </View>
          {visible.map((row, index) => (
            <Animated.View
              entering={FadeInDown.delay(70 + index * 30).duration(190)}
              key={row.financial_ledger_id}
              style={styles.card}
            >
              <View style={styles.between}>
                <View>
                  <Text style={styles.muted}>الطلب #{row.order_number}</Text>
                  <Text style={styles.line}>{date(row.completed_at)}</Text>
                </View>
                <View style={styles.left}>
                  <Text style={styles.amount}>
                    {money(row.captain_amount)} (70%)
                  </Text>
                  <Text style={styles.company}>
                    الشركة: {money(row.company_amount)}
                  </Text>
                </View>
              </View>
              <View style={styles.divider} />
              <Text style={row.is_fully_paid ? styles.paid : styles.unpaid}>
                {row.is_fully_paid
                  ? "تم تسليم الأجر"
                  : `متبقي ${money(row.unpaid_amount)}`}
              </Text>
            </Animated.View>
          ))}
        </>
      )}
    </Page>
  );
}

export function CaptainCustodyPage() {
  const [rows, setRows] = useState<CaptainCustody[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await nativeCaptainContract.reads.custody());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل الأمانات.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);
  return (
    <Page
      title="أماناتي"
      subtitle="الأغراض المسجلة على عهدتك"
      refreshing={loading}
      onRefresh={() => void load()}
    >
      {error ? (
        <Message text={error} />
      ) : rows.length ? (
        rows.map((row, index) => (
          <Animated.View
            entering={FadeInDown.delay(70 + index * 30).duration(190)}
            key={row.id}
            style={styles.card}
          >
            <View style={styles.between}>
              <View>
                <Text style={styles.muted}>أمانة #{row.id.slice(0, 8)}</Text>
                <Text style={styles.title}>{row.item_name}</Text>
              </View>
              <Text style={row.returned_at ? styles.paid : styles.unpaid}>
                {row.returned_at ? "مُرجعة" : "على العهدة"}
              </Text>
            </View>
            {row.item_details ? (
              <Text style={styles.line}>{row.item_details}</Text>
            ) : null}
            <Text style={styles.muted}>
              استلمت بتاريخ: {date(row.assigned_at)}
            </Text>
          </Animated.View>
        ))
      ) : (
        <Message text="لا توجد أمانات مسجلة." />
      )}
    </Page>
  );
}

export function CaptainSettings() {
  const auth = useDeliveryAuth();
  const [name, setName] = useState(auth.profile?.full_name ?? "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveName = async () => {
    if (!name.trim()) return setMessage("اكتب الاسم الجديد.");
    setSaving(true);
    try {
      await nativeCaptainContract.actions.updateName(name.trim());
      await auth.refresh();
      setMessage("تم تحديث الاسم.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "تعذر تحديث الاسم.");
    } finally {
      setSaving(false);
    }
  };
  const savePassword = async () => {
    if (password.length < 12)
      return setMessage("كلمة المرور يجب أن تكون 12 محرفاً على الأقل.");
    if (password !== confirmation)
      return setMessage("تأكيد كلمة المرور غير مطابق.");
    setSaving(true);
    try {
      await nativeCaptainContract.actions.updatePassword(password);
      setPassword("");
      setConfirmation("");
      setMessage("تم تحديث كلمة المرور.");
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "تعذر تحديث كلمة المرور.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Page title="إعدادات الحساب" subtitle="تغيير بيانات الكابتن">
      <View style={styles.card}>
        <View style={styles.accountHeading}>
          <MaterialIcons name="account-circle" size={28} color={BLUE} />
          <Text style={styles.title}>تفاصيل الحساب</Text>
        </View>
        <View style={styles.accountRow}>
          <Text style={styles.accountValue}>
            {auth.profile?.full_name || "غير مسجل"}
          </Text>
          <Text style={styles.accountLabel}>الاسم</Text>
        </View>
        <View style={styles.accountRow}>
          <Text style={styles.accountValue}>
            {auth.profile?.email || "غير متاح"}
          </Text>
          <Text style={styles.accountLabel}>البريد الإلكتروني</Text>
        </View>
        <View style={styles.accountRow}>
          <Text style={styles.accountValue}>كابتن</Text>
          <Text style={styles.accountLabel}>الدور</Text>
        </View>
        <View style={styles.accountRow}>
          <Text style={styles.accountValue}>
            {auth.profile?.is_active ? "فعال" : "غير فعال"}
          </Text>
          <Text style={styles.accountLabel}>حالة الحساب</Text>
        </View>
        <View style={styles.accountRow}>
          <Text style={styles.accountValue}>
            {date(auth.profile?.created_at ?? null)}
          </Text>
          <Text style={styles.accountLabel}>تاريخ إنشاء الحساب</Text>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>تغيير الاسم</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.input}
          textAlign="right"
        />
        <Button
          label="حفظ الاسم"
          onPress={() => void saveName()}
          disabled={saving}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>تغيير كلمة المرور</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          placeholder="كلمة المرور الجديدة"
          textAlign="right"
        />
        <TextInput
          value={confirmation}
          onChangeText={setConfirmation}
          secureTextEntry
          style={styles.input}
          placeholder="تأكيد كلمة المرور"
          textAlign="right"
        />
        <Button
          label="حفظ كلمة المرور"
          onPress={() => void savePassword()}
          disabled={saving}
        />
      </View>
      {message ? <Message text={message} /> : null}
      <View style={styles.logoutCard}>
        <Text style={styles.logoutTitle}>إنهاء الجلسة</Text>
        <Text style={styles.muted}>
          سيتم تسجيل خروجك من تطبيق الكابتن على هذا الجهاز.
        </Text>
        <Button
          label="تسجيل الخروج"
          onPress={() =>
            Alert.alert("تسجيل الخروج", "هل تريد تسجيل الخروج من حسابك؟", [
              { text: "إلغاء", style: "cancel" },
              {
                text: "تسجيل الخروج",
                style: "destructive",
                onPress: () => void auth.signOut(),
              },
            ])
          }
          danger
        />
      </View>
    </Page>
  );
}

function Page({
  title,
  subtitle,
  children,
  refreshing = false,
  onRefresh,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <ScreenContainer
      className="bg-transparent"
      containerClassName="bg-transparent"
    >
      <DeliveryAppHeader />
      <ScrollView
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={BLUE}
            />
          ) : undefined
        }
        contentContainerStyle={styles.content}
      >
        <View style={styles.pageHead}>
          <MaterialIcons name="local-shipping" size={22} color={BLUE} />
          <View>
            <Text style={styles.pageTitle}>{title}</Text>
            <Text style={styles.pageSubtitle}>{subtitle}</Text>
          </View>
        </View>
        <Animated.View
          entering={FadeInDown.delay(45).duration(200)}
          style={styles.pageBody}
        >
          {children}
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.amount}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
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
function Button({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <MotionPressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        danger && styles.buttonDanger,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, danger && styles.buttonDangerText]}>
        {label}
      </Text>
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, padding: 12, paddingBottom: 34 },
  pageBody: { gap: 12 },
  pageHead: {
    alignItems: "center",
    backgroundColor: DEEP_BLUE,
    borderColor: NEON,
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 10,
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: DEEP_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 12,
  },
  pageTitle: {
    color: "#FFFFFF",
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    textAlign: "right",
    writingDirection: "rtl",
  },
  pageSubtitle: {
    color: "#CDEFFF",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderColor: "#D1ECF6",
    borderRadius: 17,
    borderWidth: 1,
    gap: 8,
    padding: 14,
    shadowColor: "#0A668A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.045,
    shadowRadius: 8,
  },
  between: { flexDirection: "row-reverse", justifyContent: "space-between" },
  left: { alignItems: "flex-end" },
  title: {
    color: "#194B6E",
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
  },
  muted: {
    color: "#748C9D",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  phone: {
    color: "#1478BF",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    marginTop: 4,
  },
  badge: {
    backgroundColor: "#EAF9FF",
    borderColor: "#BCEBFA",
    borderRadius: 9,
    borderWidth: 1,
    color: BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    writingDirection: "rtl",
  },
  amount: {
    color: "#075D9F",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    writingDirection: "rtl",
  },
  company: {
    color: BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    marginTop: 3,
    writingDirection: "rtl",
  },
  divider: { borderTopColor: "#DCEBF3", borderTopWidth: 1, marginVertical: 2 },
  line: {
    color: "#54778D",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  periods: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "#CFEAF5",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 5,
    padding: 5,
  },
  period: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  periodActive: {
    backgroundColor: BLUE,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
  },
  periodText: {
    color: "#5C7C90",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    writingDirection: "rtl",
  },
  periodTextActive: { color: "#FFFFFF" },
  metrics: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  metric: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderColor: "#D1ECF6",
    borderRadius: 15,
    borderWidth: 1,
    minHeight: 84,
    padding: 12,
    width: "48.5%",
  },
  paid: {
    color: "#047857",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  unpaid: {
    color: "#B45309",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  message: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    minHeight: 90,
    justifyContent: "center",
    padding: 16,
  },
  messageText: {
    color: "#587386",
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
    textAlign: "center",
    writingDirection: "rtl",
  },
  input: {
    backgroundColor: "#F8FCFE",
    borderColor: "#CFEAF5",
    borderRadius: 13,
    borderWidth: 1,
    color: "#194B6E",
    fontFamily: "Cairo_400Regular",
    minHeight: 50,
    paddingHorizontal: 12,
    writingDirection: "rtl",
  },
  accountHeading: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: 8,
    marginBottom: 4,
  },
  accountRow: {
    borderTopColor: "#E4F0F5",
    borderTopWidth: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 7,
  },
  accountLabel: {
    color: "#7892A3",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  accountValue: {
    color: "#285C79",
    flex: 1,
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    marginRight: 12,
    textAlign: "left",
    writingDirection: "rtl",
  },
  logoutCard: {
    backgroundColor: "#FFF8F8",
    borderColor: "#F3D2D2",
    borderRadius: 15,
    borderWidth: 1,
    gap: 8,
    padding: 13,
  },
  logoutTitle: {
    color: "#991B1B",
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
  },
  button: {
    alignItems: "center",
    backgroundColor: BLUE,
    borderColor: NEON,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 50,
  },
  buttonText: { color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 11 },
  buttonDanger: { backgroundColor: "#FEE2E2" },
  buttonDangerText: { color: "#B91C1C" },
  disabled: { opacity: 0.55 },
});
