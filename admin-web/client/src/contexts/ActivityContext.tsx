/** Local UI activity state — replace with Supabase order and audit-log adapters during backend integration. */
import { createContext, useContext, useState, type ReactNode } from "react";
import type { Order } from "@/lib/dashboard-data";

export type LiveActivity = {
  id: string;
  category: "orders";
  action: string;
  subject: string;
  actor: string;
  time: string;
  details: string;
  tone: "blue";
};

type OrderCreationInput = {
  customer: string;
  location: string;
  source: string;
  captain: string;
  note: string;
};

type ActivityContextValue = {
  createdOrders: Order[];
  createdActivities: LiveActivity[];
  createOrder: (input: OrderCreationInput) => Order;
};

const ActivityContext = createContext<ActivityContextValue | null>(null);

const timeFormatter = new Intl.DateTimeFormat("ar-SY", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function ActivityProvider({ children }: { children: ReactNode }) {
  const [createdOrders, setCreatedOrders] = useState<Order[]>([]);
  const [createdActivities, setCreatedActivities] = useState<LiveActivity[]>([]);

  const createOrder = (input: OrderCreationInput) => {
    const now = new Date();
    const timestamp = timeFormatter.format(now);
    const id = String(1050 + createdOrders.length);
    const order: Order = {
      id,
      customer: input.customer || "مستلم جديد",
      amount: "قيد التحديد",
      location: input.location || "عنوان قيد التحديد",
      status: "waiting",
      timestamp,
    };
    const noteText = input.note.trim() ? ` ملاحظة المصدر: ${input.note.trim()}.` : "";
    const activity: LiveActivity = {
      id: crypto.randomUUID(),
      category: "orders",
      action: "إنشاء طلب",
      subject: `الطلب #${id}`,
      actor: "إيلي جيب",
      time: timestamp,
      details: `تم إنشاء الطلب من ${input.source || "مصدر جديد"} إلى ${input.location || "وجهة جديدة"} وتعيين الكابتن ${input.captain}.${noteText}`,
      tone: "blue",
    };
    setCreatedOrders((current) => [order, ...current]);
    setCreatedActivities((current) => [activity, ...current]);
    return order;
  };

  return <ActivityContext.Provider value={{ createdOrders, createdActivities, createOrder }}>{children}</ActivityContext.Provider>;
}

export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) throw new Error("useActivity must be used inside ActivityProvider");
  return context;
}
