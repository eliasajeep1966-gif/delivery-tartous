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
} from "react-native";

import { LogoutConfirmationDialog } from "@/components/auth/logout-confirmation-dialog";
import { ScreenContainer } from "@/components/screen-container";
import { FinancialDatePicker } from "@/components/ui/financial-date-picker";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { KeyboardSafeScrollView } from "@/components/ui/keyboard-safe-scroll-view";
import { MotionPressable } from "@/components/ui/motion-pressable";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import { useScreenLiveUpdates } from "@/hooks/use-screen-live-updates";
import {
  CAPTAIN_ORDERS_PAGE_SIZE,
  useNativeCaptainOrders,
  type CaptainOrderWithTiming,
} from "@/features/captain/use-native-captain-dashboard";
import {
  CAPTAIN_WAGES_PAGE_SIZE,
  type CaptainWageFilter,
  useNativeCaptainWages,
} from "@/features/captain/use-native-captain-wages";
import {
  nativeCaptainContract,
  type CaptainCustody,
  type CaptainOrderStatus,
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

const orderStatusLabels: Record<CaptainOrderStatus, string> = {
  pending: "قيد الانتظار",
  assigned: "تم الإسناد",
  received: "تم الاستلام",
  in_delivery: "قيد التوصيل",
  completed: "تم التوصيل",
  cancelled: "ملغى",
  false_order: "طلب كاذب",
  reversed: "معكوس",
};

const orderStatusTone: Record<CaptainOrderStatus, { background: string; border: string; color: string }> = {
  pending: { background: "#FEF3C7", border: "#FCD34D", color: "#92400E" },
  assigned: { background: "#DBEAFE", border: "#93C5FD", color: "#1D4ED8" },
  received: { background: "#E0F2FE", border: "#7DD3FC", color: "#0369A1" },
  in_delivery: { background: "#EDE9FE", border: "#C4B5FD", color: "#6D28D9" },
  completed: { background: "#DCFCE7", border: "#86EFAC", color: "#15803D" },
  cancelled: { background: "#FEE2E2", border: "#FCA5A5", color: "#B91C1C" },
  false_order: { background: "#FEE2E2", border: "#FCA5A5", color: "#B91C1C" },
  reversed: { background: "#FCE7F3", border: "#F9A8D4", color: "#BE185D" },
};

function orderDayLabel(dateKey: string) {
  const today = damascusDateKey(new Date());
  if (dateKey === today) return "اليوم";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === damascusDateKey(yesterday)) return "أمس";
  return new Intl.DateTimeFormat("ar-SY", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Damascus",
    weekday: "long",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

function groupOrdersByDate(orders: readonly CaptainOrderWithTiming[]) {
  const groups = new Map<string, CaptainOrderWithTiming[]>();
  for (const order of orders) {
    const key = damascusDateKey(new Date(order.completed_at ?? order.updated_at));
    groups.set(key, [...(groups.get(key) ?? []), order]);
  }
  return [...groups].map(([dateKey, items]) => ({
    dateKey,
    items,
    label: orderDayLabel(dateKey),
  }));
}

function wagePeriodTitle(
  filter: CaptainWageFilter,
  periodStart: string,
) {
  if (filter === "weekly") return "أجور الدورة الأسبوعية";
  if (filter === "monthly") {
    const month = new Intl.DateTimeFormat("ar-SY", {
      month: "long",
      timeZone: "Asia/Damascus",
      year: "numeric",
    }).format(new Date(`${periodStart}T12:00:00Z`));
    return `أجور شهر ${month}`;
  }
  if (filter === "custom") return "أجور التاريخ المختار";
  return "أجور اليوم";
}

function wagePeriodRange(periodStart: string, periodEnd: string) {
  if (periodStart === periodEnd) return customWageDateLabel(periodStart);
  return `${customWageDateLabel(periodStart)} — ${customWageDateLabel(periodEnd)}`;
}

export function CaptainOrders() {
  const isLiveUpdatesActive = useScreenLiveUpdates();
  const data = useNativeCaptainOrders(isLiveUpdatesActive);
  const firstOrderNumber = data.total
    ? data.page * CAPTAIN_ORDERS_PAGE_SIZE + 1
    : 0;
  const lastOrderNumber = Math.min(
    (data.page + 1) * CAPTAIN_ORDERS_PAGE_SIZE,
    data.total,
  );
  const groupedOrders = useMemo(() => groupOrdersByDate(data.orders), [data.orders]);

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
        <LoadingCards />
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

          {groupedOrders.map((group, groupIndex) => (
            <View key={group.dateKey} style={styles.orderDateGroup}>
              <View style={styles.orderDateGroupHeader}>
                <View>
                  <Text style={styles.orderDateGroupTitle}>{group.label}</Text>
                  <Text style={styles.orderDateGroupHint}>طلبات هذا اليوم</Text>
                </View>
                <Text style={styles.orderDateGroupCount}>{group.items.length} طلب</Text>
              </View>
              {group.items.map((order, index) => (
                <CaptainOrderCard
                  key={order.id}
                  order={order}
                  index={groupIndex * CAPTAIN_ORDERS_PAGE_SIZE + index}
                />
              ))}
            </View>
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

function CaptainOrderCard({
  order,
  index,
}: {
  order: CaptainOrderWithTiming;
  index: number;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(55 + index * 20).duration(170)}
      style={[styles.card, styles.orderCard]}
    >
      <View style={styles.between}>
        <View style={styles.orderPrimaryCopy}>
          <Text style={styles.wageOrderNumber}>الطلب #{order.order_number}</Text>
          <Text style={styles.wageRowDate}>
            {date(order.completed_at ?? order.updated_at)}
          </Text>
        </View>
        <View style={[styles.left, styles.orderStatusSummary]}>
          <CaptainOrderStatusBadge status={order.status} />
          <Text style={styles.wageRowAmount}>{money(order.fee)}</Text>
          <Text style={styles.wageRowHint}>قيمة الطلب</Text>
        </View>
      </View>

      <View style={styles.wageRouteGrid}>
        <View style={styles.wageRouteCard}>
          <View style={styles.wageRouteHead}>
            <MaterialIcons name="inventory-2" size={15} color="#0878D1" />
            <Text style={styles.wageRouteLabel}>المصدر</Text>
          </View>
          <Text numberOfLines={2} style={styles.wageRouteContactName}>
            {order.pickup_contact_name ?? "نقطة الاستلام"}
          </Text>
          {order.pickup_contact_phone ? (
            <MotionPressable
              accessibilityLabel={`الاتصال بمصدر الطلب ${order.pickup_contact_name ?? "نقطة الاستلام"}`}
              onPress={() =>
                void Linking.openURL(`tel:${order.pickup_contact_phone}`)
              }
              style={styles.wageRoutePhoneButton}
            >
              <MaterialIcons name="phone-in-talk" size={15} color="#0878D1" />
              <Text style={styles.wageRouteCallText}>اتصال</Text>
              <MaterialIcons name="call-made" size={14} color="#0878D1" />
              <Text style={styles.wageRoutePhone}>
                {order.pickup_contact_phone}
              </Text>
            </MotionPressable>
          ) : null}
          <Text numberOfLines={3} style={styles.wageRouteAddress}>
            {order.pickup_address}
          </Text>
        </View>
        <View style={styles.wageRouteCard}>
          <View style={styles.wageRouteHead}>
            <MaterialIcons name="location-on" size={15} color="#D35B38" />
            <Text style={styles.wageRouteLabel}>الوجهة</Text>
          </View>
          <Text numberOfLines={2} style={styles.wageRouteContactName}>
            {order.customer_name}
          </Text>
          <MotionPressable
            accessibilityLabel={`الاتصال بـ ${order.customer_name}`}
            onPress={() => void Linking.openURL(`tel:${order.customer_phone}`)}
            style={styles.wageRoutePhoneButton}
          >
            <MaterialIcons name="phone-in-talk" size={15} color="#0878D1" />
            <Text style={styles.wageRouteCallText}>اتصال</Text>
            <MaterialIcons name="call-made" size={14} color="#0878D1" />
            <Text style={styles.wageRoutePhone}>{order.customer_phone}</Text>
          </MotionPressable>
          <Text numberOfLines={3} style={styles.wageRouteAddress}>
            {order.delivery_address}
          </Text>
        </View>
      </View>

      <View style={styles.orderCardFooter}>
        <OrderDeliveryTiming status={order.status} timing={order.deliveryTiming} />
      </View>
    </Animated.View>
  );
}

function CaptainOrderStatusBadge({ status }: { status: CaptainOrderStatus }) {
  const tone = orderStatusTone[status];
  return (
    <View style={[styles.orderStatusBadge, { backgroundColor: tone.background, borderColor: tone.border }]}>
      <Text style={[styles.orderStatusBadgeText, { color: tone.color }]}>
        {orderStatusLabels[status]}
      </Text>
    </View>
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

  const text = presentation.mode === "completed"
    ? presentation.label
    : presentation.mode === "received"
      ? `استلام ${presentation.receivedTime}`
      : `قيد التوصيل · ${presentation.label}`;
  const icon = presentation.mode === "completed"
    ? "timer"
    : presentation.mode === "received"
      ? "inventory-2"
      : "two-wheeler";

  return (
    <View style={styles.orderTimingPill}>
      <MaterialIcons name={icon} size={13} color="#0878D1" />
      <Text style={styles.orderTimingText}>{text}</Text>
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
      subtitle={wagePeriodTitle(data.filter, data.periodStart)}
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
        <LoadingCards includeMetrics />
      ) : (
        <>
          <View style={styles.wageHero}>
            <View>
              <Text style={styles.wageHeroKicker}>
                {wagePeriodTitle(data.filter, data.periodStart)}
              </Text>
              <Text style={styles.wageHeroValue}>{money(data.totals.captain)}</Text>
              <Text style={styles.wageHeroHint}>
                {wagePeriodRange(data.periodStart, data.periodEnd)} · {data.total} طلب
              </Text>
            </View>
            <View style={styles.wageHeroIcon}>
              <MaterialIcons name="account-balance-wallet" size={25} color="#0878D1" />
            </View>
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
                      <Text style={styles.wageOrderNumber}>الطلب #{row.order_number}</Text>
                      <Text style={styles.wageRowDate}>{date(row.completed_at)}</Text>
                    </View>
                    <View style={styles.left}>
                      <Text style={styles.wageRowAmount}>{money(row.captain_amount)}</Text>
                      <Text style={styles.wageRowHint}>أجرك من هذا الطلب</Text>
                    </View>
                  </View>
                  <View style={styles.wageRouteGrid}>
                    <View style={styles.wageRouteCard}>
                      <View style={styles.wageRouteHead}>
                        <MaterialIcons name="inventory-2" size={15} color="#0878D1" />
                        <Text style={styles.wageRouteLabel}>المصدر</Text>
                      </View>
                      <Text style={styles.wageRouteContactName}>
                        {row.pickup_contact_name}
                      </Text>
                      <Text style={styles.wageRouteAddress}>
                        {row.pickup_address}
                      </Text>
                    </View>
                    <View style={styles.wageRouteCard}>
                      <View style={styles.wageRouteHead}>
                        <MaterialIcons name="location-on" size={15} color="#D35B38" />
                        <Text style={styles.wageRouteLabel}>الوجهة</Text>
                      </View>
                      <Text style={styles.wageRouteContactName}>
                        {row.delivery_contact_name}
                      </Text>
                      <Text style={styles.wageRouteAddress}>
                        {row.delivery_address}
                      </Text>
                    </View>
                  </View>
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
      ) : loading ? (
        <LoadingCards />
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
              <Text style={row.returned_at ? styles.custodyReturned : styles.custodyHeld}>
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
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false);
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
    <Page title="إعدادات الحساب" subtitle="إدارة ملفك وحماية حسابك" keyboardAware>
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
            <Text numberOfLines={2} style={styles.settingsProfileName}>
              {auth.profile?.full_name || "كابتن دليفري"}
            </Text>
            <Text numberOfLines={2} style={styles.settingsProfileEmail}>
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
          onPress={() => setLogoutConfirmationOpen(true)}
          danger
        />
      </Animated.View>
      <LogoutConfirmationDialog
        visible={logoutConfirmationOpen}
        isSigningOut={auth.operation === "signing-out"}
        onClose={() => setLogoutConfirmationOpen(false)}
        onConfirm={() => void auth.signOut()}
      />
    </Page>
  );
}

function Page({
  title,
  subtitle,
  children,
  refreshing = false,
  onRefresh,
  keyboardAware = false,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboardAware?: boolean;
}) {
  const PageScrollView = keyboardAware ? KeyboardSafeScrollView : ScrollView;
  return (
    <ScreenContainer
      className="bg-transparent"
      containerClassName="bg-transparent"
    >
      <DeliveryAppHeader />
      <PageScrollView
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
      </PageScrollView>
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
function LoadingCards({ includeMetrics = false }: { includeMetrics?: boolean }) {
  return (
    <View style={styles.loadingCards} accessibilityLabel="جارٍ تحميل البيانات">
      {includeMetrics ? (
        <View style={styles.loadingMetrics}>
          {["metric-one", "metric-two", "metric-three", "metric-four"].map((key) => (
            <View key={key} style={[styles.loadingBlock, styles.loadingMetric]} />
          ))}
        </View>
      ) : null}
      {["row-one", "row-two", "row-three"].map((key) => (
        <View key={key} style={[styles.loadingBlock, styles.loadingCard]}>
          <View style={styles.loadingLineShort} />
          <View style={styles.loadingLineLong} />
          <View style={styles.loadingLineMedium} />
        </View>
      ))}
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
  orderDateGroup: { gap: 8, marginTop: 4 },
  orderDateGroupHeader: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 5,
    paddingHorizontal: 3,
  },
  orderDateGroupTitle: {
    color: "#174F74",
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    textAlign: "right",
    writingDirection: "rtl",
  },
  orderDateGroupHint: {
    color: "#718C9E",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    textAlign: "right",
    writingDirection: "rtl",
  },
  orderDateGroupCount: {
    backgroundColor: "#E8F8FF",
    borderColor: "#BCEBFA",
    borderRadius: 9,
    borderWidth: 1,
    color: "#0878D1",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
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
  orderPrimaryCopy: { flex: 1, paddingLeft: 8 },
  left: { alignItems: "flex-end" },
  orderCard: {
    backgroundColor: "#FFFFFF",
    gap: 12,
    padding: 14,
    shadowOpacity: 0.025,
  },
  orderStatusSummary: { gap: 4 },
  orderCardFooter: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  orderTimingPill: {
    alignItems: "center",
    backgroundColor: "#F1F9FD",
    borderRadius: 8,
    flexDirection: "row-reverse",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  orderTimingText: {
    color: "#08719A",
    fontFamily: "Cairo_700Bold",
    fontSize: 8,
    writingDirection: "rtl",
  },
  orderStatusBadge: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 29,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  orderStatusBadgeText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    writingDirection: "rtl",
  },
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
  wageHero: {
    alignItems: "center",
    backgroundColor: "#EAF9FF",
    borderColor: "#BCEBFA",
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    minHeight: 104,
    padding: 15,
  },
  wageHeroKicker: {
    color: "#5A7C91",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  wageHeroValue: {
    color: "#075D9F",
    fontFamily: "Cairo_700Bold",
    fontSize: 22,
    marginTop: 3,
    textAlign: "right",
    writingDirection: "rtl",
  },
  wageHeroHint: {
    color: "#63869A",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  wageHeroIcon: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#CDEBF6",
    borderRadius: 16,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  wageOrderNumber: {
    color: "#174F74",
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
  wageRowDate: {
    color: "#63869A",
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  wageRowAmount: {
    color: "#075D9F",
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    textAlign: "left",
    writingDirection: "rtl",
  },
  wageRowHint: {
    color: "#63869A",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    marginTop: 2,
    textAlign: "left",
    writingDirection: "rtl",
  },
  wageRouteGrid: { flexDirection: "row-reverse", gap: 8 },
  wageRouteCard: {
    backgroundColor: "#F6FBFE",
    borderColor: "#D7EAF3",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    padding: 9,
  },
  wageRouteHead: { alignItems: "center", flexDirection: "row-reverse", gap: 4 },
  wageRouteLabel: {
    color: "#4C738B",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    writingDirection: "rtl",
  },
  wageRouteContactName: {
    color: "#194B6E",
    fontFamily: "Cairo_700Bold",
    flexShrink: 1,
    fontSize: 13,
    marginTop: 7,
    textAlign: "right",
    writingDirection: "rtl",
  },
  wageRoutePhoneButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: "#E6F7FF",
    borderColor: "#B7E7F8",
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 3,
    marginTop: 5,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  wageRouteCallText: {
    color: "#0878D1",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    writingDirection: "rtl",
  },
  wageRoutePhone: {
    color: "#075D9F",
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    writingDirection: "ltr",
  },
  wageRouteAddress: {
    color: "#668597",
    fontFamily: "Cairo_400Regular",
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  custodyReturned: {
    color: "#047857",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  custodyHeld: {
    color: "#B45309",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  loadingCards: { gap: 10 },
  loadingMetrics: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  loadingBlock: { backgroundColor: "#EAF3F7", overflow: "hidden" },
  loadingMetric: { borderRadius: 15, height: 84, width: "48.5%" },
  loadingCard: { borderRadius: 17, gap: 10, minHeight: 118, padding: 14 },
  loadingLineShort: { backgroundColor: "#D5E5EC", borderRadius: 6, height: 10, width: "30%" },
  loadingLineMedium: { backgroundColor: "#D5E5EC", borderRadius: 6, height: 10, width: "56%" },
  loadingLineLong: { alignSelf: "flex-end", backgroundColor: "#D5E5EC", borderRadius: 7, height: 14, width: "72%" },
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
    fontSize: 16,
    textAlign: "right",
    writingDirection: "rtl",
  },
  settingsProfileEmail: {
    color: "#668496",
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
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
    fontSize: 10,
    writingDirection: "rtl",
  },
  settingsStatusTextInactive: {
    color: "#647B89",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
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
    fontSize: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  settingsMetaValue: {
    color: "#28566F",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
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
    fontSize: 15,
    textAlign: "right",
    writingDirection: "rtl",
  },
  settingsSectionSubtitle: {
    color: "#748F9F",
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    marginTop: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  settingsFieldLabel: {
    color: "#527287",
    fontFamily: "Cairo_600SemiBold",
    fontSize: 12,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  settingsInput: {
    backgroundColor: "#FBFEFF",
    fontSize: 14,
    lineHeight: 22,
  },
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
    fontSize: 15,
    textAlign: "right",
    writingDirection: "rtl",
  },
  logoutSubtitle: {
    color: "#9C6560",
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
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
  buttonText: { color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 12 },
  buttonDanger: { backgroundColor: "#FEE2E2" },
  buttonDangerText: { color: "#B91C1C" },
  disabled: { opacity: 0.55 },
});
