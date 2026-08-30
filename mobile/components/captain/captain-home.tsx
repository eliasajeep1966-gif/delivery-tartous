import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import {
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { LogoutConfirmationDialog } from "@/components/auth/logout-confirmation-dialog";
import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { MotionPressable } from "@/components/ui/motion-pressable";
import { useAppSound } from "@/contexts/app-sound-context";
import { useAppToast } from "@/contexts/app-toast-context";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import { useScreenLiveUpdates } from "@/hooks/use-screen-live-updates";
import {
  type CaptainOrderWithTiming,
  useNativeCaptainDashboard,
} from "@/features/captain/use-native-captain-dashboard";
import type {
  CaptainActiveOrder,
  CaptainOrderStatus,
  CaptainOrderStatusEvent,
} from "@/lib/supabase/native-captain-contract";
import { presentDeliveryTiming } from "@/lib/admin/delivery-duration";
import { subscribeToCaptainOrderAssignment } from "@/lib/notifications";

const BLUE = "#0878D1";
const NEON = "#16CEFF";
const statusLabels: Record<CaptainOrderStatus, string> = {
  pending: "قيد الانتظار",
  assigned: "تم إسناد الطلب",
  received: "تم الاستلام",
  in_delivery: "قيد التوصيل",
  completed: "تم التوصيل",
  cancelled: "ملغى",
  false_order: "طلب كاذب",
  reversed: "معكوس",
};

const statusTone: Record<
  CaptainOrderStatus,
  { background: string; border: string; color: string }
> = {
  pending: { background: "#FEF3C7", border: "#FCD34D", color: "#92400E" },
  assigned: { background: "#DBEAFE", border: "#93C5FD", color: "#1D4ED8" },
  received: { background: "#E0F2FE", border: "#7DD3FC", color: "#0369A1" },
  in_delivery: { background: "#EDE9FE", border: "#C4B5FD", color: "#6D28D9" },
  completed: { background: "#DCFCE7", border: "#86EFAC", color: "#15803D" },
  cancelled: { background: "#FEE2E2", border: "#FCA5A5", color: "#B91C1C" },
  false_order: { background: "#FEE2E2", border: "#FCA5A5", color: "#B91C1C" },
  reversed: { background: "#FCE7F3", border: "#F9A8D4", color: "#BE185D" },
};

function money(value: number) {
  return `${new Intl.NumberFormat("en-US").format(value)} ل.س`;
}
function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("ar-SY", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "غير متاح";
}

function time(value: string) {
  return new Intl.DateTimeFormat("ar-SY", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Damascus",
  }).format(new Date(value));
}

const orderSteps: { status: CaptainOrderStatus; label: string }[] = [
  { status: "assigned", label: "تم إسناد الطلب" },
  { status: "received", label: "تم استلام الطلب" },
  { status: "in_delivery", label: "قيد التوصيل" },
  { status: "completed", label: "تم التسليم" },
];

function nextAction(status: CaptainOrderStatus) {
  if (status === "assigned")
    return { label: "تأكيد استلام الطلب", next: "received" as const };
  if (status === "received")
    return { label: "بدء التوصيل", next: "in_delivery" as const };
  if (status === "in_delivery")
    return { label: "تأكيد التسليم", next: "completed" as const };
  return null;
}

