import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { useAppToast } from "@/contexts/app-toast-context";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import {
  useAdminOrderDetails,
  useAvailableCaptains,
} from "@/features/admin/use-admin-order-details";
import {
  type AdminOrdersFilter,
  type AdminOrderListItem,
  useAdminOrders,
} from "@/features/admin/use-admin-orders";
import { type AdminOrderStatus } from "@/lib/admin/admin-home-mappers";
import { getNativeSupabaseClient } from "@/lib/supabase/native-supabase";
import { notifyCaptainOfOrder } from "@/lib/notifications";

import { nativeAdminContract } from "@/lib/supabase/native-admin-contract";

const filters: { id: AdminOrdersFilter; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "pending", label: "قيد الانتظار" },
  { id: "assigned", label: "تم تعيين كابتن" },
  { id: "received", label: "تم الاستلام" },
  { id: "in_delivery", label: "قيد التوصيل" },
  { id: "completed", label: "مكتمل" },
  { id: "cancelled", label: "ملغى" },
  { id: "false_order", label: "طلب كاذب" },
];

const statusAppearance: Record<
  AdminOrderStatus,
  { label: string; text: string; background: string; strip: string }
> = {
  pending: {
    label: "قيد الانتظار",
    text: "#0060B8",
    background: "#EFF6FF",
    strip: "#0060B8",
  },
  assigned: {
    label: "تم تعيين كابتن",
    text: "#4338CA",
    background: "#EEF2FF",
    strip: "#6366F1",
  },
  received: {
    label: "تم الاستلام",
    text: "#6D28D9",
    background: "#F5F3FF",
    strip: "#8B5CF6",
  },
  in_delivery: {
    label: "قيد التوصيل",
    text: "#0E7490",
    background: "#ECFEFF",
    strip: "#06B6D4",
  },
  completed: {
    label: "مكتمل",
    text: "#047857",
    background: "#ECFDF5",
    strip: "#10B981",
  },
  cancelled: {
    label: "ملغى",
    text: "#B91C1C",
    background: "#FEF2F2",
    strip: "#EF4444",
  },
  false_order: {
    label: "طلب كاذب",
    text: "#B45309",
    background: "#FFFBEB",
    strip: "#F59E0B",
  },
};

function formatMoney(value: number) {
  return `${new Intl.NumberFormat("en-US").format(value)} ل.س`;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ar-SY", {
      timeZone: "Asia/Damascus",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "غير متاح";
  }
}

