import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { type Dispatch, type SetStateAction, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { type AdminHomeCaptain } from "@/features/admin/use-admin-home";
import { type NativeAdminOrderStopInput } from "@/lib/supabase/native-admin-contract";

type LocationEntry = {
  id: string;
  name: string;
  phone: string;
  address: string;
  note: string;
};

export type NativeNewOrderDraft = {
  stops: NativeAdminOrderStopInput[];
  fee: number;
  captainId: string;
};

type Props = {
  visible: boolean;
  captains: AdminHomeCaptain[];
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (draft: NativeNewOrderDraft) => Promise<boolean>;
};

const blankLocation = (id: string): LocationEntry => ({
  id,
  name: "",
  phone: "",
  address: "",
  note: "",
});

export function AdminNewOrderModal({
  visible,
  captains,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}: Props) {
  const sequence = useRef(2);
  const [pickups, setPickups] = useState<LocationEntry[]>([
    blankLocation("pickup-0"),
  ]);
  const [destinations, setDestinations] = useState<LocationEntry[]>([
    blankLocation("delivery-1"),
  ]);
  const [fee, setFee] = useState("");
  const [captainId, setCaptainId] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const reset = () => {
    setPickups([blankLocation(`pickup-${sequence.current++}`)]);
    setDestinations([blankLocation(`delivery-${sequence.current++}`)]);
    setFee("");
    setCaptainId("");
    setValidationError(null);
  };

  const close = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const submit = async () => {
    const numericFee = Number(fee.trim());
    if (!Number.isFinite(numericFee) || numericFee <= 0) {
      setValidationError("أدخل أجرة الطلب كاملة كرقم موجب.");
      return;
    }
    if (!captains.some((captain) => captain.id === captainId)) {
      setValidationError("اختر كابتناً مفعّلاً ومتاحاً قبل إرسال الطلب.");
      return;
    }

    try {
      const stops: NativeAdminOrderStopInput[] = [
        ...normalizeLocations(pickups, "pickup", "مصدر الاستلام"),
        ...normalizeLocations(destinations, "delivery", "وجهة التسليم"),
      ];
      setValidationError(null);
      if (await onSubmit({ stops, fee: numericFee, captainId })) reset();
    } catch (error) {
      setValidationError(
        error instanceof Error
          ? error.message
          : "تحقق من بيانات الطلب وحاول مرة أخرى.",
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable
              disabled={isSubmitting}
              onPress={close}
              style={styles.closeButton}
            >
              <MaterialIcons name="close" size={22} color="#52616B" />
            </Pressable>
            <View style={styles.headerText}>
              <Text style={styles.title}>إنشاء طلب جديد</Text>
              <Text style={styles.subtitle}>
                أضف المصادر والوجهات، ثم اختر كابتناً متاحاً.
              </Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <LocationSection
              title="مصادر الاستلام"
              description="المكان الذي سيستلم منه الكابتن الطلب"
              type="pickup"
              locations={pickups}
              disabled={isSubmitting}
              setLocations={setPickups}
              nextId={() => `pickup-${sequence.current++}`}
            />
            <LocationSection
              title="وجهات التسليم"
              description="المكان الذي ستصل إليه الطلبية"
              type="delivery"
              locations={destinations}
              disabled={isSubmitting}
              setLocations={setDestinations}
              nextId={() => `delivery-${sequence.current++}`}
            />

            <View style={styles.section}>
              <SectionTitle
                icon="payments"
                color="#A16207"
                background="#FEF3C7"
                title="أجرة الطلب كاملة"
                subtitle="الأجرة الإجمالية للطلب بالكامل"
              />
              <View style={styles.moneyInputWrap}>
                <TextInput
                  editable={!isSubmitting}
                  value={fee}
                  onChangeText={setFee}
                  keyboardType="decimal-pad"
                  placeholder="مثال: 25000"
                  placeholderTextColor="#8A98A6"
                  style={styles.moneyInput}
                  textAlign="right"
                />
                <Text style={styles.currency}>ل.س</Text>
              </View>
            </View>

            <View style={styles.section}>
              <SectionTitle
                icon="person"
                color="#047857"
                background="#D1FAE5"
                title="اختيار الكابتن"
                subtitle="تظهر الكباتن المفعّلة والمتاحة فقط"
              />
              {captains.length ? (
                captains.map((captain) => (
                  <Pressable
                    key={captain.id}
                    disabled={isSubmitting}
                    onPress={() => setCaptainId(captain.id)}
                    style={[
                      styles.captain,
                      captainId === captain.id && styles.captainSelected,
                    ]}
                  >
                    <View style={styles.captainTextRow}>
                      <View style={styles.availableDot} />
                      <Text
                        style={[
                          styles.captainText,
                          captainId === captain.id &&
                            styles.captainTextSelected,
                        ]}
                      >
                        {captain.name}
                      </Text>
                    </View>
                    <MaterialIcons
                      name={
                        captainId === captain.id
                          ? "radio-button-checked"
                          : "radio-button-unchecked"
                      }
                      size={20}
                      color={captainId === captain.id ? "#0060B8" : "#9BAAB5"}
                    />
                  </Pressable>
                ))
              ) : (
                <Text style={styles.empty}>لا يوجد كابتن متاح حالياً.</Text>
              )}
            </View>

            {validationError || errorMessage ? (
              <Text style={styles.error}>
                {validationError ?? errorMessage}
              </Text>
            ) : null}

            <Pressable
              disabled={isSubmitting || captains.length === 0}
              onPress={() => void submit()}
              style={[
                styles.submit,
                (isSubmitting || captains.length === 0) && styles.disabled,
              ]}
            >
              <MaterialIcons name="send" size={18} color="#FFFFFF" />
              <Text style={styles.submitText}>
                {isSubmitting ? "جارٍ إنشاء الطلب..." : "إرسال الطلبية"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function normalizeLocations(
  locations: LocationEntry[],
  type: "pickup" | "delivery",
  label: string,
): NativeAdminOrderStopInput[] {
  return locations.map((location, index) => {
    const contactName = location.name.trim();
    const contactPhone = location.phone.trim();
    const address = location.address.trim();
    if (!contactName || !contactPhone || !address)
      throw new Error(
        `أكمل الاسم والهاتف والعنوان في ${label} رقم ${index + 1}.`,
      );
    return {
      stopType: type,
      sequence: index + 1,
      contactName,
      contactPhone,
      address,
      note: location.note.trim() || undefined,
    };
  });
}

function LocationSection({
  title,
  description,
  type,
  locations,
  disabled,
  setLocations,
  nextId,
}: {
  title: string;
  description: string;
  type: "pickup" | "delivery";
  locations: LocationEntry[];
  disabled: boolean;
  setLocations: Dispatch<SetStateAction<LocationEntry[]>>;
  nextId: () => string;
}) {
  const update = (
    id: string,
    field: keyof Omit<LocationEntry, "id">,
    value: string,
  ) => {
    setLocations((current) =>
      current.map((location) =>
        location.id === id ? { ...location, [field]: value } : location,
      ),
    );
  };
  return (
    <View style={styles.locationSection}>
      <View style={styles.locationHeading}>
        <Pressable
          disabled={disabled}
          onPress={() =>
            setLocations((current) => [...current, blankLocation(nextId())])
          }
          style={styles.addButton}
        >
          <MaterialIcons name="add" size={21} color="#0060B8" />
        </Pressable>
        <SectionTitle
          icon={type === "pickup" ? "storefront" : "location-on"}
          color={type === "pickup" ? "#0060B8" : "#047857"}
          background={type === "pickup" ? "#DBEEFF" : "#D1FAE5"}
          title={title}
          subtitle={description}
        />
      </View>
      {locations.map((location, index) => (
        <View key={location.id} style={styles.locationCard}>
          <View style={styles.locationCardHeading}>
            {locations.length > 1 ? (
              <Pressable
                disabled={disabled}
                onPress={() =>
                  setLocations((current) =>
                    current.filter((item) => item.id !== location.id),
                  )
                }
              >
                <MaterialIcons
                  name="delete-outline"
                  size={19}
                  color="#BA1A1A"
                />
              </Pressable>
            ) : (
              <View />
            )}
            <Text style={styles.locationLabel}>
              {index + 1}.{" "}
              {type === "pickup" ? "مصدر الاستلام" : "وجهة التسليم"}
            </Text>
          </View>
          <TextInput
            editable={!disabled}
            value={location.name}
            onChangeText={(value) => update(location.id, "name", value)}
            placeholder={
              type === "pickup" ? "اسم المحل أو المصدر" : "اسم المستلم"
            }
            placeholderTextColor="#89939E"
            style={styles.input}
            textAlign="right"
          />
          <TextInput
            editable={!disabled}
            value={location.phone}
            onChangeText={(value) => update(location.id, "phone", value)}
            placeholder="رقم الهاتف"
            placeholderTextColor="#89939E"
            keyboardType="phone-pad"
            style={styles.input}
            textAlign="right"
          />
          <TextInput
            editable={!disabled}
            value={location.address}
            onChangeText={(value) => update(location.id, "address", value)}
            placeholder="العنوان التفصيلي"
            placeholderTextColor="#89939E"
            style={styles.input}
            textAlign="right"
          />
          {type === "pickup" ? (
            <TextInput
              editable={!disabled}
              value={location.note}
              onChangeText={(value) => update(location.id, "note", value)}
              placeholder="ملاحظات المصدر (اختياري)"
              placeholderTextColor="#89939E"
              multiline
              style={[styles.input, styles.noteInput]}
              textAlign="right"
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function SectionTitle({
  icon,
  color,
  background,
  title,
  subtitle,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  color: string;
  background: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={[styles.sectionIcon, { backgroundColor: background }]}>
        <MaterialIcons name={icon} size={19} color={color} />
      </View>
      <View style={styles.sectionTitleText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: "rgba(10,32,50,0.44)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#F0F7FF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    overflow: "hidden",
  },
  header: {
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderBottomColor: "#DBE7F2",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: "#F4F8FB",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  headerText: { alignItems: "flex-end", flex: 1, marginLeft: 12 },
  title: {
    color: "#1C1B1B",
    fontFamily: "Cairo_700Bold",
    fontSize: 18,
    textAlign: "right",
    writingDirection: "rtl",
  },
  subtitle: {
    color: "#58616B",
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    marginTop: 3,
    textAlign: "right",
    writingDirection: "rtl",
  },
  content: { gap: 12, padding: 14, paddingBottom: 34 },
  section: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DBE7F2",
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
  },
  locationSection: {
    backgroundColor: "#F7FBFF",
    borderColor: "#DBE7F2",
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
  },
  locationHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  addButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#A8C8FF",
    borderRadius: 10,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row-reverse",
    flex: 1,
  },
  sectionIcon: {
    alignItems: "center",
    borderRadius: 11,
    height: 38,
    justifyContent: "center",
    marginLeft: 9,
    width: 38,
  },
  sectionTitleText: { alignItems: "flex-end", flex: 1 },
  sectionTitle: {
    color: "#1C1B1B",
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    writingDirection: "rtl",
  },
  sectionSubtitle: {
    color: "#58616B",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    marginTop: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  locationCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E4EDF5",
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: 8,
    padding: 11,
  },
  locationCardHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  locationLabel: {
    color: "#0060B8",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    writingDirection: "rtl",
  },
  input: {
    backgroundColor: "#FBFDFF",
    borderColor: "#D1DCE6",
    borderRadius: 9,
    borderWidth: 1,
    color: "#1C1B1B",
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    minHeight: 42,
    paddingHorizontal: 11,
    writingDirection: "rtl",
  },
  noteInput: { minHeight: 70, paddingTop: 10, textAlignVertical: "top" },
  moneyInputWrap: {
    alignItems: "center",
    flexDirection: "row-reverse",
    marginTop: 10,
  },
  moneyInput: {
    backgroundColor: "#FBFDFF",
    borderColor: "#C9D9E7",
    borderRadius: 11,
    borderWidth: 1,
    color: "#1C1B1B",
    flex: 1,
    fontFamily: "Cairo_600SemiBold",
    fontSize: 13,
    height: 46,
    paddingHorizontal: 12,
    writingDirection: "rtl",
  },
  currency: {
    color: "#58616B",
    fontFamily: "Cairo_700Bold",
    fontSize: 11,
    marginRight: 9,
  },
  captain: {
    alignItems: "center",
    borderColor: "#DBE7F2",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 9,
    minHeight: 44,
    paddingHorizontal: 11,
  },
  captainSelected: { backgroundColor: "#EAF4FF", borderColor: "#0060B8" },
  captainTextRow: { alignItems: "center", flexDirection: "row-reverse" },
  captainText: {
    color: "#1C1B1B",
    fontFamily: "Cairo_600SemiBold",
    fontSize: 12,
    writingDirection: "rtl",
  },
  captainTextSelected: { color: "#0060B8", fontFamily: "Cairo_700Bold" },
  availableDot: {
    backgroundColor: "#10B981",
    borderRadius: 5,
    height: 9,
    marginLeft: 7,
    width: 9,
  },
  empty: {
    backgroundColor: "#F7FBFF",
    borderColor: "#BFD6EB",
    borderRadius: 10,
    borderStyle: "dashed",
    borderWidth: 1,
    color: "#58616B",
    fontFamily: "Cairo_400Regular",
    fontSize: 11,
    marginTop: 10,
    padding: 12,
    textAlign: "center",
    writingDirection: "rtl",
  },
  error: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderRadius: 10,
    borderWidth: 1,
    color: "#BA1A1A",
    fontFamily: "Cairo_600SemiBold",
    fontSize: 11,
    lineHeight: 18,
    padding: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  submit: {
    alignItems: "center",
    backgroundColor: "#0060B8",
    borderRadius: 12,
    flexDirection: "row-reverse",
    gap: 7,
    height: 50,
    justifyContent: "center",
  },
  submitText: {
    color: "#FFFFFF",
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    writingDirection: "rtl",
  },
  disabled: { opacity: 0.5 },
});
