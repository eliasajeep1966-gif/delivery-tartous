import type { Session } from '@supabase/supabase-js';

import { getSupabaseClient } from './supabaseClient';
import type { Database, Json, Tables } from './database.types';

/**
 * The only approved application-facing Supabase API.
 * Screens and hooks use this module; they never write directly to protected tables.
 */

export type AppRole = Database['public']['Enums']['app_role'];
export type OrderStatus = Database['public']['Enums']['order_status'];
export type CaptainAvailability = Database['public']['Enums']['captain_availability'];

export type Profile = Tables<'profiles'>;
export type Order = Tables<'orders'>;
export type OrderStop = Tables<'order_stops'>;
export type OrderStopType = Database['public']['Enums']['order_stop_type'];
export type CaptainStatus = Tables<'captain_status'>;
export type FinancialLedgerEntry = Tables<'financial_ledger'>;
export type OrderStatusHistory = Tables<'order_status_history'>;
export type CaptainCustody = Tables<'captain_custody'>;
export type PendingAccountActivation = Tables<'pending_account_activations'>;
export type PendingCaptainCustody = Tables<'pending_captain_custody'>;
export type CaptainPayout = Tables<'captain_payouts'>;
export type CaptainPayoutItem = Tables<'captain_payout_items'>;
export type Permission = Tables<'permissions'>;
export type UserPermissionOverride = Tables<'user_permission_overrides'>;

type RpcName = keyof Database['public']['Functions'];
type RpcReturn<Name extends RpcName> = Database['public']['Functions'][Name]['Returns'];
type RpcRow<Name extends RpcName> = RpcReturn<Name> extends Array<infer Row> ? Row : never;

export type WageTotals = RpcRow<'get_wage_totals'>;
export type CaptainWageSummary = RpcRow<'get_captain_wage_summary'>;
export type CaptainWageDetail = RpcRow<'get_captain_wage_details'>;

export type CreateOrderInput = {
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  deliveryAddress: string;
  fee: number;
};

/** A single ordered pickup or delivery point for a multi-stop order. */
export type OrderStopInput = {
  stopType: OrderStopType;
  sequence: number;
  contactName: string;
  contactPhone: string;
  address: string;
  note?: string | null;
};

/** One order-level fee applies to all stops; individual stops never carry fees. */
export type CreateOrderWithStopsInput = {
  stops: OrderStopInput[];
  fee: number;
};

export type CreatePendingAccountInput = {
  email: string;
  fullName?: string;
  role: AppRole;
  /** One custody item per line. Custody is valid only for a captain. */
  custodyItemsText?: string;
};

export type ActivatePendingAccountInput = {
  email: string;
  password: string;
  passwordConfirmation: string;
};

export type ActivatePendingAccountResult = {
  message: string;
  profile: Pick<Profile, 'id' | 'role'>;
};

type HasMessage = { message: string } | null;

function unwrap<T>(data: T | null, error: HasMessage, fallbackMessage: string): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error(fallbackMessage);
  return data;
}

function validatePendingActivation(input: ActivatePendingAccountInput) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email is required.');
  }
  if (input.password !== input.passwordConfirmation) {
    throw new Error('Password confirmation does not match.');
  }
  if (input.password.length < 12) {
    throw new Error('Password must be at least 12 characters long.');
  }
  return email;
}

