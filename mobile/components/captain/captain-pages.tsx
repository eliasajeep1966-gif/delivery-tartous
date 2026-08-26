import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useState } from "react";
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
import { FinancialDatePicker } from "@/components/ui/financial-date-picker";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { MotionPressable } from "@/components/ui/motion-pressable";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import {
  CAPTAIN_ORDERS_PAGE_SIZE,
  useNativeCaptainOrders,
  type CaptainOrderWithTiming,
} from "@/features/captain/use-native-captain-dashboard";
import {
  CAPTAIN_WAGES_PAGE_SIZE,
  useNativeCaptainWages,
} from "@/features/captain/use-native-captain-wages";
import {
  nativeCaptainContract,
  type CaptainCustody,
} from "@/lib/supabase/native-captain-contract";
import {
  presentDeliveryTiming,
  type DeliveryTiming,
} from "@/lib/admin/delivery-duration";

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
const customWageDateLabel = (value: string) =>
  new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Damascus",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
const damascusDateKey = (value: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Damascus",
    year: "numeric",
  }).formatToParts(value);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
};

export function CaptainOrders() {
  const data = useNativeCaptainOrders();
  const firstOrderNumber = data.total
    ? data.page * CAPTAIN_ORDERS_PAGE_SIZE + 1
    : 0;
  const lastOrderNumber = Math.min(
    (data.page + 1) * CAPTAIN_ORDERS_PAGE_SIZE,
    data.total,
  );

  return (
    <Page
      title="طلباتي"
      subtitle="كل الطلبات المسندة إلى حسابك"
      refreshing={data.refreshing}
      onRefresh={() => void data.reload(true)}
    >
      {data.error ? (
        <Message text={data.error} />
      ) : data.loading ? (
        <Message text="جارٍ تحميل طلباتك..." />
      ) : data.orders.length ? (
        <>
          <View style={styles.ordersPageSummary}>
            <View>
              <Text style={styles.ordersPageTitle}>سجل الطلبات</Text>
              <Text style={styles.ordersPageHint}>
                عرض {firstOrderNumber}–{lastOrderNumber} من {data.total}
              </Text>
            </View>
            <Text style={styles.ordersPageCount}>{data.total} طلب</Text>
          </View>

          {data.orders.map((order, index) => (
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
              <OrderDeliveryTiming
                status={order.status}
                timing={order.deliveryTiming}
              />
              <Text style={styles.muted}>{date(order.updated_at)}</Text>
            </Animated.View>
          ))}

          {data.pageCount > 1 ? (
            <View style={styles.ordersPagination}>
              <MotionPressable
                accessibilityLabel="الصفحة السابقة"
                disabled={!data.hasPreviousPage}
                onPress={data.previousPage}
                style={[
                  styles.ordersPaginationButton,
                  !data.hasPreviousPage && styles.ordersPaginationButtonDisabled,
                ]}
              >
                <MaterialIcons name="chevron-right" size={22} color={DEEP_BLUE} />
                <Text style={styles.ordersPaginationButtonText}>السابق</Text>
              </MotionPressable>
              <Text style={styles.ordersPaginationLabel}>
                صفحة {data.page + 1} من {data.pageCount}
              </Text>
              <MotionPressable
                accessibilityLabel="الصفحة التالية"
                disabled={!data.hasNextPage}
                onPress={data.nextPage}
                style={[
                  styles.ordersPaginationButton,
                  !data.hasNextPage && styles.ordersPaginationButtonDisabled,
                ]}
              >
                <Text style={styles.ordersPaginationButtonText}>التالي</Text>
                <MaterialIcons name="chevron-left" size={22} color={DEEP_BLUE} />
              </MotionPressable>
            </View>
          ) : null}
        </>
      ) : (
        <Message text="لا توجد طلبات مسندة إلى حسابك حالياً." />
      )}
    </Page>
  );
}

