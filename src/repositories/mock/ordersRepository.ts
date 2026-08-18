import { OrdersRepository, DeliveryOrder, CreateOrderInput, ChangeOrderStatusInput, OrderFilters } from '../interfaces';
import { canTransitionOrder, transitionOrder } from '@/logic/orderTransitions';
import { ActorContext } from '@/types';

export class InMemoryOrdersRepository implements OrdersRepository {
  private orders: Map<string, DeliveryOrder> = new Map();

  constructor(private actor: ActorContext) {}

  async listOrders(_filters?: OrderFilters): Promise<DeliveryOrder[]> {
    return Array.from(this.orders.values());
  }

  async getOrder(id: string): Promise<DeliveryOrder | null> {
    return this.orders.get(id) ?? null;
  }

  async createOrder(input: CreateOrderInput): Promise<DeliveryOrder> {
    const id = `order-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();
    const order: DeliveryOrder = {
      id,
      orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      pickupAddress: input.pickupAddress,
      deliveryAddress: input.deliveryAddress,
      fee: input.fee,
      status: 'pending',
      assignedCaptainId: null,
      createdByUserId: this.actor.userId,
      cancellationReason: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.orders.set(id, order);
    return order;
  }

  async assignCaptain(orderId: string, captainId: string): Promise<DeliveryOrder> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Order not found');

    const transitionResult = canTransitionOrder(this.actor, order, 'assigned');
    if (!transitionResult.allowed) {
      throw new Error(`Cannot assign captain: ${transitionResult.reason}`);
    }

    const updated = transitionOrder(order, this.actor, {
      orderId,
      nextStatus: 'assigned',
      cancellationReason: undefined,
    });

    if (updated === order) {
      throw new Error('Failed to transition order to assigned');
    }

    const finalOrder = {
      ...updated,
      assignedCaptainId: captainId,
    };

    this.orders.set(orderId, finalOrder);
    return finalOrder;
  }

  async cancelOrder(orderId: string, reason: string): Promise<DeliveryOrder> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('Order not found');

    if (!reason || reason.trim() === '') {
      throw new Error('Cancellation reason is required');
    }

    const updated = transitionOrder(order, this.actor, {
      orderId,
      nextStatus: 'cancelled',
      cancellationReason: reason,
    });

    if (updated === order) {
      throw new Error('Failed to cancel order');
    }

    this.orders.set(orderId, updated);
    return updated;
  }

  async changeOrderStatus(input: ChangeOrderStatusInput): Promise<DeliveryOrder> {
    const order = this.orders.get(input.orderId);
    if (!order) throw new Error('Order not found');

    const updated = transitionOrder(order, this.actor, input);
    if (updated === order) {
      throw new Error(`Cannot transition order to ${input.nextStatus}`);
    }

    this.orders.set(input.orderId, updated);
    return updated;
  }
}
