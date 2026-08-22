import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function NavigationTestScreen() {
  return (
    <ScreenContainer className="p-5">
      <View className="flex-1">
        <View className="flex-row-reverse items-center justify-between">
          <Text className="text-right text-xl font-extrabold text-foreground">اختبار التنقل</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="الرجوع"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <IconSymbol name="arrow.right" size={22} color="#184D70" />
          </Pressable>
        </View>

        <View className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <Text className="text-right text-base font-extrabold text-foreground">زر الرجوع يعمل من Stack Navigation</Text>
          <Text className="mt-2 text-right text-sm leading-6 text-muted">
            اضغط الزر في الأعلى للعودة إلى الرئيسية. هذا يثبت أن المسار والـSafe Area والـRTL يشتغلون قبل نقل الشاشات الفعلية.
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderColor: "#DCECF4",
    borderWidth: 1,
  },
  backButtonPressed: { opacity: 0.7 },
});
