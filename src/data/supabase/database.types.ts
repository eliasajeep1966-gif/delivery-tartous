export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_correction_cases: {
        Row: {
          captain_id: string | null
          correction_type: string
          created_at: string
          created_by: string
          executed_at: string | null
          executed_by: string | null
          id: string
          idempotency_key: string
          note: string
          order_id: string | null
          payout_id: string | null
          reason_code: string
          status: string
        }
        Insert: {
          captain_id?: string | null
          correction_type: string
          created_at?: string
          created_by: string
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          idempotency_key: string
          note: string
          order_id?: string | null
          payout_id?: string | null
          reason_code: string
          status?: string
        }
        Update: {
          captain_id?: string | null
          correction_type?: string
          created_at?: string
          created_by?: string
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          idempotency_key?: string
          note?: string
          order_id?: string | null
          payout_id?: string | null
          reason_code?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_correction_cases_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_correction_cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_correction_cases_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_correction_cases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_correction_cases_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "captain_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      captain_custody: {
        Row: {
          assigned_at: string
          assigned_by_user_id: string
          captain_id: string
          created_at: string
          id: string
          item_details: string | null
          item_name: string
          return_notes: string | null
          returned_at: string | null
          returned_by_user_id: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by_user_id: string
          captain_id: string
          created_at?: string
          id?: string
          item_details?: string | null
          item_name: string
          return_notes?: string | null
          returned_at?: string | null
          returned_by_user_id?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by_user_id?: string
          captain_id?: string
          created_at?: string
          id?: string
          item_details?: string | null
          item_name?: string
          return_notes?: string | null
          returned_at?: string | null
          returned_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "captain_custody_assigned_by_user_id_fkey"
            columns: ["assigned_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_custody_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_custody_returned_by_user_id_fkey"
            columns: ["returned_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      captain_payout_items: {
        Row: {
          captain_amount: number
          created_at: string
          financial_ledger_id: string
          payout_id: string
        }
        Insert: {
          captain_amount: number
          created_at?: string
          financial_ledger_id: string
          payout_id: string
        }
        Update: {
          captain_amount?: number
          created_at?: string
          financial_ledger_id?: string
          payout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "captain_payout_items_financial_ledger_id_fkey"
            columns: ["financial_ledger_id"]
            isOneToOne: false
            referencedRelation: "financial_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_payout_items_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "captain_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      captain_payouts: {
        Row: {
          captain_id: string
          created_at: string
          id: string
          notes: string | null
          paid_at: string
          paid_by_user_id: string
          total_amount: number
        }
        Insert: {
          captain_id: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string
          paid_by_user_id: string
          total_amount: number
        }
        Update: {
          captain_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string
          paid_by_user_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "captain_payouts_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_payouts_paid_by_user_id_fkey"
            columns: ["paid_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      captain_status: {
        Row: {
          availability: Database["public"]["Enums"]["captain_availability"]
          captain_id: string
          updated_at: string
        }
        Insert: {
          availability?: Database["public"]["Enums"]["captain_availability"]
          captain_id: string
          updated_at?: string
        }
        Update: {
          availability?: Database["public"]["Enums"]["captain_availability"]
          captain_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "captain_status_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_adjustments: {
        Row: {
          adjustment_kind: string
          captain_delta: number
          captain_id: string
          company_delta: number
          correction_case_id: string
          created_at: string
          created_by: string
          financial_ledger_id: string | null
          gross_delta: number
          id: string
          order_id: string | null
          payout_id: string | null
          reversal_scope: string
          settlement_delta: number
        }
        Insert: {
          adjustment_kind?: string
          captain_delta?: number
          captain_id: string
          company_delta?: number
          correction_case_id: string
          created_at?: string
          created_by: string
          financial_ledger_id?: string | null
          gross_delta?: number
          id?: string
          order_id?: string | null
          payout_id?: string | null
          reversal_scope?: string
          settlement_delta?: number
        }
        Update: {
          adjustment_kind?: string
          captain_delta?: number
          captain_id?: string
          company_delta?: number
          correction_case_id?: string
          created_at?: string
          created_by?: string
          financial_ledger_id?: string | null
          gross_delta?: number
          id?: string
          order_id?: string | null
          payout_id?: string | null
          reversal_scope?: string
          settlement_delta?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_adjustments_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_adjustments_correction_case_fkey"
            columns: ["correction_case_id"]
            isOneToOne: false
            referencedRelation: "admin_correction_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_adjustments_financial_ledger_id_fkey"
            columns: ["financial_ledger_id"]
            isOneToOne: false
            referencedRelation: "financial_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_adjustments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_adjustments_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "captain_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_ledger: {
        Row: {
          captain_amount: number
          captain_id: string
          company_amount: number
          created_at: string
          financial_treatment: string
          gross_fee: number
          id: string
          order_id: string
          settlement_amount: number
          source_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          captain_amount: number
          captain_id: string
          company_amount: number
          created_at?: string
          financial_treatment?: string
          gross_fee: number
          id?: string
          order_id: string
          settlement_amount: number
          source_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          captain_amount?: number
          captain_id?: string
          company_amount?: number
          created_at?: string
          financial_treatment?: string
          gross_fee?: number
          id?: string
          order_id?: string
          settlement_amount?: number
          source_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "financial_ledger_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_at: string
          changed_by_user_id: string | null
          id: string
          next_status: Database["public"]["Enums"]["order_status"]
          note: string | null
          order_id: string
          previous_status: Database["public"]["Enums"]["order_status"] | null
        }
        Insert: {
          changed_at?: string
          changed_by_user_id?: string | null
          id?: string
          next_status: Database["public"]["Enums"]["order_status"]
          note?: string | null
          order_id: string
          previous_status?: Database["public"]["Enums"]["order_status"] | null
        }
        Update: {
          changed_at?: string
          changed_by_user_id?: string | null
          id?: string
          next_status?: Database["public"]["Enums"]["order_status"]
          note?: string | null
          order_id?: string
          previous_status?: Database["public"]["Enums"]["order_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_stops: {
        Row: {
          address: string
          contact_name: string
          contact_phone: string
          created_at: string
          id: string
          note: string | null
          order_id: string
          sequence: number
          stop_type: Database["public"]["Enums"]["order_stop_type"]
        }
        Insert: {
          address: string
          contact_name: string
          contact_phone: string
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          sequence: number
          stop_type: Database["public"]["Enums"]["order_stop_type"]
        }
        Update: {
          address?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          sequence?: number
          stop_type?: Database["public"]["Enums"]["order_stop_type"]
        }
        Relationships: [
          {
            foreignKeyName: "order_stops_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_at: string | null
          assigned_captain_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by_user_id: string
          customer_name: string
          customer_phone: string
          delivery_address: string
          false_order_at: string | null
          fee: number
          id: string
          idempotency_key: string | null
          order_kind: string
          order_number: number
          pickup_address: string
          received_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_captain_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id: string
          customer_name: string
          customer_phone: string
          delivery_address: string
          false_order_at?: string | null
          fee: number
          id?: string
          idempotency_key?: string | null
          order_kind?: string
          order_number?: never
          pickup_address: string
          received_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_captain_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string
          customer_name?: string
          customer_phone?: string
          delivery_address?: string
          false_order_at?: string | null
          fee?: number
          id?: string
          idempotency_key?: string | null
          order_kind?: string
          order_number?: never
          pickup_address?: string
          received_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_captain_id_fkey"
            columns: ["assigned_captain_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_reversal_items: {
        Row: {
          captain_id: string
          correction_case_id: string
          created_at: string
          created_by: string
          financial_ledger_id: string
          id: string
          original_paid_amount: number
          payout_id: string
          reversed_paid_amount: number
        }
        Insert: {
          captain_id: string
          correction_case_id: string
          created_at?: string
          created_by: string
          financial_ledger_id: string
          id?: string
          original_paid_amount: number
          payout_id: string
          reversed_paid_amount: number
        }
        Update: {
          captain_id?: string
          correction_case_id?: string
          created_at?: string
          created_by?: string
          financial_ledger_id?: string
          id?: string
          original_paid_amount?: number
          payout_id?: string
          reversed_paid_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "payout_reversal_items_captain_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_reversal_items_case_fkey"
            columns: ["correction_case_id"]
            isOneToOne: false
            referencedRelation: "admin_correction_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_reversal_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_reversal_items_ledger_fkey"
            columns: ["financial_ledger_id"]
            isOneToOne: false
            referencedRelation: "financial_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_reversal_items_payout_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "captain_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_account_activations: {
        Row: {
          activated_at: string | null
          auth_user_id: string | null
          cancelled_at: string | null
          created_at: string
          created_by_user_id: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          activated_at?: string | null
          auth_user_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by_user_id: string
          email: string
          full_name?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          activated_at?: string | null
          auth_user_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by_user_id?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "pending_account_activations_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_captain_custody: {
        Row: {
          created_at: string
          id: string
          item_name: string
          pending_account_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          pending_account_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          pending_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_captain_custody_pending_account_id_fkey"
            columns: ["pending_account_id"]
            isOneToOne: false
            referencedRelation: "pending_account_activations"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_activated_at: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          account_activated_at?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          account_activated_at?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          is_allowed: boolean
          permission_code: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_allowed?: boolean
          permission_code: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_allowed?: boolean
          permission_code?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["code"]
          },
        ]
      }
      user_permission_overrides: {
        Row: {
          created_at: string
          is_allowed: boolean
          permission_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_allowed: boolean
          permission_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_allowed?: boolean
          permission_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_permission_code_fkey"
            columns: ["permission_code"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_permission_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_confirm_completed_order: {
        Args: {
          p_idempotency_key: string
          p_note: string
          p_order_id: string
          p_reason_code: string
        }
        Returns: {
          captain_amount: number
          company_amount: number
          correction_case_id: string
          financial_ledger_id: string
          gross_fee: number
          new_status: Database["public"]["Enums"]["order_status"]
          order_id: string
          order_number: number
          previous_status: Database["public"]["Enums"]["order_status"]
          settlement_amount: number
        }[]
      }
      admin_reconcile_order_finance_preview: {
        Args: { p_order_id: string }
        Returns: {
          allocation_mismatch: boolean
          allocation_negative: boolean
          assigned_captain_id: string
          captain_id_mismatch: boolean
          ledger_captain_amount: number
          ledger_company_amount: number
          ledger_count: number
          ledger_gross_fee: number
          ledger_missing_captain: boolean
          ledger_settlement_amount: number
          order_fee_mismatch: boolean
          order_id: string
          order_missing_captain: boolean
          order_number: number
          order_status: Database["public"]["Enums"]["order_status"]
          paid_amount: number
          payable_balance: number
        }[]
      }
      admin_reverse_completed_order: {
        Args: {
          p_idempotency_key: string
          p_note: string
          p_order_id: string
          p_reason_code: string
        }
        Returns: {
          adjustment_id: string
          captain_debt_amount: number
          correction_case_id: string
          financial_ledger_id: string
          new_status: Database["public"]["Enums"]["order_status"]
          order_id: string
          order_number: number
          previous_status: Database["public"]["Enums"]["order_status"]
          reversed_paid_amount: number
        }[]
      }
      assign_captain_custody: {
        Args: {
          p_captain_id: string
          p_item_details?: string
          p_item_name: string
        }
        Returns: {
          assigned_at: string
          assigned_by_user_id: string
          captain_id: string
          created_at: string
          id: string
          item_details: string | null
          item_name: string
          return_notes: string | null
          returned_at: string | null
          returned_by_user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "captain_custody"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assign_order_captain: {
        Args: { p_captain_id: string; p_order_id: string }
        Returns: {
          assigned_at: string | null
          assigned_captain_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by_user_id: string
          customer_name: string
          customer_phone: string
          delivery_address: string
          false_order_at: string | null
          fee: number
          id: string
          idempotency_key: string | null
          order_kind: string
          order_number: number
          pickup_address: string
          received_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_order: {
        Args: { p_cancellation_reason: string; p_order_id: string }
        Returns: {
          assigned_at: string | null
          assigned_captain_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by_user_id: string
          customer_name: string
          customer_phone: string
          delivery_address: string
          false_order_at: string | null
          fee: number
          id: string
          idempotency_key: string | null
          order_kind: string
          order_number: number
          pickup_address: string
          received_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_pending_account: {
        Args: { p_pending_id: string }
        Returns: {
          activated_at: string | null
          auth_user_id: string | null
          cancelled_at: string | null
          created_at: string
          created_by_user_id: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        SetofOptions: {
          from: "*"
          to: "pending_account_activations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_account_activation: {
        Args: never
        Returns: {
          account_activated_at: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_captain_partial_payout: {
        Args: { p_amount: number; p_captain_id: string; p_notes?: string }
        Returns: {
          captain_id: string
          created_at: string
          id: string
          notes: string | null
          paid_at: string
          paid_by_user_id: string
          total_amount: number
        }
        SetofOptions: {
          from: "*"
          to: "captain_payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_captain_payout: {
        Args: {
          p_captain_id: string
          p_financial_ledger_ids: string[]
          p_notes?: string
        }
        Returns: {
          captain_id: string
          created_at: string
          id: string
          notes: string | null
          paid_at: string
          paid_by_user_id: string
          total_amount: number
        }
        SetofOptions: {
          from: "*"
          to: "captain_payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_order: {
        Args: {
          p_customer_name: string
          p_customer_phone: string
          p_delivery_address: string
          p_fee: number
          p_pickup_address: string
        }
        Returns: {
          assigned_at: string | null
          assigned_captain_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by_user_id: string
          customer_name: string
          customer_phone: string
          delivery_address: string
          false_order_at: string | null
          fee: number
          id: string
          idempotency_key: string | null
          order_kind: string
          order_number: number
          pickup_address: string
          received_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_order_with_stops: {
        Args: { p_fee: number; p_idempotency_key?: string; p_stops: Json }
        Returns: {
          assigned_at: string | null
          assigned_captain_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by_user_id: string
          customer_name: string
          customer_phone: string
          delivery_address: string
          false_order_at: string | null
          fee: number
          id: string
          idempotency_key: string | null
          order_kind: string
          order_number: number
          pickup_address: string
          received_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_pending_account: {
        Args: {
          p_custody_items_text?: string
          p_email: string
          p_full_name?: string
          p_role?: Database["public"]["Enums"]["app_role"]
        }
        Returns: {
          activated_at: string | null
          auth_user_id: string | null
          cancelled_at: string | null
          created_at: string
          created_by_user_id: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        SetofOptions: {
          from: "*"
          to: "pending_account_activations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_pending_account_activation: {
        Args: { p_auth_user_id: string; p_email: string }
        Returns: {
          account_activated_at: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_backoffice_home_summary: {
        Args: never
        Returns: {
          assigned_count: number
          cancelled_today_count: number
          completed_today_count: number
          in_delivery_count: number
          recent_order_activities: Json
        }[]
      }
      get_captain_home_metrics: {
        Args: never
        Returns: {
          availability: Database["public"]["Enums"]["captain_availability"]
          completed_count: number
          completed_gross: number
        }[]
      }
      get_captain_wage_details: {
        Args: { p_captain_id: string }
        Returns: {
          captain_amount: number
          company_amount: number
          completed_at: string
          financial_ledger_id: string
          gross_fee: number
          order_id: string
          order_number: number
          paid_at: string
          payout_id: string
          settlement_amount: number
          source_status: Database["public"]["Enums"]["order_status"]
        }[]
      }
      get_captain_wage_details_v2: {
        Args: { p_captain_id: string }
        Returns: {
          captain_amount: number
          company_amount: number
          completed_at: string
          financial_ledger_id: string
          gross_fee: number
          is_fully_paid: boolean
          latest_paid_at: string
          latest_payout_id: string
          order_id: string
          order_number: number
          paid_amount: number
          settlement_amount: number
          source_status: Database["public"]["Enums"]["order_status"]
          unpaid_amount: number
        }[]
      }
      get_captain_wage_period_summary: {
        Args: {
          p_before_captain_id?: string
          p_before_period_start?: string
          p_captain_id?: string
          p_limit?: number
          p_period?: string
        }
        Returns: {
          captain_id: string
          captain_name: string
          captain_net_total: number
          gross_total: number
          order_count: number
          paid_total: number
          period_end: string
          period_start: string
          settlement_total: number
          unpaid_total: number
        }[]
      }
      get_captain_wage_summary: {
        Args: { p_captain_id?: string }
        Returns: {
          captain_id: string
          captain_name: string
          captain_net_total: number
          gross_total: number
          order_count: number
          paid_total: number
          unpaid_total: number
        }[]
      }
      get_company_profit_day_details: {
        Args: {
          p_before_completed_at?: string
          p_before_ledger_id?: string
          p_business_day: string
          p_limit?: number
        }
        Returns: {
          captain_amount: number
          captain_id: string
          captain_name: string
          company_amount: number
          completed_at: string
          financial_ledger_id: string
          gross_fee: number
          order_id: string
          order_number: number
          settlement_amount: number
          source_status: Database["public"]["Enums"]["order_status"]
        }[]
      }
      get_company_profit_history: {
        Args: {
          p_before_day?: string
          p_end_date?: string
          p_limit_days?: number
          p_start_date?: string
        }
        Returns: {
          business_day: string
          captain_net_total: number
          company_total: number
          gross_total: number
          order_count: number
          settlement_total: number
        }[]
      }
      get_company_profit_period_history: {
        Args: {
          p_before_period_start?: string
          p_limit?: number
          p_period?: string
        }
        Returns: {
          captain_net_total: number
          company_total: number
          gross_total: number
          order_count: number
          period_end: string
          period_start: string
          settlement_total: number
        }[]
      }
      get_wage_totals: {
        Args: never
        Returns: {
          captain_net_total: number
          company_total: number
          gross_total: number
          paid_total: number
          settlement_total: number
          unpaid_total: number
        }[]
      }
      list_pending_accounts:
        | {
            Args: never
            Returns: {
              activated_at: string | null
              auth_user_id: string | null
              cancelled_at: string | null
              created_at: string
              created_by_user_id: string
              email: string
              full_name: string | null
              id: string
              role: Database["public"]["Enums"]["app_role"]
            }[]
            SetofOptions: {
              from: "*"
              to: "pending_account_activations"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: {
              p_before_created_at?: string
              p_before_id?: string
              p_limit?: number
            }
            Returns: {
              activated_at: string | null
              auth_user_id: string | null
              cancelled_at: string | null
              created_at: string
              created_by_user_id: string
              email: string
              full_name: string | null
              id: string
              role: Database["public"]["Enums"]["app_role"]
            }[]
            SetofOptions: {
              from: "*"
              to: "pending_account_activations"
              isOneToOne: false
              isSetofReturn: true
            }
          }
      list_visible_profiles: {
        Args: {
          p_before_created_at?: string
          p_before_id?: string
          p_limit?: number
        }
        Returns: {
          account_activated_at: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      return_captain_custody: {
        Args: { p_custody_id: string; p_return_notes?: string }
        Returns: {
          assigned_at: string
          assigned_by_user_id: string
          captain_id: string
          created_at: string
          id: string
          item_details: string | null
          item_name: string
          return_notes: string | null
          returned_at: string | null
          returned_by_user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "captain_custody"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_captain_active: {
        Args: { p_captain_id: string; p_is_active: boolean }
        Returns: {
          account_activated_at: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_captain_availability: {
        Args: {
          new_availability: Database["public"]["Enums"]["captain_availability"]
        }
        Returns: {
          availability: Database["public"]["Enums"]["captain_availability"]
          captain_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "captain_status"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_user_active: {
        Args: { p_is_active: boolean; p_user_id: string }
        Returns: {
          account_activated_at: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_user_permission_override: {
        Args: {
          p_is_allowed: boolean
          p_permission_code: string
          p_user_id: string
        }
        Returns: {
          created_at: string
          is_allowed: boolean
          permission_code: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_permission_overrides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: {
          account_activated_at: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_assigned_order: {
        Args: {
          p_next_status: Database["public"]["Enums"]["order_status"]
          p_order_id: string
        }
        Returns: {
          assigned_at: string | null
          assigned_captain_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by_user_id: string
          customer_name: string
          customer_phone: string
          delivery_address: string
          false_order_at: string | null
          fee: number
          id: string
          idempotency_key: string | null
          order_kind: string
          order_number: number
          pickup_address: string
          received_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_my_profile: {
        Args: { p_full_name: string }
        Returns: {
          account_activated_at: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "captain"
      captain_availability: "available" | "unavailable"
      order_status:
        | "pending"
        | "assigned"
        | "received"
        | "in_delivery"
        | "completed"
        | "cancelled"
        | "false_order"
        | "reversed"
      order_stop_type: "pickup" | "delivery"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "supervisor", "captain"],
      captain_availability: ["available", "unavailable"],
      order_status: [
        "pending",
        "assigned",
        "received",
        "in_delivery",
        "completed",
        "cancelled",
        "false_order",
        "reversed",
      ],
      order_stop_type: ["pickup", "delivery"],
    },
  },
} as const

