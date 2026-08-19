export type WageOrderStatus = "مكتمل" | "طلب كاذب";

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
};

export type Period = "daily" | "weekly" | "monthly";

export const monthOptions = [
  { key: "2026-08", label: "آب 2026" },
  { key: "2026-07", label: "تموز 2026" },
];

export const weekOptions = [
  { key: "2026-W34", label: "الأسبوع 18–24 آب" },
  { key: "2026-W30", label: "الأسبوع 27–31 تموز" },
];

export const dayOptions = [
  { key: "2026-08-19", label: "الثلاثاء 19 آب" },
  { key: "2026-08-18", label: "الاثنين 18 آب" },
  { key: "2026-07-28", label: "الثلاثاء 28 تموز" },
  { key: "2026-07-27", label: "الاثنين 27 تموز" },
];

export const wageOrders: WageOrder[] = [
  { id: "w-1", orderNumber: "#1042", captainId: "captain-1", captainName: "محمد علي", customerName: "محمد العلي", date: "11:24 ص", dayKey: "2026-08-19", weekKey: "2026-W34", monthKey: "2026-08", gross: 35000, status: "مكتمل" },
  { id: "w-2", orderNumber: "#1039", captainId: "captain-1", captainName: "محمد علي", customerName: "ليلى محمد", date: "09:10 ص", dayKey: "2026-08-19", weekKey: "2026-W34", monthKey: "2026-08", gross: 40000, status: "مكتمل" },
  { id: "w-3", orderNumber: "#1031", captainId: "captain-1", captainName: "محمد علي", customerName: "عمر علي", date: "06:40 م", dayKey: "2026-08-18", weekKey: "2026-W34", monthKey: "2026-08", gross: 30000, status: "طلب كاذب" },
  { id: "w-4", orderNumber: "#1040", captainId: "captain-2", captainName: "حسن يوسف", customerName: "لينا حمدان", date: "10:05 ص", dayKey: "2026-08-19", weekKey: "2026-W34", monthKey: "2026-08", gross: 25000, status: "مكتمل" },
  { id: "w-5", orderNumber: "#1035", captainId: "captain-2", captainName: "حسن يوسف", customerName: "هدى خليل", date: "02:15 م", dayKey: "2026-08-18", weekKey: "2026-W34", monthKey: "2026-08", gross: 50000, status: "مكتمل" },
  { id: "w-6", orderNumber: "#1028", captainId: "captain-2", captainName: "حسن يوسف", customerName: "جميل ديب", date: "11:50 ص", dayKey: "2026-08-18", weekKey: "2026-W34", monthKey: "2026-08", gross: 20000, status: "مكتمل" },
  { id: "w-7", orderNumber: "#1037", captainId: "captain-3", captainName: "رامي إبراهيم", customerName: "سمر حمود", date: "08:40 ص", dayKey: "2026-08-19", weekKey: "2026-W34", monthKey: "2026-08", gross: 45000, status: "مكتمل" },
  { id: "w-8", orderNumber: "#1029", captainId: "captain-3", captainName: "رامي إبراهيم", customerName: "فادي أحمد", date: "05:20 م", dayKey: "2026-08-18", weekKey: "2026-W34", monthKey: "2026-08", gross: 35000, status: "مكتمل" },
  { id: "w-9", orderNumber: "#1015", captainId: "captain-1", captainName: "محمد علي", customerName: "رؤى خالد", date: "04:10 م", dayKey: "2026-07-28", weekKey: "2026-W30", monthKey: "2026-07", gross: 45000, status: "مكتمل" },
  { id: "w-10", orderNumber: "#1012", captainId: "captain-2", captainName: "حسن يوسف", customerName: "سليم إبراهيم", date: "12:25 م", dayKey: "2026-07-27", weekKey: "2026-W30", monthKey: "2026-07", gross: 30000, status: "مكتمل" },
];

export const captainProfiles = [
  { id: "captain-1", name: "محمد علي", initial: "م" },
  { id: "captain-2", name: "حسن يوسف", initial: "ح" },
  { id: "captain-3", name: "رامي إبراهيم", initial: "ر" },
];

export const formatMoney = (amount: number) => `${new Intl.NumberFormat("en-US").format(Math.round(amount))} ل.س`;

export function getPeriodOptions(period: Period) {
  if (period === "daily") return dayOptions;
  if (period === "weekly") return weekOptions;
  return monthOptions;
}

export function filterWageOrders(orders: WageOrder[], period: Period, key: string) {
  if (period === "daily") return orders.filter((order) => order.dayKey === key);
  if (period === "weekly") return orders.filter((order) => order.weekKey === key);
  return orders.filter((order) => order.monthKey === key);
}