export const deliverySupabase = {
  auth: {
    async getSession(): Promise<Session | null> {
      const { data, error } = await getSupabaseClient().auth.getSession();
      if (error) throw new Error(error.message);
      return data.session;
    },

    async signInWithPassword(email: string, password: string): Promise<Session> {
      const { data, error } = await getSupabaseClient().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      return unwrap(data.session, error, 'Login did not create a session.');
    },

    async signOut(): Promise<void> {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw new Error(error.message);
    },

    /** First use only: creates Auth user from an admin-created Pending account. No email link is used. */
    async activatePendingAccount(input: ActivatePendingAccountInput): Promise<ActivatePendingAccountResult> {
      const email = validatePendingActivation(input);
      const { data, error } = await getSupabaseClient().functions.invoke<ActivatePendingAccountResult>(
        'activate-pending-account',
        {
          body: {
            email,
            password: input.password,
            passwordConfirmation: input.passwordConfirmation,
          },
        }
      );
      return unwrap(data, error, 'Account activation could not be completed.');
    },
  },

  reads: {
    async myProfile(): Promise<Profile> {
      const { data, error } = await getSupabaseClient().from('profiles').select('*').single();
      return unwrap(data, error, 'Profile not found.');
    },

    async profiles(): Promise<Profile[]> {
      const { data, error } = await getSupabaseClient()
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      return unwrap(data, error, 'Could not load user profiles.');
    },

    async captainStatuses(): Promise<CaptainStatus[]> {
      const { data, error } = await getSupabaseClient()
        .from('captain_status')
        .select('*')
        .order('updated_at', { ascending: false });
      return unwrap(data, error, 'Could not load captain availability.');
    },

    async orders(): Promise<Order[]> {
      const { data, error } = await getSupabaseClient()
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      return unwrap(data, error, 'Could not load orders.');
    },

    async orderStatusHistory(orderId: string): Promise<OrderStatusHistory[]> {
      const { data, error } = await getSupabaseClient()
        .from('order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .order('changed_at', { ascending: true });
      return unwrap(data, error, 'Could not load order history.');
    },

    async orderStops(orderId: string): Promise<OrderStop[]> {
      const { data, error } = await getSupabaseClient()
        .from('order_stops')
        .select('*')
        .eq('order_id', orderId)
        .order('stop_type', { ascending: true })
        .order('sequence', { ascending: true });
      return unwrap(data, error, 'Could not load order stops.');
    },

    async myCustody(): Promise<CaptainCustody[]> {
      const { data, error } = await getSupabaseClient()
        .from('captain_custody')
        .select('*')
        .order('assigned_at', { ascending: false });
      return unwrap(data, error, 'Could not load custody records.');
    },

    async permissions(): Promise<Permission[]> {
      const { data, error } = await getSupabaseClient()
        .from('permissions')
        .select('*')
        .order('code', { ascending: true });
      return unwrap(data, error, 'Could not load permissions.');
    },

    async userPermissionOverrides(userId: string): Promise<UserPermissionOverride[]> {
      const { data, error } = await getSupabaseClient()
        .from('user_permission_overrides')
        .select('*')
        .eq('user_id', userId)
        .order('permission_code', { ascending: true });
      return unwrap(data, error, 'Could not load user permission overrides.');
    },

    async pendingAccounts(): Promise<PendingAccountActivation[]> {
      const { data, error } = await getSupabaseClient().rpc('list_pending_accounts');
      return unwrap(data, error, 'Could not load pending accounts.');
    },

    async wageTotals(): Promise<WageTotals> {
      const { data, error } = await getSupabaseClient().rpc('get_wage_totals');
      const rows = unwrap(data, error, 'Could not load wage totals.');
      if (!rows[0]) throw new Error('Wage totals did not return a result.');
      return rows[0];
    },

    async captainWageSummary(captainId?: string): Promise<CaptainWageSummary[]> {
      const { data, error } = await getSupabaseClient().rpc('get_captain_wage_summary',
        captainId ? { p_captain_id: captainId } : undefined
      );
      return unwrap(data, error, 'Could not load captain wage summary.');
    },

    async captainWageDetails(captainId: string): Promise<CaptainWageDetail[]> {
      const { data, error } = await getSupabaseClient().rpc('get_captain_wage_details', {
        p_captain_id: captainId,
      });
      return unwrap(data, error, 'Could not load captain wage details.');
    },
  },

  actions: {
    async createOrder(input: CreateOrderInput): Promise<Order> {
      const { data, error } = await getSupabaseClient().rpc('create_order', {
        p_customer_name: input.customerName,
        p_customer_phone: input.customerPhone,
        p_pickup_address: input.pickupAddress,
        p_delivery_address: input.deliveryAddress,
        p_fee: input.fee,
      });
      return unwrap(data, error, 'Order creation did not return an order.');
    },

    async createOrderWithStops(input: CreateOrderWithStopsInput): Promise<Order> {
      const stops: Json = input.stops.map((stop) => ({
        stop_type: stop.stopType,
        sequence: stop.sequence,
        contact_name: stop.contactName,
        contact_phone: stop.contactPhone,
        address: stop.address,
        note: stop.note ?? null,
      }));
      const { data, error } = await getSupabaseClient().rpc('create_order_with_stops', {
        p_stops: stops,
        p_fee: input.fee,
      });
      return unwrap(data, error, 'Multi-stop order creation did not return an order.');
    },

    async assignOrderCaptain(orderId: string, captainId: string): Promise<Order> {
      const { data, error } = await getSupabaseClient().rpc('assign_order_captain', {
        p_order_id: orderId,
        p_captain_id: captainId,
      });
      return unwrap(data, error, 'Order assignment did not return an order.');
    },

    async cancelOrder(orderId: string, reason: string): Promise<Order> {
      const { data, error } = await getSupabaseClient().rpc('cancel_order', {
        p_order_id: orderId,
        p_cancellation_reason: reason,
      });
      return unwrap(data, error, 'Order cancellation did not return an order.');
    },

    async transitionAssignedOrder(orderId: string, nextStatus: OrderStatus): Promise<Order> {
      const { data, error } = await getSupabaseClient().rpc('transition_assigned_order', {
        p_order_id: orderId,
        p_next_status: nextStatus,
      });
      return unwrap(data, error, 'Order transition did not return an order.');
    },

    async setCaptainAvailability(availability: CaptainAvailability): Promise<CaptainStatus> {
      const { data, error } = await getSupabaseClient().rpc('set_captain_availability', {
        new_availability: availability,
      });
      return unwrap(data, error, 'Availability update did not return a record.');
    },

    async createPendingAccount(input: CreatePendingAccountInput): Promise<PendingAccountActivation> {
      const { data, error } = await getSupabaseClient().rpc('create_pending_account', {
        p_email: input.email.trim().toLowerCase(),
        p_full_name: input.fullName?.trim() || undefined,
        p_role: input.role,
        p_custody_items_text: input.custodyItemsText || undefined,
      });
      return unwrap(data, error, 'Pending account creation did not return a record.');
    },

    async cancelPendingAccount(pendingId: string): Promise<PendingAccountActivation> {
      const { data, error } = await getSupabaseClient().rpc('cancel_pending_account', {
        p_pending_id: pendingId,
      });
      return unwrap(data, error, 'Pending account cancellation did not return a record.');
    },

    async setCaptainActive(captainId: string, isActive: boolean): Promise<Profile> {
      const { data, error } = await getSupabaseClient().rpc('set_captain_active', {
        p_captain_id: captainId,
        p_is_active: isActive,
      });
      return unwrap(data, error, 'Captain status update did not return a profile.');
    },

    async assignCaptainCustody(
      captainId: string,
      itemName: string,
      itemDetails?: string
    ): Promise<CaptainCustody> {
      const { data, error } = await getSupabaseClient().rpc('assign_captain_custody', {
        p_captain_id: captainId,
        p_item_name: itemName,
        p_item_details: itemDetails,
      });
      return unwrap(data, error, 'Custody assignment did not return a record.');
    },

    async returnCaptainCustody(custodyId: string, returnNotes?: string): Promise<CaptainCustody> {
      const { data, error } = await getSupabaseClient().rpc('return_captain_custody', {
        p_custody_id: custodyId,
        p_return_notes: returnNotes,
      });
      return unwrap(data, error, 'Custody return did not return a record.');
    },

    async createCaptainPayout(
      captainId: string,
      financialLedgerIds: string[],
      notes?: string
    ): Promise<CaptainPayout> {
      const { data, error } = await getSupabaseClient().rpc('create_captain_payout', {
        p_captain_id: captainId,
        p_financial_ledger_ids: financialLedgerIds,
        p_notes: notes,
      });
      return unwrap(data, error, 'Captain payout did not return a record.');
    },

    async setUserRole(userId: string, role: AppRole): Promise<Profile> {
      const { data, error } = await getSupabaseClient().rpc('set_user_role', {
        p_user_id: userId,
        p_role: role,
      });
      return unwrap(data, error, 'Role update did not return a profile.');
    },

    async setUserPermissionOverride(
      userId: string,
      permissionCode: string,
      isAllowed: boolean
    ): Promise<UserPermissionOverride> {
      const { data, error } = await getSupabaseClient().rpc('set_user_permission_override', {
        p_user_id: userId,
        p_permission_code: permissionCode,
        p_is_allowed: isAllowed,
      });
      return unwrap(data, error, 'Permission update did not return an override.');
    },
  },
} as const;

/**
 * Prohibited outside src/data/supabase:
 * - getSupabaseClient().from('orders').insert/update/delete(...)
 * - getSupabaseClient().from('order_stops').insert/update/delete(...)
 * - getSupabaseClient().from('financial_ledger').insert/update/delete(...)
 * - getSupabaseClient().from('captain_payouts').insert/update/delete(...)
 * - getSupabaseClient().from('captain_payout_items').insert/update/delete(...)
 * - getSupabaseClient().from('pending_account_activations').insert/update/delete(...)
 * - getSupabaseClient().from('profiles').insert/update/delete(...)
 * - getSupabaseClient().from('captain_custody').insert/update/delete(...)
 * - auth.signUp(...) from Expo
 * - service_role keys or any secret in Expo source
 */
