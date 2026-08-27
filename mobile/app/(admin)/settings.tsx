import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { DeliveryAppHeader } from "@/components/ui/delivery-app-header";
import { MotionPressable } from "@/components/ui/motion-pressable";
import { useAppToast } from "@/contexts/app-toast-context";
import { useDeliveryAuth } from "@/contexts/delivery-auth-context";
import { useOfficeSettings } from "@/features/admin/use-office-settings";
import { presentOfficeSettingsError } from "@/lib/admin/office-settings-errors";
import { goBackOrReplace } from "@/lib/navigation/go-back-or-replace";

const BLUE = "#0060B8";
const DEEP_BLUE = "#173B54";
const DANGER = "#BA1A1A";

type OfficeProfile = {
  name: string;
  phone: string;
  address: string;
};

type OfficeFieldKey = keyof OfficeProfile;
type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

type Exception = {
  id: string;
  keyword: string;
  captain: string;
  office: string;
};

const defaultOffice: OfficeProfile = {
  name: "دليفري طرطوس",
  phone: "0933000000",
  address: "طرطوس — مركز المدينة",
};

const defaultExceptions: Exception[] = [
  { id: "default", keyword: "طلب سريع", captain: "75", office: "25" },
];

const validSplit = (captain: string, office: string) =>
  Number(captain) + Number(office) === 100 &&
  Number(captain) >= 0 &&
  Number(office) >= 0;

