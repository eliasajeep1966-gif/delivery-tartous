import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useMemo, useState } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  Linking,
  Modal,
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
  const [selectedCustody, setSelectedCustody] = useState<CaptainCustody | null>(
    null,
  );
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

  const activeRows = useMemo(
    () => rows.filter((row) => !row.returned_at),
    [rows],
  );
  const returnedRows = useMemo(
    () => rows.filter((row) => Boolean(row.returned_at)),
    [rows],
  );
  const displayRows = useMemo(
    () => [...activeRows, ...returnedRows],
    [activeRows, returnedRows],
  );

  return (
    <>
      <Page
        title="أماناتي"
        subtitle="كشف العهدة المسجل على حسابك"
        refreshing={loading}
        onRefresh={() => void load()}
      >
        {error ? (
          <Message text={error} />
        ) : rows.length ? (
          <>
            <View style={styles.custodySummary}>
              <CustodySummary
                icon="inventory-2"
                label="على العهدة"
                value={activeRows.length}
                active
              />
              <CustodySummary
                icon="check-circle-outline"
                label="مُرجعة"
                value={returnedRows.length}
              />
            </View>
            <View style={styles.custodyHeading}>
              <View>
                <Text style={styles.custodyTitle}>سجل الأمانات</Text>
                <Text style={styles.custodyHint}>
                  تظهر الأمانات الموجودة معك أولًا
                </Text>
              </View>
              <Text style={styles.custodyCount}>{rows.length} عناصر</Text>
            </View>
            {displayRows.map((row, index) => {
              const returned = Boolean(row.returned_at);
              return (
                <Animated.View
                  entering={FadeInDown.delay(80 + index * 35).duration(190)}
                  key={row.id}
                >
                  <MotionPressable
                    accessibilityLabel={`عرض تفاصيل ${row.item_name}`}
                    onPress={() => setSelectedCustody(row)}
                    style={[
                      styles.custodyItem,
                      returned && styles.custodyItemReturned,
                    ]}
                  >
                    <View style={styles.custodyItemTop}>
                      <View
                        style={[
                          styles.custodyItemIcon,
                          returned && styles.custodyItemIconReturned,
                        ]}
                      >
                        <MaterialIcons
                          name={returned ? "assignment-turned-in" : "inventory-2"}
                          size={20}
                          color={returned ? "#6A8392" : BLUE}
                        />
                      </View>
                      <View style={styles.custodyItemCopy}>
                        <Text numberOfLines={1} style={styles.custodyItemTitle}>
                          {row.item_name}
                        </Text>
                        <Text style={styles.custodyItemCode}>سجل عهدة</Text>
                      </View>
                      <View style={styles.custodyItemEnd}>
                        <Text
                          style={
                            returned
                              ? styles.custodyStatusReturned
                              : styles.custodyStatusActive
                          }
                        >
                          {returned ? "مُرجعة" : "على العهدة"}
                        </Text>
                        <MaterialIcons
                          name="chevron-left"
                          size={22}
                          color="#6B90A5"
                        />
                      </View>
                    </View>
                    <View style={styles.custodyItemFooter}>
                      <View style={styles.custodyDate}>
                        <MaterialIcons
                          name="calendar-today"
                          size={13}
                          color="#6B90A5"
                        />
                        <Text style={styles.custodyDateText}>
                          استلمت {date(row.assigned_at)}
                        </Text>
                      </View>
                      {row.item_details ? (
                        <Text
                          numberOfLines={1}
                          style={styles.custodyPreview}
                        >
                          {row.item_details}
                        </Text>
                      ) : null}
                    </View>
                  </MotionPressable>
                </Animated.View>
              );
            })}
          </>
        ) : (
          <Message text="لا توجد أمانات مسجلة." />
        )}
      </Page>

      <Modal
        transparent
        visible={Boolean(selectedCustody)}
        animationType="none"
        onRequestClose={() => setSelectedCustody(null)}
      >
        <View style={styles.custodySheetBackdrop}>
          <MotionPressable
            haptic="none"
            onPress={() => setSelectedCustody(null)}
            style={styles.custodySheetDismiss}
          />
          {selectedCustody ? (
            <Animated.View
              entering={FadeInDown.duration(210)}
              style={styles.custodySheet}
            >
              <View style={styles.custodySheetHandle} />
              <View style={styles.custodySheetHeader}>
                <View style={styles.custodySheetIcon}>
                  <MaterialIcons name="inventory-2" size={22} color={BLUE} />
                </View>
                <View style={styles.custodySheetCopy}>
                  <Text style={styles.custodySheetKicker}>تفاصيل العهدة</Text>
                  <Text style={styles.custodySheetTitle}>
                    {selectedCustody.item_name}
                  </Text>
                </View>
                <MotionPressable
                  accessibilityLabel="إغلاق تفاصيل العهدة"
                  onPress={() => setSelectedCustody(null)}
                  style={styles.custodySheetClose}
                >
                  <MaterialIcons name="close" size={20} color={DEEP_BLUE} />
                </MotionPressable>
              </View>
              <View style={styles.custodySheetStatusRow}>
                <Text style={styles.custodySheetStatusLabel}>حالة العهدة</Text>
                <Text
                  style={
                    selectedCustody.returned_at
                      ? styles.custodyStatusReturned
                      : styles.custodyStatusActive
                  }
                >
                  {selectedCustody.returned_at ? "مُرجعة" : "على العهدة"}
                </Text>
              </View>
              <View style={styles.custodySheetInfo}>
                <MaterialIcons
                  name="calendar-today"
                  size={16}
                  color="#5D8297"
                />
                <View style={styles.custodySheetInfoCopy}>
                  <Text style={styles.custodySheetInfoLabel}>تاريخ الاستلام</Text>
                  <Text style={styles.custodySheetInfoValue}>
                    {date(selectedCustody.assigned_at)}
                  </Text>
                </View>
              </View>
              {selectedCustody.returned_at ? (
                <View style={styles.custodySheetInfo}>
                  <MaterialIcons
                    name="assignment-returned"
                    size={17}
                    color="#5D8297"
                  />
                  <View style={styles.custodySheetInfoCopy}>
                    <Text style={styles.custodySheetInfoLabel}>تاريخ الإرجاع</Text>
                    <Text style={styles.custodySheetInfoValue}>
                      {date(selectedCustody.returned_at)}
                    </Text>
                  </View>
                </View>
              ) : null}
              {selectedCustody.item_details ? (
                <View style={styles.custodyDescription}>
                  <Text style={styles.custodyDescriptionLabel}>وصف الغرض</Text>
                  <Text style={styles.custodyDescriptionText}>
                    {selectedCustody.item_details}
                  </Text>
                </View>
              ) : null}
            </Animated.View>
          ) : null}
        </View>
      </Modal>
    </>
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
function CustodySummary({
  icon,
  label,
  value,
  active = false,
}: {
  icon: "inventory-2" | "check-circle-outline";
  label: string;
  value: number;
  active?: boolean;
}) {
  return (
    <View
      style={[
        styles.custodySummaryCard,
        active && styles.custodySummaryCardActive,
      ]}
    >
      <View
        style={[
          styles.custodySummaryIcon,
          active && styles.custodySummaryIconActive,
        ]}
      >
        <MaterialIcons
          name={icon}
          size={19}
          color={active ? BLUE : "#638293"}
        />
      </View>
      <Text style={styles.custodySummaryValue}>{value}</Text>
      <Text style={styles.custodySummaryLabel}>{label}</Text>
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
  custodySummary: {
    flexDirection: "row-reverse",
    gap: 9,
  },
  custodySummaryCard: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderColor: "#D5EAF1",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    minHeight: 92,
    padding: 12,
  },
  custodySummaryCardActive: {
    backgroundColor: "#F0FBFF",
    borderColor: "#A6E8FC",
  },
  custodySummaryIcon: {
    alignItems: "center",
    backgroundColor: "#EEF5F8",
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  custodySummaryIconActive: { backgroundColor: "#DDF7FF" },
  custodySummaryValue: {
    color: DEEP_BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 18,
    marginTop: 3,
    textAlign: "right",
    writingDirection: "rtl",
  },
  custodySummaryLabel: {
    color: "#6A8392",
    fontFamily: "Cairo_600SemiBold",
    fontSize: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  custodyHeading: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 4,
  },
  custodyTitle: {
    color: DEEP_BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    textAlign: "right",
    writingDirection: "rtl",
  },
  custodyHint: {
    color: "#7892A3",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    marginTop: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  custodyCount: {
    backgroundColor: "#EAF9FF",
    borderColor: "#BCEBFA",
    borderRadius: 11,
    borderWidth: 1,
    color: BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
    writingDirection: "rtl",
  },
  custodyItem: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderColor: "#CFEAF5",
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 108,
    overflow: "hidden",
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  custodyItemReturned: {
    backgroundColor: "rgba(250,252,253,0.9)",
    borderColor: "#DFE9EE",
  },
  custodyItemTop: {
    alignItems: "center",
    flexDirection: "row-reverse",
  },
  custodyItemIcon: {
    alignItems: "center",
    backgroundColor: "#E8F9FF",
    borderColor: "#BCEBFA",
    borderRadius: 13,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  custodyItemIconReturned: {
    backgroundColor: "#F0F4F6",
    borderColor: "#DCE6EA",
  },
  custodyItemCopy: { flex: 1, marginHorizontal: 10 },
  custodyItemTitle: {
    color: "#164866",
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
  },
  custodyItemCode: {
    color: "#7A95A5",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    marginTop: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  custodyItemEnd: { alignItems: "flex-end", gap: 2 },
  custodyStatusActive: {
    backgroundColor: "#E8F9FF",
    borderColor: "#A6E8FC",
    borderRadius: 9,
    borderWidth: 1,
    color: "#0878D1",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3,
    writingDirection: "rtl",
  },
  custodyStatusReturned: {
    backgroundColor: "#F1F5F7",
    borderColor: "#DCE5E9",
    borderRadius: 9,
    borderWidth: 1,
    color: "#627E8D",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3,
    writingDirection: "rtl",
  },
  custodyItemFooter: {
    alignItems: "center",
    borderTopColor: "#E7F0F4",
    borderTopWidth: 1,
    flexDirection: "row-reverse",
    gap: 9,
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
  },
  custodyDate: { alignItems: "center", flexDirection: "row-reverse", gap: 5 },
  custodyDateText: {
    color: "#698696",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    writingDirection: "rtl",
  },
  custodyPreview: {
    color: "#54778D",
    flex: 1,
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    textAlign: "left",
    writingDirection: "rtl",
  },
  custodySheetBackdrop: {
    backgroundColor: "rgba(4,31,50,0.38)",
    flex: 1,
    justifyContent: "flex-end",
  },
  custodySheetDismiss: { ...StyleSheet.absoluteFill },
  custodySheet: {
    backgroundColor: "#FFFFFF",
    borderColor: "#BCEBFA",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 16,
    paddingBottom: 24,
  },
  custodySheetHandle: {
    alignSelf: "center",
    backgroundColor: "#CBE6F0",
    borderRadius: 3,
    height: 5,
    width: 46,
  },
  custodySheetHeader: {
    alignItems: "center",
    flexDirection: "row-reverse",
  },
  custodySheetIcon: {
    alignItems: "center",
    backgroundColor: "#E8F9FF",
    borderColor: "#BCEBFA",
    borderRadius: 14,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  custodySheetCopy: { flex: 1, marginHorizontal: 10 },
  custodySheetKicker: {
    color: BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    textAlign: "right",
    writingDirection: "rtl",
  },
  custodySheetTitle: {
    color: DEEP_BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    textAlign: "right",
    writingDirection: "rtl",
  },
  custodySheetClose: {
    alignItems: "center",
    backgroundColor: "#F0F8FC",
    borderColor: "#D1ECF6",
    borderRadius: 15,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  custodySheetStatusRow: {
    alignItems: "center",
    backgroundColor: "#F8FCFE",
    borderColor: "#DFEFF5",
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    padding: 11,
  },
  custodySheetStatusLabel: {
    color: "#5D8297",
    fontFamily: "Cairo_600SemiBold",
    fontSize: 10,
    writingDirection: "rtl",
  },
  custodySheetInfo: {
    alignItems: "center",
    backgroundColor: "#F8FCFE",
    borderRadius: 13,
    flexDirection: "row-reverse",
    padding: 11,
  },
  custodySheetInfoCopy: { flex: 1, marginHorizontal: 8 },
  custodySheetInfoLabel: {
    color: "#7A95A5",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    textAlign: "right",
    writingDirection: "rtl",
  },
  custodySheetInfoValue: {
    color: "#234F69",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  custodyDescription: {
    backgroundColor: "#F8FCFE",
    borderColor: "#DFEFF5",
    borderRadius: 13,
    borderWidth: 1,
    padding: 11,
  },
  custodyDescriptionLabel: {
    color: "#5D8297",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  custodyDescriptionText: {
    color: "#4F7185",
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    lineHeight: 19,
    marginTop: 4,
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