function OrderDeliveryTiming({
  status,
  timing,
}: {
  status: CaptainOrderWithTiming["status"];
  timing: DeliveryTiming | null;
}) {
  const presentation = timing ? presentDeliveryTiming(timing) : null;
  if (!presentation) return null;

  if (presentation.mode !== "completed") {
    const text = presentation.mode === "received"
      ? `تم الاستلام ${presentation.receivedTime}`
      : `تم الاستلام ${presentation.receivedTime} · قيد التوصيل ${presentation.inDeliveryTime} · ${presentation.label}`;
    return (
      <View style={styles.deliveryProgressLine}>
        <MaterialIcons
          name={presentation.mode === "received" ? "inventory-2" : "two-wheeler"}
          size={13}
          color={BLUE}
        />
        <Text style={styles.deliveryProgressText}>{text}</Text>
      </View>
    );
  }

  return (
    <View style={styles.deliveryJourney}>
      <View style={styles.deliveryJourneyTop}>
        <Text style={styles.deliveryJourneyLabel}>زمن التوصيل</Text>
        <View style={styles.deliveryDurationBadge}>
          <MaterialIcons name="timer" size={12} color="#08755C" />
          <Text style={styles.deliveryDurationText}>{presentation.label}</Text>
        </View>
      </View>
      <View style={styles.deliveryJourneyTrack}>
        <View style={styles.deliveryJourneyMoment}>
          <Text style={styles.deliveryJourneyMomentLabel}>استلام</Text>
          <Text style={styles.deliveryJourneyMomentTime}>{presentation.receivedTime}</Text>
        </View>
        <View style={styles.deliveryJourneyConnector}>
          <View style={styles.deliveryJourneyLine} />
          <MaterialIcons name="arrow-back" size={13} color="#41A78C" />
        </View>
        <View style={styles.deliveryJourneyMoment}>
          <Text style={styles.deliveryJourneyMomentLabel}>توصيل</Text>
          <Text style={styles.deliveryJourneyMomentTime}>{presentation.completedTime}</Text>
        </View>
      </View>
    </View>
  );
}

