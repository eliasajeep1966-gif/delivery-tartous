import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { type Href, useRouter } from "expo-router";
import { type ComponentProps, useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  AdminNewOrderModal,
  type NativeNewOrderDraft,
} from "@/components/admin/admin-new-order-modal";
import { ScreenContainer } from "@/components/screen-container";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import {
  type AdminHomeActivity,
  type AdminHomeMetric,
  type AdminOrderStatus,
  useAdminHome,
} from "@/features/admin/use-admin-home";
import {
  createNativeIdempotencyKey,
  NativeAdminRequestTimeoutError,
  nativeAdminContract,
} from "@/lib/supabase/native-admin-contract";
import { notifyCaptainOfOrder } from "@/lib/notifications";
import { useRealtimeOrders } from "@/lib/supabase/useRealtimeOrders";

type IconName = ComponentProps<typeof MaterialIcons>["name"];

const statusStyle: Record<
  AdminOrderStatus,
  { label: string; color: string; background: string; strip: string }
> = {
  pending: {
    label: "قيد الانتظار",
    color: "#0060B8",
    background: "#EFF6FF",
    strip: "#0060B8",
  },
  assigned: {
    label: "تم تعيين كابتن",
    color: "#4338CA",
    background: "#EEF2FF",
    strip: "#6366F1",
  },
  received: {
    label: "تم الاستلام",
    color: "#6D28D9",
    background: "#F5F3FF",
    strip: "#8B5CF6",
  },
  in_delivery: {
    label: "قيد التوصيل",
    color: "#0E7490",
    background: "#ECFEFF",
    strip: "#06B6D4",
  },
  completed: {
    label: "مكتمل",
    color: "#047857",
    background: "#ECFDF5",
    strip: "#10B981",
  },
  cancelled: {
    label: "ملغى",
    color: "#B91C1C",
    background: "#FEF2F2",
    strip: "#EF4444",
  },
  false_order: {
    label: "طلب كاذب",
    color: "#B45309",
    background: "#FFFBEB",
    strip: "#F59E0B",
  },
};

