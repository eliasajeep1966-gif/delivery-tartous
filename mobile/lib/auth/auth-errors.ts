export type AuthIssueCode =
  | "configuration"
  | "network"
  | "timeout"
  | "credentials"
  | "account-pending"
  | "rate-limited"
  | "session-invalid"
  | "profile-missing"
  | "profile-mismatch"
  | "unknown";

export type AuthIssue = {
  code: AuthIssueCode;
  title: string;
  message: string;
  recoverable: boolean;
};

export class AuthRequestTimeoutError extends Error {
  constructor() {
    super("انتهت مهلة العملية بعد 15 ثانية.");
    this.name = "AuthRequestTimeoutError";
  }
}

export function withAuthTimeout<T>(request: Promise<T>, timeoutMs = 15_000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    request,
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new AuthRequestTimeoutError()), timeoutMs);
    }),
  ]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message.toLowerCase() : "";
}

export function classifyAuthError(error: unknown, context: "session" | "sign-in" | "activation" | "profile"): AuthIssue {
  const message = messageFrom(error);

  if (error instanceof Error && error.name === "SupabaseConfigurationError") {
    return {
      code: "configuration",
      title: "إعداد الاتصال ناقص",
      message: "تعذر تجهيز اتصال التطبيق بالخادم. لا تحاول تسجيل الدخول قبل مراجعة إعدادات التطبيق.",
      recoverable: false,
    };
  }

  if (error instanceof AuthRequestTimeoutError || /timeout|timed out|مهلة/.test(message)) {
    return {
      code: "timeout",
      title: "انتهت مهلة الاتصال",
      message: "لم يصل رد من الخادم خلال 15 ثانية. تحقق من الشبكة ثم أعد المحاولة، ولا تعِد إرسال الطلب بسرعة.",
      recoverable: true,
    };
  }

  if (/network|fetch|offline|internet|network request failed|failed to fetch/.test(message)) {
    return {
      code: "network",
      title: "تعذر الوصول إلى الخادم",
      message: "يبدو أن الاتصال بالإنترنت غير متاح أو متقطع. تحقق من الشبكة ثم أعد المحاولة من دون تسجيل الخروج.",
      recoverable: true,
    };
  }

  if (/invalid login credentials|invalid credentials/.test(message)) {
    return {
      code: "credentials",
      title: "بيانات الدخول غير صحيحة",
      message: "تحقق من البريد الإلكتروني وكلمة المرور ثم حاول مجدداً.",
      recoverable: true,
    };
  }

  if (/email not confirmed|email.*confirm/.test(message)) {
    return {
      code: "account-pending",
      title: "الحساب غير مفعّل بعد",
      message: "تم إنشاء الحساب، لكنه لم يُفعّل بعد. تواصل مع الإدارة أو أكمل تفعيل الحساب ثم حاول مجدداً.",
      recoverable: true,
    };
  }

  if (/too many requests|rate limit|over_request_rate_limit/.test(message)) {
    return {
      code: "rate-limited",
      title: "تم إيقاف المحاولات مؤقتاً",
      message: "تمت محاولات كثيرة خلال فترة قصيرة. انتظر قليلاً قبل إعادة المحاولة.",
      recoverable: true,
    };
  }

  if (/refresh token|jwt|session.*invalid|session.*not found|not authenticated|invalid.*token/.test(message)) {
    return {
      code: "session-invalid",
      title: "جلسة الدخول لم تعد صالحة",
      message: "انتهت الجلسة أو لم يعد رمزها صالحاً. سجّل الدخول من جديد ولا تستخدم بيانات جلسة قديمة.",
      recoverable: true,
    };
  }

  if (context === "profile") {
    return {
      code: "unknown",
      title: "تعذر التحقق من الحساب",
      message: "تمت قراءة جلسة الدخول لكن تعذر تحميل ملف الحساب أو صلاحياته. أعد المحاولة دون تسجيل الخروج.",
      recoverable: true,
    };
  }

  return {
    code: "unknown",
    title: context === "activation" ? "تعذر تفعيل الحساب" : context === "sign-in" ? "تعذر تسجيل الدخول" : "تعذر التحقق من الجلسة",
    message:
      context === "activation"
        ? "تعذر تفعيل الحساب. تحقق من البيانات وتواصل مع الإدارة."
        : context === "sign-in"
        ? "لم تكتمل عملية تسجيل الدخول. أعد المحاولة، وإذا استمر الخطأ تواصل مع الإدارة."
        : "تعذر التحقق من الجلسة حالياً. أعد المحاولة بعد التأكد من الاتصال.",
    recoverable: true,
  };
}
