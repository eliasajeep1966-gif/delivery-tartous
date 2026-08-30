import type { SupabaseClient } from "@supabase/supabase-js";

import { getNativeSupabaseClient } from "@/lib/supabase/native-supabase";

export type CaptainOrderStatus = "pending" | "assigned" | "received" | "in_delivery" | "completed" | "cancelled" | "false_order" | "reversed";
export type CaptainAvailability = "available" | "unavailable" | "offline";

export type CaptainOrder = {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string;
  pickup_address: string;
  pickup_contact_name?: string | null;
  pickup_contact_phone?: string | null;
  delivery_address: string;
  fee: number;
  status: CaptainOrderStatus;
  assigned_captain_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type CaptainOrdersPage = {
  orders: CaptainOrder[];
  total: number;
};

type CaptainOrderStopsPageRow = CaptainOrder & {
  order_stops:
    | Pick<
        CaptainOrderStop,
        "address" | "contact_name" | "contact_phone" | "sequence" | "stop_type"
      >[]
    | null;
};

function withPickupContact(order: CaptainOrderStopsPageRow): CaptainOrder {
  const pickup = (order.order_stops ?? [])
    .filter((stop) => stop.stop_type === "pickup")
    .sort((first, second) => first.sequence - second.sequence)[0];
  const { order_stops: _orderStops, ...baseOrder } = order;

  return {
    ...baseOrder,
    pickup_contact_name: pickup?.contact_name ?? null,
    pickup_contact_phone: pickup?.contact_phone ?? null,
  };
}

export type CaptainOrderStatusEvent = {
  order_id: string;
  next_status: string;
  changed_at: string;
};

export type CaptainOrderStop = {
  id: string;
  order_id: string;
  stop_type: "pickup" | "delivery";
  sequence: number;
  contact_name: string;
  contact_phone: string;
  address: string;
  note: string | null;
};

export type CaptainHomeMetrics = {
  availability: CaptainAvailability;
  completed_count: number;
  completed_gross: number;
};

export type CaptainActiveOrder = CaptainOrder & {
  stops: CaptainOrderStop[];
};

export type CaptainDashboard = {
  metrics: CaptainHomeMetrics;
  order_count: number;
  active_orders: CaptainActiveOrder[];
  // Legacy fields are retained during the mobile rollout for compatibility.
  active_order: CaptainOrder | null;
  active_stops: CaptainOrderStop[];
  recent_orders: CaptainOrder[];
};

export type CaptainWagePeriod = "daily" | "weekly" | "monthly";

export type CaptainWageTotals = {
  gross: number;
  captain: number;
  company: number;
  settlement: number;
  paid: number;
  unpaid: number;
};

export type CaptainWagesPage = {
  period_start: string;
  period_end: string;
  rows: CaptainWageRow[];
  total: number;
  totals: CaptainWageTotals;
};

export type CaptainWageRow = {
  captain_amount: number;
  company_amount: number;
  completed_at: string;
  delivery_address: string;
  delivery_contact_name: string;
  delivery_contact_phone: string;
  pickup_address: string;
  pickup_contact_name: string;
  pickup_contact_phone: string;
  financial_ledger_id: string;
  gross_fee: number;
  is_fully_paid: boolean;
  latest_paid_at: string | null;
  latest_payout_id: string | null;
  order_id: string;
  order_number: number;
  paid_amount: number;
  settlement_amount: number;
  source_status: CaptainOrderStatus;
  unpaid_amount: number;
};

export type CaptainCustody = {
  id: string;
  item_name: string;
  item_details: string | null;
  assigned_at: string;
  returned_at: string | null;
  return_notes: string | null;
};

type RpcClient = SupabaseClient;

type Result<T> = { data: T | null; error: { message: string } | null };

function client(): RpcClient {
  return getNativeSupabaseClient();
}

function unwrap<T>(result: Result<T>, fallback: string): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error(fallback);
  return result.data;
}

