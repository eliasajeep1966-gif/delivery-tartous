export type AdminOrderStatus = "pending" | "assigned" | "received" | "in_delivery" | "completed" | "cancelled" | "false_order";

export type AdminHomeActivity = {
  id: string;
  title: string;
  subtitle: string;
  timestamp: string;
  status: AdminOrderStatus | null;
};

type JsonRecord = Record<string, unknown>;

const DAMASCUS_TIME_ZONE = "Asia/Damascus";
const knownStatuses: readonly AdminOrderStatus[] = ["pending", "assigned", "received", "in_delivery", "completed", "cancelled", "false_order"];

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function activityTime(value: string): string {
  try {
    return new Intl.DateTimeFormat("ar-SY", {
      timeZone: DAMASCUS_TIME_ZONE,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function titleForActivity(action: string, orderNumber: string | null): string {
  const suffix = orderNumber ? ` #${orderNumber}` : "";
  const labels: Record<string, string> = {
    "إنشاء طلب": "تم إنشاء الطلب",
    "إسناد طلب": "تم تعيين كابتن للطلب",
    "استلام الطلب": "تم استلام الطلب",
    "بدء التوصيل": "تم بدء توصيل الطلب",
    "تم التوصيل": "تم تسليم الطلب",
    "طلب كاذب": "تم تسجيل الطلب كطلب كاذب",
    "إلغاء الطلب": "تم إلغاء الطلب",
  };
  return `${labels[action] ?? action}${suffix}`;
}

function statusValue(value: unknown): AdminOrderStatus | null {
  return typeof value === "string" && knownStatuses.includes(value as AdminOrderStatus) ? (value as AdminOrderStatus) : null;
}

export function mapAdminHomeActivities(value: unknown): AdminHomeActivity[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    const record = asRecord(entry);
    if (!record) return [];

    const id = text(record.id);
    const action = text(record.action);
    const createdAt = text(record.created_at);
    if (!id || !action || !createdAt) return [];

    const orderNumberValue = record.order_number;
    const orderNumber = typeof orderNumberValue === "string" || typeof orderNumberValue === "number" ? String(orderNumberValue) : null;
    const actorName = text(record.actor_name) || "النظام";

    return [{
      id,
      title: titleForActivity(action, orderNumber),
      subtitle: `بواسطة ${actorName}`,
      timestamp: activityTime(createdAt),
      status: statusValue(record.to_status),
    }];
  });
}
