import type {
  WebOrder,
  WebOrderStatusHistory,
  WebOrderStop,
  WebProfile,
} from '@/data/supabase/webSupabaseContract';

export type LiveOrderListItem = {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  deliveryAddress: string;
  fee: number;
  status: WebOrder['status'];
  createdAt: string;
  assignedCaptainId: string | null;
  assignedCaptainName: string | null;
  cancellationReason: string | null;
  order: WebOrder;
};

export type LiveOrderStopItem = {
  id: string;
  sequence: number;
  contactName: string;
  contactPhone: string;
  address: string;
  note: string | null;
};

export type LiveOrderTimelineItem = {
  id: string;
  status: WebOrderStatusHistory['next_status'];
  timestamp: string;
  actorName: string;
  note: string | null;
};

function profileDisplayName(profile: WebProfile): string {
  return profile.full_name?.trim() || profile.email;
}

export function mapLiveOrderListItem(order: WebOrder, profiles: WebProfile[]): LiveOrderListItem {
  const assignedCaptain = order.assigned_captain_id
    ? profiles.find((profile) => profile.id === order.assigned_captain_id) ?? null
    : null;

  return {
    id: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    pickupAddress: order.pickup_address,
    deliveryAddress: order.delivery_address,
    fee: order.fee,
    status: order.status,
    createdAt: order.created_at,
    assignedCaptainId: order.assigned_captain_id,
    assignedCaptainName: assignedCaptain ? profileDisplayName(assignedCaptain) : null,
    cancellationReason: order.cancellation_reason,
    order,
  };
}

export function mapLiveOrderStops(stops: WebOrderStop[]) {
  const pickups: LiveOrderStopItem[] = [];
  const destinations: LiveOrderStopItem[] = [];

  stops.forEach((stop) => {
    const mappedStop: LiveOrderStopItem = {
      id: stop.id,
      sequence: stop.sequence,
      contactName: stop.contact_name,
      contactPhone: stop.contact_phone,
      address: stop.address,
      note: stop.note,
    };

    if (stop.stop_type === 'pickup') pickups.push(mappedStop);
    if (stop.stop_type === 'delivery') destinations.push(mappedStop);
  });

  return { pickups, destinations };
}

export function mapLiveOrderTimeline(
  history: WebOrderStatusHistory[],
  profiles: WebProfile[],
  cancellationReason: string | null,
): LiveOrderTimelineItem[] {
  const profilesById = new Map(profiles.map((profile) => [profile.id, profileDisplayName(profile)]));

  return history.map((item) => ({
    id: item.id,
    status: item.next_status,
    timestamp: item.changed_at,
    actorName: item.changed_by_user_id ? profilesById.get(item.changed_by_user_id) ?? 'النظام' : 'النظام',
    note: item.note ?? (item.next_status === 'cancelled' ? cancellationReason : null),
  }));
}
