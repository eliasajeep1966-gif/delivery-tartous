import { classifyAuthError } from "./auth-errors";

export type AccountSettingsAction = "name" | "email" | "password";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message.toLowerCase() : "";
}

export function presentAccountSettingsError(
  error: unknown,
  action: AccountSettingsAction,
): string {
  const message = messageOf(error);

  if (message.includes("a full name is required")) {
    return "أدخل الاسم الكامل قبل الحفظ.";
  }

  if (message.includes("full name is too long")) {
    return "الاسم الكامل طويل جداً؛ الحد الأقصى 120 حرفاً.";
  }

  if (/email.*already|user already registered|email.*taken/.test(message)) {
    return "هذا البريد الإلكتروني مستخدم لحساب آخر. أدخل بريداً مختلفاً.";
  }

  if (/invalid.*email|email.*invalid/.test(message)) {
    return "صيغة البريد الإلكتروني غير صحيحة. راجعها ثم أعد المحاولة.";
  }

  if (/password.*weak|weak password/.test(message)) {
    return "كلمة المرور ضعيفة. استخدم 12 حرفاً على الأقل مع أحرف وأرقام.";
  }

  const authIssue = classifyAuthError(error, "session");
  if (authIssue.code !== "unknown") return authIssue.message;

  if (action === "name") {
    return "تعذر تحديث الاسم. لم تُحفظ التغييرات؛ أعد المحاولة.";
  }
  if (action === "email") {
    return "تعذر طلب تغيير البريد الإلكتروني. لم يتغير البريد؛ أعد المحاولة.";
  }
  return "تعذر تغيير كلمة المرور. لم تُحفظ التغييرات؛ أعد المحاولة.";
}
