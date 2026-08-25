import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { type ComponentProps, useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text as NativeText,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import {
  AdminNewOrderModal,
  type NativeNewOrderDraft,
} from "@/components/admin/admin-new-order-modal";
import { ScreenContainer } from "@/components/screen-container";
import { useAppSound } from "@/contexts/app-sound-context";
import { useAppToast } from "@/contexts/app-toast-context";
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

function Text({ style, ...props }: ComponentProps<typeof NativeText>) {
  const flattened = StyleSheet.flatten(style);
  const isBold =
    flattened?.fontWeight === "700" ||
    flattened?.fontWeight === "800" ||
    flattened?.fontWeight === "bold";

  return (
    <NativeText
      {...props}
      style={[{ fontFamily: isBold ? "Cairo_700Bold" : "Cairo_400Regular" }, style]}
    />
  );
}

const statusStyle: Record<
  AdminOrderStatus,
  { label: string; color: string; background: string; strip: string }
> = {
  pending: {
    label: "قيد الانتظار",
    color: "#255F94",
    background: "#EAF4FF",
    strip: "#2C81C5",
  },
  assigned: {
    label: "تم تعيين كابتن",
    color: "#4C43A8",
    background: "#F0EEFF",
    strip: "#7165E8",
  },
  received: {
    label: "تم الاستلام",
    color: "#7037B7",
    background: "#F6F0FF",
    strip: "#9B63DF",
  },
  in_delivery: {
    label: "قيد التوصيل",
    color: "#006F8E",
    background: "#E8F9FC",
    strip: "#12A9C8",
  },
  completed: {
    label: "مكتمل",
    color: "#08755C",
    background: "#EAF9F3",
    strip: "#16B384",
  },
  cancelled: {
    label: "ملغى",
    color: "#B33740",
    background: "#FFF0F1",
    strip: "#F06B72",
  },
  false_order: {
    label: "طلب كاذب",
    color: "#A46113",
    background: "#FFF7E8",
    strip: "#F4AA43",
  },
};

export function AdminHome() {
  const router = useRouter();
  const { profile } = useDeliveryAuth();
  const { showToast } = useAppToast();
  const { playSound } = useAppSound();
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

  const createLedProgress = useSharedValue(0);
  useEffect(() => {
    createLedProgress.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.linear }),
      -1,
      false,
    );
  }, [createLedProgress]);
  const createLedStyle = useAnimatedStyle(() => {
    const progress = createLedProgress.value;
    const x = interpolate(progress, [0, 0.25, 0.5, 0.75, 1], [16, 318, 338, 16, 16]);
    const y = interpolate(progress, [0, 0.25, 0.5, 0.75, 1], [7, 7, 110, 110, 7]);
    const rotation = interpolate(progress, [0, 0.25, 0.5, 0.75, 1], [0, 0, 90, 180, 270]);

    return {
      opacity: interpolate(progress, [0, 0.02, 0.98, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: x - 38 },
        { translateY: y - 6 },
        { rotate: `${rotation}deg` },
      ],
    };
  });

  if (!isBackOffice) {
    return (
      <ScreenContainer className="p-5">
        <View style={styles.roleNotice}>
          <View style={styles.roleNoticeIcon}>
            <MaterialIcons name="lock-outline" size={22} color="#9C3E44" />
          </View>
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
        playSound("adminOrderSuccess");
        setCreateOpen(false);
        showToast({ message: `تم إنشاء وتعيين الطلب #${assigned.orderNumber}.` });
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

  const availableCount = snapshot?.availableCaptains.length ?? 0;

  return (
    <ScreenContainer className="bg-[#F4F7FB]" containerClassName="bg-[#F4F7FB]">
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push("/account-settings" as Href)}
          style={({ pressed }) => [styles.accountButton, pressed && styles.headerPressed]}
          accessibilityLabel="إعدادات الحساب"
        >
          <MaterialIcons name="account-circle" size={22} color="#0878D1" />
        </Pressable>

        <View style={styles.headerBrand}>
          <Text style={styles.headerEyebrow}>
            {profile.role === "supervisor" ? "لوحة المشرف" : "لوحة الإدارة"}
          </Text>
          <Text style={styles.headerTitle}>دليفري طرطوس</Text>
        </View>

        <Pressable
          onPress={() => announce("الإشعارات", "لا توجد إشعارات جديدة.")}
          style={({ pressed }) => [styles.headerRoundButton, pressed && styles.headerPressed]}
          accessibilityLabel="الإشعارات"
        >
          <MaterialIcons name="notifications-none" size={20} color="#0878D1" />
          <View style={styles.notificationDot} />
        </Pressable>
      </View>
      <View style={styles.neonDivider} />

      <FlatList
        data={snapshot?.activities ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <ActivityRow item={item} onPress={openOrders} index={index} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={home.isRefetching}
            onRefresh={() => void home.refetch()}
            tintColor="#0878D1"
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <Animated.View entering={FadeInDown.duration(220)}>
              <LinearGradient
                  colors={["#EEF7FF", "#FFFFFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroTopRow}>
                  <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>تحديث مباشر</Text>
                  </View>
                  <Text style={styles.heroDate}>تشغيل اليوم</Text>
                </View>
                <Text style={styles.heroTitle}>
                  أهلاً، {profile.role === "supervisor" ? "مشرف الفريق" : "مدير المكتب"}
                </Text>
                <Text style={styles.heroSubtitle}>
                  راقب الحركة واتخذ الإجراء المناسب من مكان واحد.
                </Text>
              </LinearGradient>
            </Animated.View>

            {home.error ? (
              <Animated.View entering={FadeInDown.delay(40).duration(200)} style={styles.errorCard}>
                <View style={styles.errorIcon}>
                  <MaterialIcons name="sync-problem" size={19} color="#B23D47" />
                </View>
                <View style={styles.errorCopy}>
                  <Text style={styles.errorTitle}>تعذر تحديث الملخص</Text>
                  <Text style={styles.errorText}>
                    {home.error instanceof Error
                      ? home.error.message
                      : "تعذر تحميل لوحة الإدارة."}
                  </Text>
                </View>
                <Pressable
                  onPress={() => void home.refetch()}
                  style={({ pressed }) => [styles.retryButton, pressed && styles.smallPressed]}
                >
                  <MaterialIcons name="refresh" size={16} color="#0878D1" />
                </Pressable>
              </Animated.View>
            ) : null}

            <View style={styles.metricsHeader}>
              <View>
                <Text style={styles.overline}>لقطة تشغيلية</Text>
                <Text style={styles.metricsTitle}>حركة الطلبات اليوم</Text>
              </View>
              <Pressable
                onPress={openOrders}
                style={({ pressed }) => [styles.viewOrdersButton, pressed && styles.smallPressed]}
              >
                <Text style={styles.viewOrdersText}>كل الطلبات</Text>
                <MaterialIcons name="arrow-back" size={14} color="#0878D1" />
              </Pressable>
            </View>

            <View style={styles.metricGrid}>
              {home.isPending || !snapshot ? (
                <MetricSkeletons />
              ) : (
                snapshot.metrics.map((metric, index) => (
                  <MetricCard
                    key={metric.id}
                    metric={metric}
                    onPress={openOrders}
                    index={index}
                  />
                ))
              )}
            </View>

            <Animated.View entering={FadeInDown.delay(150).duration(220)}>
              <Pressable
                onPress={() => {
                  setCreateError(null);
                  setCreateOpen(true);
                }}
                style={({ pressed }) => [styles.createCard, pressed && styles.createPressed]}
              >
                <LinearGradient
                  colors={["#063B78", "#0872CC", "#0CBDF2"]}
                  start={{ x: 1, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.createGradient}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.createLedMarker, createLedStyle]}
                  >
                    <View style={styles.createLedTail} />
                    <View style={styles.createLedDot} />
                  </Animated.View>
                  <View style={styles.createIconWrap}>
                    <MaterialIcons name="add" size={26} color="#0C679D" />
                  </View>
                  <View style={styles.createCopy}>
                    <Text style={styles.createKicker}>إجراء سريع</Text>
                    <Text style={styles.createTitle}>إنشاء طلب جديد</Text>
                    <Text style={styles.createSubtitle}>
                      {home.isPending
                        ? "جارٍ تجهيز بيانات الكباتن..."
                        : snapshot?.availableCaptains.length
                          ? "أضف تفاصيل الطلب وعيّن كابتناً متاحاً"
                          : "يمكنك إضافة الطلب ثم متابعته من قائمة الطلبات"}
                    </Text>
                  </View>
                  <MaterialIcons name="arrow-back" size={21} color="rgba(255,255,255,0.88)" />
                </LinearGradient>
              </Pressable>
            </Animated.View>

            <SectionHeading
              title="أحدث النشاطات"
              subtitle="تحديثات الطلبات الأخيرة"
              action="عرض الطلبات"
              onPress={openOrders}
            />
          </>
        }
        ListEmptyComponent={
          home.isPending ? (
            <View style={styles.loadingActivity}>
              <View style={styles.loadingIcon}>
                <MaterialIcons name="history" size={20} color="#5A8FB1" />
              </View>
              <Text style={styles.loadingText}>جارٍ تحميل النشاطات...</Text>
            </View>
          ) : (
            <View style={styles.emptyActivities}>
              <View style={styles.emptyIcon}>
                <MaterialIcons name="inbox" size={23} color="#6D9BB9" />
              </View>
              <Text style={styles.emptyTitle}>لا توجد نشاطات جديدة</Text>
              <Text style={styles.emptyText}>ستظهر هنا آخر تحديثات حركة الطلبات.</Text>
            </View>
          )
        }
        ListFooterComponent={
          <View style={styles.captainsSection}>
            <SectionHeading
              title="الكباتن المتاحون الآن"
              subtitle={availableCount ? `${availableCount} جاهزون للاستلام` : "تتحدث حسب حالة الكابتن"}
              action="إدارة الكباتن"
              onPress={() => router.push("/(tabs)/captains" as Href)}
            />
            <FlatList
              data={snapshot?.availableCaptains ?? []}
              horizontal
              inverted
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.captainsList}
              renderItem={({ item, index }) => (
                <Animated.View
                  entering={FadeInDown.delay(Math.min(index * 35, 175)).duration(180)}
                  layout={Layout.duration(180)}
                >
                  <Pressable
                    onPress={() => router.push("/(tabs)/captains" as Href)}
                    style={({ pressed }) => [styles.captainItem, pressed && styles.captainPressed]}
                  >
                    <View style={styles.captainAvatar}>
                      <Text style={styles.captainInitial}>{item.initial}</Text>
                      <View style={styles.availableDot} />
                    </View>
                    <Text numberOfLines={1} style={styles.captainName}>
                      {item.name}
                    </Text>
                    <Text style={styles.captainAvailability}>متاح الآن</Text>
                  </Pressable>
                </Animated.View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyCaptainCard}>
                  <MaterialIcons name="person-off" size={18} color="#7296AD" />
                  <Text style={styles.emptyCaptainText}>
                    {home.isPending
                      ? "جارٍ التحميل..."
                      : "لا يوجد كابتن متاح حالياً."}
                  </Text>
                </View>
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
        <View key={item} style={styles.metricSkeleton}>
          <View style={styles.skeletonIcon} />
          <View style={styles.skeletonNumber} />
          <View style={styles.skeletonLabel} />
        </View>
      ))}
    </>
  );
}