export function AdminHome() {
  const router = useRouter();
  const { profile } = useDeliveryAuth();
  const isBackOffice =
    profile?.role === "admin" || profile?.role === "supervisor";
  const home = useAdminHome(isBackOffice);
  const { data: snapshot, refetch } = home;
  const [createOpen, setCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const realtimeRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeRefreshTimer.current !== null) return;
    realtimeRefreshTimer.current = setTimeout(() => {
      realtimeRefreshTimer.current = null;
      void refetch();
    }, 250);
  }, [refetch]);

  useRealtimeOrders({
    enabled: isBackOffice,
    onOrder: scheduleRealtimeRefresh,
    onCaptain: scheduleRealtimeRefresh,
    onProfile: scheduleRealtimeRefresh,
    onActivity: scheduleRealtimeRefresh,
  });

  useEffect(() => {
    if (!isBackOffice) return;
    const fallbackTimer = setInterval(() => {
      if (AppState.currentState === "active") void refetch();
    }, 60_000);
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") scheduleRealtimeRefresh();
    });
    return () => {
      clearInterval(fallbackTimer);
      appStateSubscription.remove();
      if (realtimeRefreshTimer.current !== null) {
        clearTimeout(realtimeRefreshTimer.current);
        realtimeRefreshTimer.current = null;
      }
    };
  }, [isBackOffice, refetch, scheduleRealtimeRefresh]);

  if (!isBackOffice) {
    return (
      <ScreenContainer className="p-5">
        <View style={styles.roleNotice}>
          <Text style={styles.roleNoticeTitle}>لا تملك صلاحية لوحة العمل</Text>
          <Text style={styles.roleNoticeText}>
            هذه الواجهة مخصصة للأدمن والمشرف فقط.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const announce = (title: string, message: string) =>
    Alert.alert(title, message);
  const openOrders = () => router.push("/(tabs)/orders" as Href);
  const submitOrder = async (draft: NativeNewOrderDraft): Promise<boolean> => {
    setIsCreating(true);
    setCreateError(null);
    try {
      const created = await nativeAdminContract.actions.createOrderWithStops({
        stops: draft.stops,
        fee: draft.fee,
        idempotencyKey: createNativeIdempotencyKey(),
      });
      try {
        const assigned = await nativeAdminContract.actions.assignOrderCaptain(
          created.id,
          draft.captainId,
        );
        void notifyCaptainOfOrder(assigned.id).catch(() => undefined);
        setCreateOpen(false);
        Alert.alert(
          "تم إنشاء الطلب",
          `تم إنشاء وتعيين الطلب #${assigned.orderNumber}.`,
        );
      } catch (assignmentError) {
        setCreateOpen(false);
        const message =
          assignmentError instanceof NativeAdminRequestTimeoutError
            ? "تم إنشاء الطلب، وتعذر تأكيد تعيين الكابتن. افتح الطلبات وتحقق من حالته قبل تنفيذ أي إجراء."
            : `تم إنشاء الطلب #${created.orderNumber}، لكن تعيين الكابتن لم ينجح. عيّنه من تفاصيل الطلب.`;
        Alert.alert("تحقق من التعيين", message, [
          { text: "فتح الطلبات", onPress: openOrders },
        ]);
      }
      await refetch();
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "تعذر إنشاء الطلب. تحقق من البيانات وحاول مرة أخرى.";
      setCreateError(message);
      return false;
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ScreenContainer className="bg-[#F3FBFF]" containerClassName="bg-[#F3FBFF]">
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <Pressable
            onPress={() => announce("الإشعارات", "لا توجد إشعارات جديدة.")}
            style={({ pressed }) => [
              styles.headerRoundButton,
              pressed && styles.pressed,
            ]}
            accessibilityLabel="الإشعارات"
          >
            <MaterialIcons
              name="notifications-none"
              size={18}
              color="#4D7D9F"
            />
            <View style={styles.notificationDot} />
          </Pressable>
        </View>
        <Text style={styles.headerTitle}>دليفري طرطوس</Text>
        <Pressable
          onPress={() => router.push("/account-settings" as Href)}
          style={({ pressed }) => [
            styles.supportButton,
            pressed && styles.pressed,
          ]}
          accessibilityLabel="إعدادات الحساب"
        >
          <MaterialIcons name="account-circle" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <FlatList
        data={snapshot?.activities ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ActivityRow item={item} onPress={openOrders} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={home.isRefetching}
            onRefresh={() => void home.refetch()}
            tintColor="#0060B8"
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.welcomeCard}>
              <Text style={styles.welcomeTitle}>
                مرحباً، {profile.role === "supervisor" ? "المشرف" : "المدير"}
              </Text>
              <Text style={styles.welcomeSubtitle}>
                إليك نظرة سريعة على حركة الطلبات اليوم
              </Text>
            </View>

            {home.error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>
                  {home.error instanceof Error
                    ? home.error.message
                    : "تعذر تحميل لوحة الإدارة."}
                </Text>
                <Pressable
                  onPress={() => void home.refetch()}
                  style={({ pressed }) => [
                    styles.retryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialIcons name="refresh" size={14} color="#0060B8" />
                  <Text style={styles.retryText}>إعادة المحاولة</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.metricGrid}>
              {home.isPending || !snapshot ? (
                <MetricSkeletons />
              ) : (
                snapshot.metrics.map((metric) => (
                  <MetricCard
                    key={metric.id}
                    metric={metric}
                    onPress={openOrders}
                  />
                ))
              )}
            </View>

            <Pressable
              onPress={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
              style={({ pressed }) => [
                styles.createCard,
                pressed && styles.pressed,
              ]}
            >
              <View>
                <Text style={styles.createTitle}>إنشاء طلب جديد</Text>
                <Text style={styles.createSubtitle}>
                  {home.isPending
                    ? "جارٍ تحميل الكباتن..."
                    : snapshot?.availableCaptains.length
                      ? "أضف طلباً وعيّن كابتناً متاحاً"
                      : "لا يوجد كابتن متاح حالياً"}
                </Text>
              </View>
              <View style={styles.createPlus}>
                <MaterialIcons
                  name="add-circle-outline"
                  size={24}
                  color="#FFFFFF"
                />
              </View>
            </Pressable>

            <SectionHeading
              title="آخر النشاطات"
              action="عرض الطلبات"
              onPress={openOrders}
            />
          </>
        }
        ListEmptyComponent={
          home.isPending ? (
            <View style={styles.loadingActivity}>
              <Text style={styles.loadingText}>جارٍ تحميل النشاطات...</Text>
            </View>
          ) : (
            <View style={styles.emptyActivities}>
              <Text style={styles.emptyText}>لا توجد نشاطات إدارية حديثة.</Text>
            </View>
          )
        }
        ListFooterComponent={
          <View style={styles.captainsSection}>
            <SectionHeading
              title="الكباتن المتاحون الآن"
              action="عرض الكل"
              onPress={() => router.push("/(tabs)/captains" as Href)}
            />
            <FlatList
              data={snapshot?.availableCaptains ?? []}
              horizontal
              inverted
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.captainsList}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => router.push("/(tabs)/captains" as Href)}
                  style={({ pressed }) => [
                    styles.captainItem,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.captainAvatar}>
                    <Text style={styles.captainInitial}>{item.initial}</Text>
                    <View style={styles.availableDot} />
                  </View>
                  <Text numberOfLines={1} style={styles.captainName}>
                    {item.name}
                  </Text>
                  <Text style={styles.captainAvailability}>متاح</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyCaptainText}>
                  {home.isPending
                    ? "جارٍ التحميل..."
                    : "لا يوجد كابتن متاح حالياً."}
                </Text>
              }
            />
          </View>
        }
      />
      <AdminNewOrderModal
        visible={createOpen}
        captains={snapshot?.availableCaptains ?? []}
        isSubmitting={isCreating}
        errorMessage={createError}
        onClose={() => {
          setCreateOpen(false);
          setCreateError(null);
        }}
        onSubmit={submitOrder}
      />
    </ScreenContainer>
  );
}

function MetricSkeletons() {
  return (
    <>
      {[0, 1, 2, 3].map((item) => (
        <View key={item} style={styles.metricSkeleton} />
      ))}
    </>
  );
}

function MetricCard({
  metric,
  onPress,
}: {
  metric: AdminHomeMetric;
  onPress: () => void;
}) {
  const highlighted = metric.id === "in_delivery";
  const iconColors: Record<AdminHomeMetric["id"], string> = {
    pending: "#1478BF",
    in_delivery: "#FFFFFF",
    completed_today: "#10B981",
    cancelled_today: "#F87171",
  };
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.metricCard,
        highlighted && styles.metricCardHighlight,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.metricTop}>
        <MaterialIcons
          name={metric.icon as IconName}
          size={19}
          color={iconColors[metric.id]}
        />
        <Text
          style={[
            styles.metricValue,
            highlighted && styles.metricValueHighlight,
          ]}
        >
          {metric.value}
        </Text>
      </View>
      <Text
        style={[styles.metricLabel, highlighted && styles.metricLabelHighlight]}
      >
        {metric.label}
      </Text>
    </Pressable>
  );
}

