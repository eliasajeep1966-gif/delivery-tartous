import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import {
  LayoutChangeEvent,
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
  CaptainOrderStatus,
  CaptainOrderStatusEvent,
} from "@/lib/supabase/native-captain-contract";
import { presentDeliveryTiming } from "@/lib/admin/delivery-duration";

const DEEP_BLUE = "#063B78";
const BLUE = "#0878D1";
const NEON = "#16CEFF";
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

type LedPoint = { x: number; y: number; perimeter: number };

function getRoundedRectLedPoint(distance: number, width: number, height: number): LedPoint {
  "worklet";
  const inset = 1;
  const innerWidth = Math.max(width - inset * 2, 1);
  const innerHeight = Math.max(height - inset * 2, 1);
  const radius = Math.min(19, innerWidth / 2, innerHeight / 2);
  const horizontal = Math.max(innerWidth - radius * 2, 0);
  const vertical = Math.max(innerHeight - radius * 2, 0);
  const corner = (Math.PI * radius) / 2;
  const perimeter = horizontal * 2 + vertical * 2 + corner * 4;
  let travel = distance % perimeter;
  const left = inset;
  const right = inset + innerWidth;
  const top = inset;
  const bottom = inset + innerHeight;

  if (travel <= horizontal) return { x: left + radius + travel, y: top, perimeter };
  travel -= horizontal;
  if (travel <= corner) {
    const theta = -Math.PI / 2 + (travel / corner) * (Math.PI / 2);
    return { x: right - radius + radius * Math.cos(theta), y: top + radius + radius * Math.sin(theta), perimeter };
  }
  travel -= corner;
  if (travel <= vertical) return { x: right, y: top + radius + travel, perimeter };
  travel -= vertical;
  if (travel <= corner) {
    const theta = (travel / corner) * (Math.PI / 2);
    return { x: right - radius + radius * Math.cos(theta), y: bottom - radius + radius * Math.sin(theta), perimeter };
  }
  travel -= corner;
  if (travel <= horizontal) return { x: right - radius - travel, y: bottom, perimeter };
  travel -= horizontal;
  if (travel <= corner) {
    const theta = Math.PI / 2 + (travel / corner) * (Math.PI / 2);
    return { x: left + radius + radius * Math.cos(theta), y: bottom - radius + radius * Math.sin(theta), perimeter };
  }
  travel -= corner;
  if (travel <= vertical) return { x: left, y: bottom - radius - travel, perimeter };
  travel -= vertical;
  const theta = Math.PI + (travel / corner) * (Math.PI / 2);
  return { x: left + radius + radius * Math.cos(theta), y: top + radius + radius * Math.sin(theta), perimeter };
}
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
  const [falseOrderOpen, setFalseOrderOpen] = useState(false);
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false);
  const currentLedProgress = useSharedValue(0);
  const currentLedWidth = useSharedValue(0);
  const currentLedHeight = useSharedValue(0);
  const name = profile?.full_name?.trim() || profile?.email || "الكابتن";
  const current = dashboard.currentOrder;
  const showCurrentOrderLed = Boolean(current);
  const currentCardColors = ["#063B78", "#0872CC", "#0CBDF2"] as const;
  const action = current ? nextAction(current.status) : null;

  const handleCurrentCardLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    currentLedWidth.value = width;
    currentLedHeight.value = height;
  };

  useEffect(() => {
    if (!showCurrentOrderLed) {
      cancelAnimation(currentLedProgress);
      currentLedProgress.value = 0;
      return;
    }
    currentLedProgress.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(currentLedProgress);
  }, [currentLedProgress, showCurrentOrderLed]);

  const currentLedDotStyle = useAnimatedStyle(() => {
    if (!currentLedWidth.value || !currentLedHeight.value) return { opacity: 0 };
    const start = getRoundedRectLedPoint(0, currentLedWidth.value, currentLedHeight.value);
    const point = getRoundedRectLedPoint(
      currentLedProgress.value * start.perimeter,
      currentLedWidth.value,
      currentLedHeight.value,
    );
    return { opacity: 1, left: point.x - 4, top: point.y - 4 };
  });

  const currentLedGlowStyle = useAnimatedStyle(() => {
    if (!currentLedWidth.value || !currentLedHeight.value) return { opacity: 0 };
    const start = getRoundedRectLedPoint(0, currentLedWidth.value, currentLedHeight.value);
    const point = getRoundedRectLedPoint(
      currentLedProgress.value * start.perimeter,
      currentLedWidth.value,
      currentLedHeight.value,
    );
    return { opacity: 0.72, left: point.x - 10, top: point.y - 10 };
  });

  const currentLedTailStyle = useAnimatedStyle(() => {
    if (!currentLedWidth.value || !currentLedHeight.value) return { opacity: 0 };
    const start = getRoundedRectLedPoint(0, currentLedWidth.value, currentLedHeight.value);
    const currentDistance = currentLedProgress.value * start.perimeter;
    const point = getRoundedRectLedPoint(currentDistance, currentLedWidth.value, currentLedHeight.value);
    const previous = getRoundedRectLedPoint(
      (currentDistance - 26 + start.perimeter) % start.perimeter,
      currentLedWidth.value,
      currentLedHeight.value,
    );
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const length = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    return {
      opacity: 0.96,
      left: (point.x + previous.x) / 2 - length / 2,
      top: (point.y + previous.y) / 2 - 1.5,
      width: length,
      transform: [{ rotate: `${angle}deg` }],
    };
  });
  const pickup = dashboard.currentStops.find(
    (stop) => stop.stop_type === "pickup",
  );
  const delivery = [...dashboard.currentStops]
    .reverse()
    .find((stop) => stop.stop_type === "delivery");
  const available = dashboard.metrics?.availability === "available";

  const call = (phone: string) => {
    void Linking.openURL(`tel:${phone}`);
  };
  const advance = async () => {
    if (
      current &&
      action &&
      (await dashboard.transitionOrder(current.id, action.next))
    ) {
      if (action.next === "received" || action.next === "completed") {
        playSound("captainOrderSuccess");
      }
      showToast({ message: `أصبحت حالة الطلب: ${statusLabels[action.next]}` });
    }
  };
  const markFalse = async () => {
    if (current && (await dashboard.transitionOrder(current.id, "false_order")))
      setFalseOrderOpen(false);
  };

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
            <Animated.View
              entering={FadeInDown.delay(70).duration(210)}
              style={styles.currentCardShell}
            >
              {!current ? (
                <View
                  pointerEvents="none"
                  style={styles.emptyCurrentOuterGlow}
                />
              ) : null}
              <LinearGradient
                colors={currentCardColors}
                start={{ x: 1, y: 0 }}
                end={{ x: 0, y: 1 }}
                onLayout={handleCurrentCardLayout}
                style={styles.currentCard}
              >
                {!current ? (
                  <LinearGradient
                    colors={[
                      "rgba(221,253,255,0.58)",
                      "rgba(105,235,255,0.32)",
                      "rgba(9,127,205,0.08)",
                    ]}
                    end={{ x: 0.08, y: 1 }}
                    pointerEvents="none"
                    start={{ x: 0.96, y: 0 }}
                    style={styles.emptyCurrentBacklight}
                  />
                ) : null}
                {showCurrentOrderLed ? (
                  <>
                    <AnimatedLinearGradient
                      colors={["rgba(126,238,255,0)", "rgba(188,250,255,0.96)"]}
                      end={{ x: 1, y: 0.5 }}
                      pointerEvents="none"
                      start={{ x: 0, y: 0.5 }}
                      style={[styles.currentLedTail, currentLedTailStyle]}
                    />
                    <Animated.View
                      pointerEvents="none"
                      style={[styles.currentLedGlow, currentLedGlowStyle]}
                    />
                    <Animated.View
                      pointerEvents="none"
                      style={[styles.currentLedDot, currentLedDotStyle]}
                    />
                  </>
                ) : null}
                <View style={styles.currentHeader}>
                <View style={styles.currentHeaderIcon}>
                  <MaterialIcons name="two-wheeler" size={25} color="#0C679D" />
                </View>
                <View style={styles.currentHeaderCopy}>
                  <Text style={styles.currentTitle}>الطلب الحالي</Text>
                  <Text style={styles.currentSubtitle}>
                    {current ? `الطلب #${current.order_number}` : "لا يوجد طلب نشط الآن"}
                  </Text>
                </View>
                {current ? <StatusBadge status={current.status} prominent /> : null}
              </View>
              {current ? (
                <View style={styles.cardBody}>
                  <View style={styles.stopsGrid}>
                    <StopCard
                      title="المصدر"
                      icon="inventory-2"
                      stop={pickup}
                      fallback={current.pickup_address}
                      onCall={call}
                    />
                    <StopCard
                      title="الوجهة"
                      icon="location-on"
                      stop={delivery}
                      fallback={current.delivery_address}
                      onCall={call}
                    />
                  </View>
                  <Animated.View
                    key={current.status}
                    entering={FadeInDown.duration(170)}
                    style={{ gap: 10 }}
                  >
                    <OrderTimeline
                      status={current.status}
                      events={dashboard.currentStatusEvents}
                    />
                    {dashboard.actionError ? (
                      <Text style={styles.errorText}>
                        {dashboard.actionError}
                      </Text>
                    ) : null}
                    {action ? (
                      <MotionPressable
                        disabled={dashboard.orderSaving}
                        haptic="medium"
                        pressedScale={0.96}
                        onPress={() => void advance()}
                        style={styles.primaryButton}
                      >
                        <Text style={styles.primaryText}>
                          {dashboard.orderSaving
                            ? "جارٍ التحديث..."
                            : action.label}
                        </Text>
                      </MotionPressable>
                    ) : null}
                    {current.status === "in_delivery" ? (
                      <MotionPressable
                        accessibilityLabel="تسجيل الطلب كطلب كاذب"
                        disabled={dashboard.orderSaving}
                        haptic="medium"
                        pressedScale={0.97}
                        onPress={() => setFalseOrderOpen(true)}
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
              ) : (
                <Text style={styles.emptyText}>
                  ستظهر تفاصيل الطلب هنا عند إسناده إليك.
                </Text>
              )}
              </LinearGradient>
            </Animated.View>
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
        visible={falseOrderOpen}
        animationType="none"
        onRequestClose={() => setFalseOrderOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Animated.View
            entering={FadeInDown.duration(210)}
            exiting={FadeOut.duration(120)}
            style={styles.modal}
          >
            <MaterialIcons name="warning" size={32} color="#C62828" />
            <Text style={styles.modalTitle}>تسجيل الطلب كطلب كاذب</Text>
            {dashboard.actionError ? (
              <Text style={styles.modalError}>{dashboard.actionError}</Text>
            ) : null}
            <Text style={styles.modalBody}>
              هل أنت متأكد من تسجيل هذا الطلب كطلب كاذب؟ سيتم إيقاف مسار
              التوصيل، ولا يمكن التراجع عن العملية.
            </Text>
            <View style={styles.modalActions}>
              <MotionPressable
                onPress={() => setFalseOrderOpen(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>إلغاء</Text>
              </MotionPressable>
              <MotionPressable
                disabled={dashboard.orderSaving}
                onPress={() => void markFalse()}
                style={styles.dangerButton}
              >
                <Text style={styles.dangerText}>
                  {dashboard.orderSaving
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
  currentCardShell: { position: "relative" },
  emptyCurrentOuterGlow: {
    backgroundColor: "rgba(22,206,255,0.24)",
    borderRadius: 25,
    bottom: 4,
    left: 7,
    position: "absolute",
    right: 7,
    shadowColor: "#16CEFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.72,
    shadowRadius: 20,
    top: 9,
  },
  emptyCurrentBacklight: {
    bottom: 0,
    left: 0,
    opacity: 0.96,
    position: "absolute",
    right: 0,
    top: 0,
  },
  currentLedTail: { borderRadius: 3, height: 3, position: "absolute" },
  currentLedGlow: { backgroundColor: "rgba(70,224,255,0.45)", borderRadius: 10, height: 20, position: "absolute", shadowColor: "#A5F4FF", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 10, width: 20 },
  currentLedDot: { backgroundColor: "#F2FEFF", borderColor: "#8AF1FF", borderRadius: 4, borderWidth: 1, height: 8, position: "absolute", shadowColor: "#E7FDFF", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 7, width: 8 },
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