export const nativeCaptainContract = {
  reads: {
    async dashboard(): Promise<CaptainDashboard> {
      return unwrap(
        await client().rpc("get_my_captain_dashboard") as Result<CaptainDashboard>,
        "تعذر تحميل حساب الكابتن.",
      );
    },
    async homeMetrics(captainId: string): Promise<CaptainHomeMetrics> {
      const supabase = client();
      const [statusResult, completedResult] = await Promise.all([
        supabase
          .from("captain_status")
          .select("availability")
          .eq("captain_id", captainId)
          .maybeSingle(),
        supabase
          .from("orders")
          .select("fee")
          .eq("assigned_captain_id", captainId)
          .eq("status", "completed"),
      ]);

      if (statusResult.error) throw new Error(statusResult.error.message);
      if (completedResult.error) throw new Error(completedResult.error.message);

      const completedOrders = (completedResult.data ?? []) as { fee: number }[];
      return {
        availability:
          (statusResult.data?.availability as CaptainAvailability | undefined) ??
          "offline",
        completed_count: completedOrders.length,
        completed_gross: completedOrders.reduce(
          (total, order) => total + Number(order.fee),
          0,
        ),
      };
    },
    async orders(captainId: string): Promise<CaptainOrder[]> {
      const result = await client().from("orders").select("*").eq("assigned_captain_id", captainId).order("updated_at", { ascending: false }).order("id", { ascending: false });
      return unwrap(result as Result<CaptainOrder[]>, "تعذر تحميل سجل طلباتك.");
    },
    async ordersPage(
      captainId: string,
      { limit, offset }: { limit: number; offset: number },
    ): Promise<CaptainOrdersPage> {
      const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 50);
      const safeOffset = Math.max(Math.floor(offset), 0);
      const result = await client()
        .from("orders")
        .select(
          "*,order_stops(stop_type,sequence,contact_name,contact_phone,address)",
          { count: "exact" },
        )
        .eq("assigned_captain_id", captainId)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);

      if (result.error) throw new Error(result.error.message);
      return {
        orders: ((result.data ?? []) as CaptainOrderStopsPageRow[]).map(
          withPickupContact,
        ),
        total: result.count ?? 0,
      };
    },
    async orderStops(orderId: string): Promise<CaptainOrderStop[]> {
      const result = await client().from("order_stops").select("*").eq("order_id", orderId).order("stop_type", { ascending: true }).order("sequence", { ascending: true });
      return unwrap(result as Result<CaptainOrderStop[]>, "تعذر تحميل نقاط الطلب.");
    },
    async orderStatusHistory(orderIds: readonly string[]): Promise<CaptainOrderStatusEvent[]> {
      const uniqueOrderIds = Array.from(
        new Set(orderIds.filter((orderId) => typeof orderId === "string" && orderId.trim())),
      );
      if (!uniqueOrderIds.length) return [];

      const result = await client()
        .from("order_status_history")
        .select("order_id,next_status,changed_at")
        .in("order_id", uniqueOrderIds)
        .in("next_status", ["received", "in_delivery", "completed"]);
      return unwrap(
        result as Result<CaptainOrderStatusEvent[]>,
        "تعذر تحميل أوقات الاستلام والتوصيل.",
      );
    },
    async wages(captainId: string): Promise<CaptainWageRow[]> {
      return unwrap(await client().rpc("get_captain_wage_details_v2", { p_captain_id: captainId }) as Result<CaptainWageRow[]>, "تعذر تحميل أجورك.");
    },
    async wagesPage(
      period: CaptainWagePeriod,
      {
        limit,
        offset,
        customDate,
      }: { limit: number; offset: number; customDate?: string | null },
    ): Promise<CaptainWagesPage> {
      const result = await client().rpc("get_my_captain_wage_page", {
        p_period: period,
        p_limit: Math.min(Math.max(Math.floor(limit), 1), 50),
        p_offset: Math.max(Math.floor(offset), 0),
        p_custom_date: customDate ?? null,
      });
      return unwrap(
        result as Result<CaptainWagesPage>,
        "تعذر تحميل أجورك.",
      );
    },
    async custody(): Promise<CaptainCustody[]> {
      const result = await client().from("captain_custody").select("id,item_name,item_details,assigned_at,returned_at,return_notes").order("assigned_at", { ascending: false }).order("id", { ascending: false });
      return unwrap(result as Result<CaptainCustody[]>, "تعذر تحميل الأمانات.");
    },
    async profile(userId: string) {
      const result = await client().from("profiles").select("id,email,full_name,is_active,role,account_activated_at,created_at,updated_at").eq("id", userId).maybeSingle();
      return unwrap(result, "تعذر العثور على ملف الحساب.");
    },
  },
  actions: {
    async setAvailability(availability: CaptainAvailability): Promise<{ availability: CaptainAvailability; captain_id: string; updated_at: string }> {
      return unwrap(
        await client().rpc("set_captain_availability", { new_availability: availability }) as Result<{ availability: CaptainAvailability; captain_id: string; updated_at: string }>,
        "تعذر تحديث حالة التوفر.",
      );
    },
    async transitionOrder(orderId: string, nextStatus: Extract<CaptainOrderStatus, "received" | "in_delivery" | "completed" | "false_order">): Promise<CaptainOrder> {
      return unwrap(await client().rpc("transition_assigned_order", { p_order_id: orderId, p_next_status: nextStatus }) as Result<CaptainOrder>, "تعذر تحديث مرحلة الطلب.");
    },
    async updateName(fullName: string) {
      return unwrap(await client().rpc("update_my_profile", { p_full_name: fullName }), "تعذر تحديث الاسم.");
    },
    async updatePassword(password: string) {
      const result = await client().auth.updateUser({ password });
      if (result.error) throw new Error(result.error.message);
    },
  },
  realtime: {
    subscribe(captainId: string, onChange: () => void): () => void {
      const normalized = captainId.trim();
      if (!normalized) return () => undefined;

      const supabase = client();
      // Expo Fast Refresh and React Strict Mode can briefly run the effect twice.
      // Use a fresh channel name for every subscription so Supabase never receives
      // a callback registration after the previous channel has started subscribing.
      const channel = supabase
        .channel(`captain-orders:${normalized}:${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `assigned_captain_id=eq.${normalized}`,
          },
          onChange,
        )
        .subscribe();

      let active = true;
      return () => {
        if (!active) return;
        active = false;
        void supabase.removeChannel(channel);
      };
    },
  },
};
