export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: AppRole;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name?: string | null;
          role?: AppRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: AppRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      permissions: {
        Row: {
          code: string;
          description: string;
          created_at: string;
        };
        Insert: {
          code?: string;
          description?: string;
          created_at?: string;
        };
        Update: {
          code?: string;
          description?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          role: AppRole;
          permission_code: string;
          is_allowed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          role?: AppRole;
          permission_code?: string;
          is_allowed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          role?: AppRole;
          permission_code?: string;
          is_allowed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_permission_overrides: {
        Row: {
          user_id: string;
          permission_code: string;
          is_allowed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          permission_code?: string;
          is_allowed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          permission_code?: string;
          is_allowed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      captain_status: {
        Row: {
          captain_id: string;
          availability: CaptainAvailability;
          updated_at: string;
        };
        Insert: {
          captain_id?: string;
          availability?: CaptainAvailability;
          updated_at?: string;
        };
        Update: {
          captain_id?: string;
          availability?: CaptainAvailability;
          updated_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
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
        };
        Insert: {
          id?: string;
          order_number?: number;
          customer_name?: string;
          customer_phone?: string;
          pickup_address?: string;
          delivery_address?: string;
          fee?: number;
          status?: OrderStatus;
          assigned_captain_id?: string | null;
          created_by_user_id?: string;
          cancellation_reason?: string | null;
          assigned_at?: string | null;
          received_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          false_order_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: number;
          customer_name?: string;
          customer_phone?: string;
          pickup_address?: string;
          delivery_address?: string;
          fee?: number;
          status?: OrderStatus;
          assigned_captain_id?: string | null;
          created_by_user_id?: string;
          cancellation_reason?: string | null;
          assigned_at?: string | null;
          received_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          false_order_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_status_history: {
        Row: {
          id: string;
          order_id: string;
          previous_status: OrderStatus | null;
          next_status: OrderStatus;
          changed_by_user_id: string | null;
          note: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string;
          previous_status?: OrderStatus | null;
          next_status?: OrderStatus;
          changed_by_user_id?: string | null;
          note?: string | null;
          changed_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          previous_status?: OrderStatus | null;
          next_status?: OrderStatus;
          changed_by_user_id?: string | null;
          note?: string | null;
          changed_at?: string;
        };
        Relationships: [];
      };
      financial_ledger: {
        Row: {
          id: string;
          order_id: string;
          captain_id: string;
          source_status: 'completed' | 'false_order';
          gross_fee: number;
          captain_amount: number;
          company_amount: number;
          settlement_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string;
          captain_id?: string;
          source_status?: 'completed' | 'false_order';
          gross_fee?: number;
          captain_amount?: number;
          company_amount?: number;
          settlement_amount?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          captain_id?: string;
          source_status?: 'completed' | 'false_order';
          gross_fee?: number;
          captain_amount?: number;
          company_amount?: number;
          settlement_amount?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      create_order: {
        Args: {
          p_customer_name: string;
          p_customer_phone: string;
          p_pickup_address: string;
          p_delivery_address: string;
          p_fee: number;
        };
        Returns: unknown;
      };
      assign_order_captain: {
        Args: {
          p_order_id: string;
          p_captain_id: string;
        };
        Returns: unknown;
      };
      cancel_order: {
        Args: {
          p_order_id: string;
          p_cancellation_reason: string;
        };
        Returns: unknown;
      };
      transition_assigned_order: {
        Args: {
          p_order_id: string;
          p_next_status: OrderStatus;
        };
        Returns: unknown;
      };
      set_captain_availability: {
        Args: {
          new_availability: CaptainAvailability;
        };
        Returns: unknown;
      };
    };
    Enums: {
      app_role: AppRole;
      captain_availability: CaptainAvailability;
      order_status: OrderStatus;
    };
    CompositeTypes: {};
    Constants: {};
  };
}

export type Tables = Database['public']['Tables'];
export type TablesInsert = {
  [K in keyof Tables]: Tables[K] extends { Insert: infer I } ? I : never;
}[keyof Tables];
export type TablesUpdate = {
  [K in keyof Tables]: Tables[K] extends { Update: infer U } ? U : never;
}[keyof Tables];
export type Enums = Database['public']['Enums'];
export type Constants = Database['public']['Constants'];