function MetricCard({
  metric,
  onPress,
  index,
}: {
  metric: AdminHomeMetric;
  onPress: () => void;
  index: number;
}) {
  const highlighted = metric.id === "in_delivery";
  const tone: Record<
    AdminHomeMetric["id"],
    { icon: IconName; accent: string; background: string; iconBackground: string }
  > = {
    pending: {
      icon: "inventory-2",
      accent: "#126FA7",
      background: "#FFFFFF",
      iconBackground: "#EAF5FC",
    },
    in_delivery: {
      icon: "two-wheeler",
      accent: "#FFFFFF",
      background: "#0878D1",
      iconBackground: "rgba(255,255,255,0.16)",
    },
    completed_today: {
      icon: "check-circle-outline",
      accent: "#0A8A67",
      background: "#FFFFFF",
      iconBackground: "#E8F8F2",
    },
    cancelled_today: {
      icon: "cancel",
      accent: "#D65760",
      background: "#FFFFFF",
      iconBackground: "#FFF0F2",
    },
  };
  const currentTone = tone[metric.id];

  return (
    <Animated.View
      entering={FadeInDown.delay(55 + index * 40).duration(190)}
      layout={Layout.duration(180)}
      style={styles.metricAnimatedWrap}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.metricCard,
          { backgroundColor: currentTone.background },
          highlighted && styles.metricCardHighlight,
          pressed && styles.metricPressed,
        ]}
      >
        <View style={styles.metricTop}>
          <View style={[styles.metricIcon, { backgroundColor: currentTone.iconBackground }]}>
            <MaterialIcons name={metric.icon as IconName} size={19} color={currentTone.accent} />
          </View>
          <MaterialIcons
            name="arrow-back"
            size={15}
            color={highlighted ? "rgba(255,255,255,0.65)" : "#B1C6D5"}
          />
        </View>
        <Text style={[styles.metricValue, highlighted && styles.metricValueHighlight]}>
          {metric.value}
        </Text>
        <Text style={[styles.metricLabel, highlighted && styles.metricLabelHighlight]}>
          {metric.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function ActivityRow({
  item,
  onPress,
  index,
}: {
  item: AdminHomeActivity;
  onPress: () => void;
  index: number;
}) {
  const meta = item.status ? statusStyle[item.status] : null;
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(80 + index * 35, 260)).duration(180)}
      layout={Layout.duration(180)}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.activityCard,
          pressed && styles.activityPressed,
        ]}
      >
        <View style={[styles.activityAccent, { backgroundColor: meta?.strip ?? "#4F90BB" }]} />
        <View style={styles.activityIconWrap}>
          <MaterialIcons
            name={meta?.label === "مكتمل" ? "task-alt" : "local-shipping"}
            size={18}
            color={meta?.color ?? "#367CA7"}
          />
        </View>
        <View style={styles.activityContent}>
          <View style={styles.activityTop}>
            <Text numberOfLines={1} style={styles.activityTitle}>
              {item.title}
            </Text>
            {meta ? (
              <View style={[styles.statusBadge, { backgroundColor: meta.background }]}>
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
            <MaterialIcons name="schedule" size={12} color="#7692A5" />
            <Text style={styles.timeText}>{item.timestamp}</Text>
          </View>
        </View>
        <MaterialIcons name="chevron-left" size={19} color="#8EAABB" />
      </Pressable>
    </Animated.View>
  );
}