export function AdminOrders() {
  const router = useRouter();
  const { profile } = useDeliveryAuth();
  const { showToast } = useAppToast();
  const isBackOffice =
    profile?.role === "admin" || profile?.role === "supervisor";
  const [filter, setFilter] = useState<AdminOrdersFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderListItem | null>(
    null,
  );
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [selectedCaptainId, setSelectedCaptainId] = useState<string | null>(
    null,
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();
  const orders = useAdminOrders(filter, isBackOffice);
  const details = useAdminOrderDetails(selectedOrder?.id ?? null);
  const captains = useAvailableCaptains(
    Boolean(selectedOrder && assignmentOpen),
  );

  useEffect(() => {
    if (!isBackOffice) return;
    const unsubscribe = nativeAdminContract.realtime.subscribeOrders(() => {
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-home"] });
      if (selectedOrder)
        void queryClient.invalidateQueries({
          queryKey: ["admin-order-details", selectedOrder.id],
        });
    });
    const polling = setInterval(
      () => void queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
      15_000,
    );
    return () => {
      clearInterval(polling);
      unsubscribe();
    };
  }, [isBackOffice, queryClient, selectedOrder]);

  const visibleOrders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return orders.items;
    return orders.items.filter((order) =>
      `${order.orderNumber} ${order.customerName} ${order.customerPhone} ${order.pickupAddress} ${order.deliveryAddress}`
        .toLowerCase()
        .includes(needle),
    );
  }, [orders.items, search]);

  if (!isBackOffice) {
    return (
      <ScreenContainer className="p-5">
        <View style={styles.roleNotice}>
          <Text style={styles.roleNoticeTitle}>لا تملك صلاحية لوحة العمل</Text>
          <Text style={styles.roleNoticeText}>
            قائمة الطلبات الإدارية مخصصة للأدمن والمشرف فقط.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const closeDetails = () => {
    if (isSaving) return;
    setSelectedOrder(null);
    setAssignmentOpen(false);
    setCancelOpen(false);
    setSelectedCaptainId(null);
    setCancellationReason("");
  };

  const refreshOrderData = async () => {
    await Promise.all([
      orders.refetch(),
      selectedOrder
        ? queryClient.invalidateQueries({
            queryKey: ["admin-order-details", selectedOrder.id],
          })
        : Promise.resolve(),
    ]);
  };

  const assignCaptain = async () => {
    if (!selectedOrder || !selectedCaptainId) return;
    setIsSaving(true);
    try {
      const { error } = await getNativeSupabaseClient().rpc(
        "assign_order_captain",
        { p_order_id: selectedOrder.id, p_captain_id: selectedCaptainId },
      );
      if (error) throw new Error(error.message);
      void notifyCaptainOfOrder(selectedOrder.id);
      showToast({ message: `تم تعيين الكابتن للطلب #${selectedOrder.orderNumber}.` });
      setAssignmentOpen(false);
      setSelectedCaptainId(null);
      await refreshOrderData();
    } catch (error) {
      Alert.alert(
        "تعذر التعيين",
        error instanceof Error ? error.message : "تعذر تعيين الكابتن للطلب.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const cancelOrder = async () => {
    if (!selectedOrder || !cancellationReason.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await getNativeSupabaseClient().rpc("cancel_order", {
        p_order_id: selectedOrder.id,
        p_cancellation_reason: cancellationReason.trim(),
      });
      if (error) throw new Error(error.message);
      showToast({ message: `تم إلغاء الطلب #${selectedOrder.orderNumber}.` });
      setCancelOpen(false);
      setCancellationReason("");
      await refreshOrderData();
    } catch (error) {
      Alert.alert(
        "تعذر الإلغاء",
        error instanceof Error ? error.message : "تعذر إلغاء الطلب.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer className="bg-[#F0F7FF]" containerClassName="bg-[#EAF5FF]">
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "العودة",
          icon: "arrow-forward",
          onPress: () => router.back(),
        }}
        trailingAction={{ accessibilityLabel: "جدولة الطلبات", icon: "schedule" }}
      />

      <FlatList
        data={visibleOrders}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={orders.isRefetching}
            onRefresh={() => void orders.refetch()}
            tintColor="#0060B8"
          />
        }
        renderItem={({ item }) => (
          <OrderRow item={item} onPress={() => setSelectedOrder(item)} />
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroIcon}>
                <MaterialIcons name="inventory-2" size={24} color="#0060B8" />
              </View>
              <View style={styles.heroText}>
                <Text style={styles.heroTitle}>قائمة الطلبات</Text>
                <Text style={styles.heroSubtitle}>
                  ابحث، صفِّ الحالات، ثم اعرض التفاصيل التشغيلية.
                </Text>
              </View>
            </View>
            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={19} color="#75818E" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="ابحث برقم الطلب أو العميل أو العنوان"
                placeholderTextColor="#8A98A6"
                style={styles.searchInput}
                textAlign="right"
              />
            </View>
            <FlatList
              data={filters}
              horizontal
              inverted
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setFilter(item.id)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    filter === item.id && styles.filterChipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      filter === item.id && styles.filterTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
            <View style={styles.listHeading}>
              <Text style={styles.listTitle}>الطلبات المعروضة</Text>
              <Text style={styles.countBadge}>
                {visibleOrders.length} في الصفحة {orders.pageNumber}
              </Text>
            </View>
            {orders.isPending ? <SkeletonRows /> : null}
            {orders.error ? (
              <ErrorBox
                message={
                  orders.error instanceof Error
                    ? orders.error.message
                    : "تعذر تحميل بيانات الطلبات."
                }
                onRetry={() => void orders.refetch()}
              />
            ) : null}
          </>
        }
        ListEmptyComponent={
          orders.isPending || orders.error ? null : (
            <View style={styles.emptyState}>
              <MaterialIcons name="inventory-2" size={30} color="#7D9AB0" />
              <Text style={styles.emptyTitle}>لا توجد طلبات مطابقة</Text>
              <Text style={styles.emptySubtitle}>
                جرّب تغيير البحث أو الحالة.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          !orders.isPending &&
          !orders.error &&
          (orders.hasPreviousPage || orders.hasNextPage) ? (
            <View style={styles.pager}>
              <Pressable
                disabled={!orders.hasPreviousPage || orders.isFetching}
                onPress={orders.previousPage}
                style={({ pressed }) => [
                  styles.pageButtonSecondary,
                  (!orders.hasPreviousPage || orders.isFetching) &&
                    styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.pageButtonSecondaryText}>
                  الصفحة السابقة
                </Text>
              </Pressable>
              <Text style={styles.pageText}>صفحة {orders.pageNumber}</Text>
              <Pressable
                disabled={!orders.hasNextPage || orders.isFetching}
                onPress={orders.nextPage}
                style={({ pressed }) => [
                  styles.pageButtonPrimary,
                  (!orders.hasNextPage || orders.isFetching) && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.pageButtonPrimaryText}>الصفحة التالية</Text>
              </Pressable>
            </View>
          ) : null
        }
      />
      <OrderDetailsModal
        order={selectedOrder}
        details={details}
        captains={captains}
        assignmentOpen={assignmentOpen}
        cancelOpen={cancelOpen}
        selectedCaptainId={selectedCaptainId}
        cancellationReason={cancellationReason}
        isSaving={isSaving}
        onClose={closeDetails}
        onOpenAssignment={() => setAssignmentOpen(true)}
        onOpenCancellation={() => setCancelOpen(true)}
        onChooseCaptain={setSelectedCaptainId}
        onChangeCancellationReason={setCancellationReason}
        onAssign={() => void assignCaptain()}
        onCancel={() => void cancelOrder()}
      />
    </ScreenContainer>
  );
}

function OrderRow({
  item,
  onPress,
}: {
  item: AdminOrderListItem;
  onPress: () => void;
}) {
  const status = statusAppearance[item.status];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.orderCard,
        pressed && styles.orderPressed,
      ]}
    >
      <View style={[styles.orderStrip, { backgroundColor: status.strip }]} />
      <View style={styles.orderBody}>
        <View style={styles.orderTop}>
          <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
          <View
            style={[styles.statusBadge, { backgroundColor: status.background }]}
          >
            <Text style={[styles.statusText, { color: status.text }]}>
              {status.label}
            </Text>
          </View>
        </View>
        <View style={styles.orderCustomerRow}>
          <Text style={styles.orderCustomer}>{item.customerName}</Text>
          <Text style={styles.orderFee}>{formatMoney(item.fee)}</Text>
        </View>
        <View style={styles.locationRow}>
          <MaterialIcons name="location-on" size={15} color="#414752" />
          <Text numberOfLines={1} style={styles.locationText}>
            {item.pickupAddress} ← {item.deliveryAddress}
          </Text>
        </View>
        <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>
      </View>
      <MaterialIcons
        name="arrow-back"
        size={20}
        color="#75818E"
        style={styles.orderArrow}
      />
    </Pressable>
  );
}

function OrderDetailsModal({
  order,
  details,
  captains,
  assignmentOpen,
  cancelOpen,
  selectedCaptainId,
  cancellationReason,
  isSaving,
  onClose,
  onOpenAssignment,
  onOpenCancellation,
  onChooseCaptain,
  onChangeCancellationReason,
  onAssign,
  onCancel,
}: {
  order: AdminOrderListItem | null;
  details: ReturnType<typeof useAdminOrderDetails>;
  captains: ReturnType<typeof useAvailableCaptains>;
  assignmentOpen: boolean;
  cancelOpen: boolean;
  selectedCaptainId: string | null;
  cancellationReason: string;
  isSaving: boolean;
  onClose: () => void;
  onOpenAssignment: () => void;
  onOpenCancellation: () => void;
  onChooseCaptain: (id: string) => void;
  onChangeCancellationReason: (value: string) => void;
  onAssign: () => void;
  onCancel: () => void;
}) {
  if (!order) return null;
  const status = statusAppearance[order.status];
  const pickups =
    details.data?.stops.filter((stop) => stop.type === "pickup") ?? [];
  const destinations =
    details.data?.stops.filter((stop) => stop.type === "delivery") ?? [];
  const canAssign = order.status === "pending";
  const canCancel = order.status === "pending";

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Pressable
              disabled={isSaving}
              onPress={onClose}
              style={({ pressed }) => [
                styles.modalClose,
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons name="close" size={22} color="#52616B" />
            </Pressable>
            <View>
              <Text style={styles.modalTitle}>
                تفاصيل الطلب #{order.orderNumber}
              </Text>
              <Text style={styles.modalDescription}>
                تفاصيل المصادر والوجهات والتسلسل التشغيلي.
              </Text>
            </View>
          </View>
          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.detailCard}>
              <View style={styles.detailTitleRow}>
                <View>
                  <Text style={styles.detailLabel}>العميل</Text>
                  <Text style={styles.detailValue}>{order.customerName}</Text>
                  <Text style={styles.detailPhone}>{order.customerPhone}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: status.background },
                  ]}
                >
                  <Text style={[styles.statusText, { color: status.text }]}>
                    {status.label}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.detailCard}>
              <View style={styles.detailTitleRow}>
                <Text style={styles.detailSectionTitle}>المصدر والوجهة</Text>
                <Text style={styles.detailFee}>{formatMoney(order.fee)}</Text>
              </View>
              {details.isPending ? (
                <LoadingLine label="جارٍ تحميل نقاط الطلب..." />
              ) : details.error ? (
                <DetailError
                  message={
                    details.error instanceof Error
                      ? details.error.message
                      : "تعذر تحميل نقاط الطلب."
                  }
                  onRetry={() => void details.refetch()}
                />
              ) : (
                <View style={styles.places}>
                  {[...pickups, ...destinations].map((place) => (
                    <View
                      key={place.id}
                      style={[
                        styles.placeRow,
                        place.type === "delivery" && styles.deliveryPlace,
                      ]}
                    >
                      <View
                        style={[
                          styles.placeIcon,
                          place.type === "delivery" && styles.destinationIcon,
                        ]}
                      >
                        <MaterialIcons
                          name={
                            place.type === "pickup"
                              ? "storefront"
                              : "location-on"
                          }
                          size={16}
                          color={
                            place.type === "pickup" ? "#0060B8" : "#047857"
                          }
                        />
                      </View>
                      <View style={styles.placeText}>
                        <Text style={styles.placeName}>
                          {place.contactName}
                        </Text>
                        <Text style={styles.placeAddress}>{place.address}</Text>
                        {place.contactPhone ? (
                          <Text style={styles.placePhone}>
                            {place.contactPhone}
                          </Text>
                        ) : null}
                        {place.note ? (
                          <Text style={styles.placeNote}>{place.note}</Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.detailCard}>
              <Text style={styles.detailSectionTitle}>الكابتن</Text>
              <View style={styles.captainDetail}>
                <View style={styles.captainDetailAvatar}>
                  <MaterialIcons name="person" size={18} color="#52606D" />
                </View>
                <View>
                  <Text style={styles.detailValue}>
                    {order.assignedCaptainName ?? "لم يُعيّن كابتن بعد"}
                  </Text>
                  <Text style={styles.placeAddress}>
                    {order.assignedCaptainName
                      ? "الكابتن المعيّن على الطلب"
                      : "بانتظار التعيين"}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.detailCard}>
              <Text style={styles.detailSectionTitle}>التسلسل الزمني</Text>
              {details.isPending ? (
                <LoadingLine label="جارٍ تحميل السجل..." />
              ) : details.error ? (
                <DetailError
                  message="تعذر تحميل السجل. استخدم إعادة محاولة التفاصيل."
                  onRetry={() => void details.refetch()}
                />
              ) : details.data?.timeline.length ? (
                <View style={styles.timeline}>
                  {details.data.timeline.map((item) => {
                    const meta = statusAppearance[item.status];
                    return (
                      <View key={item.id} style={styles.timelineRow}>
                        <View
                          style={[
                            styles.timelineDot,
                            { backgroundColor: meta.strip },
                          ]}
                        />
                        <View style={styles.timelineText}>
                          <Text style={styles.placeName}>{meta.label}</Text>
                          <Text style={styles.placeAddress}>
                            {formatDate(item.timestamp)} — {item.actorName}
                          </Text>
                          {item.note ? (
                            <Text style={styles.placeNote}>{item.note}</Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.emptyInline}>
                  لا يوجد سجل حالات مرئي لهذا الطلب.
                </Text>
              )}
            </View>
            {canAssign || canCancel ? (
              <View style={styles.actionsRow}>
                {canAssign ? (
                  <Pressable
                    onPress={onOpenAssignment}
                    disabled={isSaving}
                    style={({ pressed }) => [
                      styles.assignAction,
                      pressed && styles.pressed,
                    ]}
                  >
                    <MaterialIcons
                      name="two-wheeler"
                      size={17}
                      color="#0060B8"
                    />
                    <Text style={styles.assignActionText}>تعيين كابتن</Text>
                  </Pressable>
                ) : null}
                {canCancel ? (
                  <Pressable
                    onPress={onOpenCancellation}
                    disabled={isSaving}
                    style={({ pressed }) => [
                      styles.cancelAction,
                      pressed && styles.pressed,
                    ]}
                  >
                    <MaterialIcons name="cancel" size={17} color="#BA1A1A" />
                    <Text style={styles.cancelActionText}>إلغاء مع سبب</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {assignmentOpen ? (
              <View style={styles.inlineModal}>
                <Text style={styles.inlineModalTitle}>تعيين كابتن</Text>
                <Text style={styles.inlineModalDescription}>
                  تظهر الكباتن المفعّلة والمتاحة فقط.
                </Text>
                {captains.isPending ? (
                  <LoadingLine label="جارٍ تحميل الكباتن المتاحين..." />
                ) : captains.error ? (
                  <DetailError
                    message={
                      captains.error instanceof Error
                        ? captains.error.message
                        : "تعذر تحميل الكباتن."
                    }
                    onRetry={() => void captains.refetch()}
                  />
                ) : captains.data?.length ? (
                  captains.data.map((captain) => (
                    <Pressable
                      key={captain.id}
                      onPress={() => onChooseCaptain(captain.id)}
                      style={({ pressed }) => [
                        styles.captainChoice,
                        selectedCaptainId === captain.id &&
                          styles.captainChoiceSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.captainChoiceText,
                          selectedCaptainId === captain.id &&
                            styles.captainChoiceTextSelected,
                        ]}
                      >
                        {captain.name}
                      </Text>
                      <View style={styles.availableSmallDot} />
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.emptyInline}>
                    لا يوجد كابتن متاح حالياً.
                  </Text>
                )}
                <Pressable
                  disabled={!selectedCaptainId || isSaving}
                  onPress={onAssign}
                  style={({ pressed }) => [
                    styles.confirmAssign,
                    (!selectedCaptainId || isSaving) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.confirmAssignText}>
                    {isSaving ? "جارٍ التعيين..." : "تأكيد التعيين"}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {cancelOpen ? (
              <View style={styles.inlineModal}>
                <Text style={styles.inlineModalTitle}>إلغاء الطلب</Text>
                <Text style={styles.inlineModalDescription}>
                  سبب الإلغاء إلزامي وسيظهر في التسلسل الزمني للطلب.
                </Text>
                <TextInput
                  multiline
                  value={cancellationReason}
                  onChangeText={onChangeCancellationReason}
                  placeholder="اكتب سبب الإلغاء"
                  placeholderTextColor="#89939E"
                  style={styles.reasonInput}
                  textAlign="right"
                />
                <Pressable
                  disabled={!cancellationReason.trim() || isSaving}
                  onPress={onCancel}
                  style={({ pressed }) => [
                    styles.confirmCancel,
                    (!cancellationReason.trim() || isSaving) && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.confirmCancelText}>
                    {isSaving ? "جارٍ الإلغاء..." : "تأكيد الإلغاء"}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function LoadingLine({ label }: { label: string }) {
  return (
    <View style={styles.loadingLine}>
      <MaterialIcons name="sync" size={17} color="#0060B8" />
      <Text style={styles.loadingLineText}>{label}</Text>
    </View>
  );
}
function DetailError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.detailError}>
      <Text style={styles.detailErrorText}>{message}</Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.detailRetry, pressed && styles.pressed]}
      >
        <Text style={styles.detailRetryText}>إعادة محاولة التفاصيل</Text>
      </Pressable>
    </View>
  );
}

function SkeletonRows() {
  return (
    <View style={styles.skeletonWrap}>
      {[1, 2, 3].map((id) => (
        <View key={id} style={styles.skeleton} />
      ))}
    </View>
  );
}
function ErrorBox({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
      >
        <MaterialIcons name="refresh" size={15} color="#BA1A1A" />
        <Text style={styles.retryText}>إعادة المحاولة</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    backgroundColor: "#0060B8",
    flexDirection: "row-reverse",
    height: 64,
    justifyContent: "space-between",
    paddingHorizontal: 18,
    shadowColor: "#0060B8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerText: { alignItems: "flex-end", flex: 1, marginHorizontal: 12 },
  headerEyebrow: { color: "#DBEAFF", fontSize: 11, writingDirection: "rtl" },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 24,
    writingDirection: "rtl",
  },
  headerIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  listContent: { paddingBottom: 30, paddingHorizontal: 18, paddingTop: 20 },
  heroCard: {
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderColor: "#D3E3F0",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row-reverse",
    padding: 16,
    shadowColor: "#004889",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "#EAF4FF",
    borderRadius: 16,
    height: 44,
    justifyContent: "center",
    marginLeft: 12,
    width: 44,
  },
  heroText: { flex: 1 },
  heroTitle: {
    color: "#1C1B1B",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
    writingDirection: "rtl",
  },
  heroSubtitle: {
    color: "#58616B",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: "#FBFDFF",
    borderColor: "#C9D9E7",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row-reverse",
    height: 44,
    marginTop: 14,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: "#1C1B1B",
    flex: 1,
    fontSize: 14,
    marginRight: 8,
    writingDirection: "rtl",
  },
  filters: { gap: 8, paddingVertical: 14 },
  filterChip: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D4E2EC",
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  filterChipSelected: { backgroundColor: "#0060B8", borderColor: "#0060B8" },
  filterText: {
    color: "#58616B",
    fontSize: 12,
    fontWeight: "700",
    writingDirection: "rtl",
  },
  filterTextSelected: { color: "#FFFFFF" },
  listHeading: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  listTitle: {
    color: "#1C1B1B",
    fontSize: 16,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  countBadge: {
    backgroundColor: "#DBEEFF",
    borderRadius: 14,
    color: "#0060B8",
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
    writingDirection: "rtl",
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E0E8EE",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    minHeight: 128,
    overflow: "hidden",
    paddingBottom: 14,
    paddingLeft: 34,
    paddingRight: 18,
    paddingTop: 14,
    position: "relative",
    shadowColor: "#004889",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  orderStrip: { bottom: 0, position: "absolute", right: 0, top: 0, width: 6 },
  orderBody: { flex: 1 },
  orderTop: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  orderNumber: { color: "#1C1B1B", fontSize: 16, fontWeight: "800" },
  statusBadge: { borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: "800", writingDirection: "rtl" },
  orderCustomerRow: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 8,
  },
  orderCustomer: { color: "#1C1B1B", fontSize: 14, writingDirection: "rtl" },
  orderFee: {
    color: "#1C1B1B",
    fontSize: 16,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  locationRow: {
    alignItems: "center",
    flexDirection: "row-reverse",
    marginTop: 7,
  },
  locationText: {
    color: "#414752",
    flex: 1,
    fontSize: 12,
    marginRight: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  orderDate: {
    color: "#75818E",
    fontSize: 10,
    marginTop: 8,
    textAlign: "right",
    writingDirection: "rtl",
  },
  orderArrow: { left: 9, position: "absolute", top: 52 },
  orderPressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  skeletonWrap: { gap: 12 },
  skeleton: { backgroundColor: "#FFFFFF", borderRadius: 16, height: 128 },
  errorBox: {
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  errorText: {
    color: "#BA1A1A",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    writingDirection: "rtl",
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#FECACA",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 6,
    height: 40,
    justifyContent: "center",
    marginTop: 10,
    paddingHorizontal: 14,
  },
  retryText: {
    color: "#BA1A1A",
    fontSize: 12,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.70)",
    borderColor: "#C7DAE8",
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 40,
  },
  emptyTitle: {
    color: "#4F5D6B",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 8,
    writingDirection: "rtl",
  },
  emptySubtitle: {
    color: "#75818E",
    fontSize: 12,
    marginTop: 4,
    writingDirection: "rtl",
  },
  pager: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D3E3F0",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 8,
    justifyContent: "space-between",
    marginTop: 8,
    padding: 10,
  },
  pageButtonPrimary: {
    alignItems: "center",
    backgroundColor: "#0060B8",
    borderRadius: 10,
    flex: 1,
    height: 40,
    justifyContent: "center",
  },
  pageButtonSecondary: {
    alignItems: "center",
    borderColor: "#C9D9E7",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    height: 40,
    justifyContent: "center",
  },
  pageButtonPrimaryText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  pageButtonSecondaryText: {
    color: "#0060B8",
    fontSize: 12,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  pageText: {
    color: "#58616B",
    fontSize: 12,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
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
  modalOverlay: {
    backgroundColor: "rgba(10,32,50,0.44)",
    flex: 1,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#F0F7FF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    overflow: "hidden",
  },
  modalHeader: {
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderBottomColor: "#DBE7F2",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18,
  },
  modalClose: {
    alignItems: "center",
    backgroundColor: "#F4F8FB",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  modalTitle: {
    color: "#1C1B1B",
    fontSize: 19,
    fontWeight: "800",
    textAlign: "right",
    writingDirection: "rtl",
  },
  modalDescription: {
    color: "#58616B",
    fontSize: 12,
    marginTop: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  modalContent: { gap: 12, padding: 14 },
  detailCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DBE7F2",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  detailTitleRow: {
    alignItems: "flex-start",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  detailLabel: {
    color: "#66727E",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
    writingDirection: "rtl",
  },
  detailValue: {
    color: "#1C1B1B",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  detailPhone: {
    color: "#58616B",
    fontSize: 12,
    marginTop: 4,
    textAlign: "right",
  },
  detailSectionTitle: {
    color: "#1C1B1B",
    fontSize: 14,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  detailFee: {
    color: "#0060B8",
    fontSize: 14,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  places: { gap: 12, marginTop: 14 },
  placeRow: { flexDirection: "row-reverse", gap: 10 },
  deliveryPlace: {
    borderTopColor: "#DBE7F2",
    borderTopWidth: 1,
    paddingTop: 12,
  },
  placeIcon: {
    alignItems: "center",
    backgroundColor: "#DBEEFF",
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  destinationIcon: { backgroundColor: "#D1FAE5" },
  placeText: { flex: 1 },
  placeName: {
    color: "#1C1B1B",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    writingDirection: "rtl",
  },
  placeAddress: {
    color: "#66727E",
    fontSize: 11,
    marginTop: 3,
    textAlign: "right",
    writingDirection: "rtl",
  },
  placePhone: {
    color: "#75818E",
    fontSize: 10,
    marginTop: 3,
    textAlign: "right",
  },
  placeNote: {
    backgroundColor: "#F4F8FB",
    borderRadius: 6,
    color: "#58616B",
    fontSize: 10,
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  captainDetail: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: 10,
    marginTop: 12,
  },
  captainDetailAvatar: {
    alignItems: "center",
    backgroundColor: "#E7EDF2",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  timeline: { gap: 12, marginTop: 14 },
  timelineRow: { flexDirection: "row-reverse", gap: 10 },
  timelineDot: {
    borderColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 4,
    height: 20,
    marginTop: 1,
    width: 20,
  },
  timelineText: { flex: 1 },
  emptyInline: {
    color: "#58616B",
    fontSize: 12,
    marginTop: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
  loadingLine: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: 7,
    justifyContent: "center",
    minHeight: 70,
  },
  loadingLineText: {
    color: "#0060B8",
    fontSize: 12,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  detailError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    padding: 10,
  },
  detailErrorText: {
    color: "#BA1A1A",
    fontSize: 12,
    lineHeight: 19,
    textAlign: "right",
    writingDirection: "rtl",
  },
  detailRetry: {
    alignSelf: "flex-end",
    borderColor: "#FECACA",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  detailRetryText: {
    color: "#BA1A1A",
    fontSize: 11,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  actionsRow: { flexDirection: "row-reverse", gap: 8 },
  assignAction: {
    alignItems: "center",
    backgroundColor: "#EEF6FF",
    borderColor: "#A8C8FF",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row-reverse",
    gap: 6,
    height: 44,
    justifyContent: "center",
  },
  assignActionText: {
    color: "#0060B8",
    fontSize: 12,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  cancelAction: {
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row-reverse",
    gap: 6,
    height: 44,
    justifyContent: "center",
  },
  cancelActionText: {
    color: "#BA1A1A",
    fontSize: 12,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  inlineModal: {
    backgroundColor: "#FFFFFF",
    borderColor: "#CFE1F0",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  inlineModalTitle: {
    color: "#1C1B1B",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
    writingDirection: "rtl",
  },
  inlineModalDescription: {
    color: "#58616B",
    fontSize: 11,
    lineHeight: 18,
    marginTop: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  captainChoice: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#DBE7F2",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  captainChoiceSelected: { backgroundColor: "#EAF4FF", borderColor: "#0060B8" },
  captainChoiceText: {
    color: "#1C1B1B",
    fontSize: 13,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  captainChoiceTextSelected: { color: "#0060B8" },
  availableSmallDot: {
    backgroundColor: "#10B981",
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  confirmAssign: {
    alignItems: "center",
    backgroundColor: "#0060B8",
    borderRadius: 11,
    height: 44,
    justifyContent: "center",
    marginTop: 12,
  },
  confirmAssignText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    writingDirection: "rtl",
  },
  reasonInput: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1DCE6",
    borderRadius: 12,
    borderWidth: 1,
    color: "#1C1B1B",
    fontSize: 14,
    minHeight: 96,
    padding: 10,
    textAlignVertical: "top",
    writingDirection: "rtl",
    marginTop: 12,
  },
  confirmCancel: {
    alignItems: "center",
    backgroundColor: "#BA1A1A",
    borderRadius: 11,
    height: 44,
    justifyContent: "center",
    marginTop: 12,
  },
  confirmCancelText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    writingDirection: "rtl",
  },
});
