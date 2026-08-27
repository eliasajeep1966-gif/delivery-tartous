import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";

import { goBackOrReplace } from "@/lib/navigation/go-back-or-replace";
import { useMemo, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { useAppToast } from "@/contexts/app-toast-context";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import { useAdminCaptainsData } from "@/features/admin/use-admin-captains";

const filters = [
  { id: "all", label: "الكل" },
  { id: "held", label: "مع الكابتن" },
  { id: "returned", label: "تم الاستلام" },
] as const;
type CustodyFilter = (typeof filters)[number]["id"];

type CustodyRow = ReturnType<
  typeof useAdminCaptainsData
>["captains"][number]["custodyRecords"][number] & {
  captainName: string;
  captainInitial: string;
};

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

function formatCompactDate(value: string) {
  if (!value) return "غير محدد";
  return new Intl.DateTimeFormat("ar-SY", {
    timeZone: "Asia/Damascus",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminCustodyScreen() {
  const router = useRouter();
  const { profile } = useDeliveryAuth();
  const { showToast } = useAppToast();
  const data = useAdminCaptainsData();
  const [filter, setFilter] = useState<CustodyFilter>("all");
  const [returningId, setReturningId] = useState<string | null>(null);

  const rows = useMemo<CustodyRow[]>(
    () =>
      data.captains
        .flatMap((captain) =>
          captain.custodyRecords.map((record) => ({
            ...record,
            captainName: captain.name,
            captainInitial: captain.initial,
          })),
        )
        .filter(
          (record) =>
            filter === "all" ||
            (filter === "held" && record.returnedAt === null) ||
            (filter === "returned" && record.returnedAt !== null),
        ),
    [data.captains, filter],
  );
  const heldCount = useMemo(
    () =>
      data.captains.reduce(
        (count, captain) =>
          count + captain.custodyRecords.filter((record) => !record.returnedAt).length,
        0,
      ),
    [data.captains],
  );

  const handleReturn = async (record: CustodyRow) => {
    if (returningId) return;
    setReturningId(record.id);
    try {
      await data.returnCustody(record.id);
      showToast({ message: `تم تسجيل استلام الأمانة من ${record.captainName}.` });
    } catch (cause) {
      showToast({
        message: cause instanceof Error ? cause.message : "تعذر تسجيل الاستلام. أعد المحاولة.",
        tone: "error",
        durationMs: 5000,
      });
    } finally {
      setReturningId(null);
    }
  };

  if (profile?.role !== "admin" && profile?.role !== "supervisor") {
    return (
      <ScreenContainer className="items-center justify-center bg-[#F4F7FB] p-5" containerClassName="bg-[#F4F7FB]">
        <Text style={styles.deniedText}>هذه الشاشة مخصصة للأدمن والمشرف.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer safeBottom className="bg-[#F4F7FB]" containerClassName="bg-[#F4F7FB]">
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "العودة",
          icon: "arrow-forward",
          onPress: () => goBackOrReplace(router),
        }}
        trailingAction={{ accessibilityLabel: "إدارة الأمانات", icon: "inventory-2" }}
      />
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={data.isRefreshing}
            onRefresh={() => void data.reload(true)}
            tintColor="#0878D1"
          />
        }
      >
        <LinearGradient
          colors={["#EEF7FF", "#FFFFFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroPill}>
              <View style={styles.heroDot} />
              <Text style={styles.heroPillText}>سجل متابعة</Text>
            </View>
            <Text style={styles.heroDate}>الأمانات</Text>
          </View>
          <Text style={styles.heroTitle}>أمانات الكباتن</Text>
          <Text style={styles.heroSubtitle}>تابع الأمانات المسجلة وسجّل استلامها من الكابتن.</Text>
          <View style={styles.filterPicker}>
            {filters.map((item) => {
              const selected = filter === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setFilter(item.id)}
                  style={({ pressed }) => [
                    styles.filterChoice,
                    selected && styles.filterChoiceSelected,
                    pressed && styles.smallPressed,
                  ]}
                >
                  <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </LinearGradient>

        {data.error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{data.error}</Text>
            <Pressable onPress={() => void data.reload()} style={({ pressed }) => [styles.retryButton, pressed && styles.smallPressed]}>
              <MaterialIcons name="refresh" size={16} color="#0878D1" />
              <Text style={styles.retryText}>إعادة المحاولة</Text>
            </Pressable>
          </View>
        ) : null}

        <SectionHeading overline="لقطة تشغيلية" title="حالة الأمانات" />
        <View style={styles.metricGrid}>
          <MetricCard
            icon="assignment-late"
            label="لدى الكباتن"
            value={String(heldCount)}
            highlighted
          />
          <MetricCard
            icon="inventory-2"
            label="السجلات المعروضة"
            value={data.isLoading ? "..." : String(rows.length)}
          />
        </View>

        <SectionHeading overline="السجل الحالي" title="الأمانات المسجلة" />
        {data.isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="#0878D1" />
            <Text style={styles.loadingText}>جارٍ تحميل الأمانات...</Text>
          </View>
        ) : rows.length ? (
          rows.map((record) => (
            <CustodyActivityRow
              key={record.id}
              record={record}
              isReturning={returningId === record.id}
              blocked={Boolean(returningId)}
              onConfirm={() => void handleReturn(record)}
            />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="inventory-2" size={22} color="#6D9BB9" />
            </View>
            <Text style={styles.emptyTitle}>لا توجد أمانات مطابقة</Text>
            <Text style={styles.emptyText}>ستظهر هنا الأمانات المسجلة بحسب الفلتر المختار.</Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function SectionHeading({ overline, title }: { overline: string; title: string }) {
  return (
    <View style={styles.sectionHeading}>
      <View>
        <Text style={styles.overline}>{overline}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
    </View>
  );
}

function MetricCard({
  icon,
  label,
  value,
  highlighted = false,
}: {
  icon: ComponentProps<typeof MaterialIcons>["name"];
  label: string;
  value: string;
  highlighted?: boolean;
}) {
  return (
    <View style={[styles.metricCard, highlighted && styles.metricCardHighlight]}>
      <View style={styles.metricTop}>
        <View style={[styles.metricIcon, highlighted && styles.metricIconHighlight]}>
          <MaterialIcons name={icon} size={19} color={highlighted ? "#FFFFFF" : "#126FA7"} />
        </View>
      </View>
      <Text style={[styles.metricValue, highlighted && styles.metricValueHighlight]}>{value}</Text>
      <Text style={[styles.metricLabel, highlighted && styles.metricLabelHighlight]}>{label}</Text>
    </View>
  );
}

function CustodyActivityRow({
  record,
  isReturning,
  blocked,
  onConfirm,
}: {
  record: CustodyRow;
  isReturning: boolean;
  blocked: boolean;
  onConfirm: () => void;
}) {
  const held = record.returnedAt === null;
  return (
    <View style={styles.activityCard}>
      <View style={[styles.activityAccent, held ? styles.heldAccent : styles.returnedAccent]} />
      <View style={[styles.activityIcon, held ? styles.heldIcon : styles.returnedIcon]}>
        <Text style={[styles.avatarText, held ? styles.heldAvatarText : styles.returnedAvatarText]}>
          {record.captainInitial}
        </Text>
      </View>
      <View style={styles.activityContent}>
        <View style={styles.activityTop}>
          <Text numberOfLines={1} style={styles.activityTitle}>{record.itemName}</Text>
          <View style={[styles.statusBadge, held ? styles.heldBadge : styles.returnedBadge]}>
            <Text style={[styles.statusText, held ? styles.heldStatusText : styles.returnedStatusText]}>
              {held ? "لدى الكابتن" : "مستلمة"}
            </Text>
          </View>
        </View>
        <Text numberOfLines={1} style={styles.activitySubtitle}>
          {record.captainName} · {held ? `سُلّمت ${formatCompactDate(record.assignedAt)}` : `استُلمت ${formatCompactDate(record.returnedAt ?? "")}`}
        </Text>
        {record.itemDetails ? <Text numberOfLines={1} style={styles.activityDetails}>{record.itemDetails}</Text> : null}
        {held ? (
          <Pressable
            disabled={blocked}
            onPress={onConfirm}
            style={({ pressed }) => [styles.confirmButton, pressed && !blocked && styles.confirmPressed]}
          >
            {isReturning ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialIcons name="assignment-return" size={15} color="#FFFFFF" />
            )}
            <Text style={styles.confirmText}>{isReturning ? "جارٍ التسجيل..." : "تأكيد الاستلام"}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: 34, paddingHorizontal: 16, paddingTop: 12 },
  deniedText: { color: "#173B59", fontSize: 16, fontWeight: "700", textAlign: "center", writingDirection: "rtl" },
  heroCard: { borderColor: "#D8EBF7", borderRadius: 24, borderWidth: 1, marginBottom: 18, overflow: "hidden", padding: 17, shadowColor: "#0C679D", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 14 },
  heroTopRow: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  heroPill: { alignItems: "center", backgroundColor: "#E4F8EE", borderRadius: 12, flexDirection: "row-reverse", gap: 5, paddingHorizontal: 9, paddingVertical: 5 },
  heroDot: { backgroundColor: "#19A778", borderRadius: 4, height: 7, width: 7 },
  heroPillText: { color: "#08745A", fontSize: 10, fontWeight: "800", writingDirection: "rtl" },
  heroDate: { color: "#6E90A6", fontSize: 11, fontWeight: "700", writingDirection: "rtl" },
  heroTitle: { color: "#123D60", fontSize: 21, fontWeight: "800", marginTop: 17, textAlign: "right", writingDirection: "rtl" },
  heroSubtitle: { color: "#608098", fontSize: 12, lineHeight: 20, marginTop: 5, textAlign: "right", writingDirection: "rtl" },
  filterPicker: { backgroundColor: "rgba(227,240,248,0.8)", borderRadius: 14, flexDirection: "row-reverse", gap: 5, marginTop: 15, padding: 4 },
  filterChoice: { alignItems: "center", borderRadius: 10, flex: 1, justifyContent: "center", minHeight: 32 },
  filterChoiceSelected: { backgroundColor: "#FFFFFF", shadowColor: "#0C679D", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5 },
  filterText: { color: "#718C9F", fontSize: 10, fontWeight: "700", writingDirection: "rtl" },
  filterTextSelected: { color: "#0878D1", fontWeight: "800" },
  sectionHeading: { alignItems: "flex-end", flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 11, marginTop: 6 },
  overline: { color: "#7B9AAC", fontSize: 10, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  sectionTitle: { color: "#163E5C", fontSize: 17, fontWeight: "800", marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  metricGrid: { flexDirection: "row-reverse", gap: 8, marginBottom: 17 },
  metricCard: { backgroundColor: "#FFFFFF", borderColor: "#E6EEF4", borderRadius: 16, borderWidth: 1, flex: 1, minHeight: 90, overflow: "hidden", padding: 11, shadowColor: "#113D5B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.055, shadowRadius: 9 },
  metricCardHighlight: { backgroundColor: "#0878D1", borderColor: "#0878D1", shadowColor: "#0878D1", shadowOpacity: 0.2, shadowRadius: 13 },
  metricTop: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  metricIcon: { alignItems: "center", backgroundColor: "#EAF5FC", borderRadius: 10, height: 29, justifyContent: "center", width: 29 },
  metricIconHighlight: { backgroundColor: "rgba(255,255,255,0.16)" },
  metricValue: { color: "#164C70", fontSize: 22, fontWeight: "800", marginTop: 8, textAlign: "right", writingDirection: "rtl" },
  metricValueHighlight: { color: "#FFFFFF" },
  metricLabel: { color: "#6A879A", fontSize: 10, fontWeight: "700", marginTop: 1, textAlign: "right", writingDirection: "rtl" },
  metricLabelHighlight: { color: "rgba(255,255,255,0.82)" },
  activityCard: { alignItems: "flex-start", backgroundColor: "#FFFFFF", borderColor: "#E4EDF3", borderRadius: 18, borderWidth: 1, flexDirection: "row-reverse", gap: 10, marginBottom: 9, minHeight: 86, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 11, shadowColor: "#113D5B", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.045, shadowRadius: 8 },
  activityAccent: { bottom: 0, position: "absolute", right: 0, top: 0, width: 4 },
  heldAccent: { backgroundColor: "#4F90BB" },
  returnedAccent: { backgroundColor: "#16B384" },
  activityIcon: { alignItems: "center", borderRadius: 11, height: 35, justifyContent: "center", width: 35 },
  heldIcon: { backgroundColor: "#EAF5FC" },
  returnedIcon: { backgroundColor: "#E8F8F2" },
  avatarText: { fontSize: 13, fontWeight: "800" },
  heldAvatarText: { color: "#287AAC" },
  returnedAvatarText: { color: "#08755C" },
  activityContent: { flex: 1 },
  activityTop: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  activityTitle: { color: "#193F5B", flex: 1, fontSize: 13, fontWeight: "800", marginLeft: 8, textAlign: "right", writingDirection: "rtl" },
  activitySubtitle: { color: "#7894A7", fontSize: 10, marginTop: 4, textAlign: "right", writingDirection: "rtl" },
  activityDetails: { color: "#9AAEBB", fontSize: 9, marginTop: 2, textAlign: "right", writingDirection: "rtl" },
  statusBadge: { borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3 },
  heldBadge: { backgroundColor: "#EAF4FF" },
  returnedBadge: { backgroundColor: "#EAF9F3" },
  statusText: { fontSize: 9, fontWeight: "800", writingDirection: "rtl" },
  heldStatusText: { color: "#287AAC" },
  returnedStatusText: { color: "#08755C" },
  confirmButton: { alignItems: "center", alignSelf: "flex-end", backgroundColor: "#0878D1", borderRadius: 10, flexDirection: "row-reverse", gap: 5, marginTop: 8, minHeight: 31, paddingHorizontal: 10 },
  confirmText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800", writingDirection: "rtl" },
  confirmPressed: { opacity: 0.88, transform: [{ scale: 0.975 }] },
  loadingCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DBE7F2", borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 36 },
  loadingText: { color: "#75818E", fontSize: 12, marginTop: 8, writingDirection: "rtl" },
  errorCard: { alignItems: "center", backgroundColor: "#FFF5F5", borderColor: "#F6D5D8", borderRadius: 16, borderWidth: 1, marginBottom: 12, padding: 14 },
  errorText: { color: "#9C343D", fontSize: 12, fontWeight: "700", textAlign: "center", writingDirection: "rtl" },
  retryButton: { alignItems: "center", flexDirection: "row-reverse", gap: 4, marginTop: 9 },
  retryText: { color: "#0878D1", fontSize: 11, fontWeight: "800", writingDirection: "rtl" },
  emptyCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#C7DAE8", borderRadius: 16, borderStyle: "dashed", borderWidth: 1, paddingHorizontal: 16, paddingVertical: 32 },
  emptyIcon: { alignItems: "center", backgroundColor: "#EEF6FB", borderRadius: 13, height: 42, justifyContent: "center", width: 42 },
  emptyTitle: { color: "#365B75", fontSize: 13, fontWeight: "800", marginTop: 9, writingDirection: "rtl" },
  emptyText: { color: "#7894A7", fontSize: 10, marginTop: 3, textAlign: "center", writingDirection: "rtl" },
  smallPressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
});
