import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  Package,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  UserPlus,
  WalletCards,
  XCircle,
} from "lucide-react-native";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import {
  useNativeActivityLogs,
  type ActivityLogCategory,
  type ActivityLogIcon,
  type ActivityLogTone,
  type NativeActivityLog,
} from "@/features/admin/use-native-activity-logs";
import { goBackOrReplace } from "@/lib/navigation/go-back-or-replace";

const BLUE = "#0878D1";
const DEEP_BLUE = "#063B78";

type Filter = "all" | ActivityLogCategory;

type ActivityTone = {
  accent: string;
  background: string;
  chip: string;
};

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "orders", label: "الطلبات" },
  { id: "users", label: "المستخدمون" },
  { id: "captains", label: "الكباتن" },
  { id: "system", label: "النظام" },
];

const tones: Record<ActivityLogTone, ActivityTone> = {
  blue: { accent: BLUE, background: "#EAF5FF", chip: "#EEF8FF" },
  green: { accent: "#047857", background: "#E7F8F0", chip: "#EDFBF4" },
  red: { accent: "#BA1A1A", background: "#FDEBEC", chip: "#FFF4F4" },
  violet: { accent: "#6D4CC2", background: "#F0EBFF", chip: "#F7F4FF" },
  slate: { accent: "#547286", background: "#EEF4F8", chip: "#F4F8FB" },
};

const activityIcons: Record<ActivityLogIcon, typeof Package> = {
  package: Package,
  "user-plus": UserPlus,
  check: CheckCircle2,
  trash: Trash2,
  truck: Truck,
  shield: ShieldCheck,
  wallet: WalletCards,
  cancel: XCircle,
  clipboard: ClipboardList,
};

export default function ActivityLogsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const data = useNativeActivityLogs();

  const activities = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return data.activities.filter(
      (item) =>
        (filter === "all" || item.category === filter) &&
        (!normalized ||
          `${item.action} ${item.subject} ${item.actor} ${item.details}`
            .toLocaleLowerCase()
            .includes(normalized)),
    );
  }, [data.activities, filter, query]);

  return (
    <ScreenContainer
      safeBottom
      className="bg-[#F4F7FB]"
      containerClassName="bg-[#F4F7FB]"
    >
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "العودة",
          icon: "arrow-forward",
          onPress: () => goBackOrReplace(router),
        }}
        trailingAction={{ accessibilityLabel: "سجل الحركات", icon: "assignment" }}
      />

      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ActivityRow item={item} />}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <ActivityLogHeader
            filter={filter}
            onFilterChange={setFilter}
            onQueryChange={setQuery}
            query={query}
            error={data.error}
            onRetry={() => void data.reload()}
            visibleCount={activities.length}
          />
        }
        ListEmptyComponent={
          data.isInitialLoading ? (
            <LoadingState />
          ) : (
            <EmptyState hasSearch={Boolean(query.trim()) || filter !== "all"} />
          )
        }
        ListFooterComponent={
          !data.isInitialLoading && !data.error ? (
            <Pagination
              hasNextPage={data.hasNextPage}
              hasPreviousPage={data.hasPreviousPage}
              pageNumber={data.pageNumber}
              onNext={() => void data.nextPage()}
              onPrevious={() => void data.previousPage()}
            />
          ) : null
        }
      />
    </ScreenContainer>
  );
}

