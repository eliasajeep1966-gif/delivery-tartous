/**
 * Admin feature contract for the React Web UI only.
 * These are presentation and draft types, not Supabase/database types.
 */
export type AdminRole = "admin" | "supervisor" | "captain";

export type OrderStatus = "pending" | "assigned" | "received" | "in_delivery" | "completed" | "cancelled" | "false_order";

export const orderStatusPresentation: Record<OrderStatus, { label: string; className: string; stripClass: string }> = {
  pending: { label: "قيد الانتظار", className: "bg-blue-50 text-[#0060B8]", stripClass: "bg-[#0060B8]" },
  assigned: { label: "تم تعيين كابتن", className: "bg-indigo-50 text-indigo-700", stripClass: "bg-indigo-500" },
  received: { label: "تم الاستلام", className: "bg-violet-50 text-violet-700", stripClass: "bg-violet-500" },
  in_delivery: { label: "قيد التوصيل", className: "bg-cyan-50 text-cyan-700", stripClass: "bg-cyan-500" },
  completed: { label: "مكتمل", className: "bg-emerald-50 text-emerald-700", stripClass: "bg-emerald-500" },
  cancelled: { label: "ملغى", className: "bg-red-50 text-red-700", stripClass: "bg-red-500" },
  false_order: { label: "طلب كاذب", className: "bg-amber-50 text-amber-700", stripClass: "bg-amber-500" },
};

export type OrderLocationDraft = { name: string; phone: string; address: string; note?: string };
export type OrderDraft = { pickups: OrderLocationDraft[]; destinations: OrderLocationDraft[] };
// Integration must call create_order_with_stops, then assign_order_captain with the returned order id.
export type CreateOrderFlowDraft = { order: OrderDraft; totalFee: number; assignedCaptainId: string };

export type CaptainOption = { id: string; name: string; initial: string; availability: "available" };
export type CaptainAvailability = "available" | "unavailable";
export type CaptainActivation = "active" | "inactive";
export type CaptainCustodyItem = { label: string; status: "held" | "returned" };

export type AdminCaptainListItem = {
  id: string;
  name: string;
  initial: string;
  availability: CaptainAvailability;
  activation: CaptainActivation;
  completedOrders: number;
  currentOrderId?: string;
  custodyItems: CaptainCustodyItem[];
};

export type AdminOrderListItem = { id: string; customer: string; amount: string; location: string; status: OrderStatus; timestamp: string };
export type OrderTimelineItem = { status: OrderStatus; label: string; timestamp: string; actor: string };
export type AdminOrderDetail = AdminOrderListItem & {
  customerPhone: string;
  pickups: OrderLocationDraft[];
  destinations: OrderLocationDraft[];
  captain?: { id: string; name: string };
  fee: number;
  timeline: OrderTimelineItem[];
};

export type AdminUserListItem = { id: string; name: string; email: string; role: AdminRole; custodyItemsText?: string };
export type PendingAccountDraft = { name: string; email: string; role: AdminRole; custodyItemsText?: string };
export type PendingAccountListItem = PendingAccountDraft & { id: string; createdAt: string };

export type WageOrderStatus = Extract<OrderStatus, "completed" | "false_order">;
export type WageOrder = {
  id: string;
  orderNumber: string;
  captainId: string;
  captainName: string;
  customerName: string;
  date: string;
  dayKey: string;
  weekKey: string;
  monthKey: string;
  gross: number;
  status: WageOrderStatus;
  payoutId?: string;
};
export type PayoutRegistrationDraft = { captainId: string; ledgerIds: string[] };
export type WagePeriod = "daily" | "weekly" | "monthly";
