export type UserRole = 'admin' | 'supervisor' | 'captain';

export type OrderStatus =
  | 'pending'
  | 'assigned'
  | 'received'
  | 'in_delivery'
  | 'completed'
  | 'cancelled'
  | 'false_order';

export interface DeliveryOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  deliveryAddress: string;
  fee: number;
  status: OrderStatus;
  assignedCaptainId: string | null;
  createdByUserId: string;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type CaptainAvailability = 'available' | 'unavailable';

export interface OrderFilters {
  status?: OrderStatus;
  captainId?: string;
  createdBy?: string;
}

export interface CreateOrderInput {
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  deliveryAddress: string;
  fee: number;
}

export interface ChangeOrderStatusInput {
  orderId: string;
  nextStatus: OrderStatus;
  cancellationReason?: string;
}

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
}
