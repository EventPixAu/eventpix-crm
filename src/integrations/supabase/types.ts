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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      delivery_methods_lookup: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      delivery_records: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          delivery_link: string | null
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          delivery_method_id: string | null
          event_id: string
          id: string
          notes: string | null
          qr_code_data: string | null
          qr_enabled: boolean | null
          qr_token: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          delivery_link?: string | null
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          delivery_method_id?: string | null
          event_id: string
          id?: string
          notes?: string | null
          qr_code_data?: string | null
          qr_enabled?: boolean | null
          qr_token?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          delivery_link?: string | null
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          delivery_method_id?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          qr_code_data?: string | null
          qr_enabled?: boolean | null
          qr_token?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_records_delivery_method_id_fkey"
            columns: ["delivery_method_id"]
            isOneToOne: false
            referencedRelation: "delivery_methods_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_records_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_assignments: {
        Row: {
          assignment_notes: string | null
          created_at: string | null
          event_id: string
          id: string
          notes: string | null
          notified: boolean | null
          role_on_event: string | null
          staff_id: string | null
          staff_role_id: string | null
          user_id: string | null
        }
        Insert: {
          assignment_notes?: string | null
          created_at?: string | null
          event_id: string
          id?: string
          notes?: string | null
          notified?: boolean | null
          role_on_event?: string | null
          staff_id?: string | null
          staff_role_id?: string | null
          user_id?: string | null
        }
        Update: {
          assignment_notes?: string | null
          created_at?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          notified?: boolean | null
          role_on_event?: string | null
          staff_id?: string | null
          staff_role_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_assignments_staff_role_id_fkey"
            columns: ["staff_role_id"]
            isOneToOne: false
            referencedRelation: "staff_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          calendar_sequence: number
          client_name: string
          coverage_details: string | null
          created_at: string | null
          created_by: string | null
          delivery_deadline: string | null
          delivery_method: Database["public"]["Enums"]["delivery_method"] | null
          delivery_method_id: string | null
          end_at: string | null
          end_time: string | null
          event_date: string
          event_name: string
          event_type: Database["public"]["Enums"]["event_type"]
          event_type_id: string | null
          id: string
          notes: string | null
          onsite_contact_name: string | null
          onsite_contact_phone: string | null
          start_at: string | null
          start_time: string | null
          updated_at: string | null
          venue_address: string | null
          venue_name: string | null
        }
        Insert: {
          calendar_sequence?: number
          client_name: string
          coverage_details?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_deadline?: string | null
          delivery_method?:
            | Database["public"]["Enums"]["delivery_method"]
            | null
          delivery_method_id?: string | null
          end_at?: string | null
          end_time?: string | null
          event_date: string
          event_name: string
          event_type?: Database["public"]["Enums"]["event_type"]
          event_type_id?: string | null
          id?: string
          notes?: string | null
          onsite_contact_name?: string | null
          onsite_contact_phone?: string | null
          start_at?: string | null
          start_time?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_name?: string | null
        }
        Update: {
          calendar_sequence?: number
          client_name?: string
          coverage_details?: string | null
          created_at?: string | null
          created_by?: string | null
          delivery_deadline?: string | null
          delivery_method?:
            | Database["public"]["Enums"]["delivery_method"]
            | null
          delivery_method_id?: string | null
          end_at?: string | null
          end_time?: string | null
          event_date?: string
          event_name?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          event_type_id?: string | null
          id?: string
          notes?: string | null
          onsite_contact_name?: string | null
          onsite_contact_phone?: string | null
          start_at?: string | null
          start_time?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_delivery_method_id_fkey"
            columns: ["delivery_method_id"]
            isOneToOne: false
            referencedRelation: "delivery_methods_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_assets: {
        Row: {
          created_at: string
          event_id: string
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          event_id: string
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path: string
        }
        Update: {
          created_at?: string
          event_id?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_assets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          default_role_id: string | null
          email: string
          full_name: string | null
          id: string
          phone: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          default_role_id?: string | null
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          default_role_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_role_id_fkey"
            columns: ["default_role_id"]
            isOneToOne: false
            referencedRelation: "staff_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          status: Database["public"]["Enums"]["staff_status"]
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          status?: Database["public"]["Enums"]["staff_status"]
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          status?: Database["public"]["Enums"]["staff_status"]
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      staff_roles: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workflow_template_items: {
        Row: {
          created_at: string | null
          help_text: string | null
          id: string
          label: string
          sort_order: number
          template_id: string
        }
        Insert: {
          created_at?: string | null
          help_text?: string | null
          id?: string
          label: string
          sort_order?: number
          template_id: string
        }
        Update: {
          created_at?: string | null
          help_text?: string | null
          id?: string
          label?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          phase: Database["public"]["Enums"]["workflow_phase"]
          template_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          phase: Database["public"]["Enums"]["workflow_phase"]
          template_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          phase?: Database["public"]["Enums"]["workflow_phase"]
          template_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      worksheet_items: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          done_at: string | null
          done_by: string | null
          id: string
          is_done: boolean | null
          item_text: string
          notes: string | null
          sort_order: number
          status: Database["public"]["Enums"]["worksheet_item_status"]
          template_item_id: string | null
          worksheet_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean | null
          item_text: string
          notes?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["worksheet_item_status"]
          template_item_id?: string | null
          worksheet_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean | null
          item_text?: string
          notes?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["worksheet_item_status"]
          template_item_id?: string | null
          worksheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worksheet_items_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worksheet_items_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "workflow_template_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worksheet_items_worksheet_id_fkey"
            columns: ["worksheet_id"]
            isOneToOne: false
            referencedRelation: "worksheets"
            referencedColumns: ["id"]
          },
        ]
      }
      worksheets: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          phase: Database["public"]["Enums"]["workflow_phase"]
          status: string | null
          template_id: string | null
          template_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          phase: Database["public"]["Enums"]["workflow_phase"]
          status?: string | null
          template_id?: string | null
          template_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          phase?: Database["public"]["Enums"]["workflow_phase"]
          status?: string | null
          template_id?: string | null
          template_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worksheets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worksheets_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_assigned_to_event: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "photographer"
      delivery_method:
        | "dropbox"
        | "zno_instant"
        | "spotmyphotos"
        | "internal_gallery"
      event_type:
        | "wedding"
        | "corporate"
        | "birthday"
        | "conference"
        | "gala"
        | "festival"
        | "private"
        | "sports"
        | "other"
      staff_role: "photographer" | "videographer" | "assistant"
      staff_status: "active" | "inactive"
      workflow_phase: "pre_event" | "day_of" | "post_event"
      worksheet_item_status: "pending" | "in_progress" | "completed"
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
      app_role: ["admin", "photographer"],
      delivery_method: [
        "dropbox",
        "zno_instant",
        "spotmyphotos",
        "internal_gallery",
      ],
      event_type: [
        "wedding",
        "corporate",
        "birthday",
        "conference",
        "gala",
        "festival",
        "private",
        "sports",
        "other",
      ],
      staff_role: ["photographer", "videographer", "assistant"],
      staff_status: ["active", "inactive"],
      workflow_phase: ["pre_event", "day_of", "post_event"],
      worksheet_item_status: ["pending", "in_progress", "completed"],
    },
  },
} as const
