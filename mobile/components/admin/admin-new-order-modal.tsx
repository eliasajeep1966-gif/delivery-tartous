import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
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
  const [step, setStep] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);

  const reset = () => {
    setPickups([blankLocation(`pickup-${sequence.current++}`)]);
    setDestinations([blankLocation(`delivery-${sequence.current++}`)]);
    setFee("");
    setCaptainId("");
    setStep(1);
    setValidationError(null);
  };

  const close = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const validateLocations = (
    locations: LocationEntry[],
    type: "pickup" | "delivery",
    label: string,
  ) => {
    try {
      normalizeLocations(locations, type, label);
      setValidationError(null);
      return true;
    } catch (error) {
      setValidationError(
        error instanceof Error
          ? error.message
          : "تحقق من بيانات المحطة قبل المتابعة.",
      );
      return false;
    }
  };

  const nextStep = () => {
    if (isSubmitting) return;
    if (
      step === 1 &&
      !validateLocations(pickups, "pickup", "مصدر الاستلام")
    )
      return;
    if (
      step === 2 &&
      !validateLocations(destinations, "delivery", "وجهة التوصيل")
    )
      return;
    setStep((current) => Math.min(current + 1, 3));
  };

  const previousStep = () => {
    if (isSubmitting) return;
    setValidationError(null);
    setStep((current) => Math.max(current - 1, 1));
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
      animationType="fade"
      hardwareAccelerated
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={styles.sheet}>
                  <View style={styles.header}>
          <View style={styles.headerAccent} />
          <Pressable
            disabled={isSubmitting}
            onPress={close}
            style={styles.closeButton}
          >
            <MaterialIcons name="close" size={20} color="#0878D1" />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerEyebrow}>طلب جديد</Text>
            <Text style={styles.title}>إنشاء رحلة توصيل</Text>
            <Text style={styles.subtitle}>
              أدخل المحطات، حدّد الأجرة، ثم عيّن الكابتن.
            </Text>
          </View>
        </View>

        <View style={styles.routeSteps}>
          <RouteStep number="1" label="مصدر الاستلام" active={step === 1} complete={step > 1} />
          <View style={[styles.routeConnector, step > 1 && styles.routeConnectorComplete]} />
          <RouteStep number="2" label="وجهة التوصيل" active={step === 2} complete={step > 2} />
          <View style={[styles.routeConnector, step > 2 && styles.routeConnectorComplete]} />
          <RouteStep number="3" label="التعيين" active={step === 3} />
        </View>

        <ScrollView

            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 1 ? (
              <LocationSection
                title="مصدر الاستلام"
                description="المكان الذي سيستلم منه الكابتن الطلب"
                type="pickup"
                locations={pickups}
                disabled={isSubmitting}
                setLocations={setPickups}
                nextId={() => `pickup-${sequence.current++}`}
              />
            ) : null}

            {step === 2 ? (
              <LocationSection
                title="وجهة التوصيل"
                description="المكان الذي ستصل إليه الطلبية"
                type="delivery"
                locations={destinations}
                disabled={isSubmitting}
                setLocations={setDestinations}
                nextId={() => `delivery-${sequence.current++}`}
              />
            ) : null}

            {step === 3 ? (
              <>
                <View style={styles.formCard}>
                  <SectionTitle
                    icon="payments"
                    color="#A16207"
                    background="#FFF4D9"
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

                <View style={styles.formCard}>
                  <SectionTitle
                    icon="person"
                    color="#047857"
                    background="#E0FAEF"
                    title="تعيين الكابتن"
                    subtitle="تظهر الكباتن المفعّلة والمتاحة فقط"
                  />
                  {captains.length ? (
                    <View style={styles.captainGrid}>
                      {captains.map((captain) => (
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
                              numberOfLines={1}
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
                                ? "check-circle"
                                : "radio-button-unchecked"
                            }
                            size={19}
                            color={captainId === captain.id ? "#0878D1" : "#A2B5C3"}
                          />
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.empty}>لا يوجد كابتن متاح حالياً.</Text>
                  )}
                </View>
              </>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {validationError || errorMessage ? (
              <Text style={styles.error}>
                {validationError ?? errorMessage}
              </Text>
            ) : null}
            <View style={styles.footerActions}>
              {step > 1 ? (
                <Pressable
                  disabled={isSubmitting}
                  onPress={previousStep}
                  style={[styles.backButton, isSubmitting && styles.disabled]}
                >
                  <MaterialIcons name="arrow-forward" size={17} color="#0878D1" />
                  <Text style={styles.backButtonText}>السابق</Text>
                </Pressable>
              ) : null}
              <Pressable
                disabled={isSubmitting || (step === 3 && captains.length === 0)}
                onPress={() => (step === 3 ? void submit() : nextStep())}
                style={[
                  styles.submit,
                  (isSubmitting || (step === 3 && captains.length === 0)) &&
                    styles.disabled,
                ]}
              >
                <LinearGradient
                  colors={["#063B78", "#0878D1", "#0CBDF2"]}
                  start={{ x: 1, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.submitGradient}
                >
                  <MaterialIcons
                    name={step === 3 ? "send" : "arrow-back"}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.submitText}>
                    {step === 3
                      ? isSubmitting
                        ? "جارٍ إنشاء الطلب..."
                        : "إرسال الطلبية"
                      : "التالي"}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
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

function RouteStep({
  number,
  label,
  active = false,
  complete = false,
}: {
  number: string;
  label: string;
  active?: boolean;
  complete?: boolean;
}) {
  return (
    <View style={styles.routeStep}>
      <View
        style={[
          styles.routeNumber,
          active && styles.routeNumberActive,
          complete && styles.routeNumberComplete,
        ]}
      >
        {complete ? (
          <MaterialIcons name="check" size={13} color="#FFFFFF" />
        ) : (
          <Text style={[styles.routeNumberText, active && styles.routeNumberTextActive]}>
            {number}
          </Text>
        )}
      </View>
      <Text
        style={[
          styles.routeLabel,
          active && styles.routeLabelActive,
          complete && styles.routeLabelComplete,
        ]}
      >
        {label}
      </Text>
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
    backgroundColor: "rgba(6,31,57,0.42)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#F4F7FB",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "94%",
    overflow: "hidden",
  },
  header: {
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderBottomColor: "#E0EDF6",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 15,
    position: "relative",
  },
  headerAccent: { backgroundColor: "#16CEFF", bottom: 0, height: 2, left: 18, position: "absolute", right: 18 },
  closeButton: {
    alignItems: "center",
    backgroundColor: "#F2F8FD",
    borderColor: "#D8EAF8",
    borderRadius: 14,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  headerText: { alignItems: "flex-end", flex: 1, marginLeft: 12 },
  headerEyebrow: { color: "#0878D1", fontFamily: "Cairo_700Bold", fontSize: 10, textAlign: "right", writingDirection: "rtl" },
  title: {
    color: "#073D70",
    fontFamily: "Cairo_700Bold",
    fontSize: 19,
    marginTop: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  subtitle: {
    color: "#6A8598",
    fontFamily: "Cairo_400Regular",
    fontSize: 10,
    marginTop: 2,
    textAlign: "right",
    writingDirection: "rtl",
  },
  routeSteps: { alignItems: "center", backgroundColor: "#FFFFFF", flexDirection: "row-reverse", justifyContent: "center", paddingBottom: 12, paddingHorizontal: 18, paddingTop: 9 },
  routeStep: { alignItems: "center", gap: 3 },
  routeNumber: { alignItems: "center", backgroundColor: "#EDF4F8", borderRadius: 10, height: 20, justifyContent: "center", width: 20 },
  routeNumberActive: { backgroundColor: "#0878D1" },
  routeNumberComplete: { backgroundColor: "#18A775" },
  routeNumberText: { color: "#6D8799", fontFamily: "Cairo_700Bold", fontSize: 10 },
  routeNumberTextActive: { color: "#FFFFFF" },
  routeLabel: { color: "#8399A8", fontFamily: "Cairo_700Bold", fontSize: 9, writingDirection: "rtl" },
  routeLabelActive: { color: "#0878D1" },
  routeLabelComplete: { color: "#15916C" },
  routeConnector: { backgroundColor: "#D8E8F2", height: 1, marginBottom: 16, marginHorizontal: 8, width: 46 },
  routeConnectorComplete: { backgroundColor: "#18A775" },
  content: { gap: 10, padding: 14, paddingBottom: 16 },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E1EDF5",
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
  },
  locationSection: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DDECF7",
    borderRadius: 18,
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
    backgroundColor: "#EEF8FF",
    borderColor: "#A3DEFF",
    borderRadius: 11,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
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
    backgroundColor: "#F9FCFF",
    borderColor: "#E1EDF5",
    borderRadius: 14,
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
    backgroundColor: "#FFFFFF",
    borderColor: "#D7E5EF",
    borderRadius: 10,
    borderWidth: 1,
    color: "#173D59",
    fontFamily: "Cairo_400Regular",
    fontSize: 12,
    minHeight: 42,
    paddingHorizontal: 11,
    writingDirection: "rtl",
  },
  noteInput: { minHeight: 70, paddingTop: 10, textAlignVertical: "top" },
  moneyInputWrap: { alignItems: "center", flexDirection: "row-reverse", marginTop: 10 },
  moneyInput: {
    backgroundColor: "#FFFDF8",
    borderColor: "#F4D99B",
    borderRadius: 12,
    borderWidth: 1,
    color: "#714600",
    flex: 1,
    fontFamily: "Cairo_700Bold",
    fontSize: 14,
    height: 48,
    paddingHorizontal: 12,
    writingDirection: "rtl",
  },
  currency: { color: "#9B6507", fontFamily: "Cairo_700Bold", fontSize: 11, marginRight: 9 },
  captainGrid: { gap: 8, marginTop: 10 },
  captain: {
    alignItems: "center",
    backgroundColor: "#FBFDFF",
    borderColor: "#DDEAF2",
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 46,
    paddingHorizontal: 11,
  },
  captainSelected: { backgroundColor: "#EDF8FF", borderColor: "#0878D1", shadowColor: "#16CEFF", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 5 },
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
  footer: { backgroundColor: "#FFFFFF", borderTopColor: "#E0EDF6", borderTopWidth: 1, gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14 },
  footerActions: { alignItems: "center", flexDirection: "row-reverse", gap: 9 },
  backButton: { alignItems: "center", backgroundColor: "#F0F8FE", borderColor: "#BCE3FA", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 4, height: 52, justifyContent: "center", paddingHorizontal: 14 },
  backButtonText: { color: "#0878D1", fontFamily: "Cairo_700Bold", fontSize: 12, writingDirection: "rtl" },
  submit: { borderRadius: 15, flex: 1, overflow: "hidden" },
  submitGradient: { alignItems: "center", borderColor: "rgba(133,239,255,0.65)", borderRadius: 15, borderWidth: 1, flexDirection: "row-reverse", gap: 8, height: 52, justifyContent: "center" },
  submitText: {
    color: "#FFFFFF",
    fontFamily: "Cairo_700Bold",
    fontSize: 13,
    writingDirection: "rtl",
  },
  disabled: { opacity: 0.5 },
});
