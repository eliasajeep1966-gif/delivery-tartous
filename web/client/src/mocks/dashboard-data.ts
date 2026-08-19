/** Mock dashboard and admin operations data. Replace this module with a future web data adapter. */
import type { AdminCaptainListItem, AdminOrderDetail, AdminOrderListItem, CaptainOption, PendingAccountListItem } from "@/features/admin/types";

export const summaryMetrics = [
  { id: "pending", label: "قيد الانتظار", value: 4, icon: "package" },
  { id: "in_delivery", label: "قيد التوصيل", value: 7, icon: "bike" },
  { id: "completed", label: "طلبات مكتملة اليوم", value: 18, icon: "check" },
  { id: "cancelled", label: "طلبات ملغاة", value: 2, icon: "cancel" },
] as const;

export const recentOrders: AdminOrderListItem[] = [
  { id: "1042", customer: "محمد العلي", amount: "35,000 ل.س", location: "الرمل الجنوبي", status: "completed", timestamp: "الثلاثاء 19 آب، 10:42 ص" },
  { id: "1045", customer: "لينا حمدان", amount: "25,000 ل.س", location: "بانياس", status: "pending", timestamp: "الثلاثاء 19 آب، 10:18 ص" },
  { id: "1048", customer: "سامر أحمد", amount: "40,000 ل.س", location: "صافيتا", status: "received", timestamp: "الثلاثاء 19 آب، 09:55 ص" },
];

export const orderDetails: AdminOrderDetail[] = [
  { ...recentOrders[0], customerPhone: "0933001122", fee: 35000, captain: { id: "captain-1", name: "محمد علي" }, pickups: [{ name: "متجر الساحل", phone: "0933004455", address: "شارع الثورة، طرطوس", note: "يُسلّم ضمن كيس حراري." }], destinations: [{ name: "محمد العلي", phone: "0933001122", address: "الرمل الجنوبي، بناء 12" }], timeline: [{ status: "pending", label: "تم إنشاء الطلب", timestamp: "الثلاثاء 19 آب، 09:52 ص", actor: "هشام علي" }, { status: "assigned", label: "تم تعيين الكابتن", timestamp: "الثلاثاء 19 آب، 10:00 ص", actor: "هشام علي" }, { status: "received", label: "تم الاستلام", timestamp: "الثلاثاء 19 آب، 10:18 ص", actor: "محمد علي" }, { status: "completed", label: "تم التسليم", timestamp: "الثلاثاء 19 آب، 10:42 ص", actor: "محمد علي" }] },
  { ...recentOrders[1], customerPhone: "0933002233", fee: 25000, pickups: [{ name: "صيدلية المدينة", phone: "0933006677", address: "دوار الساعة، بانياس", note: "اتصل قبل الاستلام." }], destinations: [{ name: "لينا حمدان", phone: "0933002233", address: "بانياس، حي البلدية" }], timeline: [{ status: "pending", label: "تم إنشاء الطلب", timestamp: "الثلاثاء 19 آب، 10:18 ص", actor: "هشام علي" }] },
  { ...recentOrders[2], customerPhone: "0933003344", fee: 40000, captain: { id: "captain-2", name: "حسن يوسف" }, pickups: [{ name: "مكتبة الندى", phone: "0933007788", address: "شارع الكورنيش، طرطوس" }], destinations: [{ name: "سامر أحمد", phone: "0933003344", address: "صافيتا، مقابل البلدية" }], timeline: [{ status: "pending", label: "تم إنشاء الطلب", timestamp: "الثلاثاء 19 آب، 09:22 ص", actor: "هشام علي" }, { status: "assigned", label: "تم تعيين الكابتن", timestamp: "الثلاثاء 19 آب، 09:31 ص", actor: "هشام علي" }, { status: "received", label: "تم الاستلام", timestamp: "الثلاثاء 19 آب، 09:55 ص", actor: "حسن يوسف" }] },
];

export const availableCaptains: CaptainOption[] = [
  { id: "captain-1", name: "علي", initial: "ع", availability: "available" },
  { id: "captain-2", name: "حسن", initial: "ح", availability: "available" },
  { id: "captain-3", name: "يوسف", initial: "ي", availability: "available" },
  { id: "captain-4", name: "رامي", initial: "ر", availability: "available" },
];

export const captains: AdminCaptainListItem[] = [
  { id: "captain-1", name: "محمد علي", initial: "م", availability: "available", activation: "active", completedOrders: 48, currentOrderId: "1042", custodyItems: [{ label: "حقيبة حرارية", status: "held" }, { label: "هاتف العمل", status: "held" }, { label: "وصلة شحن", status: "held" }] },
  { id: "captain-2", name: "حسن يوسف", initial: "ح", availability: "unavailable", activation: "active", completedOrders: 37, currentOrderId: "1048", custodyItems: [{ label: "حقيبة حرارية", status: "held" }, { label: "سترة دليفري", status: "held" }] },
  { id: "captain-3", name: "رامي إبراهيم", initial: "ر", availability: "available", activation: "inactive", completedOrders: 21, custodyItems: [{ label: "حقيبة حرارية", status: "returned" }] },
];

export const pendingAccounts: PendingAccountListItem[] = [
  { id: "pending-1", name: "كريم حمود", email: "karim@delivery-tartous.com", role: "captain", custodyItemsText: "حقيبة حرارية\nسترة دليفري", createdAt: "الثلاثاء 19 آب، 11:15 ص" },
  { id: "pending-2", name: "نور أسعد", email: "nour@delivery-tartous.com", role: "supervisor", createdAt: "الاثنين 18 آب، 04:20 م" },
];
