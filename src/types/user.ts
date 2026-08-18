import { UserRole, CaptainAvailability } from './order';

export interface AppSession {
  userId: string;
  role: UserRole;
  email: string;
}

export interface UserProfile {
  userId: string;
  role: UserRole;
  name: string;
}

export interface ActorContext {
  userId: string;
  role: UserRole;
}

export interface CaptainProfile {
  userId: string;
  name: string;
  availability: CaptainAvailability;
}

export type Permission =
  | 'manage_users'
  | 'create_orders'
  | 'assign_captains'
  | 'cancel_orders'
  | 'view_all_orders'
  | 'view_own_orders'
  | 'manage_finances'
  | 'change_availability';
