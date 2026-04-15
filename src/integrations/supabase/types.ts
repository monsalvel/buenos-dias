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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bcv_rates: {
        Row: {
          currency: string
          fetched_at: string
          id: string
          rate: number
        }
        Insert: {
          currency?: string
          fetched_at?: string
          id?: string
          rate: number
        }
        Update: {
          currency?: string
          fetched_at?: string
          id?: string
          rate?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          first_name: string
          id: string
          is_favorite: boolean | null
          last_name: string
          phone: string
          total_purchases: number
          total_spent: number
        }
        Insert: {
          address?: string | null
          created_at?: string
          first_name: string
          id?: string
          is_favorite?: boolean | null
          last_name: string
          phone?: string
          total_purchases?: number
          total_spent?: number
        }
        Update: {
          address?: string | null
          created_at?: string
          first_name?: string
          id?: string
          is_favorite?: boolean | null
          last_name?: string
          phone?: string
          total_purchases?: number
          total_spent?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          date: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          sale_id: string
        }
        Insert: {
          amount: number
          date?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          sale_id: string
        }
        Update: {
          amount?: number
          date?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string
          cost: number
          created_at: string
          description: string | null
          id: string
          name: string
          price: number
        }
        Insert: {
          active?: boolean
          category?: string
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price?: number
        }
        Update: {
          active?: boolean
          category?: string
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          id: string
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_cost: number
          unit_price: number
        }
        Insert: {
          id?: string
          product_id: string
          product_name: string
          quantity?: number
          sale_id: string
          subtotal: number
          unit_cost: number
          unit_price: number
        }
        Update: {
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          sale_id?: string
          subtotal?: number
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_paid: number
          balance: number
          created_at: string
          customer_id: string
          customer_name: string
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          seller_name: string
          status: Database["public"]["Enums"]["sale_status"]
          total: number
          total_cost: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          balance?: number
          created_at?: string
          customer_id: string
          customer_name: string
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          seller_name?: string
          status?: Database["public"]["Enums"]["sale_status"]
          total?: number
          total_cost?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          balance?: number
          created_at?: string
          customer_id?: string
          customer_name?: string
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          seller_name?: string
          status?: Database["public"]["Enums"]["sale_status"]
          total?: number
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          bank: string
          cedula: string
          id: string
          phone: string
          store_name: string
          updated_at: string
        }
        Insert: {
          bank?: string
          cedula?: string
          id?: string
          phone?: string
          store_name?: string
          updated_at?: string
        }
        Update: {
          bank?: string
          cedula?: string
          id?: string
          phone?: string
          store_name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      payment_method: "efectivo" | "transferencia" | "pago_movil" | "credito"
      sale_status: "pagado" | "abonado" | "deuda" | "anulado"
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
      payment_method: ["efectivo", "transferencia", "pago_movil", "credito"],
      sale_status: ["pagado", "abonado", "deuda", "anulado"],
    },
  },
} as const
