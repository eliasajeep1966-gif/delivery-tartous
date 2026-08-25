import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useAppSound } from "@/contexts/app-sound-context";
import { useAppToast } from "@/contexts/app-toast-context";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import { useNativeCaptainDashboard } from "@/features/captain/use-native-captain-dashboard";
import type { CaptainOrderStatus } from "@/lib/supabase/native-captain-contract";

const BLUE = "#0060B8";
const statusLabels: Record<CaptainOrderStatus, string> = {
  pending: "قيد الانتظار",
  assigned: "تم إسناد الطلب",
  received: "تم الاستلام",
  in_delivery: "قيد التوصيل",
  completed: "مكتمل",
  cancelled: "ملغى",
  false_order: "طلب كاذب",
  reversed: "معكوس",
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
      playSound("captainOrderSuccess");
      showToast({ message: `أصبحت حالة الطلب: ${statusLabels[action.next]}` });
    }
  };
  const markFalse = async () => {
    if (current && (await dashboard.transitionOrder(current.id, "false_order")))
      setFalseOrderOpen(false);
  };

  return (
    <ScreenContainer className="bg-[#edf8fd]" containerClassName="bg-[#edf8fd]">
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
        <View style={styles.topBar}>
          <Pressable
            onPress={() =>
              Alert.alert("المساعدة", "تواصل مع الإدارة عند الحاجة.")
            }
            style={styles.iconButton}
          >
            <MaterialIcons name="info-outline" size={20} color={BLUE} />
          </Pressable>
          <View style={styles.brand}>
            <Text style={styles.brandTitle}>دليفري طرطوس</Text>
            <Text style={styles.brandSubtitle}>حساب الكابتن</Text>
          </View>
          <Pressable
            onPress={() => router.push("/(tabs)/settings")}
            style={styles.iconButton}
          >
            <MaterialIcons name="settings" size={20} color={BLUE} />
          </Pressable>
        </View>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>مرحباً، {name}</Text>
            <Text style={styles.subtitle}>
              تابع طلبك الحالي وحالة التوفر من مكان واحد.
            </Text>
          </View>
          <Pressable onPress={() => void signOut()} style={styles.iconButton}>
            <MaterialIcons name="logout" size={19} color={BLUE} />
          </Pressable>
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
            <View style={styles.availabilityCard}>
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
                onValueChange={(value) =>
                  void dashboard.updateAvailability(
                    value ? "available" : "unavailable",
                  )
                }
                trackColor={{ false: "#D8E7EE", true: BLUE }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={styles.currentCard}>
              <View style={styles.currentHeader}>
                <MaterialIcons name="two-wheeler" size={22} color="#FFFFFF" />
                <View>
                  <Text style={styles.currentTitle}>الطلب الحالي</Text>
                  <Text style={styles.currentSubtitle}>
                    {current
                      ? `الطلب #${current.order_number} · ${statusLabels[current.status]}`
                      : "لا يوجد طلب نشط الآن"}
                  </Text>
                </View>
              </View>
              {current ? (
                <View style={styles.cardBody}>
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
                  <OrderTimeline status={current.status} />
                  {dashboard.actionError ? (
                    <Text style={styles.errorText}>
                      {dashboard.actionError}
                    </Text>
                  ) : null}
                  {action ? (
                    <Pressable
                      disabled={dashboard.orderSaving}
                      onPress={() => void advance()}
                      style={styles.primaryButton}
                    >
                      <Text style={styles.primaryText}>
                        {dashboard.orderSaving
                          ? "جارٍ التحديث..."
                          : action.label}
                      </Text>
                    </Pressable>
                  ) : null}
                  {current.status === "received" ||
                  current.status === "in_delivery" ? (
                    <Pressable
                      disabled={dashboard.orderSaving}
                      onPress={() => setFalseOrderOpen(true)}
                      style={styles.dangerButton}
                    >
                      <Text style={styles.dangerText}>تسجيل طلب كاذب</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.emptyText}>
                  ستظهر تفاصيل الطلب هنا عند إسناده إليك.
                </Text>
              )}
            </View>
            <View>
              <Text style={styles.sectionTitle}>ملخص اليوم</Text>
              <View style={styles.metrics}>
                <Metric
                  icon="check-circle-outline"
                  value={String(dashboard.metrics?.completed_count ?? 0)}
                  label="طلبات مكتملة"
                />
                <Metric
                  icon="account-balance-wallet"
                  value={money(dashboard.metrics?.completed_gross ?? 0)}
                  label="قيمة مكتملة"
                />
              </View>
            </View>
            <View>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>آخر الطلبات</Text>
                <Text style={styles.link}>{dashboard.orders.length} طلبات</Text>
              </View>
              {dashboard.recentOrders.slice(0, 4).map((order) => (
                <View key={order.id} style={styles.orderRow}>
                  <View>
                    <Text style={styles.orderNumber}>
                      #{order.order_number}
                    </Text>
                    <Text style={styles.orderName}>{order.customer_name}</Text>
                    <Text style={styles.orderDate}>
                      {date(order.updated_at)}
                    </Text>
                  </View>
                  <View style={styles.orderMeta}>
                    <Text style={styles.badge}>
                      {statusLabels[order.status]}
                    </Text>
                    <Text style={styles.fee}>{money(order.fee)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
      <Modal
        transparent
        visible={falseOrderOpen}
        animationType="fade"
        onRequestClose={() => setFalseOrderOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
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
              <Pressable
                onPress={() => setFalseOrderOpen(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>إلغاء</Text>
              </Pressable>
              <Pressable
                disabled={dashboard.orderSaving}
                onPress={() => void markFalse()}
                style={styles.dangerButton}
              >
                <Text style={styles.dangerText}>
                  {dashboard.orderSaving
                    ? "جارٍ الحفظ..."
                    : "تأكيد الطلب الكاذب"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function OrderTimeline({ status }: { status: CaptainOrderStatus }) {
  const currentIndex = orderSteps.findIndex((step) => step.status === status);

  return (
    <View style={styles.timeline}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>خطوات الطلب</Text>
        <Text style={styles.timelineHint}>تتحدث بعد كل تأكيد</Text>
      </View>
      {orderSteps.map((step, index) => {
        const done = currentIndex >= index;
        const current = currentIndex === index;
        return (
          <View key={step.status} style={styles.timelineRow}>
            <View style={[styles.timelineDot, done && styles.timelineDotDone]}>
              {done ? (
                <MaterialIcons name="check" size={13} color="#FFFFFF" />
              ) : null}
            </View>
            {index < orderSteps.length - 1 ? (
              <View
                style={[
                  styles.timelineLine,
                  currentIndex > index && styles.timelineLineDone,
                ]}
              />
            ) : null}
            <Text
              style={[
                styles.timelineText,
                done && styles.timelineTextDone,
                current && styles.timelineTextCurrent,
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
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
        <Pressable onPress={() => onCall(stop.contact_phone)}>
          <Text style={styles.phone}>{stop.contact_phone}</Text>
        </Pressable>
      ) : null}
      <Text style={styles.detail}>العنوان: {stop?.address || fallback}</Text>
      {stop?.note ? <Text style={styles.note}>{stop.note}</Text> : null}
    </View>
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
        <Pressable onPress={retry}>
          <Text style={styles.link}>إعادة المحاولة</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomColor: "#D8EDF7",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: -12,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  content: { padding: 12, paddingBottom: 32, gap: 14 },
  header: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
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
    backgroundColor: "#E8F6FF",
    borderRadius: 12,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  availabilityCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#DCECF4",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    padding: 13,
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
    backgroundColor: "#FFFFFF",
    borderColor: "#B9DDF1",
    borderRadius: 17,
    borderWidth: 1,
    overflow: "hidden",
  },
  currentHeader: {
    alignItems: "center",
    backgroundColor: BLUE,
    flexDirection: "row-reverse",
    gap: 9,
    padding: 13,
  },
  currentTitle: {
    color: "#FFFFFF",
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    textAlign: "right",
    writingDirection: "rtl",
  },
  currentSubtitle: {
    color: "#D9EEFF",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    textAlign: "right",
    writingDirection: "rtl",
  },
  cardBody: { gap: 9, padding: 12 },
  timeline: {
    backgroundColor: "#F8FCFE",
    borderColor: "#DCECF4",
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
  timelineRow: {
    alignItems: "center",
    flexDirection: "row-reverse",
    minHeight: 25,
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
  timelineLine: {
    backgroundColor: "#D8E7EE",
    height: 2,
    marginHorizontal: 5,
    width: 18,
  },
  timelineLineDone: {
    backgroundColor: BLUE,
  },
  timelineText: {
    color: "#8AA0AD",
    flex: 1,
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  timelineTextDone: {
    color: "#0874BD",
    fontFamily: "Cairo_700Bold",
  },
  timelineTextCurrent: {
    color: BLUE,
  },
  stopCard: {
    backgroundColor: "#F8FCFE",
    borderColor: "#DCECF4",
    borderRadius: 12,
    borderWidth: 1,
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
    borderRadius: 12,
    minHeight: 44,
    justifyContent: "center",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    flex: 1,
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
  orderRow: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 13,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 7,
    padding: 11,
  },
  orderNumber: {
    color: "#154F79",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    textAlign: "right",
  },
  orderName: {
    color: "#38586F",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  orderDate: {
    color: "#7892A3",
    fontFamily: "Cairo_400Regular",
    fontSize: 9,
    marginTop: 3,
    textAlign: "right",
    writingDirection: "rtl",
  },
  orderMeta: { alignItems: "flex-end" },
  badge: {
    backgroundColor: "#E8F6FF",
    borderRadius: 5,
    color: BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 3,
    writingDirection: "rtl",
  },
  fee: {
    color: "#075D9F",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    marginTop: 5,
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
    borderRadius: 18,
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
