import type { RealtimeChannel } from "@supabase/supabase-js";

import { getNativeSupabaseClient } from "@/lib/supabase/native-supabase";
import {
  NativeAdminRequestTimeoutError,
  type NativeAdminOrderStopInput,
  type NativeCreatedOrder,
  type NativeEditableOrder,
} from "@/lib/supabase/types/admin-contracts.types";

const REQUEST_TIMEOUT_MS = 15_000;

function withTimeout<T>(request: PromiseLike<T>, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new NativeAdminRequestTimeoutError(message)),
      REQUEST_TIMEOUT_MS,
    );
    Promise.resolve(request).then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function createdOrder(value: unknown): NativeCreatedOrder {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object")
    throw new Error("لم يُرجع الخادم بيانات الطلب المنشأ.");
  const record = row as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.order_number !== "number"
  ) {
    throw new Error("بيانات الطلب المنشأ غير مكتملة.");
  }
  return {
    id: record.id,
    orderNumber: record.order_number,
    status: typeof record.status === "string" ? record.status : "pending",
  };
}

export function createNativeIdempotencyKey(): string {
  // Keep the key valid for deployments where the RPC argument is still uuid.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export const nativeAdminContract = {
  reads: {
    async editableOrder(orderId: string): Promise<NativeEditableOrder> {
      const client = getNativeSupabaseClient();
      const [orderResult, stopsResult] = await Promise.all([
        withTimeout(
          client.from("orders").select("id,order_number,fee,status").eq("id", orderId).single(),
          "انتهت مهلة تحميل بيانات الطلب للتعديل.",
        ),
        withTimeout(
          client.from("order_stops").select("stop_type,sequence,contact_name,contact_phone,address,note").eq("order_id", orderId).order("stop_type").order("sequence"),
          "انتهت مهلة تحميل نقاط الطلب للتعديل.",
        ),
      ]);
      if (orderResult.error) throw new Error(orderResult.error.message);
      if (stopsResult.error) throw new Error(stopsResult.error.message);
      const order = orderResult.data as Record<string, unknown>;
      const stops = (stopsResult.data ?? []).map((stop) => ({
        stopType: stop.stop_type as "pickup" | "delivery",
        sequence: Number(stop.sequence),
        contactName: String(stop.contact_name ?? ""),
        contactPhone: String(stop.contact_phone ?? ""),
        address: String(stop.address ?? ""),
        note: typeof stop.note === "string" ? stop.note : undefined,
      }));
      if (typeof order.id !== "string" || typeof order.order_number !== "number" || typeof order.fee !== "number") {
        throw new Error("بيانات الطلب للتعديل غير مكتملة.");
      }
      return { id: order.id, orderNumber: order.order_number, fee: order.fee, stops };
    },
  },
  actions: {
    async updateOrderWithStops(input: { orderId: string; stops: NativeAdminOrderStopInput[]; fee: number }): Promise<NativeCreatedOrder> {
      const stops = input.stops.map((stop) => ({
        stop_type: stop.stopType,
        sequence: stop.sequence,
        contact_name: stop.contactName.trim(),
        contact_phone: stop.contactPhone.trim(),
        address: stop.address.trim(),
        note: stop.note?.trim() || null,
      }));
      const result = await withTimeout(
        getNativeSupabaseClient().rpc("update_order_with_stops", {
          p_order_id: input.orderId,
          p_stops: stops,
          p_fee: input.fee,
        }),
        "انتهت مهلة تعديل الطلب. تحقّق من حالة الطلب قبل إعادة المحاولة.",
      );
      if (result.error) throw new Error(result.error.message);
      return createdOrder(result.data);
    },

    async createOrderWithStops(input: {
      stops: NativeAdminOrderStopInput[];
      fee: number;
      idempotencyKey: string;
      exceptionKeyword?: string;
    }): Promise<NativeCreatedOrder> {
      const stops = input.stops.map((stop) => ({
        stop_type: stop.stopType,
        sequence: stop.sequence,
        contact_name: stop.contactName.trim(),
        contact_phone: stop.contactPhone.trim(),
        address: stop.address.trim(),
        note: stop.note?.trim() || null,
      }));
      const result = await withTimeout(
        getNativeSupabaseClient().rpc("create_order_with_stops", {
          p_stops: stops,
          p_fee: input.fee,
          p_idempotency_key: input.idempotencyKey,
          p_exception_keyword: input.exceptionKeyword?.trim() || null,
        }),
        "انتهت مهلة إنشاء الطلب. تحقّق من قائمة الطلبات قبل إعادة الإرسال.",
      );
      if (result.error) throw new Error(result.error.message);
      return createdOrder(result.data);
    },

    async assignOrderCaptain(
      orderId: string,
      captainId: string,
      options?: { recordActivity?: boolean },
    ): Promise<NativeCreatedOrder> {
      const rpcName =
        options?.recordActivity === false
          ? "assign_order_captain_without_activity"
          : "assign_order_captain";
      const result = await withTimeout(
        getNativeSupabaseClient().rpc(rpcName, {
          p_order_id: orderId,
          p_captain_id: captainId,
        }),
        "انتهت مهلة تعيين الكابتن. تحقّق من حالة الطلب قبل إعادة المحاولة.",
      );
      if (result.error) throw new Error(result.error.message);
      return createdOrder(result.data);
    },
  },

  realtime: {
    subscribeOrders(onChange: () => void): () => void {
      const client = getNativeSupabaseClient();
      const uniqueId = Math.random().toString(36).substring(7);
      let active = true;
      let channel: RealtimeChannel | null = client
        .channel(`backoffice-finance:${Date.now()}-${uniqueId}`
)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          () => {
            if (active) onChange();
          },
        )
        .subscribe();

      return () => {
        active = false;
        if (channel) void client.removeChannel(channel);
        channel = null;
      };
    },
    subscribe(onChange: () => void): () => void {
      const client = getNativeSupabaseClient();
      const uniqueId = Math.random().toString(36).substring(7);
      let active = true;
      const channel = client
        .channel(`backoffice-finance:${Date.now()}-${uniqueId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "financial_ledger" },
          () => {
            if (active) onChange();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "captain_payouts" },
          () => {
            if (active) onChange();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "office_expenses" },
          () => {
            if (active) onChange();
          },
        )
        .subscribe();

      return () => {
        active = false;
        void client.removeChannel(channel);
      };
    },
  },
} as const;

export { nativeAdminUsersContract } from "@/lib/supabase/native-admin-users-contract";
export { NativeAdminRequestTimeoutError } from "@/lib/supabase/types/admin-contracts.types";
export type {
  NativeAdminOrderStopInput,
  NativeAppRole,
  NativeCreatedOrder,
  NativeEditableOrder,
  NativePendingAccount,
  NativePendingAccountInput,
  NativeUser,
} from "@/lib/supabase/types/admin-contracts.types";