function ActivityRow({
  item,
  onPress,
}: {
  item: AdminHomeActivity;
  onPress: () => void;
}) {
  const meta = item.status ? statusStyle[item.status] : null;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.activityCard,
        pressed && styles.activityPressed,
      ]}
    >
      <View
        style={[
          styles.activityStrip,
          { backgroundColor: meta?.strip ?? "#4F8BB5" },
        ]}
      />
      <View style={styles.activityContent}>
        <View style={styles.activityTop}>
          <Text numberOfLines={1} style={styles.activityTitle}>
            {item.title}
          </Text>
          {meta ? (
            <View
              style={[styles.statusBadge, { backgroundColor: meta.background }]}
            >
              <Text style={[styles.statusText, { color: meta.color }]}>
                {meta.label}
              </Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.activitySubtitle}>
          {item.subtitle}
        </Text>
        <View style={styles.timeRow}>
          <MaterialIcons name="schedule" size={11} color="#7590A2" />
          <Text style={styles.timeText}>{item.timestamp}</Text>
        </View>
      </View>
      <MaterialIcons
        name="chevron-left"
        size={18}
        color="#88A0B0"
        style={styles.activityChevron}
      />
    </Pressable>
  );
}

function SectionHeading({
  title,
  action,
  onPress,
}: {
  title: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable onPress={onPress} hitSlop={8}>
        <Text style={styles.sectionAction}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    backgroundColor: "#F8FDFF",
    borderBottomColor: "#E1F0F6",
    borderBottomWidth: 1,
    flexDirection: "row",
    height: 56,
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  headerSide: { flexDirection: "row", gap: 6 },
  headerRoundButton: {
    alignItems: "center",
    backgroundColor: "#EEF8FC",
    borderColor: "#D6E9F4",
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    position: "relative",
    width: 32,
  },
  notificationDot: {
    backgroundColor: "#159ED8",
    borderRadius: 4,
    height: 7,
    position: "absolute",
    right: 4,
    top: 5,
    width: 7,
  },
  headerTitle: {
    color: "#005BA8",
    fontSize: 14,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  supportButton: {
    alignItems: "center",
    backgroundColor: "#075EAE",
    borderRadius: 8,
    elevation: 2,
    height: 32,
    justifyContent: "center",
    shadowColor: "#0060B8",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    width: 32,
  },
  listContent: { paddingBottom: 34, paddingHorizontal: 12, paddingTop: 12 },
  welcomeCard: {
    backgroundColor: "rgba(255,255,255,0.70)",
    borderColor: "#E0F0F7",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: "#0060B8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 7,
  },
  welcomeTitle: {
    color: "#155B8D",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
    writingDirection: "rtl",
  },
  welcomeSubtitle: {
    color: "#658096",
    fontSize: 11,
    marginTop: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  errorCard: {
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  errorText: {
    color: "#BA1A1A",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 19,
    textAlign: "center",
    writingDirection: "rtl",
  },
  retryButton: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: 4,
    marginTop: 8,
  },
  retryText: {
    color: "#0060B8",
    fontSize: 12,
    fontWeight: "700",
    writingDirection: "rtl",
  },
  metricGrid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  metricCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(255,255,255,0.92)",
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 104,
    padding: 14,
    shadowColor: "#0060B8",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    width: "48.5%",
  },
  metricCardHighlight: {
    backgroundColor: "#0060B8",
    borderColor: "#086FC4",
    shadowColor: "#0060B8",
    shadowOpacity: 0.22,
    shadowRadius: 13,
  },
  metricTop: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  metricValue: { color: "#1B557E", fontSize: 25, fontWeight: "800" },
  metricValueHighlight: { color: "#FFFFFF" },
  metricLabel: {
    color: "#617B90",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
  metricLabelHighlight: { color: "rgba(255,255,255,0.92)" },
  metricSkeleton: {
    backgroundColor: "rgba(255,255,255,0.72)",
    borderColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 104,
    width: "48.5%",
  },
  createCard: {
    alignItems: "center",
    backgroundColor: "#0060B8",
    borderRadius: 12,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 14,
    minHeight: 94,
    overflow: "hidden",
    paddingHorizontal: 14,
    shadowColor: "#0060B8",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.23,
    shadowRadius: 13,
  },
  createTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
    writingDirection: "rtl",
  },
  createSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 11,
    marginTop: 5,
    textAlign: "right",
    writingDirection: "rtl",
  },
  createPlus: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 18,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 18,
  },
  sectionTitle: {
    color: "#18547E",
    fontSize: 14,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  sectionAction: {
    color: "#0877C2",
    fontSize: 11,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  activityCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderColor: "rgba(255,255,255,0.92)",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    minHeight: 86,
    overflow: "hidden",
    paddingBottom: 11,
    paddingLeft: 30,
    paddingRight: 14,
    paddingTop: 11,
    position: "relative",
    shadowColor: "#0060B8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.045,
    shadowRadius: 7,
  },
  activityStrip: {
    bottom: 0,
    position: "absolute",
    right: 0,
    top: 0,
    width: 4,
  },
  activityContent: { flex: 1 },
  activityTop: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: 8,
    justifyContent: "space-between",
  },
  activityTitle: {
    color: "#154F79",
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    writingDirection: "rtl",
  },
  statusBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  statusText: { fontSize: 9, fontWeight: "800", writingDirection: "rtl" },
  activitySubtitle: {
    color: "#38586F",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "right",
    writingDirection: "rtl",
  },
  timeRow: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: 3,
    marginTop: 5,
  },
  timeText: { color: "#7590A2", fontSize: 9, writingDirection: "rtl" },
  activityChevron: { left: 8, position: "absolute", top: 33 },
  activityPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  loadingActivity: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: 12,
    minHeight: 86,
    justifyContent: "center",
  },
  loadingText: { color: "#638096", fontSize: 12, writingDirection: "rtl" },
  emptyActivities: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderColor: "#C1DFEA",
    borderRadius: 12,
    borderStyle: "dashed",
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 86,
    paddingHorizontal: 16,
  },
  emptyText: { color: "#587386", fontSize: 14, writingDirection: "rtl" },
  captainsSection: { marginTop: 2 },
  captainsList: { gap: 14, paddingBottom: 6 },
  captainItem: { alignItems: "center", maxWidth: 70, minWidth: 58 },
  captainAvatar: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    position: "relative",
    shadowColor: "#0060B8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 7,
    width: 44,
  },
  captainInitial: {
    color: "#477188",
    fontSize: 15,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  availableDot: {
    backgroundColor: "#10B981",
    borderColor: "#D9EFF9",
    borderRadius: 7,
    borderWidth: 2,
    bottom: 0,
    height: 13,
    position: "absolute",
    right: 0,
    width: 13,
  },
  captainName: {
    color: "#335872",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center",
    writingDirection: "rtl",
  },
  captainAvailability: {
    color: "#55788E",
    fontSize: 9,
    marginTop: 1,
    writingDirection: "rtl",
  },
  emptyCaptainText: { color: "#638096", fontSize: 12, writingDirection: "rtl" },
  pressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
  roleNotice: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D8E5F1",
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
  },
  roleNoticeTitle: {
    color: "#17364D",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
    writingDirection: "rtl",
  },
  roleNoticeText: {
    color: "#52616B",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
