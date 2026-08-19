/**
 * Data boundary for the Tartous delivery supervisor dashboard.
 * Replace these exports with API adapters when the backend is connected.
 */
export type OrderStatus = "delivered" | "waiting" | "picked_up";

export type Order = {
  id: string;
  customer: string;
  amount: string;
  location: string;
  status: OrderStatus;
  timestamp: string;
};

export type Captain = {
  id: string;
  name: string;
  initial: string;
  availability: "متاح";
};

export const summaryMetrics = [
  { id: "waiting", label: "بانتظار استلام الكابتن", value: 4, icon: "package" },
  { id: "delivery", label: "قيد التوصيل", value: 7, icon: "bike" },
  { id: "delivered", label: "تم التوصيل اليوم", value: 18, icon: "check" },
  { id: "cancelled", label: "طلبات ملغاة", value: 2, icon: "cancel" },
] as const;

export const recentOrders: Order[] = [
  { id: "1042", customer: "محمد العلي", amount: "35,000 ل.س", location: "الرمل الجنوبي", status: "delivered", timestamp: "الثلاثاء 19 آب، 10:42 ص" },
  { id: "1045", customer: "لينا حمدان", amount: "25,000 ل.س", location: "بانياس", status: "waiting", timestamp: "الثلاثاء 19 آب، 10:18 ص" },
  { id: "1048", customer: "سامر أحمد", amount: "40,000 ل.س", location: "صافيتا", status: "picked_up", timestamp: "الثلاثاء 19 آب، 09:55 ص" },
];

export const availableCaptains: Captain[] = [
  { id: "captain-1", name: "علي", initial: "ع", availability: "متاح" },
  { id: "captain-2", name: "حسن", initial: "ح", availability: "متاح" },
  { id: "captain-3", name: "يوسف", initial: "ي", availability: "متاح" },
  { id: "captain-4", name: "رامي", initial: "ر", availability: "متاح" },
];
