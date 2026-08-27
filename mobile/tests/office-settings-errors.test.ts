import { describe, expect, it } from "vitest";

import { presentOfficeSettingsError } from "../lib/admin/office-settings-errors";

describe("presentOfficeSettingsError", () => {
  it("explains permission failures without exposing the database error", () => {
    expect(
      presentOfficeSettingsError(
        new Error("permission denied for function get_office_settings"),
        "load",
      ),
    ).toBe(
      "لا تملك صلاحية إعدادات المكتب. تأكد أنك داخل بحساب أدمن أو مشرف، ثم أعد تسجيل الدخول.",
    );
  });

  it("explains connection failures and preserves unsaved-change context", () => {
    expect(
      presentOfficeSettingsError(new Error("Failed to fetch"), "save"),
    ).toBe("تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.");

    expect(
      presentOfficeSettingsError(new Error("unexpected database response"), "save"),
    ).toBe("تعذر حفظ إعدادات المكتب. لم تُحفظ التغييرات؛ أعد المحاولة.");
  });

  it("explains distribution validation failures", () => {
    expect(
      presentOfficeSettingsError(
        new Error("Office distribution shares must total 100"),
        "save",
      ),
    ).toBe("يجب أن يكون مجموع نسبة الكابتن ونسبة المكتب 100%.");
  });
});
