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

export type CaptainWageRow = {
  captain_amount: number;
  company_amount: number;
  completed_at: string;
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

function first<T>(result: Result<T[]>, fallback: string): T {
  const rows = unwrap(result, fallback);
  if (!rows[0]) throw new Error(fallback);
  return rows[0];
}

export const nativeCaptainContract = {
  reads: {
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
      const result = await client().from("orders").select("*").eq("assigned_captain_id", captainId).order("created_at", { ascending: false }).order("id", { ascending: false });
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
        .select("*", { count: "exact" })
        .eq("assigned_captain_id", captainId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);

      if (result.error) throw new Error(result.error.message);
      return {
        orders: (result.data ?? []) as CaptainOrder[],
        total: result.count ?? 0,
      };
    },
    async orderStops(orderId: string): Promise<CaptainOrderStop[]> {
      const result = await client().from("order_stops").select("*").eq("order_id", orderId).order("stop_type", { ascending: true }).order("sequence", { ascending: true });
      return unwrap(result as Result<CaptainOrderStop[]>, "تعذر تحميل نقاط الطلب.");
    },
    async wages(captainId: string): Promise<CaptainWageRow[]> {
      return unwrap(await client().rpc("get_captain_wage_details_v2", { p_captain_id: captainId }) as Result<CaptainWageRow[]>, "تعذر تحميل أجورك.");
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
