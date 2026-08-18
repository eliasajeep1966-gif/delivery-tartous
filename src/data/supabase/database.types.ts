export type AppRole = 'admin' | 'supervisor' | 'captain';

export type CaptainAvailability = 'available' | 'unavailable';

export type OrderStatus =
  | 'pending'
  | 'assigned'
  | 'received'
  | 'in_delivery'
  | 'completed'
  | 'cancelled'
  | 'false_order';

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PermissionRow {
  code: string;
  description: string | null;
  created_at: string;
}

export interface RolePermissionRow {
  role: AppRole;
  permission_code: string;
  is_allowed: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPermissionOverrideRow {
  user_id: string;
  permission_code: string;
  is_allowed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CaptainStatusRow {
  captain_id: string;
  availability: CaptainAvailability;
  updated_at: string;
}

export interface OrderRow {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string;
  pickup_address: string;
  delivery_address: string;
  fee: number;
  status: OrderStatus;
  assigned_captain_id: string | null;
  created_by_user_id: string;
  cancellation_reason: string | null;
  assigned_at: string | null;
  received_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  false_order_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderStatusHistoryRow {
  id: string;
  order_id: string;
  previous_status: OrderStatus | null;
  next_status: OrderStatus;
  changed_by_user_id: string | null;
  note: string | null;
  changed_at: string;
}

export interface FinancialLedgerRow {
  id: string;
  order_id: string;
  captain_id: string;
  source_status: 'completed' | 'false_order';
  gross_fee: number;
  captain_amount: number;
  company_amount: number;
  settlement_amount: number;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