export function CaptainHome() {
  const router = useRouter();
  const { profile, signOut, operation } = useDeliveryAuth();
  const { showToast } = useAppToast();
  const { playSound } = useAppSound();
  const isLiveUpdatesActive = useScreenLiveUpdates();
  const dashboard = useNativeCaptainDashboard(isLiveUpdatesActive);
  const announceNewOrder = dashboard.announceNewOrder;
  const [falseOrderId, setFalseOrderId] = useState<string | null>(null);
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false);
  const name = profile?.full_name?.trim() || profile?.email || "الكابتن";
  const activeOrders = dashboard.activeOrders;
  const currentCardColors = ["#063B78", "#0872CC", "#0CBDF2"] as const;
  const newestQueuedOrderId =
    dashboard.newOrderQueue[dashboard.newOrderQueue.length - 1] ?? null;
  const presentedNewOrderId = dashboard.newOrderQueue[0] ?? null;
  const presentedNewOrder = activeOrders.find(
    (order) => order.id === presentedNewOrderId,
  );
  const falseOrder = activeOrders.find((order) => order.id === falseOrderId) ?? null;

  const available = dashboard.metrics?.availability === "available";

  const call = (phone: string) => {
    void Linking.openURL(`tel:${phone}`);
  };
  const advanceOrder = async (order: { id: string; status: CaptainOrderStatus }) => {
    const next = nextAction(order.status);
    if (next && (await dashboard.transitionOrder(order.id, next.next))) {
      if (next.next === "received" || next.next === "completed") {
        playSound("captainOrderSuccess");
      }
      showToast({ message: `أصبحت حالة الطلب: ${statusLabels[next.next]}` });
    }
  };
  const markFalse = async () => {
    if (
      falseOrder &&
      (await dashboard.transitionOrder(falseOrder.id, "false_order"))
    )
      setFalseOrderId(null);
  };

  useEffect(() => {
    return subscribeToCaptainOrderAssignment((assignment) => {
      if (assignment.orderId) announceNewOrder(assignment.orderId);
    });
  }, [announceNewOrder]);

  useEffect(() => {
    if (!newestQueuedOrderId) return;
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    playSound("newOrder");
    showToast({ message: "لديك طلب جديد. راجع تفاصيله الآن." });
  }, [newestQueuedOrderId, playSound, showToast]);

  return (
    <ScreenContainer
      className="bg-transparent"
      containerClassName="bg-transparent"
    >
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "الإعدادات",
          icon: "settings",
          onPress: () => router.push("/(tabs)/settings"),
        }}
        trailingAction={{
          accessibilityLabel: "المساعدة",
          icon: "info-outline",
          onPress: () => router.push("/(admin)/support"),
        }}
      />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={dashboard.refreshing}
            onRefresh={() => void dashboard.reload(true)}
            tintColor={BLUE}
          />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>مرحباً، {name}</Text>
            <Text style={styles.subtitle}>
              تابع طلبك الحالي وحالة التوفر من مكان واحد.
            </Text>
          </View>
          <MotionPressable
            accessibilityLabel="تسجيل الخروج"
            onPress={() => setLogoutConfirmationOpen(true)}
            style={styles.iconButton}
          >
            <MaterialIcons name="logout" size={19} color={BLUE} />
          </MotionPressable>
        </View>
        {dashboard.loading ? (
          <StateCard text="جارٍ تحميل حسابك..." />
        ) : dashboard.error ? (
          <StateCard
            text={dashboard.error}
            retry={() => void dashboard.reload()}
          />
        ) : (
          <>
            <Animated.View
              entering={FadeInDown.delay(30).duration(190)}
              style={styles.availabilityCard}
            >
              <View>
                <View style={styles.row}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: available ? "#10B981" : "#94A3B8" },
                    ]}
                  />
                  <Text style={styles.sectionTitle}>حالة التوفر</Text>
                </View>
                <Text style={styles.availabilityText}>
                  {available ? "متاح لاستقبال الطلبات" : "غير متاح حالياً"}
                </Text>
              </View>
              <Switch
                value={available}
                disabled={dashboard.availabilitySaving}
                onValueChange={(value) => {
                  if (Platform.OS !== "web") {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }
                  void dashboard.updateAvailability(
                    value ? "available" : "unavailable",
                  );
                }}
                trackColor={{ false: "#D8E7EE", true: BLUE }}
                thumbColor="#FFFFFF"
              />
            </Animated.View>
            <View style={styles.activeOrdersSection}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>الطلبات النشطة</Text>
                <Text style={styles.link}>{activeOrders.length} طلبات</Text>
              </View>
              {activeOrders.length ? (
                activeOrders.map((order, index) => (
                  <ActiveOrderCard
                    key={order.id}
                    order={order}
                    events={dashboard.activeStatusEvents[order.id] ?? []}
                    isSaving={dashboard.isOrderSaving(order.id)}
                    isNew={order.id === presentedNewOrderId}
                    cardColors={currentCardColors}
                    onAdvance={() => void advanceOrder(order)}
                    onCall={call}
                    onMarkFalse={() => setFalseOrderId(order.id)}
                    enteringDelay={70 + index * 40}
                  />
                ))
              ) : (
                <EmptyActiveOrders />
              )}
            </View>
            <Animated.View entering={FadeInDown.delay(110).duration(210)}>
              <Text style={styles.sectionTitle}>ملخص اليوم</Text>
              <View style={styles.metrics}>
                <Metric
                  icon="check-circle-outline"
                  value={String(dashboard.metrics?.completed_count ?? 0)}
                  label="طلبات مكتملة"
                />
                <Metric
                  icon="account-balance-wallet"
                  value={
                    dashboard.todayCaptainWage === null
                      ? "—"
                      : money(dashboard.todayCaptainWage)
                  }
                  label="أجوري اليوم"
                />
              </View>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(150).duration(210)}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>آخر الطلبات</Text>
                <Text style={styles.link}>{dashboard.orderCount} طلبات</Text>
              </View>
              {dashboard.recentOrders.map((order, index) => (
                <RecentOrderRow key={order.id} order={order} index={index} />
              ))}
            </Animated.View>
          </>
        )}
      </ScrollView>
      <Modal
        transparent
        visible={Boolean(presentedNewOrderId)}
        animationType="none"
        onRequestClose={() => {
          if (presentedNewOrderId) dashboard.dismissNewOrder(presentedNewOrderId);
        }}
      >
        <View style={styles.newOrderBackdrop}>
          <ScrollView
            contentContainerStyle={styles.newOrderOverlayContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              entering={FadeInDown.duration(250)}
              exiting={FadeOut.duration(140)}
              style={styles.newOrderOverlay}
            >
              <View style={styles.newOrderOverlayHeader}>
                <View style={styles.newOrderOverlayIcon}>
                  <MaterialIcons name="notifications-active" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.currentHeaderCopy}>
                  <Text style={styles.newOrderOverlayTitle}>طلب جديد</Text>
                  <Text style={styles.newOrderOverlayHint}>
                    {dashboard.newOrderQueue.length > 1
                      ? `تبقّى ${dashboard.newOrderQueue.length - 1} طلبات جديدة بعد هذا الطلب`
                      : "تم إسناد طلب جديد إليك"}
                  </Text>
                </View>
              </View>
              {presentedNewOrder ? (
                <ActiveOrderCard
                  order={presentedNewOrder}
                  events={dashboard.activeStatusEvents[presentedNewOrder.id] ?? []}
                  isSaving={dashboard.isOrderSaving(presentedNewOrder.id)}
                  isNew
                  cardColors={currentCardColors}
                  onAdvance={() => void advanceOrder(presentedNewOrder)}
                  onCall={call}
                  onMarkFalse={() => setFalseOrderId(presentedNewOrder.id)}
                  enteringDelay={0}
                />
              ) : (
                <StateCard text="جارٍ تجهيز تفاصيل الطلب الجديد..." />
              )}
              <MotionPressable
                haptic="light"
                onPress={() => {
                  if (presentedNewOrderId)
                    dashboard.dismissNewOrder(presentedNewOrderId);
                }}
                style={styles.reviewLaterButton}
              >
                <Text style={styles.reviewLaterText}>متابعة الطلبات</Text>
              </MotionPressable>
            </Animated.View>
          </ScrollView>
        </View>
      </Modal>
      <Modal
        transparent
        visible={Boolean(falseOrderId)}
        animationType="none"
        onRequestClose={() => setFalseOrderId(null)}
      >
        <View style={styles.modalBackdrop}>
          <Animated.View
            entering={FadeInDown.duration(210)}
            exiting={FadeOut.duration(120)}
            style={styles.modal}
          >
            <MaterialIcons name="warning" size={32} color="#C62828" />
            <Text style={styles.modalTitle}>تسجيل الطلب كطلب كاذب</Text>
            {falseOrder ? (
              <Text style={styles.modalOrderHint}>الطلب #{falseOrder.order_number}</Text>
            ) : null}
            {dashboard.actionError ? (
              <Text style={styles.modalError}>{dashboard.actionError}</Text>
            ) : null}
            <Text style={styles.modalBody}>
              هل أنت متأكد من تسجيل هذا الطلب كطلب كاذب؟ سيتم إيقاف مسار
              التوصيل، ولا يمكن التراجع عن العملية.
            </Text>
            <View style={styles.modalActions}>
              <MotionPressable
                onPress={() => setFalseOrderId(null)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>إلغاء</Text>
              </MotionPressable>
              <MotionPressable
                disabled={!falseOrder || dashboard.isOrderSaving(falseOrder.id)}
                onPress={() => void markFalse()}
                style={styles.dangerButton}
              >
                <Text style={styles.dangerText}>
                  {falseOrder && dashboard.isOrderSaving(falseOrder.id)
                    ? "جارٍ الحفظ..."
                    : "تأكيد الطلب الكاذب"}
                </Text>
              </MotionPressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
      <LogoutConfirmationDialog
        visible={logoutConfirmationOpen}
        isSigningOut={operation === "signing-out"}
        onClose={() => setLogoutConfirmationOpen(false)}
        onConfirm={() => void signOut()}
      />
    </ScreenContainer>
  );
}