export default function OfficeSettingsScreen() {
  const router = useRouter();
  const { profile } = useDeliveryAuth();
  const { showToast } = useAppToast();
  const [officeDraft, setOfficeDraft] = useState<OfficeProfile | null>(null);
  const [editingField, setEditingField] = useState<OfficeFieldKey | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [captainShareDraft, setCaptainShareDraft] = useState<string | null>(null);
  const [officeShareDraft, setOfficeShareDraft] = useState<string | null>(null);
  const [exceptionsDraft, setExceptionsDraft] = useState<Exception[] | null>(null);
  const isBackOffice =
    profile?.role === "admin" || profile?.role === "supervisor";
  const officeSettings = useOfficeSettings(isBackOffice);
  const savedSettings = officeSettings.data;
  const office = officeDraft ?? {
    name: savedSettings?.name ?? defaultOffice.name,
    phone: savedSettings?.phone ?? defaultOffice.phone,
    address: savedSettings?.address ?? defaultOffice.address,
  };
  const captainShare = captainShareDraft ?? savedSettings?.captainShare ?? "70";
  const officeShare = officeShareDraft ?? savedSettings?.officeShare ?? "30";
  const exceptions = exceptionsDraft ?? savedSettings?.exceptions ?? defaultExceptions;
  const splitIsValid = validSplit(captainShare, officeShare);

  const updateOffice = (key: OfficeFieldKey, value: string) =>
    setOfficeDraft({ ...office, [key]: value });

  const replaceExceptions = (updater: (items: Exception[]) => Exception[]) =>
    setExceptionsDraft(updater(exceptions));

  const updateException = (
    id: string,
    key: "keyword" | "captain" | "office",
    value: string,
  ) =>
    replaceExceptions((items) =>
      items.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    );

  const saveEditedField = () => {
    if (!editingField) return;
    if (!editingValue.trim()) {
      showToast({ message: "لا يمكن ترك هذا الحقل فارغاً.", tone: "error" });
      return;
    }
    updateOffice(editingField, editingValue.trim());
    setEditingField(null);
    setEditingValue("");
  };

  const save = async () => {
    if (!splitIsValid) {
      showToast({
        message: "يجب أن يكون مجموع نسب التوزيع الأساسية 100%.",
        tone: "error",
      });
      return;
    }
    if (
      exceptions.some(
        (item) =>
          !item.keyword.trim() || !validSplit(item.captain, item.office),
      )
    ) {
      showToast({
        message: "أكمل نص كل استثناء ونسبه لتكون 100%.",
        tone: "error",
      });
      return;
    }
    try {
      await officeSettings.save({
        name: office.name,
        phone: office.phone,
        address: office.address,
        captainShare,
        officeShare,
        exceptions,
      });
      showToast({ message: "تم حفظ إعدادات المكتب بشكل دائم." });
    } catch (error) {
      showToast({
        message: presentOfficeSettingsError(error, "save"),
        tone: "error",
        durationMs: 5000,
      });
    }
  };

  if (!isBackOffice) {
    return (
      <ScreenContainer
        className="items-center justify-center bg-[#F0F7FF] p-5"
        containerClassName="bg-[#EAF5FF]"
      >
        <View style={styles.accessDenied}>
          <View style={styles.accessDeniedIcon}>
            <MaterialIcons name="lock-outline" size={24} color={DANGER} />
          </View>
          <Text style={styles.accessDeniedTitle}>لا تملك صلاحية الإعدادات</Text>
          <Text style={styles.accessDeniedText}>
            هذه الواجهة مخصصة للأدمن والمشرف فقط.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (officeSettings.isPending) {
    return (
      <ScreenContainer className="items-center justify-center bg-[#F0F7FF] p-5" containerClassName="bg-[#EAF5FF]">
        <View style={styles.loadingCard}>
          <MaterialIcons name="sync" size={23} color={BLUE} />
          <Text style={styles.loadingText}>جارٍ تحميل إعدادات المكتب...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (officeSettings.error) {
    return (
      <ScreenContainer className="items-center justify-center bg-[#F0F7FF] p-5" containerClassName="bg-[#EAF5FF]">
        <View style={styles.loadErrorCard}>
          <MaterialIcons name="sync-problem" size={24} color={DANGER} />
          <Text style={styles.loadErrorTitle}>تعذر تحميل إعدادات المكتب</Text>
          <Text style={styles.loadErrorText}>
            {presentOfficeSettingsError(officeSettings.error, "load")}
          </Text>
          <MotionPressable onPress={() => void officeSettings.refetch()} style={styles.retryLoadButton}>
            <MaterialIcons name="refresh" size={17} color="#FFFFFF" />
            <Text style={styles.retryLoadButtonText}>إعادة المحاولة</Text>
          </MotionPressable>
        </View>
      </ScreenContainer>
    );
  }

  const officeFields: {
    key: OfficeFieldKey;
    label: string;
    value: string;
    icon: IconName;
    keyboardType?: "default" | "phone-pad";
  }[] = [
    { key: "name", label: "اسم المكتب", value: office.name, icon: "business" },
    {
      key: "phone",
      label: "رقم المكتب",
      value: office.phone,
      icon: "phone-in-talk",
      keyboardType: "phone-pad",
    },
    { key: "address", label: "العنوان", value: office.address, icon: "location-on" },
  ];

  return (
    <ScreenContainer
      className="bg-[#F0F7FF]"
      containerClassName="bg-[#EAF5FF]"
    >
      <DeliveryAppHeader
        leadingAction={{
          accessibilityLabel: "العودة",
          icon: "arrow-forward",
          onPress: () => goBackOrReplace(router),
        }}
        trailingAction={{ accessibilityLabel: "إعدادات المكتب", icon: "business" }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="tune" size={25} color={BLUE} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>إدارة المكتب</Text>
            <Text style={styles.heroTitle}>إعدادات التشغيل</Text>
            <Text style={styles.heroText}>
              اضبط بيانات المكتب ونسب التوزيع من مكان واحد.
            </Text>
          </View>
        </View>

        <SectionHeader
          icon="business"
          title="بيانات المكتب"
          subtitle="بيانات أساسية تظهر ضمن تشغيل المكتب"
        />
        <View style={styles.card}>
          {officeFields.map((field, index) => (
            <OfficeInfoRow
              key={field.key}
              icon={field.icon}
              label={field.label}
              value={field.value}
              divider={index < officeFields.length - 1}
              onEdit={() => {
                setEditingField(field.key);
                setEditingValue(field.value);
              }}
            />
          ))}
        </View>

        <SectionHeader
          icon="pie-chart"
          title="نسب التوزيع الأساسية"
          subtitle="تطبق تلقائياً على كل طلب لا يطابق استثناءً خاصاً"
        />
        <View style={styles.card}>
          <View style={styles.shareRow}>
            <ShareInput
              label="حصة الكابتن"
              value={captainShare}
              onChangeText={setCaptainShareDraft}
              tone="captain"
            />
            <ShareInput
              label="حصة المكتب"
              value={officeShare}
              onChangeText={setOfficeShareDraft}
              tone="office"
            />
          </View>
          <View
            style={[
              styles.splitStatus,
              splitIsValid ? styles.splitStatusValid : styles.splitStatusInvalid,
            ]}
          >
            <MaterialIcons
              name={splitIsValid ? "check-circle" : "error-outline"}
              size={16}
              color={splitIsValid ? "#047857" : DANGER}
            />
            <Text
              style={[
                styles.splitStatusText,
                splitIsValid
                  ? styles.splitStatusTextValid
                  : styles.splitStatusTextInvalid,
              ]}
            >
              المجموع: {Number(captainShare || 0) + Number(officeShare || 0)}%
            </Text>
          </View>
        </View>

        <SectionHeader
          icon="tune"
          title="استثناءات التوزيع"
          subtitle="نسبة خاصة عند وجود كلمة أو عبارة ضمن ملاحظات الطلب"
          badge={`${exceptions.length}`}
        />
        <View style={styles.exceptionsCard}>
          {exceptions.map((item, index) => (
            <View key={item.id} style={styles.exceptionItem}>
              <View style={styles.exceptionTop}>
                <Pressable
                  accessibilityLabel={`حذف الاستثناء ${index + 1}`}
                  onPress={() =>
                    replaceExceptions((items) =>
                      items.filter((candidate) => candidate.id !== item.id),
                    )
                  }
                  style={({ pressed }) => [
                    styles.removeException,
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialIcons name="delete-outline" size={18} color={DANGER} />
                </Pressable>
                <View style={styles.exceptionTitleRow}>
                  <Text style={styles.exceptionTitle}>استثناء {index + 1}</Text>
                  <View style={styles.exceptionNumber}>
                    <Text style={styles.exceptionNumberText}>{index + 1}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.inputLabel}>الكلمة أو العبارة المطابقة</Text>
              <TextInput
                value={item.keyword}
                onChangeText={(value) => updateException(item.id, "keyword", value)}
                placeholder="مثال: طلب سريع"
                placeholderTextColor="#91A4B3"
                style={styles.textInput}
                textAlign="right"
              />
              <View style={styles.exceptionShares}>
                <CompactShareInput
                  label="الكابتن"
                  value={item.captain}
                  onChangeText={(value) => updateException(item.id, "captain", value)}
                  tone="captain"
                />
                <CompactShareInput
                  label="المكتب"
                  value={item.office}
                  onChangeText={(value) => updateException(item.id, "office", value)}
                  tone="office"
                />
              </View>
            </View>
          ))}
          <MotionPressable
            onPress={() =>
              replaceExceptions((items) => [
                ...items,
                {
                  id: String(Date.now()),
                  keyword: "",
                  captain: "",
                  office: "",
                },
              ])
            }
            style={styles.addException}
          >
            <MaterialIcons name="add-circle-outline" size={19} color={BLUE} />
            <Text style={styles.addExceptionText}>إضافة استثناء جديد</Text>
          </MotionPressable>
        </View>

        <MotionPressable
          disabled={officeSettings.isSaving}
          onPress={() => void save()}
          style={[styles.saveButton, officeSettings.isSaving && styles.saveButtonDisabled]}
        >
          <MaterialIcons name="save" size={20} color="#FFFFFF" />
          <Text style={styles.saveButtonText}>
            {officeSettings.isSaving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
          </Text>
        </MotionPressable>
        <Text style={styles.saveHint}>
          تُحفظ التغييرات في قاعدة البيانات وتبقى بعد إغلاق التطبيق.
        </Text>
      </ScrollView>
      <OfficeFieldEditModal
        field={officeFields.find((field) => field.key === editingField) ?? null}
        value={editingValue}
        onChangeText={setEditingValue}
        onClose={() => {
          setEditingField(null);
          setEditingValue("");
        }}
        onSave={saveEditedField}
      />
    </ScreenContainer>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  badge,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <MaterialIcons name={icon} size={19} color={BLUE} />
      </View>
      <View style={styles.sectionCopy}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {badge ? <Text style={styles.sectionBadge}>{badge}</Text> : null}
        </View>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function OfficeInfoRow({
  icon,
  label,
  value,
  onEdit,
  divider,
}: {
  icon: IconName;
  label: string;
  value: string;
  onEdit: () => void;
  divider: boolean;
}) {
  return (
    <View style={[styles.settingsField, divider && styles.fieldDivider]}>
      <View style={styles.fieldIcon}>
        <MaterialIcons name={icon} size={18} color="#4A87B5" />
      </View>
      <View style={styles.settingsFieldCopy}>
        <Text style={styles.inputLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.fieldValue}>{value || "—"}</Text>
      </View>
      <MotionPressable onPress={onEdit} style={styles.editFieldButton}>
        <MaterialIcons name="edit" size={15} color={BLUE} />
        <Text style={styles.editFieldButtonText}>تعديل</Text>
      </MotionPressable>
    </View>
  );
}

function OfficeFieldEditModal({
  field,
  value,
  onChangeText,
  onClose,
  onSave,
}: {
  field: {
    key: OfficeFieldKey;
    label: string;
    value: string;
    icon: IconName;
    keyboardType?: "default" | "phone-pad";
  } | null;
  value: string;
  onChangeText: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal
      visible={Boolean(field)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.editModalOverlay}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={styles.editModalCard}>
          <View style={styles.editModalIcon}>
            <MaterialIcons name={field?.icon ?? "edit"} size={23} color={BLUE} />
          </View>
          <Text style={styles.editModalTitle}>تعديل {field?.label}</Text>
          <Text style={styles.editModalDescription}>
            عدّل القيمة ثم اضغط حفظ التعديل.
          </Text>
          <TextInput
            autoFocus
            value={value}
            onChangeText={onChangeText}
            keyboardType={field?.keyboardType ?? "default"}
            placeholderTextColor="#91A4B3"
            style={styles.editModalInput}
            textAlign="right"
          />
          <View style={styles.editModalActions}>
            <MotionPressable onPress={onClose} style={styles.editModalCancel}>
              <Text style={styles.editModalCancelText}>تراجع</Text>
            </MotionPressable>
            <MotionPressable onPress={onSave} style={styles.editModalSave}>
              <MaterialIcons name="check" size={18} color="#FFFFFF" />
              <Text style={styles.editModalSaveText}>حفظ التعديل</Text>
            </MotionPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ShareInput({
  label,
  value,
  onChangeText,
  tone,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  tone: "captain" | "office";
}) {
  const captain = tone === "captain";
  return (
    <View style={[styles.shareInput, captain ? styles.captainShare : styles.officeShare]}>
      <View style={styles.shareLabelRow}>
        <MaterialIcons
          name={captain ? "two-wheeler" : "business"}
          size={16}
          color={captain ? "#047857" : BLUE}
        />
        <Text style={[styles.shareLabel, captain ? styles.captainText : styles.officeText]}>
          {label}
        </Text>
      </View>
      <View style={styles.shareValueRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          style={styles.shareValueInput}
          textAlign="center"
        />
        <Text style={[styles.percentSign, captain ? styles.captainText : styles.officeText]}>%</Text>
      </View>
    </View>
  );
}

function CompactShareInput({
  label,
  value,
  onChangeText,
  tone,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  tone: "captain" | "office";
}) {
  const captain = tone === "captain";
  return (
    <View style={styles.compactShare}>
      <Text style={[styles.compactShareLabel, captain ? styles.captainText : styles.officeText]}>
        {label}
      </Text>
      <View style={styles.compactShareInputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="#A1B0BA"
          style={styles.compactShareInput}
          textAlign="center"
        />
        <Text style={styles.compactPercent}>%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 13, padding: 18, paddingBottom: 38 },
  hero: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D7E7F2", borderRadius: 19, borderWidth: 1, flexDirection: "row-reverse", padding: 16, shadowColor: "#153C58", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 9 },
  heroIcon: { alignItems: "center", backgroundColor: "#EAF4FF", borderRadius: 16, height: 48, justifyContent: "center", marginLeft: 12, width: 48 },
  heroCopy: { flex: 1 },
  heroEyebrow: { color: BLUE, fontFamily: "Cairo_700Bold", fontSize: 10, textAlign: "right", writingDirection: "rtl" },
  heroTitle: { color: DEEP_BLUE, fontFamily: "Cairo_700Bold", fontSize: 17, marginTop: 1, textAlign: "right", writingDirection: "rtl" },
  heroText: { color: "#66727E", fontFamily: "Cairo_400Regular", fontSize: 10, marginTop: 3, textAlign: "right", writingDirection: "rtl" },
  sectionHeader: { alignItems: "center", flexDirection: "row-reverse", gap: 9, marginTop: 5 },
  sectionIcon: { alignItems: "center", backgroundColor: "#EAF4FF", borderRadius: 10, height: 35, justifyContent: "center", width: 35 },
  sectionCopy: { flex: 1 },
  sectionTitleRow: { alignItems: "center", flexDirection: "row-reverse", gap: 7 },
  sectionTitle: { color: "#1C1B1B", fontFamily: "Cairo_700Bold", fontSize: 14, writingDirection: "rtl" },
  sectionBadge: { backgroundColor: "#EAF4FF", borderRadius: 8, color: BLUE, fontFamily: "Cairo_700Bold", fontSize: 9, overflow: "hidden", paddingHorizontal: 7, paddingVertical: 2 },
  sectionSubtitle: { color: "#6A7C88", fontFamily: "Cairo_400Regular", fontSize: 10, marginTop: 1, textAlign: "right", writingDirection: "rtl" },
  card: { backgroundColor: "#FFFFFF", borderColor: "#D7E7F2", borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  settingsField: { alignItems: "center", flexDirection: "row-reverse", gap: 10, minHeight: 68, paddingHorizontal: 13, paddingVertical: 8 },
  fieldDivider: { borderBottomColor: "#E6EFF5", borderBottomWidth: 1 },
  fieldIcon: { alignItems: "center", backgroundColor: "#F2F8FC", borderRadius: 11, height: 38, justifyContent: "center", width: 38 },
  settingsFieldCopy: { flex: 1 },
  inputLabel: { color: "#547086", fontFamily: "Cairo_700Bold", fontSize: 10, textAlign: "right", writingDirection: "rtl" },
  fieldValue: { color: DEEP_BLUE, fontFamily: "Cairo_400Regular", fontSize: 12, marginTop: 1, textAlign: "right", writingDirection: "rtl" },
  editFieldButton: { alignItems: "center", backgroundColor: "#EAF4FF", borderRadius: 9, flexDirection: "row-reverse", gap: 3, justifyContent: "center", minHeight: 32, paddingHorizontal: 8 },
  editFieldButtonText: { color: BLUE, fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" },
  editModalOverlay: { ...StyleSheet.absoluteFill, alignItems: "center", backgroundColor: "rgba(20, 30, 38, 0.42)", justifyContent: "center", padding: 24 },
  editModalCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#CDE1F0", borderRadius: 20, borderWidth: 1, maxWidth: 400, padding: 22, width: "100%" },
  editModalIcon: { alignItems: "center", backgroundColor: "#EAF4FF", borderRadius: 24, height: 48, justifyContent: "center", width: 48 },
  editModalTitle: { color: DEEP_BLUE, fontFamily: "Cairo_700Bold", fontSize: 16, marginTop: 10, textAlign: "center", writingDirection: "rtl" },
  editModalDescription: { color: "#647782", fontFamily: "Cairo_400Regular", fontSize: 11, marginTop: 4, textAlign: "center", writingDirection: "rtl" },
  editModalInput: { alignSelf: "stretch", backgroundColor: "#F8FBFD", borderColor: "#C8DCEB", borderRadius: 11, borderWidth: 1, color: DEEP_BLUE, fontFamily: "Cairo_400Regular", fontSize: 13, height: 46, marginTop: 16, paddingHorizontal: 11 },
  editModalActions: { flexDirection: "row-reverse", gap: 9, marginTop: 17, width: "100%" },
  editModalCancel: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#C9D9E7", borderRadius: 11, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 43 },
  editModalCancelText: { color: "#536B7B", fontFamily: "Cairo_700Bold", fontSize: 11, writingDirection: "rtl" },
  editModalSave: { alignItems: "center", backgroundColor: BLUE, borderRadius: 11, flex: 1, flexDirection: "row-reverse", gap: 4, justifyContent: "center", minHeight: 43 },
  editModalSaveText: { color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 11, writingDirection: "rtl" },
  shareRow: { flexDirection: "row-reverse", gap: 10, padding: 12 },
  shareInput: { borderRadius: 14, flex: 1, padding: 12 },
  captainShare: { backgroundColor: "#ECFDF5", borderColor: "#B7E7D6", borderWidth: 1 },
  officeShare: { backgroundColor: "#EAF4FF", borderColor: "#BBD9F2", borderWidth: 1 },
  shareLabelRow: { alignItems: "center", flexDirection: "row-reverse", gap: 5, justifyContent: "flex-end" },
  shareLabel: { fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" },
  captainText: { color: "#047857" },
  officeText: { color: BLUE },
  shareValueRow: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, flexDirection: "row", justifyContent: "center", marginTop: 9, minHeight: 38 },
  shareValueInput: { color: DEEP_BLUE, fontFamily: "Cairo_700Bold", fontSize: 17, minWidth: 38, padding: 0 },
  percentSign: { fontFamily: "Cairo_700Bold", fontSize: 13, marginLeft: 1 },
  splitStatus: { alignItems: "center", borderTopWidth: 1, flexDirection: "row-reverse", gap: 5, justifyContent: "center", minHeight: 40 },
  splitStatusValid: { backgroundColor: "#F4FEF9", borderTopColor: "#D4F0E2" },
  splitStatusInvalid: { backgroundColor: "#FFF5F5", borderTopColor: "#F4D2D4" },
  splitStatusText: { fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" },
  splitStatusTextValid: { color: "#047857" },
  splitStatusTextInvalid: { color: DANGER },
  exceptionsCard: { backgroundColor: "#F6FBFF", borderColor: "#CAE1F1", borderRadius: 18, borderWidth: 1, gap: 10, padding: 10 },
  exceptionItem: { backgroundColor: "#FFFFFF", borderColor: "#D9E8F2", borderRadius: 14, borderWidth: 1, padding: 12 },
  exceptionTop: { alignItems: "center", flexDirection: "row-reverse", justifyContent: "space-between" },
  exceptionTitleRow: { alignItems: "center", flexDirection: "row-reverse", gap: 7 },
  exceptionTitle: { color: DEEP_BLUE, fontFamily: "Cairo_700Bold", fontSize: 12, writingDirection: "rtl" },
  exceptionNumber: { alignItems: "center", backgroundColor: "#EAF4FF", borderRadius: 9, height: 22, justifyContent: "center", width: 22 },
  exceptionNumberText: { color: BLUE, fontFamily: "Cairo_700Bold", fontSize: 10 },
  removeException: { alignItems: "center", backgroundColor: "#FFF2F2", borderRadius: 9, height: 31, justifyContent: "center", width: 31 },
  textInput: { backgroundColor: "#F8FBFD", borderColor: "#D8E5ED", borderRadius: 10, borderWidth: 1, color: DEEP_BLUE, fontFamily: "Cairo_400Regular", fontSize: 11, height: 40, marginTop: 5, paddingHorizontal: 10 },
  exceptionShares: { flexDirection: "row-reverse", gap: 8, marginTop: 10 },
  compactShare: { flex: 1 },
  compactShareLabel: { fontFamily: "Cairo_700Bold", fontSize: 10, textAlign: "right", writingDirection: "rtl" },
  compactShareInputWrap: { alignItems: "center", backgroundColor: "#F8FBFD", borderColor: "#D8E5ED", borderRadius: 9, borderWidth: 1, flexDirection: "row", height: 36, justifyContent: "center", marginTop: 4 },
  compactShareInput: { color: DEEP_BLUE, fontFamily: "Cairo_700Bold", fontSize: 13, minWidth: 32, padding: 0 },
  compactPercent: { color: "#708797", fontFamily: "Cairo_700Bold", fontSize: 10 },
  addException: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#9FC9E8", borderRadius: 12, borderStyle: "dashed", borderWidth: 1, flexDirection: "row-reverse", gap: 6, justifyContent: "center", minHeight: 43 },
  addExceptionText: { color: BLUE, fontFamily: "Cairo_700Bold", fontSize: 11, writingDirection: "rtl" },
  saveButton: { alignItems: "center", backgroundColor: BLUE, borderRadius: 14, flexDirection: "row-reverse", gap: 8, justifyContent: "center", minHeight: 49, marginTop: 5, shadowColor: BLUE, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.18, shadowRadius: 8 },
  saveButtonText: { color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 13, writingDirection: "rtl" },
  saveButtonDisabled: { opacity: 0.62 },
  saveHint: { color: "#748492", fontFamily: "Cairo_400Regular", fontSize: 9, marginTop: -5, textAlign: "center", writingDirection: "rtl" },
  loadingCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D7E7F2", borderRadius: 18, borderWidth: 1, gap: 9, padding: 24, width: "100%" },
  loadingText: { color: DEEP_BLUE, fontFamily: "Cairo_700Bold", fontSize: 12, writingDirection: "rtl" },
  loadErrorCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#F4D2D4", borderRadius: 18, borderWidth: 1, padding: 22, width: "100%" },
  loadErrorTitle: { color: "#7F1D1D", fontFamily: "Cairo_700Bold", fontSize: 14, marginTop: 8, textAlign: "center", writingDirection: "rtl" },
  loadErrorText: { color: "#66727E", fontFamily: "Cairo_400Regular", fontSize: 11, marginTop: 4, textAlign: "center", writingDirection: "rtl" },
  retryLoadButton: { alignItems: "center", backgroundColor: BLUE, borderRadius: 10, flexDirection: "row-reverse", gap: 5, justifyContent: "center", marginTop: 14, minHeight: 38, paddingHorizontal: 12 },
  retryLoadButtonText: { color: "#FFFFFF", fontFamily: "Cairo_700Bold", fontSize: 10, writingDirection: "rtl" },
  accessDenied: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#F4D2D4", borderRadius: 18, borderWidth: 1, padding: 22, width: "100%" },
  accessDeniedIcon: { alignItems: "center", backgroundColor: "#FFF2F2", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  accessDeniedTitle: { color: "#7F1D1D", fontFamily: "Cairo_700Bold", fontSize: 15, marginTop: 10, textAlign: "center", writingDirection: "rtl" },
  accessDeniedText: { color: "#66727E", fontFamily: "Cairo_400Regular", fontSize: 11, marginTop: 4, textAlign: "center", writingDirection: "rtl" },
  pressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
});