function SectionHeading({
  title,
  subtitle,
  action,
  onPress,
}: {
  title: string;
  subtitle: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      <Pressable
        onPress={onPress}
        hitSlop={8}
        style={({ pressed }) => [styles.sectionAction, pressed && styles.smallPressed]}
      >
        <Text style={styles.sectionActionText}>{action}</Text>
        <MaterialIcons name="arrow-back" size={13} color="#0878D1" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    backgroundColor: "#F4F7FB",
    flexDirection: "row-reverse",
    height: 56,
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  neonDivider: {
    backgroundColor: "#15C8FF",
    height: 2,
    shadowColor: "#15C8FF",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  accountButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D9EBF8",
    borderRadius: 15,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  headerBrand: { alignItems: "center", flex: 1, paddingHorizontal: 10 },
  headerEyebrow: {
    color: "#6F8A9D",
    fontSize: 9,
    fontWeight: "700",
    writingDirection: "rtl",
  },
  headerTitle: {
    color: "#07488D",
    fontSize: 14,
    fontWeight: "800",
    marginTop: -1,
    writingDirection: "rtl",
  },
  headerRoundButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D9EBF8",
    borderRadius: 15,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    position: "relative",
    width: 34,
  },
  notificationDot: {
    backgroundColor: "#15C8FF",
    borderColor: "#F4F7FB",
    borderRadius: 5,
    borderWidth: 2,
    height: 10,
    position: "absolute",
    right: 3,
    top: 3,
    width: 10,
  },
  headerPressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
  listContent: { paddingBottom: 34, paddingHorizontal: 16, paddingTop: 12 },
  heroCard: {
    borderColor: "#D8EBF7",
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 18,
    overflow: "hidden",
    padding: 17,
    shadowColor: "#0C679D",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  heroTopRow: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  livePill: {
    alignItems: "center",
    backgroundColor: "#E4F8EE",
    borderRadius: 12,
    flexDirection: "row-reverse",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  liveDot: { backgroundColor: "#19A778", borderRadius: 4, height: 7, width: 7 },
  liveText: { color: "#08745A", fontSize: 10, fontWeight: "800", writingDirection: "rtl" },
  heroDate: { color: "#6E90A6", fontSize: 11, fontWeight: "700", writingDirection: "rtl" },
  heroTitle: {
    color: "#123D60",
    fontSize: 21,
    fontWeight: "800",
    marginTop: 17,
    textAlign: "right",
    writingDirection: "rtl",
  },
  heroSubtitle: {
    color: "#608098",
    fontSize: 12,
    lineHeight: 20,
    marginTop: 5,
    textAlign: "right",
    writingDirection: "rtl",
  },
  errorCard: {
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    borderColor: "#F6D5D8",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 10,
    marginBottom: 15,
    padding: 12,
  },
  errorIcon: { alignItems: "center", backgroundColor: "#FFE6E8", borderRadius: 11, height: 36, justifyContent: "center", width: 36 },
  errorCopy: { flex: 1 },
  errorTitle: { color: "#9C343D", fontSize: 12, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  errorText: { color: "#B35A61", fontSize: 10, lineHeight: 16, marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  retryButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#F4CDD0", borderRadius: 10, borderWidth: 1, height: 34, justifyContent: "center", width: 34 },
  metricsHeader: { alignItems: "flex-end", flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 11 },
  overline: { color: "#7B9AAC", fontSize: 10, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  metricsTitle: { color: "#163E5C", fontSize: 17, fontWeight: "800", marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  viewOrdersButton: { alignItems: "center", flexDirection: "row-reverse", gap: 3, paddingVertical: 5 },
  viewOrdersText: { color: "#0878D1", fontSize: 11, fontWeight: "800", writingDirection: "rtl" },
  metricGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, justifyContent: "space-between" },
  metricAnimatedWrap: { width: "48.5%" },
  metricCard: {
    borderColor: "#E6EEF4",
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 90,
    overflow: "hidden",
    padding: 11,
    shadowColor: "#113D5B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.055,
    shadowRadius: 9,
  },
  metricCardHighlight: { borderColor: "#0878D1", shadowColor: "#0878D1", shadowOpacity: 0.2, shadowRadius: 13 },
  metricTop: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  metricIcon: { alignItems: "center", borderRadius: 10, height: 29, justifyContent: "center", width: 29 },
  metricValue: { color: "#164C70", fontSize: 22, fontWeight: "800", marginTop: 8, textAlign: "right", writingDirection: "rtl" },
  metricValueHighlight: { color: "#FFFFFF" },
  metricLabel: { color: "#6A879A", fontSize: 10, fontWeight: "700", marginTop: 1, textAlign: "right", writingDirection: "rtl" },
  metricLabelHighlight: { color: "rgba(255,255,255,0.82)" },
  metricPressed: { opacity: 0.88, transform: [{ scale: 0.975 }] },
  metricSkeleton: { backgroundColor: "#FFFFFF", borderColor: "#E6EEF4", borderRadius: 16, borderWidth: 1, minHeight: 90, overflow: "hidden", padding: 11, width: "48.5%" },
  skeletonIcon: { alignSelf: "flex-end", backgroundColor: "#EDF3F7", borderRadius: 10, height: 29, width: 29 },
  skeletonNumber: { backgroundColor: "#EAF1F5", borderRadius: 5, height: 19, marginLeft: "auto", marginTop: 8, width: "36%" },
  skeletonLabel: { backgroundColor: "#F0F5F8", borderRadius: 4, height: 8, marginLeft: "auto", marginTop: 6, width: "65%" },
  createCard: { borderColor: "rgba(84,222,255,0.62)", borderRadius: 20, borderWidth: 1, marginTop: 18, overflow: "hidden", shadowColor: "#16CEFF", shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.28, shadowRadius: 16 },
  createGradient: { alignItems: "center", flexDirection: "row-reverse", gap: 13, minHeight: 118, overflow: "hidden", paddingHorizontal: 16, paddingVertical: 15, position: "relative" },
  createLedMarker: { alignItems: "center", flexDirection: "row", height: 12, position: "absolute", width: 44 },
  createLedTail: { backgroundColor: "rgba(167,246,255,0.34)", borderRadius: 3, height: 2, width: 34 },
  createLedDot: { backgroundColor: "#E8FCFF", borderColor: "#7BEAFF", borderRadius: 6, borderWidth: 1, height: 10, shadowColor: "#A5F4FF", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.95, shadowRadius: 8, width: 10 },
  createIconWrap: { alignItems: "center", backgroundColor: "#F5FDFF", borderColor: "rgba(137,240,255,0.8)", borderRadius: 17, borderWidth: 1, height: 48, justifyContent: "center", shadowColor: "#043D63", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 5, width: 48 },
  createCopy: { flex: 1 },
  createKicker: { color: "rgba(231,248,255,0.72)", fontSize: 10, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  createTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  createSubtitle: { color: "rgba(235,249,255,0.86)", fontSize: 11, lineHeight: 17, marginTop: 4, textAlign: "right", writingDirection: "rtl" },
  createPressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  sectionHeading: { alignItems: "flex-end", flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 11, marginTop: 24 },
  sectionTitle: { color: "#163E5C", fontSize: 17, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  sectionSubtitle: { color: "#7894A7", fontSize: 10, fontWeight: "700", marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  sectionAction: { alignItems: "center", flexDirection: "row-reverse", gap: 3, paddingVertical: 6 },
  sectionActionText: { color: "#0878D1", fontSize: 11, fontWeight: "800", writingDirection: "rtl" },
  activityCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4EDF3", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginBottom: 9, minHeight: 94, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 11, shadowColor: "#153C58", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.045, shadowRadius: 7 },
  activityAccent: { bottom: 0, position: "absolute", right: 0, top: 0, width: 4 },
  activityIconWrap: { alignItems: "center", backgroundColor: "#F3F8FB", borderRadius: 12, height: 38, justifyContent: "center", width: 38 },
  activityContent: { flex: 1 },
  activityTop: { alignItems: "center", flexDirection: "row-reverse", gap: 6, justifyContent: "space-between" },
  activityTitle: { color: "#1A4868", flex: 1, fontSize: 12, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  statusBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  statusText: { fontSize: 9, fontWeight: "800", writingDirection: "rtl" },
  activitySubtitle: { color: "#5E7C90", fontSize: 11, fontWeight: "700", marginTop: 5, textAlign: "right", writingDirection: "rtl" },
  timeRow: { alignItems: "center", flexDirection: "row-reverse", gap: 3, marginTop: 6 },
  timeText: { color: "#7B96A8", fontSize: 10, writingDirection: "rtl" },
  activityPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  loadingActivity: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E3EDF4", borderRadius: 18, borderStyle: "dashed", borderWidth: 1, flexDirection: "row-reverse", gap: 8, justifyContent: "center", minHeight: 100 },
  loadingIcon: { alignItems: "center", backgroundColor: "#EEF7FC", borderRadius: 11, height: 34, justifyContent: "center", width: 34 },
  loadingText: { color: "#5F8298", fontSize: 12, fontWeight: "700", writingDirection: "rtl" },
  emptyActivities: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D9E8F0", borderRadius: 18, borderStyle: "dashed", borderWidth: 1, justifyContent: "center", minHeight: 135, paddingHorizontal: 16 },
  emptyIcon: { alignItems: "center", backgroundColor: "#EDF6FB", borderRadius: 15, height: 46, justifyContent: "center", width: 46 },
  emptyTitle: { color: "#315F7C", fontSize: 13, fontWeight: "800", marginTop: 9, writingDirection: "rtl" },
  emptyText: { color: "#7892A4", fontSize: 11, marginTop: 3, textAlign: "center", writingDirection: "rtl" },
  captainsSection: { marginTop: 2 },
  captainsList: { gap: 10, paddingBottom: 8 },
  captainItem: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E5EDF3", borderRadius: 16, borderWidth: 1, minHeight: 105, paddingHorizontal: 8, paddingVertical: 10, shadowColor: "#143D5B", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 6, width: 82 },
  captainAvatar: { alignItems: "center", backgroundColor: "#EAF6FC", borderColor: "#D5EAF5", borderRadius: 22, borderWidth: 1, height: 44, justifyContent: "center", position: "relative", width: 44 },
  captainInitial: { color: "#21678F", fontSize: 16, fontWeight: "800", writingDirection: "rtl" },
  availableDot: { backgroundColor: "#18A877", borderColor: "#FFFFFF", borderRadius: 7, borderWidth: 2, bottom: -2, height: 14, position: "absolute", right: -1, width: 14 },
  captainName: { color: "#315B77", fontSize: 10, fontWeight: "800", marginTop: 7, textAlign: "center", writingDirection: "rtl" },
  captainAvailability: { color: "#15916C", fontSize: 9, fontWeight: "700", marginTop: 2, writingDirection: "rtl" },
  captainPressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  emptyCaptainCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E0EAF0", borderRadius: 14, borderWidth: 1, flexDirection: "row-reverse", gap: 7, paddingHorizontal: 12, paddingVertical: 12 },
  emptyCaptainText: { color: "#638399", fontSize: 11, fontWeight: "700", writingDirection: "rtl" },
  smallPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  roleNotice: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E8D6D8", borderRadius: 22, borderWidth: 1, padding: 24 },
  roleNoticeIcon: { alignItems: "center", backgroundColor: "#FFF1F2", borderRadius: 18, height: 48, justifyContent: "center", width: 48 },
  roleNoticeTitle: { color: "#4E2B31", fontSize: 18, fontWeight: "800", marginTop: 12, textAlign: "right", writingDirection: "rtl" },
  roleNoticeText: { color: "#79646A", fontSize: 13, lineHeight: 21, marginTop: 6, textAlign: "center", writingDirection: "rtl" },
});
