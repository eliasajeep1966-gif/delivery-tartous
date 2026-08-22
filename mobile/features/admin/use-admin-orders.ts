import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { type AdminOrderStatus } from "@/lib/admin/admin-home-mappers";
import { getNativeSupabaseClient } from "@/lib/supabase/native-supabase";

export type AdminOrdersFilter = "all" | AdminOrderStatus | "delivery_active";

export type AdminOrderListItem = {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  deliveryAddress: string;
  fee: number;
  status: AdminOrderStatus;
  createdAt: string;
  assignedCaptainId: string | null;
  assignedCaptainName: string | null;
};

type Cursor = { createdAt: string; id: string };
type OrdersPage = { items: AdminOrderListItem[]; nextCursor: Cursor | null };

export const ADMIN_ORDERS_PAGE_SIZE = 25;

const deliveryStatuses: readonly AdminOrderStatus[] = ["received", "in_delivery"];
const validStatuses: readonly AdminOrderStatus[] = ["pending", "assigned", "received", "in_delivery", "completed", "cancelled", "false_order"];

function isOrderStatus(value: unknown): value is AdminOrderStatus {
  return typeof value === "string" && validStatuses.includes(value as AdminOrderStatus);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function ordersKeysetFilter(cursor: Cursor | null): string | null {
  if (!cursor) return null;
  return `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`;
}

function statusesForFilter(filter: AdminOrdersFilter): readonly AdminOrderStatus[] | null {
  if (filter === "all") return null;
  return filter === "delivery_active" ? deliveryStatuses : [filter];
}

async function loadOrdersPage(filter: AdminOrdersFilter, cursor: Cursor | null): Promise<OrdersPage> {
  const client = getNativeSupabaseClient();
  const statuses = statusesForFilter(filter);
  let query = client.from("orders").select("*").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(ADMIN_ORDERS_PAGE_SIZE + 1);
  if (statuses?.length === 1) query = query.eq("status", statuses[0]);
  if (statuses && statuses.length > 1) query = query.in("status", statuses);
  const keyset = ordersKeysetFilter(cursor);
  if (keyset) query = query.or(keyset);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : [];
  const hasNextPage = rows.length > ADMIN_ORDERS_PAGE_SIZE;
  const currentRows = rows.slice(0, ADMIN_ORDERS_PAGE_SIZE);
  const captainIds = Array.from(new Set(currentRows.map((row) => stringValue(row.assigned_captain_id)).filter(Boolean)));
  const { data: profiles, error: profilesError } = captainIds.length
    ? await client.from("profiles").select("id,email,full_name").in("id", captainIds)
    : { data: [], error: null };
  if (profilesError) throw new Error(profilesError.message);

  const captainNames = new Map((profiles ?? []).flatMap((profile) => {
    if (typeof profile.id !== "string") return [];
    const name = typeof profile.full_name === "string" && profile.full_name.trim() ? profile.full_name.trim() : stringValue(profile.email, "كابتن");
    return [[profile.id, name] as const];
  }));

  const items = currentRows.flatMap((row) => {
    if (typeof row.id !== "string" || !isOrderStatus(row.status) || typeof row.order_number !== "number" || typeof row.created_at !== "string") return [];
    const assignedCaptainId = typeof row.assigned_captain_id === "string" ? row.assigned_captain_id : null;
    return [{
      id: row.id,
      orderNumber: row.order_number,
      customerName: stringValue(row.customer_name, "غير محدد"),
      customerPhone: stringValue(row.customer_phone),
      pickupAddress: stringValue(row.pickup_address, "غير محدد"),
      deliveryAddress: stringValue(row.delivery_address, "غير محدد"),
      fee: numberValue(row.fee),
      status: row.status,
      createdAt: row.created_at,
      assignedCaptainId,
      assignedCaptainName: assignedCaptainId ? captainNames.get(assignedCaptainId) ?? null : null,
    }];
  });

  const last = currentRows.at(-1);
  return {
    items,
    nextCursor: hasNextPage && last && typeof last.created_at === "string" && typeof last.id === "string" ? { createdAt: last.created_at, id: last.id } : null,
  };
}

export function useAdminOrders(filter: AdminOrdersFilter, enabled = true) {
  const [cursorHistory, setCursorHistory] = useState<(Cursor | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const currentCursor = cursorHistory[pageIndex] ?? null;

  useEffect(() => {
    setCursorHistory([null]);
    setPageIndex(0);
  }, [filter]);

  const page = useQuery({
    queryKey: ["admin-orders", filter, currentCursor?.createdAt ?? null, currentCursor?.id ?? null],
    queryFn: () => loadOrdersPage(filter, currentCursor),
    enabled,
    staleTime: 20_000,
    retry: 1,
  });

  const nextPage = useCallback(() => {
    const nextCursor = page.data?.nextCursor;
    if (!nextCursor || page.isFetching) return;
    const nextIndex = pageIndex + 1;
    setCursorHistory((current) => [...current.slice(0, nextIndex), nextCursor]);
    setPageIndex(nextIndex);
  }, [page.data?.nextCursor, page.isFetching, pageIndex]);

  const previousPage = useCallback(() => {
    if (pageIndex === 0 || page.isFetching) return;
    setPageIndex((current) => Math.max(0, current - 1));
  }, [page.isFetching, pageIndex]);

  return useMemo(() => ({
    ...page,
    items: page.data?.items ?? [],
    pageNumber: pageIndex + 1,
    hasNextPage: Boolean(page.data?.nextCursor),
    hasPreviousPage: pageIndex > 0,
    nextPage,
    previousPage,
  }), [nextPage, page, pageIndex, previousPage]);
}