function ActiveOrderCard({
  order,
  events,
  isSaving,
  isNew,
  cardColors,
  onAdvance,
  onCall,
  onMarkFalse,
  enteringDelay,
}: {
  order: CaptainActiveOrder;
  events: readonly CaptainOrderStatusEvent[];
  isSaving: boolean;
  isNew: boolean;
  cardColors: readonly [string, string, string];
  onAdvance: () => void;
  onCall: (phone: string) => void;
  onMarkFalse: () => void;
  enteringDelay: number;
}) {
  const action = nextAction(order.status);
  const pickup = order.stops.find((stop) => stop.stop_type === "pickup");
  const delivery = [...order.stops]
    .reverse()
    .find((stop) => stop.stop_type === "delivery");

  return (
    <Animated.View
      entering={FadeInDown.delay(enteringDelay).duration(210)}
      style={[styles.currentCardShell, isNew && styles.currentCardNew]}
    >
      <LinearGradient
        colors={cardColors}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.currentCard}
      >
        <View style={styles.currentHeader}>
          <View style={styles.currentHeaderIcon}>
            <MaterialIcons name="two-wheeler" size={25} color="#0C679D" />
          </View>
          <View style={styles.currentHeaderCopy}>
            <View style={styles.orderTitleRow}>
              <Text style={styles.currentTitle}>
                {isNew ? "طلب جديد" : "طلب نشط"}
              </Text>
              {isNew ? (
                <View style={styles.newOrderBadge}>
                  <Text style={styles.newOrderBadgeText}>جديد</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.currentSubtitle}>الطلب #{order.order_number}</Text>
          </View>
          <StatusBadge status={order.status} prominent />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.stopsGrid}>
            <StopCard
              title="المصدر"
              icon="inventory-2"
              stop={pickup}
              fallback={order.pickup_address}
              onCall={onCall}
            />
            <StopCard
              title="الوجهة"
              icon="location-on"
              stop={delivery}
              fallback={order.delivery_address}
              onCall={onCall}
            />
          </View>
          <Animated.View
            key={order.status}
            entering={FadeInDown.duration(170)}
            style={{ gap: 10 }}
          >
            <OrderTimeline status={order.status} events={events} />
            {action ? (
              <MotionPressable
                disabled={isSaving}
                haptic="medium"
                pressedScale={0.96}
                onPress={onAdvance}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryText}>
                  {isSaving ? "جارٍ التحديث..." : action.label}
                </Text>
              </MotionPressable>
            ) : null}
            {order.status === "in_delivery" ? (
              <MotionPressable
                accessibilityLabel={`تسجيل الطلب #${order.order_number} كطلب كاذب`}
                disabled={isSaving}
                haptic="medium"
                pressedScale={0.97}
                onPress={onMarkFalse}
                style={styles.falseOrderButton}
              >
                <View style={styles.falseOrderIcon}>
                  <MaterialIcons name="warning-amber" size={22} color="#FFFFFF" />
                </View>
                <View style={styles.falseOrderCopy}>
                  <Text style={styles.falseOrderTitle}>تسجيل طلب كاذب</Text>
                  <Text style={styles.falseOrderHint}>أوقف الطلب عند تعذّر تسليمه</Text>
                </View>
                <MaterialIcons name="chevron-left" size={26} color="#FEE2E2" />
              </MotionPressable>
            ) : null}
          </Animated.View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

