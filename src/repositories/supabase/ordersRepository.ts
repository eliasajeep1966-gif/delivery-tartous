import { OrdersRepository, DeliveryOrder, CreateOrderInput, ChangeOrderStatusInput, OrderFilters } from '../interfaces';
import { getSupabaseClient } from '@/data/supabase/client';
import { mapOrderRowToDeliveryOrder } from '@/data/supabase/mappers';
import { Tables } from '@/data/supabase/database.types';

type OrderRow = Tables<'orders'>;

export class SupabaseOrdersRepository implements OrdersRepository {
  async listOrders(filters?: OrderFilters): Promise<DeliveryOrder[]> {
    const client = getSupabaseClient();
    let query = client.from('orders').select('*');

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.captainId) {
      query = query.eq('assigned_captain_id', filters.captainId);
    }
    if (filters?.createdBy) {
      query = query.eq('created_by_user_id', filters.createdBy);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapOrderRowToDeliveryOrder);
  }

  async getOrder(id: string): Promise<DeliveryOrder | null> {
    const client = getSupabaseClient();
    const { data, error } = await client.from('orders').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    if (!data) return null;
    return mapOrderRowToDeliveryOrder(data as OrderRow);
  }

  async createOrder(input: CreateOrderInput): Promise<DeliveryOrder> {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('create_order', {
      p_customer_name: input.customerName,
      p_customer_phone: input.customerPhone,
      p_pickup_address: input.pickupAddress,
      p_delivery_address: input.deliveryAddress,
      p_fee: input.fee,
    });
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Failed to create order');
    return mapOrderRowToDeliveryOrder(data as OrderRow);
  }

  async assignCaptain(orderId: string, captainId: string): Promise<DeliveryOrder> {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('assign_order_captain', {
      p_order_id: orderId,
      p_captain_id: captainId,
    });
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Failed to assign captain');
    return mapOrderRowToDeliveryOrder(data as OrderRow);
  }

  async cancelOrder(orderId: string, reason: string): Promise<DeliveryOrder> {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('cancel_order', {
      p_order_id: orderId,
      p_cancellation_reason: reason,
    });
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Failed to cancel order');
    return mapOrderRowToDeliveryOrder(data as OrderRow);
  }

  async changeOrderStatus(input: ChangeOrderStatusInput): Promise<DeliveryOrder> {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('transition_assigned_order', {
      p_order_id: input.orderId,
      p_next_status: input.nextStatus,
    });
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Failed to transition order');
    return mapOrderRowToDeliveryOrder(data as OrderRow);
  }
}
