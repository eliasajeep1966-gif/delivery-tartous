import type { Session } from '@supabase/supabase-js';

import { getSupabaseClient } from './supabaseClient';
import type { Database, Tables } from './database.types';

/**
 * This module is the only approved application-facing Supabase API.
 * Do not call getSupabaseClient().from(...).insert/update/delete from screens.
 */

export type AppRole = Database['public']['Enums']['app_role'];
export type OrderStatus = Database['public']['Enums']['order_status'];
export type CaptainAvailability = Database['public']['Enums']['captain_availability'];

export type Profile = Tables<'profiles'>;
export type Order = Tables<'orders'>;
export type CaptainStatus = Tables<'captain_status'>;
export type FinancialLedgerEntry = Tables<'financial_ledger'>;
export type OrderStatusHistory = Tables<'order_status_history'>;
export type CaptainCustody = Tables<'captain_custody'>;
export type Permission = Tables<'permissions'>;
export type UserPermissionOverride = Tables<'user_permission_overrides'>;

export type CreateOrderInput = {
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  deliveryAddress: string;
  fee: number;
};

export type InviteUserInput = {
  email: string;
  fullName?: string;
  role: AppRole;
  /** One custody item per line. Valid only when role is captain. */
  custodyItemsText?: string;
};

export type InviteUserResult = {
  userId: string;
  email: string;
  role: AppRole;
  custodyItemCount: number;
  message: string;
};

export type AccountActivationInput = {
  password: string;
  passwordConfirmation: string;
};

type HasMessage = { message: string } | null;

function unwrap<T>(data: T | null, error: HasMessage, fallbackMessage: string): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error(fallbackMessage);
  return data;
}

function validatePasswordActivation(input: AccountActivationInput) {
  if (input.password !== input.passwordConfirmation) {
    throw new Error('Password confirmation does not match.');
  }
  if (input.password.length < 12) {
    throw new Error('Password must be at least 12 characters long.');
  }
}

export const deliverySupabase = {
  auth: {
    async getSession(): Promise<Session | null> {
      const { data, error } = await getSupabaseClient().auth.getSession();
      if (error) throw new Error(error.message);
      return data.session;
    },

    async signInWithPassword(email: string, password: string): Promise<Session> {
      const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
      return unwrap(data.session, error, 'Login did not create a session.');
    },

    async signOut(): Promise<void> {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw new Error(error.message);
    },

    /**
     * Call only after Supabase has verified an invitation/deep-link token and created a session.
     * This is the first-login screen: choose password, confirm password, then activate the profile.
     */
    async activateInvitedAccount(input: AccountActivationInput): Promise<Profile> {
      validatePasswordActivation(input);

      const { error: passwordError } = await getSupabaseClient().auth.updateUser({
        password: input.password,
      });
      if (passwordError) throw new Error(passwordError.message);

      const { data, error } = await getSupabaseClient().rpc('complete_account_activation');
      return unwrap(data, error, 'Account activation did not return a profile.');
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

    async userPermissionOverrides(userId: string): Promise<UserPermissionOverride[]> {
      const { data, error } = await getSupabaseClient()
        .from('user_permission_overrides')
        .select('*')
        .eq('user_id', userId)
        .order('permission_code', { ascending: true });
      return unwrap(data, error, 'Could not load user permission overrides.');
    },

    async orders(): Promise<Order[]> {
      const { data, error } = await getSupabaseClient()
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      return unwrap(data, error, 'Could not load orders.');
    },

    async myCustody(): Promise<CaptainCustody[]> {
      const { data, error } = await getSupabaseClient()
        .from('captain_custody')
        .select('*')
        .order('assigned_at', { ascending: false });
      return unwrap(data, error, 'Could not load custody records.');
    },

    async financialLedger(): Promise<FinancialLedgerEntry[]> {
      const { data, error } = await getSupabaseClient()
        .from('financial_ledger')
        .select('*')
        .order('created_at', { ascending: false });
      return unwrap(data, error, 'Could not load financial ledger.');
    },

    async orderStatusHistory(orderId: string): Promise<OrderStatusHistory[]> {
      const { data, error } = await getSupabaseClient()
        .from('order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .order('changed_at', { ascending: true });
      return unwrap(data, error, 'Could not load order history.');
    },

    async permissions(): Promise<Permission[]> {
      const { data, error } = await getSupabaseClient()
        .from('permissions')
        .select('*')
        .order('code', { ascending: true });
      return unwrap(data, error, 'Could not load permissions.');
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

    async inviteUser(input: InviteUserInput): Promise<InviteUserResult> {
      const { data, error } = await getSupabaseClient().functions.invoke<InviteUserResult>('invite-user', {
        body: {
          email: input.email,
          fullName: input.fullName ?? '',
          role: input.role,
          custodyItemsText: input.custodyItemsText ?? '',
        },
      });
      return unwrap(data, error, 'Invitation did not return a result.');
    },
  },
} as const;

/**
 * Banned in screens/hooks:
 * - getSupabaseClient().from('orders').insert/update/delete(...)
 * - getSupabaseClient().from('financial_ledger').insert/update/delete(...)
 * - getSupabaseClient().from('order_status_history').insert/update/delete(...)
 * - getSupabaseClient().from('profiles').insert/update/delete(...)
 * - getSupabaseClient().from('captain_custody').insert/update/delete(...)
 * - auth.signUp(...) from the mobile app
 * - service_role / secret keys in any Expo source file
 */