function ActivityLogHeader({
  filter,
  onFilterChange,
  onQueryChange,
  query,
  error,
  onRetry,
  visibleCount,
}: {
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
  onQueryChange: (query: string) => void;
  query: string;
  error: string | null;
  onRetry: () => void;
  visibleCount: number;
}) {
  return (
    <View style={styles.headerContent}>
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>سجل تشغيلي</Text>
          </View>
          <View style={styles.heroIcon}>
            <Clock3 size={20} color={BLUE} />
          </View>
        </View>
        <Text style={styles.heroTitle}>سجل الحركات</Text>
        <Text style={styles.heroSubtitle}>
          راقب تغييرات الطلبات والحسابات والتشغيل بترتيب واضح.
        </Text>
      </View>

      <View style={styles.searchBox}>
        <Search size={18} color="#5D8198" />
        <TextInput
          accessibilityLabel="البحث في سجل الحركات"
          onChangeText={onQueryChange}
          placeholder="ابحث باسم، طلب، أو حركة"
          placeholderTextColor="#8EA4B3"
          returnKeyType="search"
          style={styles.searchInput}
          textAlign="right"
          value={query}
        />
      </View>

      {error ? <ErrorState message={error} onRetry={onRetry} /> : null}

      <View style={styles.filterSection}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>نوع الحركة</Text>
          <Text style={styles.countPill}>{visibleCount} حركة</Text>
        </View>
        <View style={styles.filterGrid}>
          {filters.map((item) => {
            const selected = filter === item.id;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={item.id}
                onPress={() => onFilterChange(item.id)}
                style={({ pressed }) => [
                  styles.filterButton,
                  selected && styles.filterButtonActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    selected && styles.filterButtonTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.activitySectionHeading}>
        <View>
          <Text style={styles.overline}>التسلسل الأخير</Text>
          <Text style={styles.activitySectionTitle}>آخر الحركات</Text>
        </View>
        <View style={styles.timelineHint}>
          <View style={styles.timelineHintDot} />
          <Text style={styles.timelineHintText}>الأحدث أولًا</Text>
        </View>
      </View>
    </View>
  );
}

function ActivityRow({ item }: { item: NativeActivityLog }) {
  const Icon = activityIcons[item.icon];
  const tone = tones[item.tone];

  return (
    <View style={styles.activityRowWrap}>
      <View style={[styles.timelineLine, { backgroundColor: tone.background }]} />
      <View style={[styles.iconWrap, { backgroundColor: tone.background }]}>
        <Icon size={18} color={tone.accent} strokeWidth={2.35} />
      </View>
      <View style={styles.activityCard}>
        <View style={[styles.activityAccent, { backgroundColor: tone.accent }]} />
        <View style={styles.activityTopRow}>
          <View style={[styles.timePill, { backgroundColor: tone.chip }]}>
            <Clock3 size={12} color={tone.accent} />
            <Text style={[styles.timeText, { color: tone.accent }]}>{item.time}</Text>
          </View>
          <Text style={styles.actionText}>{item.action}</Text>
        </View>
        <Text style={[styles.subjectText, { color: tone.accent }]} numberOfLines={2}>
          {item.subject}
        </Text>
        <Text style={styles.detailsText} numberOfLines={2}>
          {item.details}
        </Text>
        <View style={[styles.actorRow, { backgroundColor: tone.chip }]}>
          <View style={[styles.actorAvatar, { backgroundColor: tone.background }]}>
            <Text style={[styles.actorInitial, { color: tone.accent }]}>
              {item.actor.trim().charAt(0) || "ن"}
            </Text>
          </View>
          <Text style={styles.actorText} numberOfLines={1}>
            بواسطة {item.actor}
          </Text>
        </View>
      </View>
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.stateCard}>
      <View style={styles.stateIcon}>
        <ActivityIndicator color={BLUE} />
      </View>
      <Text style={styles.stateTitle}>جارٍ تحميل سجل الحركات</Text>
      <Text style={styles.stateText}>نجلب آخر التحديثات التشغيلية.</Text>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={[styles.stateCard, styles.errorCard]}>
      <View style={[styles.stateIcon, styles.errorIcon]}>
        <XCircle size={22} color="#BA1A1A" />
      </View>
      <Text style={[styles.stateTitle, styles.errorTitle]}>تعذر تحميل السجل</Text>
      <Text style={styles.stateText}>{message}</Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
      >
        <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
      </Pressable>
    </View>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <View style={styles.stateCard}>
      <View style={styles.stateIcon}>
        <ClipboardList size={23} color="#5D8198" />
      </View>
      <Text style={styles.stateTitle}>
        {hasSearch ? "لا توجد حركات مطابقة" : "لا توجد حركات مسجلة بعد"}
      </Text>
      <Text style={styles.stateText}>
        {hasSearch
          ? "غيّر كلمات البحث أو نوع الحركة ثم حاول مجددًا."
          : "ستظهر عمليات التطبيق هنا عند تنفيذها."}
      </Text>
    </View>
  );
}

function Pagination({
  hasNextPage,
  hasPreviousPage,
  pageNumber,
  onNext,
  onPrevious,
}: {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  pageNumber: number;
  onNext: () => void;
  onPrevious: () => void;
}) {
  if (!hasNextPage && !hasPreviousPage) return null;

  return (
    <View style={styles.pagination}>
      <Pressable
        accessibilityLabel="الصفحة التالية"
        disabled={!hasNextPage}
        onPress={onNext}
        style={({ pressed }) => [
          styles.nextButton,
          !hasNextPage && styles.disabled,
          pressed && hasNextPage && styles.pressed,
        ]}
      >
        <Text style={styles.nextButtonText}>الأقدم</Text>
      </Pressable>
      <Text style={styles.pageLabel}>صفحة {pageNumber}</Text>
      <Pressable
        accessibilityLabel="الصفحة السابقة"
        disabled={!hasPreviousPage}
        onPress={onPrevious}
        style={({ pressed }) => [
          styles.previousButton,
          !hasPreviousPage && styles.disabled,
          pressed && hasPreviousPage && styles.pressed,
        ]}
      >
        <Text style={styles.previousButtonText}>الأحدث</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: 16, paddingTop: 12 },
  headerContent: { gap: 14, paddingBottom: 14 },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D9EAF5",
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
  },
  heroTopRow: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  livePill: {
    alignItems: "center",
    backgroundColor: "#EAF8FF",
    borderColor: "#C1EAF7",
    borderRadius: 99,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  liveDot: { backgroundColor: "#16A879", borderRadius: 4, height: 8, width: 8 },
  liveText: {
    color: "#24705C",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    writingDirection: "rtl",
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "#EAF5FF",
    borderRadius: 13,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  heroTitle: {
    color: DEEP_BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 19,
    marginTop: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
  heroSubtitle: {
    color: "#5A7487",
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    lineHeight: 19,
    marginTop: 3,
    textAlign: "right",
    writingDirection: "rtl",
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#CBDFEC",
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 9,
    minHeight: 48,
    paddingHorizontal: 13,
  },
  searchInput: {
    color: "#163E5C",
    flex: 1,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 12,
    minWidth: 0,
    paddingVertical: 9,
    writingDirection: "rtl",
  },
  filterSection: { gap: 8 },
  sectionRow: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#355D78",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    writingDirection: "rtl",
  },
  countPill: {
    backgroundColor: "#E7F5FE",
    borderRadius: 99,
    color: BLUE,
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 4,
    writingDirection: "rtl",
  },
  filterGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  filterButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D6E5EF",
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 12,
  },
  filterButtonActive: { backgroundColor: DEEP_BLUE, borderColor: DEEP_BLUE },
  filterButtonText: {
    color: "#5A7487",
    fontFamily: "Cairo_700Bold",
    fontSize: 10,
    writingDirection: "rtl",
  },
  filterButtonTextActive: { color: "#FFFFFF" },
  activitySectionHeading: {
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 4,
  },
  overline: {
    color: "#6A91AB",
    fontFamily: "Cairo_700Bold",
    fontSize: 9,
    letterSpacing: 0.2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  activitySectionTitle: {
    color: "#163E5C",
    fontFamily: "Cairo_700Bold",
    fontSize: 15,
    marginTop: -1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  timelineHint: { alignItems: "center", flexDirection: "row-reverse", gap: 5 },
  timelineHintDot: { backgroundColor: "#16CEFF", borderRadius: 3, height: 6, width: 6 },
  timelineHintText: {
    color: "#718A9B",
    fontFamily: "Cairo_600SemiBold",
    fontSize: 9,
    writingDirection: "rtl",
  },
  activityRowWrap: { flexDirection: "row-reverse", paddingBottom: 10, position: "relative" },
  timelineLine: {
    bottom: -1,
    position: "absolute",
    right: 19,
    top: 39,
    width: 2,
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: 15,
    height: 38,
    justifyContent: "center",
    marginLeft: 9,
    marginTop: 10,
    width: 38,
  },
  activityCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DCE9F1",
    borderRadius: 17,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    padding: 13,
  },
  activityAccent: { bottom: 0, position: "absolute", right: 0, top: 0, width: 3 },
  activityTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  timePill: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 4,
    maxWidth: "49%",
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  timeText: {
    flexShrink: 1,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 8,
    writingDirection: "rtl",
  },
  actionText: {
    color: "#163E5C",
    flex: 1,
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    minWidth: 0,
    textAlign: "right",
    writingDirection: "rtl",
  },
  subjectText: {
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    lineHeight: 19,
    marginTop: 7,
    textAlign: "right",
    writingDirection: "rtl",
  },
  detailsText: {
    color: "#657F91",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    lineHeight: 17,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  actorRow: {
    alignItems: "center",
    alignSelf: "flex-end",
    borderRadius: 9,
    flexDirection: "row-reverse",
    gap: 5,
    marginTop: 9,
    maxWidth: "100%",
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  actorAvatar: { alignItems: "center", borderRadius: 8, height: 17, justifyContent: "center", width: 17 },
  actorInitial: { fontFamily: "Cairo_700Bold", fontSize: 8, writingDirection: "rtl" },
  actorText: {
    color: "#516F82",
    flexShrink: 1,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 9,
    textAlign: "right",
    writingDirection: "rtl",
  },
  stateCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D6E5EF",
    borderRadius: 18,
    borderStyle: "dashed",
    borderWidth: 1,
    marginTop: 2,
    padding: 22,
  },
  stateIcon: {
    alignItems: "center",
    backgroundColor: "#EAF5FF",
    borderRadius: 14,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  stateTitle: {
    color: "#244C68",
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    marginTop: 9,
    textAlign: "center",
    writingDirection: "rtl",
  },
  stateText: {
    color: "#718A9B",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    lineHeight: 17,
    marginTop: 3,
    textAlign: "center",
    writingDirection: "rtl",
  },
  errorCard: { borderColor: "#F0C5C5" },
  errorIcon: { backgroundColor: "#FDEBEC" },
  errorTitle: { color: "#9F2830" },
  retryButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#F0C5C5",
    borderRadius: 9,
    borderWidth: 1,
    marginTop: 12,
    minHeight: 36,
    paddingHorizontal: 13,
    justifyContent: "center",
  },
  retryButtonText: { color: "#BA1A1A", fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" },
  pagination: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#DCE9F1",
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 8,
    justifyContent: "space-between",
    marginTop: 4,
    padding: 8,
  },
  nextButton: {
    alignItems: "center",
    backgroundColor: DEEP_BLUE,
    borderRadius: 10,
    flex: 1,
    justifyContent: "center",
    minHeight: 38,
  },
  nextButtonText: { color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" },
  previousButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#C9DCE8",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 38,
  },
  previousButtonText: { color: BLUE, fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" },
  pageLabel: { color: "#607D91", fontFamily: "Cairo_700Bold", fontSize: 9, writingDirection: "rtl" },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
