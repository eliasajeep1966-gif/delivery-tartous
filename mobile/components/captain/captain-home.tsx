import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import {
  Alert,
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

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { MotionPressable } from "@/components/ui/motion-pressable";
import { useAppSound } from "@/contexts/app-sound-context";
import { useAppToast } from "@/contexts/app-toast-context";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import {
  type CaptainOrderWithTiming,
  useNativeCaptainDashboard,
} from "@/features/captain/use-native-captain-dashboard";
import type { CaptainOrderStatus } from "@/lib/supabase/native-captain-contract";
import { presentDeliveryTiming } from "@/lib/admin/delivery-duration";

const DEEP_BLUE = "#063B78";
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
  cancelled: { background: "#F3F4F6", border: "#D1D5DB", color: "#4B5563" },
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
  const { profile, signOut } = useDeliveryAuth();
  const { showToast } = useAppToast();
  const { playSound } = useAppSound();
  const dashboard = useNativeCaptainDashboard();
  const [falseOrderOpen, setFalseOrderOpen] = useState(false);
  const name = profile?.full_name?.trim() || profile?.email || "الكابتن";
  const current = dashboard.currentOrder;
  const action = current ? nextAction(current.status) : null;
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
            onPress={() =>
              Alert.alert("تسجيل الخروج", "هل تريد تسجيل الخروج من حسابك؟", [
                { text: "إلغاء", style: "cancel" },
                {
                  text: "تسجيل الخروج",
                  style: "destructive",
                  onPress: () => void signOut(),
                },
              ])
            }
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
            <Animated.View entering={FadeInDown.delay(70).duration(210)}>
              <LinearGradient
                colors={["rgba(4,51,101,0.95)", "rgba(7,107,177,0.86)", "rgba(15,174,217,0.74)"]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.currentCard}
              >
                <BlurView
                  intensity={18}
                  pointerEvents="none"
                  style={StyleSheet.absoluteFill}
                  tint="light"
                />
                <View style={styles.currentHeader}>
                <View style={styles.currentHeaderIcon}>
                  <MaterialIcons name="two-wheeler" size={22} color="#FFFFFF" />
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
                    <OrderTimeline status={current.status} />
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
                    {current.status === "received" ||
                    current.status === "in_delivery" ? (
                      <MotionPressable
                        disabled={dashboard.orderSaving}
                        pressedScale={0.97}
                        onPress={() => setFalseOrderOpen(true)}
                        style={styles.dangerButton}
                      >
                        <Text style={styles.dangerText}>تسجيل طلب كاذب</Text>
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
    </ScreenContainer>
  );
}

function OrderTimeline({ status }: { status: CaptainOrderStatus }) {
  const currentIndex = orderSteps.findIndex((step) => step.status === status);
  const stepColors = ["#3B82F6", "#0EA5E9", "#8B5CF6", "#16A34A"];

  return (
    <View style={styles.timeline}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>خطوات الطلب</Text>
        <Text style={styles.timelineHint}>تتحدث بعد كل تأكيد</Text>
      </View>
      <View style={styles.timelineSteps}>
        {orderSteps.map((step, index) => {
          const done = currentIndex >= index;
          const current = currentIndex === index;
          const color = stepColors[index];
          return (
            <View key={step.status} style={styles.timelineStep}>
              <View
                style={[
                  styles.timelineDot,
                  { borderColor: color },
                  done && { backgroundColor: color },
                ]}
              >
                {done ? <MaterialIcons name="check" size={13} color="#FFFFFF" /> : null}
              </View>
              <Text
                style={[
                  styles.timelineText,
                  done && { color, fontFamily: "Cairo_700Bold" },
                  current && styles.timelineTextCurrent,
                ]}
              >
                {step.label}
              </Text>

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
      <Text style={styles.detail}>
        الاسم: {stop?.contact_name || "غير متاح"}
      </Text>
      {stop?.contact_phone ? (
        <MotionPressable onPress={() => onCall(stop.contact_phone)}>
          <Text style={styles.phone}>{stop.contact_phone}</Text>
        </MotionPressable>
      ) : null}
      <Text style={styles.detail}>العنوان: {stop?.address || fallback}</Text>
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
    borderColor: "rgba(220,248,255,0.74)",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#075B91",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  currentHeader: {
    alignItems: "center",
    borderBottomColor: "rgba(215,248,255,0.34)",
    borderBottomWidth: 1,
    flexDirection: "row-reverse",
    gap: 9,
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  currentHeaderIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 14,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  currentHeaderCopy: { flex: 1 },
  currentTitle: {
    color: "#FFFFFF",
    fontFamily: "Cairo_700Bold",
    fontSize: 15,
    textAlign: "right",
    writingDirection: "rtl",
  },
  currentSubtitle: {
    color: "rgba(232,249,255,0.84)",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    textAlign: "right",
    writingDirection: "rtl",
  },
  cardBody: { backgroundColor: "rgba(245,253,255,0.2)", gap: 11, padding: 13 },
  stopsGrid: { flexDirection: "row-reverse", gap: 8 },
  timeline: {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderColor: "rgba(202,239,250,0.82)",
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  timelineHint: {
    color: "#7892A3",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    writingDirection: "rtl",
  },
  timelineSteps: { gap: 7, marginTop: 1 },
  timelineStep: {
    alignItems: "center",
    backgroundColor: "rgba(246,252,254,0.88)",
    borderColor: "#DCECF4",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 8,
    minHeight: 31,
    paddingHorizontal: 8,
  },
  timelineDot: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#C8DCE7",
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  timelineDotDone: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  timelineText: {
    color: "#7892A3",
    flex: 1,
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  timelineTextCurrent: {
    color: BLUE,
  },
  stopCard: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderColor: "rgba(202,239,250,0.9)",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minHeight: 145,
    padding: 10,
  },
  stopTitle: {
    color: "#285C79",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    writingDirection: "rtl",
  },
  detail: {
    color: "#54778D",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    marginTop: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  phone: {
    color: "#1478BF",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    marginTop: 4,
    textAlign: "left",
  },
  note: {
    backgroundColor: "#FFFBEB",
    borderRadius: 7,
    color: "#92400E",
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
    color: "#587386",
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
    borderRadius: 12,
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    writingDirection: "rtl",
  },
  statusBadgeTextProminent: { fontSize: 12 },
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
  orderCopy: { flex: 1, gap: 4 },
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
