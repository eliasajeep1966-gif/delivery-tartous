import { describe, expect, it } from "vitest";

import { presentAccountSettingsError } from "../lib/auth/account-settings-errors";

describe("presentAccountSettingsError", () => {
  it("turns profile validation errors into an actionable Arabic message", () => {
    expect(
      presentAccountSettingsError(new Error("A full name is required"), "name"),
    ).toBe("أدخل الاسم الكامل قبل الحفظ.");
  });

  it("keeps session failures understandable without exposing raw errors", () => {
    expect(
      presentAccountSettingsError(new Error("JWT expired"), "password"),
    ).toBe("انتهت الجلسة أو لم يعد رمزها صالحاً. سجّل الدخول من جديد ولا تستخدم بيانات جلسة قديمة.");
  });

  it("makes unknown save failures clear that no change was saved", () => {
    expect(
      presentAccountSettingsError(new Error("unexpected backend error"), "email"),
    ).toBe("تعذر طلب تغيير البريد الإلكتروني. لم يتغير البريد؛ أعد المحاولة.");
  });
});
