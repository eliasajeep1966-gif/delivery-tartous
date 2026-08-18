import { OrdersRepository, DeliveryOrder, CreateOrderInput, ChangeOrderStatusInput, OrderFilters } from '../interfaces';

export class InMemoryOrdersRepository implements OrdersRepository {
  private orders: Map<string, DeliveryOrder> = new Map();

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
      createdByUserId: input.createdByUserId,
      cancellationReason: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.orders.set(id, order);
    return order;
  }

  async changeOrderStatus(input: ChangeOrderStatusInput): Promise<DeliveryOrder> {
    const order = this.orders.get(input.orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    const updated: DeliveryOrder = {
      ...order,
      status: input.nextStatus as any,
      updatedAt: new Date().toISOString(),
      cancellationReason: input.cancellationReason ?? order.cancellationReason,
    };
    if (input.nextStatus === 'completed') {
      updated.completedAt = new Date().toISOString();
    }
    this.orders.set(input.orderId, updated);
    return updated;
  }
}