export function CaptainWages() {
  const data = useNativeCaptainWages();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const firstRowNumber = data.total
    ? data.page * CAPTAIN_WAGES_PAGE_SIZE + 1
    : 0;
  const lastRowNumber = Math.min(
    (data.page + 1) * CAPTAIN_WAGES_PAGE_SIZE,
    data.total,
  );

  return (
    <Page
      title="أجوري"
      subtitle="تفاصيل الأجور من السجلات الفعلية"
      refreshing={data.refreshing}
      onRefresh={() => void data.reload(true)}
    >
      <View style={styles.periods}>
        {(["daily", "weekly", "monthly", "custom"] as const).map(
          (value) => (
            <MotionPressable
              key={value}
              onPress={() => {
                data.selectFilter(value);
                if (value === "custom") setIsDatePickerOpen(true);
              }}
              style={[
                styles.period,
                data.filter === value && styles.periodActive,
              ]}
            >
              <Text
                style={[
                  styles.periodText,
                  data.filter === value && styles.periodTextActive,
                ]}
              >
                {value === "daily"
                  ? "يومي"
                  : value === "weekly"
                    ? "أسبوعي"
                    : value === "monthly"
                      ? "شهري"
                      : "تاريخ"}
              </Text>
            </MotionPressable>
          ),
        )}
      </View>
      <MotionPressable
        accessibilityLabel="اختيار تاريخ مخصص للأجور"
        onPress={() => setIsDatePickerOpen(true)}
        style={styles.customDateControl}
      >
        <View style={styles.customDateIcon}>
          <MaterialIcons name="calendar-month" size={20} color={BLUE} />
        </View>
        <View style={styles.customDateCopy}>
          <Text style={styles.customDateKicker}>التاريخ المعروض</Text>
          <Text numberOfLines={1} style={styles.customDateValue}>
            {data.filter === "custom"
              ? customWageDateLabel(data.customDate)
              : "اختر تاريخًا مخصصًا"}
          </Text>
        </View>
        <MaterialIcons name="chevron-left" size={22} color="#6B90A5" />
      </MotionPressable>
      {data.error ? (
        <Message text={data.error} />
      ) : data.loading ? (
        <Message text="جارٍ تحميل أجورك..." />
      ) : (
        <>
          <View style={styles.metrics}>
            <Metric label="الإجمالي" value={money(data.totals.gross)} />
            <Metric
              label="صافي الكابتن (70%)"
              value={money(data.totals.captain)}
            />
            <Metric label="حصة الشركة" value={money(data.totals.company)} />
            <Metric label="التسوية" value={money(data.totals.settlement)} />
            <Metric label="المسدّد" value={money(data.totals.paid)} />
            <Metric label="المتبقي" value={money(data.totals.unpaid)} />
          </View>

          {data.rows.length ? (
            <>
              <View style={styles.ordersPageSummary}>
                <View>
                  <Text style={styles.ordersPageTitle}>سجل الأجور</Text>
                  <Text style={styles.ordersPageHint}>
                    عرض {firstRowNumber}–{lastRowNumber} من {data.total}
                  </Text>
                </View>
                <Text style={styles.ordersPageCount}>{data.total} سجل</Text>
              </View>

              {data.rows.map((row, index) => (
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

              {data.pageCount > 1 ? (
                <View style={styles.ordersPagination}>
                  <MotionPressable
                    accessibilityLabel="صفحة الأجور السابقة"
                    disabled={!data.hasPreviousPage}
                    onPress={data.previousPage}
                    style={[
                      styles.ordersPaginationButton,
                      !data.hasPreviousPage &&
                        styles.ordersPaginationButtonDisabled,
                    ]}
                  >
                    <MaterialIcons
                      name="chevron-right"
                      size={22}
                      color={DEEP_BLUE}
                    />
                    <Text style={styles.ordersPaginationButtonText}>
                      السابق
                    </Text>
                  </MotionPressable>
                  <Text style={styles.ordersPaginationLabel}>
                    صفحة {data.page + 1} من {data.pageCount}
                  </Text>
                  <MotionPressable
                    accessibilityLabel="صفحة الأجور التالية"
                    disabled={!data.hasNextPage}
                    onPress={data.nextPage}
                    style={[
                      styles.ordersPaginationButton,
                      !data.hasNextPage && styles.ordersPaginationButtonDisabled,
                    ]}
                  >
                    <Text style={styles.ordersPaginationButtonText}>التالي</Text>
                    <MaterialIcons
                      name="chevron-left"
                      size={22}
                      color={DEEP_BLUE}
                    />
                  </MotionPressable>
                </View>
              ) : null}
            </>
          ) : (
            <Message text="لا توجد أجور مسجلة ضمن هذه الفترة." />
          )}
        </>
      )}
      {isDatePickerOpen ? (
        <FinancialDatePicker
          onClose={() => setIsDatePickerOpen(false)}
          onSelect={(nextDate) => {
            data.selectCustomDate(damascusDateKey(nextDate));
            setIsDatePickerOpen(false);
          }}
          value={new Date(`${data.customDate}T12:00:00Z`)}
          visible
        />
      ) : null}
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
    <Page title="إعدادات الحساب" subtitle="إدارة ملفك وحماية حسابك">
      <Animated.View
        entering={FadeInDown.delay(70).duration(190)}
        style={styles.settingsProfileCard}
      >
        <View style={styles.settingsProfileTop}>
          <View style={styles.settingsAvatar}>
            <Text style={styles.settingsAvatarText}>
              {(auth.profile?.full_name || "ك").trim().charAt(0)}
            </Text>
          </View>
          <View style={styles.settingsProfileCopy}>
            <Text numberOfLines={1} style={styles.settingsProfileName}>
              {auth.profile?.full_name || "كابتن دليفري"}
            </Text>
            <Text numberOfLines={1} style={styles.settingsProfileEmail}>
              {auth.profile?.email || "البريد الإلكتروني غير متاح"}
            </Text>
          </View>
          <View
            style={[
              styles.settingsStatus,
              auth.profile?.is_active
                ? styles.settingsStatusActive
                : styles.settingsStatusInactive,
            ]}
          >
            <View
              style={[
                styles.settingsStatusDot,
                auth.profile?.is_active
                  ? styles.settingsStatusDotActive
                  : styles.settingsStatusDotInactive,
              ]}
            />
            <Text
              style={
                auth.profile?.is_active
                  ? styles.settingsStatusTextActive
                  : styles.settingsStatusTextInactive
              }
            >
              {auth.profile?.is_active ? "فعال" : "غير فعال"}
            </Text>
          </View>
        </View>
        <View style={styles.settingsMetaRow}>
          <View style={styles.settingsMetaItem}>
            <MaterialIcons name="two-wheeler" size={17} color="#5C8299" />
            <View style={styles.settingsMetaCopy}>
              <Text style={styles.settingsMetaLabel}>نوع الحساب</Text>
              <Text style={styles.settingsMetaValue}>كابتن</Text>
            </View>
          </View>
          <View style={styles.settingsMetaDivider} />
          <View style={styles.settingsMetaItem}>
            <MaterialIcons name="calendar-today" size={15} color="#5C8299" />
            <View style={styles.settingsMetaCopy}>
              <Text style={styles.settingsMetaLabel}>تاريخ الانضمام</Text>
              <Text numberOfLines={1} style={styles.settingsMetaValue}>
                {date(auth.profile?.created_at ?? null)}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(110).duration(190)} style={styles.settingsSection}>
        <View style={styles.settingsSectionHeading}>
          <View style={styles.settingsSectionIcon}>
            <MaterialIcons name="edit" size={19} color={BLUE} />
          </View>
          <View style={styles.settingsSectionCopy}>
            <Text style={styles.settingsSectionTitle}>الاسم الظاهر</Text>
            <Text style={styles.settingsSectionSubtitle}>
              الاسم الذي يظهر للإدارة والطلبات
            </Text>
          </View>
        </View>
        <Text style={styles.settingsFieldLabel}>الاسم الكامل</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="اكتب الاسم الكامل"
          placeholderTextColor="#809AA9"
          style={[styles.input, styles.settingsInput]}
          textAlign="right"
        />
        <Button
          label="حفظ الاسم"
          onPress={() => void saveName()}
          disabled={saving}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(190)} style={styles.settingsSection}>
        <View style={styles.settingsSectionHeading}>
          <View style={styles.settingsSectionIcon}>
            <MaterialIcons name="lock-outline" size={19} color={BLUE} />
          </View>
          <View style={styles.settingsSectionCopy}>
            <Text style={styles.settingsSectionTitle}>أمان الحساب</Text>
            <Text style={styles.settingsSectionSubtitle}>
              استخدم كلمة مرور من 12 محرفًا على الأقل
            </Text>
          </View>
        </View>
        <Text style={styles.settingsFieldLabel}>كلمة المرور الجديدة</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={[styles.input, styles.settingsInput]}
          placeholder="أدخل كلمة المرور الجديدة"
          placeholderTextColor="#809AA9"
          textAlign="right"
        />
        <Text style={styles.settingsFieldLabel}>تأكيد كلمة المرور</Text>
        <TextInput
          value={confirmation}
          onChangeText={setConfirmation}
          secureTextEntry
          style={[styles.input, styles.settingsInput]}
          placeholder="أعد إدخال كلمة المرور"
          placeholderTextColor="#809AA9"
          textAlign="right"
        />
        <Button
          label="تحديث كلمة المرور"
          onPress={() => void savePassword()}
          disabled={saving}
        />
      </Animated.View>

      {message ? <Message text={message} /> : null}

      <Animated.View
        entering={FadeInDown.delay(190).duration(190)}
        style={styles.logoutCard}
      >
        <View style={styles.logoutHeading}>
          <View style={styles.logoutIcon}>
            <MaterialIcons name="logout" size={19} color="#B42318" />
          </View>
          <View style={styles.settingsSectionCopy}>
            <Text style={styles.logoutTitle}>إنهاء الجلسة</Text>
            <Text style={styles.logoutSubtitle}>
              سيتم تسجيل خروجك من هذا الجهاز فقط.
            </Text>
          </View>
        </View>
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
      </Animated.View>
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
  ordersPageSummary: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "#CDEBF6",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  ordersPageTitle: {
    color: DEEP_BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
  },
  ordersPageHint: {
    color: "#708A9A",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    marginTop: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  ordersPageCount: {
    backgroundColor: "#E8F9FF",
    borderColor: "#BCEBFA",
    borderRadius: 10,
    borderWidth: 1,
    color: BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    writingDirection: "rtl",
  },
  ordersPagination: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderColor: "#CDEBF6",
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    padding: 5,
  },
  ordersPaginationButton: {
    alignItems: "center",
    backgroundColor: "#F4FBFE",
    borderColor: "#D1ECF6",
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 2,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 86,
    paddingHorizontal: 8,
  },
  ordersPaginationButtonDisabled: { opacity: 0.42 },
  ordersPaginationButtonText: {
    color: DEEP_BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    writingDirection: "rtl",
  },
  ordersPaginationLabel: {
    color: "#527287",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    textAlign: "center",
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
  deliveryProgressLine: {
    alignItems: "center",
    backgroundColor: "#F1FAFE",
    borderColor: "#D6EEF8",
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 5,
    marginTop: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  deliveryProgressText: {
    color: "#08719A",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    writingDirection: "rtl",
  },
  deliveryJourney: {
    backgroundColor: "#F4FBF8",
    borderColor: "#D9EFE6",
    borderRadius: 11,
    borderWidth: 1,
    marginTop: 4,
    padding: 8,
  },
  deliveryJourneyTop: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  deliveryJourneyLabel: { color: "#4F7281", fontFamily: "Cairo_700Bold", fontSize: 9, writingDirection: "rtl" },
  deliveryDurationBadge: { alignItems: "center", backgroundColor: "#E3F7EE", borderRadius: 8, flexDirection: "row-reverse", gap: 3, paddingHorizontal: 6, paddingVertical: 3 },
  deliveryDurationText: { color: "#08755C", fontFamily: "Cairo_700Bold", fontSize: 9, writingDirection: "rtl" },
  deliveryJourneyTrack: { alignItems: "center", flexDirection: "row-reverse", marginTop: 7 },
  deliveryJourneyMoment: { alignItems: "flex-start", flex: 1 },
  deliveryJourneyMomentLabel: { color: "#7895A4", fontFamily: "Cairo_400Regular", fontSize: 8, writingDirection: "rtl" },
  deliveryJourneyMomentTime: { color: "#285B73", fontFamily: "Cairo_700Bold", fontSize: 10, marginTop: 1, writingDirection: "rtl" },
  deliveryJourneyConnector: { alignItems: "center", flexDirection: "row", width: 38 },
  deliveryJourneyLine: { backgroundColor: "#A8D8C6", flex: 1, height: 1 },
  line: {
    color: "#54778D",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  periods: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
  },
  period: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D1E7F1",
    borderRadius: 13,
    borderWidth: 1,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: "22%",
    paddingHorizontal: 10,
    shadowColor: "#0B5379",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  periodActive: {
    backgroundColor: "#E7F8FF",
    borderColor: NEON,
    shadowColor: NEON,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
  },
  periodText: {
    color: "#55778C",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    writingDirection: "rtl",
  },
  periodTextActive: { color: DEEP_BLUE },
  customDateControl: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderColor: "#BCEBFA",
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row-reverse",
    minHeight: 62,
    paddingHorizontal: 11,
  },
  customDateIcon: {
    alignItems: "center",
    backgroundColor: "#EAF9FF",
    borderColor: "#BCEBFA",
    borderRadius: 12,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  customDateCopy: { flex: 1, marginHorizontal: 9 },
  customDateKicker: {
    color: "#7290A1",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    textAlign: "right",
    writingDirection: "rtl",
  },
  customDateValue: {
    color: DEEP_BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
    marginTop: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
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
  settingsProfileCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderColor: "#BCEBFA",
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 14,
    shadowColor: "#0A668A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
  },
  settingsProfileTop: {
    alignItems: "center",
    flexDirection: "row-reverse",
  },
  settingsAvatar: {
    alignItems: "center",
    backgroundColor: DEEP_BLUE,
    borderColor: NEON,
    borderRadius: 18,
    borderWidth: 1,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  settingsAvatarText: {
    color: "#FFFFFF",
    fontFamily: "Cairo_700Bold",
    fontSize: 23,
    lineHeight: 31,
    writingDirection: "rtl",
  },
  settingsProfileCopy: { flex: 1, marginHorizontal: 10 },
  settingsProfileName: {
    color: DEEP_BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    textAlign: "right",
    writingDirection: "rtl",
  },
  settingsProfileEmail: {
    color: "#668496",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    marginTop: 2,
    textAlign: "right",
  },
  settingsStatus: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row-reverse",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  settingsStatusActive: { backgroundColor: "#EAFBF5" },
  settingsStatusInactive: { backgroundColor: "#F2F5F7" },
  settingsStatusDot: { borderRadius: 4, height: 7, width: 7 },
  settingsStatusDotActive: { backgroundColor: "#16A36A" },
  settingsStatusDotInactive: { backgroundColor: "#8398A5" },
  settingsStatusTextActive: {
    color: "#0F7A51",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    writingDirection: "rtl",
  },
  settingsStatusTextInactive: {
    color: "#647B89",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    writingDirection: "rtl",
  },
  settingsMetaRow: {
    backgroundColor: "#F7FCFE",
    borderColor: "#E0F1F7",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row-reverse",
    minHeight: 62,
    paddingHorizontal: 10,
  },
  settingsMetaItem: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row-reverse",
  },
  settingsMetaCopy: { flex: 1, marginRight: 7 },
  settingsMetaDivider: { backgroundColor: "#DCEEF4", marginVertical: 11, width: 1 },
  settingsMetaLabel: {
    color: "#7A94A4",
    fontFamily: "Cairo_400Regular",
    fontSize: 8,
    textAlign: "right",
    writingDirection: "rtl",
  },
  settingsMetaValue: {
    color: "#28566F",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  settingsSection: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderColor: "#D1ECF6",
    borderRadius: 18,
    borderWidth: 1,
    gap: 9,
    padding: 14,
  },
  settingsSectionHeading: {
    alignItems: "center",
    flexDirection: "row-reverse",
    marginBottom: 2,
  },
  settingsSectionIcon: {
    alignItems: "center",
    backgroundColor: "#EAF9FF",
    borderColor: "#BCEBFA",
    borderRadius: 12,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  settingsSectionCopy: { flex: 1, marginRight: 9 },
  settingsSectionTitle: {
    color: DEEP_BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
  },
  settingsSectionSubtitle: {
    color: "#748F9F",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    marginTop: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  settingsFieldLabel: {
    color: "#527287",
    fontFamily: "Cairo_600SemiBold",
    fontSize: 10,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  settingsInput: { backgroundColor: "#FBFEFF" },
  logoutCard: {
    backgroundColor: "#FFF8F8",
    borderColor: "#F4D4D4",
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  logoutHeading: { alignItems: "center", flexDirection: "row-reverse" },
  logoutIcon: {
    alignItems: "center",
    backgroundColor: "#FDECEC",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  logoutTitle: {
    color: "#9D241C",
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
  },
  logoutSubtitle: {
    color: "#9C6560",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    marginTop: 1,
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
