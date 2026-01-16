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
      assignment_drafts: {
        Row: {
          created_at: string | null
          created_by: string | null
          draft_json: Json
          event_ids: string[]
          id: string
          scope: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          draft_json: Json
          event_ids: string[]
          id?: string
          scope: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          draft_json?: Json
          event_ids?: string[]
          id?: string
          scope?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          event_id: string | null
          id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          event_id?: string | null
          id?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          event_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          trigger_config: Json
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          action_config?: Json
          action_type: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_communications: {
        Row: {
          client_id: string
          communication_date: string | null
          communication_type: string
          created_at: string | null
          email_template_id: string | null
          id: string
          logged_by: string | null
          related_contract_id: string | null
          related_quote_id: string | null
          status: string | null
          subject: string | null
          summary: string | null
        }
        Insert: {
          client_id: string
          communication_date?: string | null
          communication_type: string
          created_at?: string | null
          email_template_id?: string | null
          id?: string
          logged_by?: string | null
          related_contract_id?: string | null
          related_quote_id?: string | null
          status?: string | null
          subject?: string | null
          summary?: string | null
        }
        Update: {
          client_id?: string
          communication_date?: string | null
          communication_type?: string
          created_at?: string | null
          email_template_id?: string | null
          id?: string
          logged_by?: string | null
          related_contract_id?: string | null
          related_quote_id?: string | null
          status?: string | null
          subject?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_communications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_communications_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_communications_related_contract_id_fkey"
            columns: ["related_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_communications_related_quote_id_fkey"
            columns: ["related_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          consent_source: string | null
          consent_status: string | null
          contact_name: string
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          is_primary: boolean | null
          last_contacted_at: string | null
          last_name: string | null
          notes: string | null
          phone: string | null
          phone_mobile: string | null
          phone_office: string | null
          relationship_type_id: string | null
          role: string | null
          role_title: string | null
        }
        Insert: {
          client_id: string
          consent_source?: string | null
          consent_status?: string | null
          contact_name: string
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_primary?: boolean | null
          last_contacted_at?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          phone_mobile?: string | null
          phone_office?: string | null
          relationship_type_id?: string | null
          role?: string | null
          role_title?: string | null
        }
        Update: {
          client_id?: string
          consent_source?: string | null
          consent_status?: string | null
          contact_name?: string
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_primary?: boolean | null
          last_contacted_at?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          phone_mobile?: string | null
          phone_office?: string | null
          relationship_type_id?: string | null
          role?: string | null
          role_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_relationship_type_id_fkey"
            columns: ["relationship_type_id"]
            isOneToOne: false
            referencedRelation: "contact_relationship_types"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          client_id: string
          created_at: string | null
          created_by: string | null
          id: string
          note: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          note: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          abn: string | null
          billing_address: string | null
          business_name: string
          created_at: string | null
          created_by: string | null
          id: string
          industry: string | null
          is_training: boolean | null
          legal_name: string | null
          notes: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          status: string | null
          trading_name: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          abn?: string | null
          billing_address?: string | null
          business_name: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          industry?: string | null
          is_training?: boolean | null
          legal_name?: string | null
          notes?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          status?: string | null
          trading_name?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          abn?: string | null
          billing_address?: string | null
          business_name?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          industry?: string | null
          is_training?: boolean | null
          legal_name?: string | null
          notes?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          status?: string | null
          trading_name?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      compliance_document_types: {
        Row: {
          applies_to_roles: string[] | null
          created_at: string | null
          description: string | null
          has_expiry: boolean
          id: string
          is_active: boolean
          name: string
          required: boolean
          sort_order: number
        }
        Insert: {
          applies_to_roles?: string[] | null
          created_at?: string | null
          description?: string | null
          has_expiry?: boolean
          id?: string
          is_active?: boolean
          name: string
          required?: boolean
          sort_order?: number
        }
        Update: {
          applies_to_roles?: string[] | null
          created_at?: string | null
          description?: string | null
          has_expiry?: boolean
          id?: string
          is_active?: boolean
          name?: string
          required?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      contact_relationship_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      contract_acceptance_attempts: {
        Row: {
          attempt_at: string
          id: string
          public_token: string
          success: boolean
        }
        Insert: {
          attempt_at?: string
          id?: string
          public_token: string
          success?: boolean
        }
        Update: {
          attempt_at?: string
          id?: string
          public_token?: string
          success?: boolean
        }
        Relationships: []
      }
      contract_templates: {
        Row: {
          body_html: string
          body_text: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          body_html: string
          body_text?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          body_text?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          client_id: string
          created_at: string | null
          file_url: string | null
          id: string
          lead_id: string | null
          public_token: string | null
          quote_id: string | null
          rendered_html: string | null
          sent_at: string | null
          signed_at: string | null
          signed_by_email: string | null
          signed_by_name: string | null
          status: Database["public"]["Enums"]["contract_status"] | null
          template_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          file_url?: string | null
          id?: string
          lead_id?: string | null
          public_token?: string | null
          quote_id?: string | null
          rendered_html?: string | null
          sent_at?: string | null
          signed_at?: string | null
          signed_by_email?: string | null
          signed_by_name?: string | null
          status?: Database["public"]["Enums"]["contract_status"] | null
          template_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          file_url?: string | null
          id?: string
          lead_id?: string | null
          public_token?: string | null
          quote_id?: string | null
          rendered_html?: string | null
          sent_at?: string | null
          signed_at?: string | null
          signed_by_email?: string | null
          signed_by_name?: string | null
          status?: Database["public"]["Enums"]["contract_status"] | null
          template_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      coverage_packages: {
        Row: {
          created_at: string | null
          description: string | null
          hours_included: number | null
          id: string
          is_active: boolean | null
          name: string
          photographers_included: number | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          hours_included?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          photographers_included?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          hours_included?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          photographers_included?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      delivery_methods_lookup: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      delivery_records: {
        Row: {
          client_access_token: string | null
          created_at: string | null
          delivered_at: string | null
          delivery_link: string | null
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          delivery_method_id: string | null
          delivery_status: string | null
          event_id: string
          id: string
          notes: string | null
          qr_code_data: string | null
          qr_enabled: boolean | null
          qr_token: string | null
          updated_at: string | null
        }
        Insert: {
          client_access_token?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_link?: string | null
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          delivery_method_id?: string | null
          delivery_status?: string | null
          event_id: string
          id?: string
          notes?: string | null
          qr_code_data?: string | null
          qr_enabled?: boolean | null
          qr_token?: string | null
          updated_at?: string | null
        }
        Update: {
          client_access_token?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_link?: string | null
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          delivery_method_id?: string | null
          delivery_status?: string | null
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
      email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string
          trigger_type: Database["public"]["Enums"]["email_trigger_type"] | null
          updated_at: string | null
        }
        Insert: {
          body_html: string
          body_text?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject: string
          trigger_type?:
            | Database["public"]["Enums"]["email_trigger_type"]
            | null
          updated_at?: string | null
        }
        Update: {
          body_html?: string
          body_text?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string
          trigger_type?:
            | Database["public"]["Enums"]["email_trigger_type"]
            | null
          updated_at?: string | null
        }
        Relationships: []
      }
      enquiry_contacts: {
        Row: {
          contact_id: string
          created_at: string | null
          id: string
          lead_id: string
          role: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          id?: string
          lead_id: string
          role?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          id?: string
          lead_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enquiry_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiry_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_allocations: {
        Row: {
          allocated_at: string | null
          created_at: string | null
          equipment_item_id: string
          event_id: string
          id: string
          notes: string | null
          returned_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          allocated_at?: string | null
          created_at?: string | null
          equipment_item_id: string
          event_id: string
          id?: string
          notes?: string | null
          returned_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          allocated_at?: string | null
          created_at?: string | null
          equipment_item_id?: string
          event_id?: string
          id?: string
          notes?: string | null
          returned_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_allocations_equipment_item_id_fkey"
            columns: ["equipment_item_id"]
            isOneToOne: false
            referencedRelation: "equipment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_allocations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_allocations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_categories: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      equipment_items: {
        Row: {
          brand: string | null
          category: string
          category_id: string | null
          condition: string
          created_at: string | null
          id: string
          model: string | null
          name: string
          notes: string | null
          serial_number: string | null
          status: string
        }
        Insert: {
          brand?: string | null
          category: string
          category_id?: string | null
          condition?: string
          created_at?: string | null
          id?: string
          model?: string | null
          name: string
          notes?: string | null
          serial_number?: string | null
          status?: string
        }
        Update: {
          brand?: string | null
          category?: string
          category_id?: string | null
          condition?: string
          created_at?: string | null
          id?: string
          model?: string | null
          name?: string
          notes?: string | null
          serial_number?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "equipment_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_kit_items: {
        Row: {
          created_at: string | null
          equipment_item_id: string
          id: string
          kit_id: string
          quantity: number
        }
        Insert: {
          created_at?: string | null
          equipment_item_id: string
          id?: string
          kit_id: string
          quantity?: number
        }
        Update: {
          created_at?: string | null
          equipment_item_id?: string
          id?: string
          kit_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipment_kit_items_equipment_item_id_fkey"
            columns: ["equipment_item_id"]
            isOneToOne: false
            referencedRelation: "equipment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_kit_items_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "equipment_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_kits: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      event_assignments: {
        Row: {
          assignment_notes: string | null
          assignment_status: string | null
          call_time_at: string | null
          created_at: string | null
          estimated_cost: number | null
          event_id: string
          id: string
          notes: string | null
          notified: boolean | null
          role_on_event: string | null
          staff_id: string | null
          staff_role_id: string | null
          user_id: string | null
          wrap_time_at: string | null
        }
        Insert: {
          assignment_notes?: string | null
          assignment_status?: string | null
          call_time_at?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          event_id: string
          id?: string
          notes?: string | null
          notified?: boolean | null
          role_on_event?: string | null
          staff_id?: string | null
          staff_role_id?: string | null
          user_id?: string | null
          wrap_time_at?: string | null
        }
        Update: {
          assignment_notes?: string | null
          assignment_status?: string | null
          call_time_at?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          event_id?: string
          id?: string
          notes?: string | null
          notified?: boolean | null
          role_on_event?: string | null
          staff_id?: string | null
          staff_role_id?: string | null
          user_id?: string | null
          wrap_time_at?: string | null
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
      event_contacts: {
        Row: {
          client_contact_id: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_type: string
          created_at: string | null
          event_id: string
          id: string
          notes: string | null
          sort_order: number | null
        }
        Insert: {
          client_contact_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_type?: string
          created_at?: string | null
          event_id: string
          id?: string
          notes?: string | null
          sort_order?: number | null
        }
        Update: {
          client_contact_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_type?: string
          created_at?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_contacts_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_contacts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          event_id: string
          id: string
          note_type: string | null
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          event_id: string
          id?: string
          note_type?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
          note_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_notes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_series: {
        Row: {
          created_at: string | null
          default_coverage_details: string | null
          default_delivery_deadline_days: number | null
          default_delivery_method_id: string | null
          default_kit_id: string | null
          default_notes_internal: string | null
          default_notes_public: string | null
          default_photographers_required: number | null
          default_roles_json: Json | null
          default_venue_city: string | null
          event_type_id: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_coverage_details?: string | null
          default_delivery_deadline_days?: number | null
          default_delivery_method_id?: string | null
          default_kit_id?: string | null
          default_notes_internal?: string | null
          default_notes_public?: string | null
          default_photographers_required?: number | null
          default_roles_json?: Json | null
          default_venue_city?: string | null
          event_type_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_coverage_details?: string | null
          default_delivery_deadline_days?: number | null
          default_delivery_method_id?: string | null
          default_kit_id?: string | null
          default_notes_internal?: string | null
          default_notes_public?: string | null
          default_photographers_required?: number | null
          default_roles_json?: Json | null
          default_venue_city?: string | null
          event_type_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_series_default_delivery_method_id_fkey"
            columns: ["default_delivery_method_id"]
            isOneToOne: false
            referencedRelation: "delivery_methods_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_series_default_kit_id_fkey"
            columns: ["default_kit_id"]
            isOneToOne: false
            referencedRelation: "equipment_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_series_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sessions: {
        Row: {
          created_at: string | null
          end_time: string | null
          event_id: string | null
          id: string
          label: string | null
          lead_id: string | null
          notes: string | null
          session_date: string
          sort_order: number | null
          start_time: string | null
          updated_at: string | null
          venue_address: string | null
          venue_name: string | null
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          event_id?: string | null
          id?: string
          label?: string | null
          lead_id?: string | null
          notes?: string | null
          session_date: string
          sort_order?: number | null
          start_time?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_name?: string | null
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          event_id?: string | null
          id?: string
          label?: string | null
          lead_id?: string | null
          notes?: string | null
          session_date?: string
          sort_order?: number | null
          start_time?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      event_type_workflow_defaults: {
        Row: {
          created_at: string | null
          event_type_id: string
          id: string
          template_id: string
        }
        Insert: {
          created_at?: string | null
          event_type_id: string
          id?: string
          template_id: string
        }
        Update: {
          created_at?: string | null
          event_type_id?: string
          id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_type_workflow_defaults_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_type_workflow_defaults_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          calendar_sequence: number
          city: string | null
          client_id: string | null
          client_name: string
          cost_threshold: number | null
          coverage_details: string | null
          coverage_package_id: string | null
          created_at: string | null
          created_by: string | null
          date_status: string | null
          delivery_deadline: string | null
          delivery_method: Database["public"]["Enums"]["delivery_method"] | null
          delivery_method_id: string | null
          end_at: string | null
          end_time: string | null
          enquiry_source: string | null
          event_date: string
          event_name: string
          event_series_id: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          event_type_id: string | null
          id: string
          invoice_paid_at: string | null
          invoice_reference: string | null
          invoice_status: string | null
          is_training: boolean | null
          job_intake_id: string | null
          lead_id: string | null
          notes: string | null
          onsite_contact_name: string | null
          onsite_contact_phone: string | null
          ops_status: string | null
          quote_id: string | null
          recommended_kit_id: string | null
          run_sheet_url: string | null
          special_instructions: string | null
          start_at: string | null
          start_time: string | null
          state: string | null
          updated_at: string | null
          venue_address: string | null
          venue_id: string | null
          venue_name: string | null
          venue_postcode: string | null
        }
        Insert: {
          calendar_sequence?: number
          city?: string | null
          client_id?: string | null
          client_name: string
          cost_threshold?: number | null
          coverage_details?: string | null
          coverage_package_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_status?: string | null
          delivery_deadline?: string | null
          delivery_method?:
            | Database["public"]["Enums"]["delivery_method"]
            | null
          delivery_method_id?: string | null
          end_at?: string | null
          end_time?: string | null
          enquiry_source?: string | null
          event_date: string
          event_name: string
          event_series_id?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          event_type_id?: string | null
          id?: string
          invoice_paid_at?: string | null
          invoice_reference?: string | null
          invoice_status?: string | null
          is_training?: boolean | null
          job_intake_id?: string | null
          lead_id?: string | null
          notes?: string | null
          onsite_contact_name?: string | null
          onsite_contact_phone?: string | null
          ops_status?: string | null
          quote_id?: string | null
          recommended_kit_id?: string | null
          run_sheet_url?: string | null
          special_instructions?: string | null
          start_at?: string | null
          start_time?: string | null
          state?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_id?: string | null
          venue_name?: string | null
          venue_postcode?: string | null
        }
        Update: {
          calendar_sequence?: number
          city?: string | null
          client_id?: string | null
          client_name?: string
          cost_threshold?: number | null
          coverage_details?: string | null
          coverage_package_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date_status?: string | null
          delivery_deadline?: string | null
          delivery_method?:
            | Database["public"]["Enums"]["delivery_method"]
            | null
          delivery_method_id?: string | null
          end_at?: string | null
          end_time?: string | null
          enquiry_source?: string | null
          event_date?: string
          event_name?: string
          event_series_id?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          event_type_id?: string | null
          id?: string
          invoice_paid_at?: string | null
          invoice_reference?: string | null
          invoice_status?: string | null
          is_training?: boolean | null
          job_intake_id?: string | null
          lead_id?: string | null
          notes?: string | null
          onsite_contact_name?: string | null
          onsite_contact_phone?: string | null
          ops_status?: string | null
          quote_id?: string | null
          recommended_kit_id?: string | null
          run_sheet_url?: string | null
          special_instructions?: string | null
          start_at?: string | null
          start_time?: string | null
          state?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_id?: string | null
          venue_name?: string | null
          venue_postcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_coverage_package_id_fkey"
            columns: ["coverage_package_id"]
            isOneToOne: false
            referencedRelation: "coverage_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_delivery_method_id_fkey"
            columns: ["delivery_method_id"]
            isOneToOne: false
            referencedRelation: "delivery_methods_lookup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_event_series_id_fkey"
            columns: ["event_series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_job_intake_id_fkey"
            columns: ["job_intake_id"]
            isOneToOne: false
            referencedRelation: "job_intake"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_recommended_kit_id_fkey"
            columns: ["recommended_kit_id"]
            isOneToOne: false
            referencedRelation: "equipment_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_assets: {
        Row: {
          alt_text: string | null
          caption: string | null
          created_at: string
          event_id: string
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          sort_order: number
          storage_path: string
          thumbnail_path: string | null
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          event_id: string
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          sort_order?: number
          storage_path: string
          thumbnail_path?: string | null
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          event_id?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          sort_order?: number
          storage_path?: string
          thumbnail_path?: string | null
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
      guardrail_overrides: {
        Row: {
          created_at: string | null
          created_by: string
          event_id: string | null
          id: string
          justification: string
          override_type: string
          rules_breached: string[]
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          event_id?: string | null
          id?: string
          justification: string
          override_type: string
          rules_breached: string[]
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          event_id?: string | null
          id?: string
          justification?: string
          override_type?: string
          rules_breached?: string[]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardrail_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardrail_overrides_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardrail_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guardrail_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      job_intake: {
        Row: {
          client_email: string | null
          client_name: string
          converted_at: string | null
          converted_by: string | null
          created_at: string | null
          external_job_id: string | null
          handoff_status: Database["public"]["Enums"]["handoff_status"]
          id: string
          job_name: string
          notes: string | null
          proposed_event_date: string | null
          source: string
          status: string
          updated_at: string | null
        }
        Insert: {
          client_email?: string | null
          client_name: string
          converted_at?: string | null
          converted_by?: string | null
          created_at?: string | null
          external_job_id?: string | null
          handoff_status?: Database["public"]["Enums"]["handoff_status"]
          id?: string
          job_name: string
          notes?: string | null
          proposed_event_date?: string | null
          source?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          client_email?: string | null
          client_name?: string
          converted_at?: string | null
          converted_by?: string | null
          created_at?: string | null
          external_job_id?: string | null
          handoff_status?: Database["public"]["Enums"]["handoff_status"]
          id?: string
          job_name?: string
          notes?: string | null
          proposed_event_date?: string | null
          source?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_intake_converted_by_fkey"
            columns: ["converted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_workflow_items: {
        Row: {
          created_at: string | null
          done_at: string | null
          done_by: string | null
          id: string
          is_done: boolean | null
          lead_id: string
          sort_order: number | null
          title: string
        }
        Insert: {
          created_at?: string | null
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean | null
          lead_id: string
          sort_order?: number | null
          title: string
        }
        Update: {
          created_at?: string | null
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean | null
          lead_id?: string
          sort_order?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_workflow_items_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_workflow_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          estimated_event_date: string | null
          event_month_hint: number | null
          event_type_id: string | null
          id: string
          is_training: boolean | null
          lead_name: string
          lost_reason_id: string | null
          notes: string | null
          owner_priority: string | null
          received_at: string | null
          requirements_summary: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string | null
          venue_text: string | null
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          estimated_event_date?: string | null
          event_month_hint?: number | null
          event_type_id?: string | null
          id?: string
          is_training?: boolean | null
          lead_name: string
          lost_reason_id?: string | null
          notes?: string | null
          owner_priority?: string | null
          received_at?: string | null
          requirements_summary?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string | null
          venue_text?: string | null
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          estimated_event_date?: string | null
          event_month_hint?: number | null
          event_type_id?: string | null
          id?: string
          is_training?: boolean | null
          lead_name?: string
          lost_reason_id?: string | null
          notes?: string | null
          owner_priority?: string | null
          received_at?: string | null
          requirements_summary?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string | null
          venue_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_lost_reason_id_fkey"
            columns: ["lost_reason_id"]
            isOneToOne: false
            referencedRelation: "lost_reasons"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_reasons: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          delivery_channel: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          message: string
          severity: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_channel?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message: string
          severity?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_channel?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message?: string
          severity?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          tax_rate: number | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tax_rate?: number | null
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tax_rate?: number | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
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
          email_notifications_enabled: boolean | null
          full_name: string | null
          home_city: string | null
          home_state: string | null
          id: string
          is_training: boolean | null
          notes_internal: string | null
          notification_preferences: Json | null
          onboarding_notes: string | null
          onboarding_status: string
          phone: string | null
          preferred_end_time: string | null
          preferred_start_time: string | null
          seniority: string | null
          status: string | null
          travel_ready: boolean | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          default_role_id?: string | null
          email: string
          email_notifications_enabled?: boolean | null
          full_name?: string | null
          home_city?: string | null
          home_state?: string | null
          id: string
          is_training?: boolean | null
          notes_internal?: string | null
          notification_preferences?: Json | null
          onboarding_notes?: string | null
          onboarding_status?: string
          phone?: string | null
          preferred_end_time?: string | null
          preferred_start_time?: string | null
          seniority?: string | null
          status?: string | null
          travel_ready?: boolean | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          default_role_id?: string | null
          email?: string
          email_notifications_enabled?: boolean | null
          full_name?: string | null
          home_city?: string | null
          home_state?: string | null
          id?: string
          is_training?: boolean | null
          notes_internal?: string | null
          notification_preferences?: Json | null
          onboarding_notes?: string | null
          onboarding_status?: string
          phone?: string | null
          preferred_end_time?: string | null
          preferred_start_time?: string | null
          seniority?: string | null
          status?: string | null
          travel_ready?: boolean | null
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
      quote_acceptance_attempts: {
        Row: {
          attempt_at: string
          id: string
          public_token: string
          success: boolean
        }
        Insert: {
          attempt_at?: string
          id?: string
          public_token: string
          success?: boolean
        }
        Update: {
          attempt_at?: string
          id?: string
          public_token?: string
          success?: boolean
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          created_at: string | null
          description: string
          group_label: string | null
          id: string
          line_total: number | null
          product_id: string | null
          quantity: number
          quote_id: string
          sort_order: number | null
          tax_rate: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          description: string
          group_label?: string | null
          id?: string
          line_total?: number | null
          product_id?: string | null
          quantity?: number
          quote_id: string
          sort_order?: number | null
          tax_rate?: number | null
          unit_price?: number
        }
        Update: {
          created_at?: string | null
          description?: string
          group_label?: string | null
          id?: string
          line_total?: number | null
          product_id?: string | null
          quantity?: number
          quote_id?: string
          sort_order?: number | null
          tax_rate?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          items_json: Json
          name: string
          terms_text: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          items_json?: Json
          name: string
          terms_text?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          items_json?: Json
          name?: string
          terms_text?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          accepted_at: string | null
          accepted_by_email: string | null
          accepted_by_name: string | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          intro_text: string | null
          lead_id: string | null
          linked_event_id: string | null
          notes: string | null
          notes_internal: string | null
          public_token: string | null
          quote_number: string | null
          quote_version: number
          scope_text: string | null
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number | null
          tax_total: number | null
          terms_text: string | null
          total_estimate: number | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_email?: string | null
          accepted_by_name?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          intro_text?: string | null
          lead_id?: string | null
          linked_event_id?: string | null
          notes?: string | null
          notes_internal?: string | null
          public_token?: string | null
          quote_number?: string | null
          quote_version?: number
          scope_text?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number | null
          tax_total?: number | null
          terms_text?: string | null
          total_estimate?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by_email?: string | null
          accepted_by_name?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          intro_text?: string | null
          lead_id?: string | null
          linked_event_id?: string | null
          notes?: string | null
          notes_internal?: string | null
          public_token?: string | null
          quote_number?: string | null
          quote_version?: number
          scope_text?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number | null
          tax_total?: number | null
          terms_text?: string | null
          total_estimate?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_linked_event_id_fkey"
            columns: ["linked_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      rebooking_profiles: {
        Row: {
          auto_remind: boolean | null
          client_id: string
          created_at: string | null
          id: string
          last_event_at: string | null
          next_expected_event_at: string | null
          rebook_contact_id: string | null
          rebook_notes: string | null
          typical_event_month: number | null
          typical_lead_time_days: number | null
          updated_at: string | null
        }
        Insert: {
          auto_remind?: boolean | null
          client_id: string
          created_at?: string | null
          id?: string
          last_event_at?: string | null
          next_expected_event_at?: string | null
          rebook_contact_id?: string | null
          rebook_notes?: string | null
          typical_event_month?: number | null
          typical_lead_time_days?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_remind?: boolean | null
          client_id?: string
          created_at?: string | null
          id?: string
          last_event_at?: string | null
          next_expected_event_at?: string | null
          rebook_contact_id?: string | null
          rebook_notes?: string | null
          typical_event_month?: number | null
          typical_lead_time_days?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rebooking_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rebooking_profiles_rebook_contact_id_fkey"
            columns: ["rebook_contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_workflow_templates: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          items: Json
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          items?: Json
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          items?: Json
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      skills: {
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
      staff_availability: {
        Row: {
          availability_status: string
          created_at: string
          date: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          availability_status?: string
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          availability_status?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_compliance_documents: {
        Row: {
          created_at: string | null
          document_type_id: string
          document_url: string
          expiry_date: string | null
          file_name: string | null
          id: string
          issued_date: string | null
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
          uploaded_at: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          document_type_id: string
          document_url: string
          expiry_date?: string | null
          file_name?: string | null
          id?: string
          issued_date?: string | null
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          uploaded_at?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          document_type_id?: string
          document_url?: string
          expiry_date?: string | null
          file_name?: string | null
          id?: string
          issued_date?: string | null
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_compliance_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "compliance_document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_compliance_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_compliance_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_event_feedback: {
        Row: {
          created_at: string | null
          created_by: string
          event_id: string
          id: string
          notes: string | null
          rating: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          event_id: string
          id?: string
          notes?: string | null
          rating: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          event_id?: string
          id?: string
          notes?: string | null
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_event_feedback_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_event_feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_event_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_rates: {
        Row: {
          base_rate: number
          created_at: string | null
          currency: string
          effective_from: string
          effective_to: string | null
          id: string
          notes: string | null
          rate_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          base_rate: number
          created_at?: string | null
          currency?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          rate_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          base_rate?: number
          created_at?: string | null
          currency?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          rate_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_rates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      staff_skills: {
        Row: {
          created_at: string | null
          id: string
          rejected_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          skill_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          rejected_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          skill_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          rejected_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          skill_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          priority: string | null
          related_id: string
          related_type: string
          snoozed_until: string | null
          status: string
          task_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string | null
          related_id: string
          related_type: string
          snoozed_until?: string | null
          status?: string
          task_type?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string | null
          related_id?: string
          related_type?: string
          snoozed_until?: string | null
          status?: string
          task_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      venues: {
        Row: {
          access_notes: string | null
          address_line_1: string | null
          address_line_2: string | null
          country: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          parking_notes: string | null
          postcode: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          state: string | null
          suburb: string | null
          updated_at: string | null
        }
        Insert: {
          access_notes?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parking_notes?: string | null
          postcode?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          state?: string | null
          suburb?: string | null
          updated_at?: string | null
        }
        Update: {
          access_notes?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parking_notes?: string | null
          postcode?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          state?: string | null
          suburb?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      workflow_template_items: {
        Row: {
          created_at: string | null
          help_text: string | null
          id: string
          is_active: boolean | null
          label: string
          sort_order: number
          template_id: string
        }
        Insert: {
          created_at?: string | null
          help_text?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number
          template_id: string
        }
        Update: {
          created_at?: string | null
          help_text?: string | null
          id?: string
          is_active?: boolean | null
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
      xero_sync_log: {
        Row: {
          completed_at: string | null
          created_by: string | null
          error_message: string | null
          events_synced: number | null
          id: string
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          created_by?: string | null
          error_message?: string | null
          events_synced?: number | null
          id?: string
          started_at?: string
          status?: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          created_by?: string | null
          error_message?: string | null
          events_synced?: number | null
          id?: string
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "xero_sync_log_created_by_fkey"
            columns: ["created_by"]
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
      accept_contract_public: {
        Args: { p_email: string; p_name: string; p_token: string }
        Returns: Json
      }
      accept_quote_public: {
        Args: { p_email: string; p_name: string; p_token: string }
        Returns: Json
      }
      can_access_sales: { Args: { _user_id: string }; Returns: boolean }
      check_staff_conflicts: {
        Args: {
          p_end_at: string
          p_exclude_event_id?: string
          p_start_at: string
          p_user_id: string
        }
        Returns: {
          end_at: string
          event_id: string
          event_name: string
          start_at: string
        }[]
      }
      check_staff_eligibility: { Args: { p_user_id: string }; Returns: Json }
      convert_enquiry_to_event: { Args: { p_input: Json }; Returns: Json }
      create_notification: {
        Args: {
          p_dedupe_hours?: number
          p_entity_id?: string
          p_entity_type?: string
          p_message: string
          p_severity?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      expire_compliance_documents: { Args: never; Returns: number }
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
      is_executive: { Args: { _user_id: string }; Returns: boolean }
      is_executive_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_photographer: { Args: { _user_id: string }; Returns: boolean }
      log_audit_entry:
        | {
            Args: {
              p_action: Database["public"]["Enums"]["audit_action"]
              p_actor_user_id: string
              p_after?: Json
              p_before?: Json
              p_event_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_action: Database["public"]["Enums"]["audit_action"]
              p_after?: Json
              p_before?: Json
              p_event_id: string
            }
            Returns: string
          }
      mark_contract_as_sent: { Args: { p_contract_id: string }; Returns: Json }
      mark_quote_as_sent: { Args: { p_quote_id: string }; Returns: Json }
      regenerate_contract_token: {
        Args: { p_contract_id: string }
        Returns: Json
      }
      regenerate_quote_token: { Args: { p_quote_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "photographer" | "sales" | "executive"
      audit_action:
        | "event_created"
        | "event_updated"
        | "assignment_created"
        | "assignment_removed"
        | "delivery_updated"
        | "worksheet_item_toggled"
        | "assignment_override"
        | "equipment_allocated"
        | "equipment_pickup_marked"
        | "equipment_returned"
        | "equipment_flagged_missing"
        | "equipment_flagged_damaged"
        | "compliance_override"
        | "guardrail_override"
        | "quote_token_regenerated"
        | "contract_token_regenerated"
        | "quote_accepted_public"
        | "quote_acceptance_failed"
        | "contract_accepted_public"
        | "contract_acceptance_failed"
        | "bulk_update"
        | "note_added"
        | "enquiry_won"
        | "event_created_from_enquiry"
        | "workflow_pack_applied"
        | "tasks_created"
        | "venue_created_or_linked"
        | "event_cancelled"
      contract_status: "draft" | "sent" | "signed" | "cancelled"
      delivery_method:
        | "dropbox"
        | "zno_instant"
        | "spotmyphotos"
        | "internal_gallery"
      email_trigger_type:
        | "manual"
        | "quote_sent"
        | "quote_followup"
        | "booking_confirmed"
        | "event_reminder"
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
      handoff_status: "draft" | "ready_for_ops" | "converted" | "cancelled"
      lead_status: "new" | "qualified" | "quoted" | "accepted" | "lost"
      quote_status: "draft" | "sent" | "accepted" | "rejected"
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
      app_role: ["admin", "photographer", "sales", "executive"],
      audit_action: [
        "event_created",
        "event_updated",
        "assignment_created",
        "assignment_removed",
        "delivery_updated",
        "worksheet_item_toggled",
        "assignment_override",
        "equipment_allocated",
        "equipment_pickup_marked",
        "equipment_returned",
        "equipment_flagged_missing",
        "equipment_flagged_damaged",
        "compliance_override",
        "guardrail_override",
        "quote_token_regenerated",
        "contract_token_regenerated",
        "quote_accepted_public",
        "quote_acceptance_failed",
        "contract_accepted_public",
        "contract_acceptance_failed",
        "bulk_update",
        "note_added",
        "enquiry_won",
        "event_created_from_enquiry",
        "workflow_pack_applied",
        "tasks_created",
        "venue_created_or_linked",
        "event_cancelled",
      ],
      contract_status: ["draft", "sent", "signed", "cancelled"],
      delivery_method: [
        "dropbox",
        "zno_instant",
        "spotmyphotos",
        "internal_gallery",
      ],
      email_trigger_type: [
        "manual",
        "quote_sent",
        "quote_followup",
        "booking_confirmed",
        "event_reminder",
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
      handoff_status: ["draft", "ready_for_ops", "converted", "cancelled"],
      lead_status: ["new", "qualified", "quoted", "accepted", "lost"],
      quote_status: ["draft", "sent", "accepted", "rejected"],
      staff_role: ["photographer", "videographer", "assistant"],
      staff_status: ["active", "inactive"],
      workflow_phase: ["pre_event", "day_of", "post_event"],
      worksheet_item_status: ["pending", "in_progress", "completed"],
    },
  },
} as const
