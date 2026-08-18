import {
  AppSession,
  UserProfile,
  CaptainProfile,
  CaptainAvailability,
  DeliveryOrder,
  OrderFilters,
  CreateOrderInput,
  ChangeOrderStatusInput,
  ActorContext,
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
  ActorContext,
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
  changeOrderStatus(actor: ActorContext, input: ChangeOrderStatusInput): Promise<DeliveryOrder>;
}

export interface UsersRepository {
  getProfile(userId: string): Promise<UserProfile | null>;
  listCaptains(): Promise<CaptainProfile[]>;
  setCaptainAvailability(status: CaptainAvailability): Promise<void>;
}
