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
      financial_ledger: {
        Row: {
          captain_amount: number
          captain_id: string
          company_amount: number
          created_at: string
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
      ],
    },
  },
} as const
