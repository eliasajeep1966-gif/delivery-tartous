import {
  AppSession,
  UserProfile,
  CaptainProfile,
  CaptainAvailability,
  DeliveryOrder,
  OrderFilters,
  CreateOrderInput,
  ChangeOrderStatusInput,
} from '@/types';

export {
  AppSession,
  UserProfile,
  CaptainProfile,
  CaptainAvailability,
  DeliveryOrder,
  OrderFilters,
  CreateOrderInput,
  ChangeOrderStatusInput,
};

export interface AuthRepository {
  getCurrentSession(): Promise<AppSession | null>;
  signIn(email: string, password: string): Promise<AppSession>;
  signOut(): Promise<void>;
}

export interface OrdersRepository {
  listOrders(filters?: OrderFilters): Promise<DeliveryOrder[]>;
  getOrder(id: string): Promise<DeliveryOrder | null>;
  createOrder(input: CreateOrderInput): Promise<DeliveryOrder>;
  assignCaptain(orderId: string, captainId: string): Promise<DeliveryOrder>;
  cancelOrder(orderId: string, reason: string): Promise<DeliveryOrder>;
  changeOrderStatus(input: ChangeOrderStatusInput): Promise<DeliveryOrder>;
}

export interface UsersRepository {
  getProfile(userId: string): Promise<UserProfile | null>;
  listCaptains(): Promise<CaptainProfile[]>;
  setCaptainAvailability(status: CaptainAvailability): Promise<void>;
}