function EmptyActiveOrders() {
  return (
    <View style={styles.emptyOrdersCard}>
      <MaterialIcons name="delivery-dining" size={31} color="#8FB2C7" />
      <Text style={styles.emptyOrdersTitle}>لا توجد طلبات نشطة الآن</Text>
      <Text style={styles.emptyOrdersHint}>
        ستظهر كل الطلبات المسندة إليك هنا بشكل مستقل.
      </Text>
    </View>
  );
}

function OrderTimeline({
  status,
  events,
}: {
  status: CaptainOrderStatus;
  events: readonly CaptainOrderStatusEvent[];
}) {
  const currentIndex = orderSteps.findIndex((step) => step.status === status);
  const stepColors = ["#7BEAFF", "#9BD7FF", "#C4B5FD", "#8CE7C4"];
  const eventTimes = new Map<CaptainOrderStatus, string>();
  for (const event of events) {
    if (event.next_status in statusLabels) {
      eventTimes.set(event.next_status as CaptainOrderStatus, event.changed_at);
    }
  }

  return (
    <View style={styles.timeline}>
      <View style={styles.sectionHeading}>
        <Text style={styles.currentTimelineTitle}>خطوات الطلب</Text>
        <Text style={styles.timelineHint}>تتحدث بعد كل تأكيد</Text>
      </View>
      <View style={styles.timelineSteps}>
        {orderSteps.map((step, index) => {
          const done = currentIndex >= index;
          const current = currentIndex === index;
          const color = stepColors[index];
          const changedAt = eventTimes.get(step.status);
          return (
            <View key={step.status} style={styles.timelineRow}>
              <View style={styles.timelineMarker}>
                <View
                  style={[
                    styles.timelineDot,
                    { borderColor: done ? color : "rgba(255,255,255,0.45)" },
                    done && { backgroundColor: color },
                  ]}
                >
                  {done ? <MaterialIcons name="check" size={13} color="#073E6B" /> : null}
                </View>
                {index < orderSteps.length - 1 ? (
                  <View
                    style={[
                      styles.timelineLine,
                      currentIndex > index && { backgroundColor: color },
                    ]}
                  />
                ) : null}
              </View>
              <View style={styles.timelineCopy}>
                <View style={styles.timelineLabelRow}>
                  <Text
                    style={[
                      styles.timelineText,
                      done && styles.timelineTextDone,
                      current && styles.timelineTextCurrent,
                    ]}
                  >
                    {step.label}
                  </Text>
                  {done ? (
                    <Text style={styles.timelineTime}>
                      {changedAt ? `تم في ${time(changedAt)}` : "تم الآن"}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function StopCard({
  title,
  icon,
  stop,
  fallback,
  onCall,
}: {
  title: string;
  icon: "inventory-2" | "location-on";
  stop?: {
    contact_name: string;
    contact_phone: string;
    address: string;
    note: string | null;
  };
  fallback: string;
  onCall: (phone: string) => void;
}) {
  return (
    <View style={styles.stopCard}>
      <View style={styles.row}>
        <MaterialIcons name={icon} size={16} color={BLUE} />
        <Text style={styles.stopTitle}>{title}</Text>
      </View>
      <Text style={styles.stopContactName}>
        {stop?.contact_name || "غير متاح"}
      </Text>
      {stop?.contact_phone ? (
        <MotionPressable
          accessibilityLabel={`الاتصال بـ ${stop.contact_name || title}`}
          haptic="light"
          onPress={() => onCall(stop.contact_phone)}
          style={styles.stopCallButton}
        >
          <MaterialIcons name="phone-in-talk" size={15} color="#0878D1" />
          <Text style={styles.stopCallText}>اتصال</Text>
          <MaterialIcons name="call-made" size={14} color="#0878D1" />
          <Text style={styles.stopPhone}>{stop.contact_phone}</Text>
        </MotionPressable>
      ) : null}
      <Text style={styles.stopAddress}>العنوان: {stop?.address || fallback}</Text>
      {stop?.note ? <Text style={styles.note}>{stop.note}</Text> : null}
    </View>
  );
}
function StatusBadge({
  status,
  prominent = false,
}: {
  status: CaptainOrderStatus;
  prominent?: boolean;
}) {
  const tone = statusTone[status];
  return (
    <View
      style={[
        styles.statusBadge,
        prominent && styles.statusBadgeProminent,
        { backgroundColor: tone.background, borderColor: tone.border },
      ]}
    >
      <Text
        style={[
          styles.statusBadgeText,
          prominent && styles.statusBadgeTextProminent,
          { color: tone.color },
        ]}
      >
        {statusLabels[status]}
      </Text>
    </View>
  );
}

function RecentOrderRow({
  order,
  index,
}: {
  order: CaptainOrderWithTiming;
  index: number;
}) {
  const timing = order.deliveryTiming
    ? presentDeliveryTiming(order.deliveryTiming)
    : null;
  const timingText = timing
    ? timing.mode === "completed"
      ? `مدة التوصيل: ${timing.label}`
      : timing.mode === "received"
        ? `تم الاستلام ${timing.receivedTime}`
        : `قيد التوصيل · ${timing.label}`
    : "لا توجد مدة مسجلة";

  return (
    <Animated.View
      entering={FadeInDown.delay(180 + index * 35).duration(190)}
      style={styles.orderRow}
    >
      <View style={styles.orderCopy}>
        <View style={styles.orderTitleRow}>
          <Text style={styles.orderNumber}>الطلب #{order.order_number}</Text>
          <Text style={styles.fee}>{money(order.fee)}</Text>
        </View>
        <Text numberOfLines={1} style={styles.orderName}>{order.customer_name}</Text>
        <View style={styles.orderTimingRow}>
          <MaterialIcons name="event" size={13} color="#64869A" />
          <Text style={styles.orderDate}>{date(order.completed_at ?? order.updated_at)}</Text>
        </View>
        <View style={styles.orderTimingRow}>
          <MaterialIcons name="timer" size={13} color="#0877B8" />
          <Text style={styles.orderDuration}>{timingText}</Text>
        </View>
      </View>
      <StatusBadge status={order.status} prominent />
    </Animated.View>
  );
}

function Metric({
  icon,
  value,
  label,
}: {
  icon: "check-circle-outline" | "account-balance-wallet";
  value: string;
  label: string;
}) {
  return (
    <View style={styles.metric}>
      <MaterialIcons name={icon} size={19} color={BLUE} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}
function StateCard({ text, retry }: { text: string; retry?: () => void }) {
  return (
    <View style={styles.state}>
      <Text style={styles.stateText}>{text}</Text>
      {retry ? (
        <MotionPressable onPress={retry}>
          <Text style={styles.link}>إعادة المحاولة</Text>
        </MotionPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderBottomColor: "rgba(22,206,255,0.58)",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: -12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  brand: { alignItems: "center", flex: 1, gap: 1 },
  brandTitle: {
    color: BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    textAlign: "center",
    writingDirection: "rtl",
  },
  brandSubtitle: {
    color: "#7892A3",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    textAlign: "center",
    writingDirection: "rtl",
  },
  content: { gap: 14, padding: 12, paddingBottom: 34 },
  header: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingTop: 2,
  },
  greeting: {
    color: "#155B8D",
    fontFamily: "Cairo_700Bold",
    fontSize: 15,
    textAlign: "right",
    writingDirection: "rtl",
  },
  subtitle: {
    color: "#6C899E",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.86)",
    borderColor: "#BCEBFA",
    borderRadius: 16,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  availabilityCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderColor: "#BCEBFA",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    padding: 14,
    shadowColor: "#0A668A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  availabilityText: {
    color: "#6D8799",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    marginTop: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  row: { alignItems: "center", flexDirection: "row-reverse", gap: 7 },
  dot: { borderRadius: 5, height: 10, width: 10 },
  sectionTitle: {
    color: "#18547E",
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
  },
  currentCard: {
    borderColor: "rgba(84,222,255,0.62)",
    elevation: 8,
    zIndex: 1,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#16CEFF",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
  },
  activeOrdersSection: { gap: 10 },
  currentCardShell: { position: "relative" },
  currentCardNew: {
    shadowColor: "#FACC15",
    shadowOpacity: 0.48,
    shadowRadius: 18,
  },
  emptyOrdersCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.93)",
    borderColor: "#BCEBFA",
    borderRadius: 20,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: 4,
    justifyContent: "center",
    minHeight: 156,
    padding: 18,
  },
  emptyOrdersTitle: {
    color: "#18547E",
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    textAlign: "center",
    writingDirection: "rtl",
  },
  emptyOrdersHint: {
    color: "#6C899E",
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    textAlign: "center",
    writingDirection: "rtl",
  },
  currentHeader: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: 13,
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  currentHeaderIcon: {
    alignItems: "center",
    backgroundColor: "#F5FDFF",
    borderColor: "rgba(137,240,255,0.8)",
    borderRadius: 17,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    shadowColor: "#043D63",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    width: 48,
  },
  currentHeaderCopy: { flex: 1 },
  newOrderBadge: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  newOrderBadgeText: {
    color: "#92400E",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    writingDirection: "rtl",
  },
  currentTitle: {
    color: "#FFFFFF",
    fontFamily: "Cairo_700Bold",
    fontSize: 18,
    textAlign: "right",
    writingDirection: "rtl",
  },
  currentSubtitle: {
    color: "rgba(235,249,255,0.86)",
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    textAlign: "right",
    writingDirection: "rtl",
  },
  cardBody: { gap: 14, padding: 14 },
  stopsGrid: { alignItems: "stretch", flexDirection: "row-reverse", gap: 8 },
  timeline: { gap: 7 },
  currentTimelineTitle: {
    color: "#FFFFFF",
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    textAlign: "right",
    writingDirection: "rtl",
  },
  timelineHint: {
    color: "rgba(235,249,255,0.78)",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    writingDirection: "rtl",
  },
  timelineSteps: { gap: 0, marginTop: 2 },
  timelineRow: { flexDirection: "row-reverse", minHeight: 43 },
  timelineMarker: { alignItems: "center", width: 24 },
  timelineDot: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  timelineLine: {
    backgroundColor: "rgba(255,255,255,0.34)",
    flex: 1,
    marginVertical: 2,
    width: 2,
  },
  timelineCopy: { flex: 1, paddingBottom: 8, paddingRight: 7 },
  timelineLabelRow: { alignItems: "center", flexDirection: "row-reverse", gap: 7 },
  timelineText: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Cairo_600SemiBold",
    fontSize: 11,
    textAlign: "right",
    writingDirection: "rtl",
  },
  timelineTextDone: { color: "#FFFFFF", fontFamily: "Cairo_700Bold" },
  timelineTextCurrent: { color: "#FFFFFF" },
  timelineTime: {
    color: "rgba(235,249,255,0.82)",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    writingDirection: "rtl",
  },
  stopCard: {
    backgroundColor: "rgba(255,255,255,0.13)",
    borderColor: "rgba(222,248,255,0.5)",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    padding: 11,
  },
  stopTitle: {
    color: "#FFFFFF",
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
    writingDirection: "rtl",
  },
  stopContactName: {
    color: "#FFFFFF",
    flexShrink: 1,
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 6,
    textAlign: "right",
    writingDirection: "rtl",
  },
  stopCallButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: "rgba(231,250,255,0.96)",
    borderColor: "rgba(157,239,255,0.92)",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 3,
    marginTop: 7,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  stopCallText: {
    color: "#0878D1",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    writingDirection: "rtl",
  },
  stopPhone: {
    color: "#075D9F",
    flexShrink: 1,
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    writingDirection: "ltr",
  },
  stopAddress: {
    color: "rgba(245,253,255,0.92)",
    flexShrink: 1,
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
    textAlign: "right",
    writingDirection: "rtl",
  },
  note: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 7,
    color: "#FFFFFF",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    marginTop: 6,
    padding: 6,
    textAlign: "right",
    writingDirection: "rtl",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: BLUE,
    borderColor: NEON,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 50,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
  },
  primaryText: {
    color: "#FFFFFF",
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
    writingDirection: "rtl",
  },
  falseOrderButton: {
    alignItems: "center",
    backgroundColor: "#BE2433",
    borderColor: "rgba(255,220,224,0.82)",
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row-reverse",
    minHeight: 72,
    paddingHorizontal: 16,
    shadowColor: "#690A15",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.26,
    shadowRadius: 9,
  },
  falseOrderIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 15,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  falseOrderCopy: { flex: 1, marginHorizontal: 12 },
  falseOrderTitle: {
    color: "#FFFFFF",
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    textAlign: "right",
    writingDirection: "rtl",
  },
  falseOrderHint: {
    color: "rgba(255,238,240,0.88)",
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    marginTop: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  dangerButton: {
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 14,
  },
  dangerText: {
    color: "#B91C1C",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    writingDirection: "rtl",
  },
  cancelButton: {
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
  },
  cancelText: { color: "#52606D", fontFamily: "Cairo_700Bold", fontSize: 11 },
  errorText: {
    color: "#B91C1C",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    textAlign: "right",
    writingDirection: "rtl",
  },
  emptyText: {
    color: "rgba(255,255,255,0.92)",
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    padding: 18,
    textAlign: "center",
    writingDirection: "rtl",
  },
  metrics: { flexDirection: "row-reverse", gap: 10, marginTop: 8 },
  metric: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "#D5EDF6",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    minHeight: 104,
    padding: 13,
  },
  metricValue: {
    color: "#175D8A",
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    marginTop: 6,
    textAlign: "right",
    writingDirection: "rtl",
  },
  metricLabel: {
    color: "#708B9D",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  link: {
    color: "#0877C2",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    writingDirection: "rtl",
  },
  statusBadge: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeProminent: {
    alignSelf: "flex-start",
    borderRadius: 12,
    flexShrink: 0,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    writingDirection: "rtl",
  },
  statusBadgeTextProminent: { fontSize: 12, lineHeight: 18 },
  orderRow: {
    alignItems: "flex-start",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderColor: "#D5EDF6",
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 10,
    justifyContent: "space-between",
    marginTop: 9,
    minHeight: 116,
    padding: 12,
  },
  orderCopy: { flex: 1, gap: 4, minWidth: 0 },
  orderTitleRow: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  orderNumber: {
    color: "#154F79",
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
  orderName: {
    color: "#38586F",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    textAlign: "right",
    writingDirection: "rtl",
  },
  orderTimingRow: { alignItems: "center", flexDirection: "row-reverse", gap: 4 },
  orderDate: {
    color: "#64869A",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    textAlign: "right",
    writingDirection: "rtl",
  },
  orderDuration: {
    color: "#0874AE",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    textAlign: "right",
    writingDirection: "rtl",
  },
  fee: {
    color: "#075D9F",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    writingDirection: "rtl",
  },
  state: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    justifyContent: "center",
    minHeight: 150,
    padding: 20,
  },
  stateText: {
    color: "#18547E",
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    textAlign: "center",
    writingDirection: "rtl",
  },
  newOrderBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(3,33,59,0.68)",
  },
  newOrderOverlayContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 16,
  },
  newOrderOverlay: {
    backgroundColor: "#F0FAFF",
    borderColor: "rgba(126,238,255,0.88)",
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    overflow: "hidden",
    padding: 12,
    shadowColor: "#001F3E",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
  },
  newOrderOverlayHeader: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: 10,
    paddingHorizontal: 4,
  },
  newOrderOverlayIcon: {
    alignItems: "center",
    backgroundColor: "#0878D1",
    borderRadius: 15,
    height: 45,
    justifyContent: "center",
    width: 45,
  },
  newOrderOverlayTitle: {
    color: "#155B8D",
    fontFamily: "Cairo_700Bold",
    fontSize: 18,
    textAlign: "right",
    writingDirection: "rtl",
  },
  newOrderOverlayHint: {
    color: "#5E7E93",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    marginTop: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  reviewLaterButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#B9DDEB",
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  reviewLaterText: {
    color: "#086FC4",
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
    writingDirection: "rtl",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    backgroundColor: "rgba(4,31,50,0.35)",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: "#FFFFFF",
    borderColor: "#BCEBFA",
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 18,
    width: "100%",
  },
  modalOrderHint: {
    color: "#8A4B00",
    fontFamily: "Cairo_700Bold",
    fontSize: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
  modalTitle: {
    color: "#991B1B",
    fontFamily: "Cairo_700Bold",
    fontSize: 16,
    textAlign: "right",
    writingDirection: "rtl",
  },
  modalActions: { flexDirection: "row-reverse", gap: 8, marginTop: 4 },
  modalError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderRadius: 8,
    borderWidth: 1,
    color: "#B91C1C",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    padding: 8,
    textAlign: "right",
    writingDirection: "rtl",
  },
  modalBody: {
    color: "#6F5555",
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    lineHeight: 21,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
