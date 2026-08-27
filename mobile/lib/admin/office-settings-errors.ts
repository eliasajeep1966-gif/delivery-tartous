export type OfficeSettingsOperation = "load" | "save";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message.toLowerCase() : "";
}

export function presentOfficeSettingsError(
  error: unknown,
  operation: OfficeSettingsOperation,
): string {
  const message = messageOf(error);

  if (
    message.includes("permission denied") ||
    message.includes("not allowed") ||
    message.includes("insufficient privilege") ||
    message.includes("42501")
  ) {
    return "لا تملك صلاحية إعدادات المكتب. تأكد أنك داخل بحساب أدمن أو مشرف، ثم أعد تسجيل الدخول.";
  }

  if (
    message.includes("jwt") ||
    message.includes("not authenticated") ||
    message.includes("authentication") ||
    message.includes("401")
  ) {
    return "انتهت جلسة الدخول. سجّل الخروج ثم ادخل إلى التطبيق مجدداً.";
  }

  if (
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("timeout") ||
    message.includes("connection")
  ) {
    return "تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.";
  }

  if (message.includes("office name, phone, and address are required")) {
    return "اسم المكتب ورقمه وعنوانه حقول مطلوبة ولا يمكن تركها فارغة.";
  }

  if (message.includes("office distribution shares must total 100")) {
    return "يجب أن يكون مجموع نسبة الكابتن ونسبة المكتب 100%.";
  }

  if (message.includes("distribution exceptions must be an array")) {
    return "تعذر حفظ استثناءات التوزيع. راجع الاستثناءات ثم أعد المحاولة.";
  }

  return operation === "load"
    ? "تعذر تحميل إعدادات المكتب. أعد المحاولة، وإن استمر الخطأ تحقق من الاتصال."
    : "تعذر حفظ إعدادات المكتب. لم تُحفظ التغييرات؛ أعد المحاولة.";
}
