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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          event_id: string
          id: string
          summary: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          event_id: string
          id?: string
          summary?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          event_id?: string
          id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_tokens: {
        Row: {
          id: string
          event_id: string
          token_hash: string
          label: string | null
          expires_at: string
          revoked_at: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          token_hash: string
          label?: string | null
          expires_at?: string
          revoked_at?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          token_hash?: string
          label?: string | null
          expires_at?: string
          revoked_at?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_tokens_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_invoices: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          created_by: string | null
          currency: string
          due_date: string | null
          id: string
          invoice_number: string
          issued_at: string
          notes: string | null
          paid_amount: number
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          issued_at?: string
          notes?: string | null
          paid_amount?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string
          notes?: string | null
          paid_amount?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "vendor_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_payment_schedule: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          due_date: string | null
          id: string
          label: string
          paid_amount: number
          sort_order: number
          status: Database["public"]["Enums"]["payment_schedule_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          label: string
          paid_amount?: number
          sort_order?: number
          status?: Database["public"]["Enums"]["payment_schedule_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          label?: string
          paid_amount?: number
          sort_order?: number
          status?: Database["public"]["Enums"]["payment_schedule_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_payment_schedule_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "vendor_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          actual_amount: number
          category: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          estimated_amount: number
          event_id: string
          id: string
          is_sample: boolean
          is_test_seed: boolean
          label: string
          notes: string | null
          paid_amount: number
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          actual_amount?: number
          category: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          estimated_amount?: number
          event_id: string
          id?: string
          is_sample?: boolean
          is_test_seed?: boolean
          label: string
          notes?: string | null
          paid_amount?: number
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          actual_amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          estimated_amount?: number
          event_id?: string
          id?: string
          is_sample?: boolean
          is_test_seed?: boolean
          label?: string
          notes?: string | null
          paid_amount?: number
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          start_time: string
          updated_at: string
          user_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          start_time: string
          updated_at?: string
          user_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
          updated_at?: string
          user_id?: string
          weekday?: number
        }
        Relationships: []
      }
      calendar_blocked_dates: {
        Row: {
          created_at: string
          end_date: string
          id: string
          notes: string | null
          reason: Database["public"]["Enums"]["calendar_block_reason"]
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          reason?: Database["public"]["Enums"]["calendar_block_reason"]
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          reason?: Database["public"]["Enums"]["calendar_block_reason"]
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_booking_requests: {
        Row: {
          address: string | null
          alternate_end: string | null
          alternate_message: string | null
          alternate_start: string | null
          booking_id: string | null
          client_name: string | null
          created_at: string
          event_name: string
          event_type: string | null
          id: string
          message: string | null
          planner_id: string
          requested_end: string
          requested_start: string
          status: Database["public"]["Enums"]["calendar_request_status"]
          updated_at: string
          vendor_id: string
          venue_name: string | null
        }
        Insert: {
          address?: string | null
          alternate_end?: string | null
          alternate_message?: string | null
          alternate_start?: string | null
          booking_id?: string | null
          client_name?: string | null
          created_at?: string
          event_name: string
          event_type?: string | null
          id?: string
          message?: string | null
          planner_id: string
          requested_end: string
          requested_start: string
          status?: Database["public"]["Enums"]["calendar_request_status"]
          updated_at?: string
          vendor_id: string
          venue_name?: string | null
        }
        Update: {
          address?: string | null
          alternate_end?: string | null
          alternate_message?: string | null
          alternate_start?: string | null
          booking_id?: string | null
          client_name?: string | null
          created_at?: string
          event_name?: string
          event_type?: string | null
          id?: string
          message?: string | null
          planner_id?: string
          requested_end?: string
          requested_start?: string
          status?: Database["public"]["Enums"]["calendar_request_status"]
          updated_at?: string
          vendor_id?: string
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_booking_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_connections: {
        Row: {
          access_token: string | null
          created_at: string
          external_account_email: string | null
          external_calendar_id: string | null
          id: string
          is_active: boolean
          last_error: string | null
          last_synced_at: string | null
          provider: Database["public"]["Enums"]["calendar_provider"]
          refresh_token: string | null
          scope: string | null
          sync_direction: Database["public"]["Enums"]["calendar_sync_direction"]
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          external_account_email?: string | null
          external_calendar_id?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_synced_at?: string | null
          provider: Database["public"]["Enums"]["calendar_provider"]
          refresh_token?: string | null
          scope?: string | null
          sync_direction?: Database["public"]["Enums"]["calendar_sync_direction"]
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          external_account_email?: string | null
          external_calendar_id?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_synced_at?: string | null
          provider?: Database["public"]["Enums"]["calendar_provider"]
          refresh_token?: string | null
          scope?: string | null
          sync_direction?: Database["public"]["Enums"]["calendar_sync_direction"]
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          address: string | null
          attachments: Json
          breakdown_minutes: number
          checklist: Json
          client_name: string | null
          contract_status: string | null
          created_at: string
          ends_at: string
          event_id: string | null
          event_name: string
          event_type: string | null
          external_id: string | null
          external_provider: string | null
          id: string
          internal_notes: string | null
          payment_status: string | null
          planner_id: string | null
          revenue_amount: number | null
          setup_minutes: number
          source: Database["public"]["Enums"]["calendar_event_source"]
          starts_at: string
          status: Database["public"]["Enums"]["calendar_event_status"]
          team_assignments: Json
          timeline: Json
          updated_at: string
          vendor_id: string
          venue_name: string | null
        }
        Insert: {
          address?: string | null
          attachments?: Json
          breakdown_minutes?: number
          checklist?: Json
          client_name?: string | null
          contract_status?: string | null
          created_at?: string
          ends_at: string
          event_id?: string | null
          event_name: string
          event_type?: string | null
          external_id?: string | null
          external_provider?: string | null
          id?: string
          internal_notes?: string | null
          payment_status?: string | null
          planner_id?: string | null
          revenue_amount?: number | null
          setup_minutes?: number
          source?: Database["public"]["Enums"]["calendar_event_source"]
          starts_at: string
          status?: Database["public"]["Enums"]["calendar_event_status"]
          team_assignments?: Json
          timeline?: Json
          updated_at?: string
          vendor_id: string
          venue_name?: string | null
        }
        Update: {
          address?: string | null
          attachments?: Json
          breakdown_minutes?: number
          checklist?: Json
          client_name?: string | null
          contract_status?: string | null
          created_at?: string
          ends_at?: string
          event_id?: string | null
          event_name?: string
          event_type?: string | null
          external_id?: string | null
          external_provider?: string | null
          id?: string
          internal_notes?: string | null
          payment_status?: string | null
          planner_id?: string | null
          revenue_amount?: number | null
          setup_minutes?: number
          source?: Database["public"]["Enums"]["calendar_event_source"]
          starts_at?: string
          status?: Database["public"]["Enums"]["calendar_event_status"]
          team_assignments?: Json
          timeline?: Json
          updated_at?: string
          vendor_id?: string
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_settings: {
        Row: {
          block_travel_days: boolean
          buffer_after_minutes: number
          buffer_before_minutes: number
          calendar_feed_token: string | null
          created_at: string
          include_address: boolean
          include_event_name: boolean
          include_venue: boolean
          max_events_per_day: number
          timezone: string
          updated_at: string
          user_id: string
          vacation_end: string | null
          vacation_start: string | null
        }
        Insert: {
          block_travel_days?: boolean
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          calendar_feed_token?: string | null
          created_at?: string
          include_address?: boolean
          include_event_name?: boolean
          include_venue?: boolean
          max_events_per_day?: number
          timezone?: string
          updated_at?: string
          user_id: string
          vacation_end?: string | null
          vacation_start?: string | null
        }
        Update: {
          block_travel_days?: boolean
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          calendar_feed_token?: string | null
          created_at?: string
          include_address?: boolean
          include_event_name?: boolean
          include_venue?: boolean
          max_events_per_day?: number
          timezone?: string
          updated_at?: string
          user_id?: string
          vacation_end?: string | null
          vacation_start?: string | null
        }
        Relationships: []
      }
      calendar_sync_map: {
        Row: {
          created_at: string
          event_id: string
          external_etag: string | null
          external_event_id: string
          id: string
          last_pulled_at: string | null
          last_pushed_at: string | null
          provider: Database["public"]["Enums"]["calendar_provider"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          external_etag?: string | null
          external_event_id: string
          id?: string
          last_pulled_at?: string | null
          last_pushed_at?: string | null
          provider: Database["public"]["Enums"]["calendar_provider"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          external_etag?: string | null
          external_event_id?: string
          id?: string
          last_pulled_at?: string | null
          last_pushed_at?: string | null
          provider?: Database["public"]["Enums"]["calendar_provider"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_sync_map_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          joined_at: string
          participant_role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          participant_role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          participant_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          archived_at: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_archived: boolean
          is_favorite: boolean
          is_muted: boolean
          is_pinned: boolean
          is_sample: boolean
          is_test_seed: boolean
          labels: string[]
          last_message_at: string
          last_message_preview: string | null
          owner_id: string
          title: string | null
          type: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          is_favorite?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          is_sample?: boolean
          is_test_seed?: boolean
          labels?: string[]
          last_message_at?: string
          last_message_preview?: string | null
          owner_id: string
          title?: string | null
          type?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          is_favorite?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          is_sample?: boolean
          is_test_seed?: boolean
          labels?: string[]
          last_message_at?: string
          last_message_preview?: string | null
          owner_id?: string
          title?: string | null
          type?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_communications: {
        Row: {
          body: string
          created_at: string
          event_id: string
          id: string
          organizer_id: string
          recipient_count: number
          recipient_group: string
          scheduled_for: string | null
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id: string
          id?: string
          organizer_id: string
          recipient_count?: number
          recipient_group: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string
          id?: string
          organizer_id?: string
          recipient_count?: number
          recipient_group?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_communications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_drafts: {
        Row: {
          approved_event_id: string | null
          confidence: number
          created_at: string
          extracted: Json
          field_confidences: Json
          id: string
          owner_id: string
          raw_input: string | null
          review_notes: string | null
          reviewed_at: string | null
          source: Database["public"]["Enums"]["event_draft_source"]
          source_reference: string | null
          status: Database["public"]["Enums"]["event_draft_status"]
          suggested_next_actions: Json
          summary: string | null
          updated_at: string
        }
        Insert: {
          approved_event_id?: string | null
          confidence?: number
          created_at?: string
          extracted?: Json
          field_confidences?: Json
          id?: string
          owner_id: string
          raw_input?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          source?: Database["public"]["Enums"]["event_draft_source"]
          source_reference?: string | null
          status?: Database["public"]["Enums"]["event_draft_status"]
          suggested_next_actions?: Json
          summary?: string | null
          updated_at?: string
        }
        Update: {
          approved_event_id?: string | null
          confidence?: number
          created_at?: string
          extracted?: Json
          field_confidences?: Json
          id?: string
          owner_id?: string
          raw_input?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          source?: Database["public"]["Enums"]["event_draft_source"]
          source_reference?: string | null
          status?: Database["public"]["Enums"]["event_draft_status"]
          suggested_next_actions?: Json
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_drafts_approved_event_id_fkey"
            columns: ["approved_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_files: {
        Row: {
          category: string
          created_at: string
          deleted_at: string | null
          event_id: string
          filename: string
          id: string
          is_sample: boolean
          is_test_seed: boolean
          mime_type: string | null
          notes: string | null
          size_bytes: number | null
          storage_path: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          event_id: string
          filename: string
          id?: string
          is_sample?: boolean
          is_test_seed?: boolean
          mime_type?: string | null
          notes?: string | null
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          category?: string
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          filename?: string
          id?: string
          is_sample?: boolean
          is_test_seed?: boolean
          mime_type?: string | null
          notes?: string | null
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_files_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_members: {
        Row: {
          created_at: string
          event_id: string
          invited_email: string | null
          is_sample: boolean
          role: Database["public"]["Enums"]["event_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          invited_email?: string | null
          is_sample?: boolean
          role?: Database["public"]["Enums"]["event_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          invited_email?: string | null
          is_sample?: boolean
          role?: Database["public"]["Enums"]["event_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_members_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_runsheet_items: {
        Row: {
          ai_generated: boolean
          assigned_user_id: string | null
          assigned_vendor_id: string | null
          created_at: string
          created_by: string | null
          duration_min: number
          event_id: string
          id: string
          is_sample: boolean
          locked: boolean
          notes: string | null
          owner: string | null
          sort_order: number
          start_time: string | null
          status: Database["public"]["Enums"]["runsheet_status"]
          title: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          assigned_user_id?: string | null
          assigned_vendor_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_min?: number
          event_id: string
          id?: string
          is_sample?: boolean
          locked?: boolean
          notes?: string | null
          owner?: string | null
          sort_order?: number
          start_time?: string | null
          status?: Database["public"]["Enums"]["runsheet_status"]
          title: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          assigned_user_id?: string | null
          assigned_vendor_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_min?: number
          event_id?: string
          id?: string
          is_sample?: boolean
          locked?: boolean
          notes?: string | null
          owner?: string | null
          sort_order?: number
          start_time?: string | null
          status?: Database["public"]["Enums"]["runsheet_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_runsheet_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_shopping_items: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          is_test_seed: boolean
          item: string
          notes: string | null
          purchased: boolean
          quantity: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          is_test_seed?: boolean
          item: string
          notes?: string | null
          purchased?: boolean
          quantity?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          is_test_seed?: boolean
          item?: string
          notes?: string | null
          purchased?: boolean
          quantity?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_shopping_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_vendor_needs: {
        Row: {
          booked_vendor_id: string | null
          category: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          is_sample: boolean
          notes: string | null
          priority: number
          sort_order: number
          status: Database["public"]["Enums"]["vendor_need_status"]
          updated_at: string
        }
        Insert: {
          booked_vendor_id?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          is_sample?: boolean
          notes?: string | null
          priority?: number
          sort_order?: number
          status?: Database["public"]["Enums"]["vendor_need_status"]
          updated_at?: string
        }
        Update: {
          booked_vendor_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          is_sample?: boolean
          notes?: string | null
          priority?: number
          sort_order?: number
          status?: Database["public"]["Enums"]["vendor_need_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_vendor_needs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          balance_due_date: string | null
          banner_url: string | null
          budget_target: number | null
          ceremony_start_time: string | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          cover_image_url: string | null
          created_at: string
          custom_event_type: string | null
          deleted_at: string | null
          deposit_paid: number | null
          deposit_required: number | null
          description: string | null
          end_time: string | null
          event_date: string | null
          event_notes: string | null
          event_time: string | null
          event_type: string | null
          event_visibility: string
          gift_registry_url: string | null
          guest_target: number | null
          id: string
          invitation_guidance: string | null
          invitation_last_sent_at: string | null
          is_published: boolean
          is_sample: boolean
          is_test_seed: boolean
          lead_source: string | null
          location: string | null
          name: string
          owner_id: string
          payment_status: string | null
          preferred_contact: string | null
          public_description: string | null
          public_faqs: Json
          sample_metadata: Json | null
          show_rsvp_public: boolean
          show_schedule_public: boolean
          source_draft_id: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["event_status"]
          ticket_accent_color: string
          ticket_cancellation_policy: string
          ticket_cancellation_terms: string | null
          ticket_cancellation_window_hours: number | null
          ticket_contact_email: string | null
          ticket_contact_name: string | null
          ticket_primary_color: string
          tickets_enabled: boolean
          updated_at: string
          venue_city: string | null
          venue_lat: number | null
          venue_lng: number | null
          venue_place_id: string | null
          venue_state: string | null
          venue_street: string | null
          venue_zip: string | null
        }
        Insert: {
          balance_due_date?: string | null
          banner_url?: string | null
          budget_target?: number | null
          ceremony_start_time?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          cover_image_url?: string | null
          created_at?: string
          custom_event_type?: string | null
          deleted_at?: string | null
          deposit_paid?: number | null
          deposit_required?: number | null
          description?: string | null
          end_time?: string | null
          event_date?: string | null
          event_notes?: string | null
          event_time?: string | null
          event_type?: string | null
          event_visibility?: string
          gift_registry_url?: string | null
          guest_target?: number | null
          id?: string
          invitation_guidance?: string | null
          invitation_last_sent_at?: string | null
          is_published?: boolean
          is_sample?: boolean
          is_test_seed?: boolean
          lead_source?: string | null
          location?: string | null
          name: string
          owner_id: string
          payment_status?: string | null
          preferred_contact?: string | null
          public_description?: string | null
          public_faqs?: Json
          sample_metadata?: Json | null
          show_rsvp_public?: boolean
          show_schedule_public?: boolean
          source_draft_id?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          ticket_accent_color?: string
          ticket_cancellation_policy?: string
          ticket_cancellation_terms?: string | null
          ticket_cancellation_window_hours?: number | null
          ticket_contact_email?: string | null
          ticket_contact_name?: string | null
          ticket_primary_color?: string
          tickets_enabled?: boolean
          updated_at?: string
          venue_city?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_place_id?: string | null
          venue_state?: string | null
          venue_street?: string | null
          venue_zip?: string | null
        }
        Update: {
          balance_due_date?: string | null
          banner_url?: string | null
          budget_target?: number | null
          ceremony_start_time?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          cover_image_url?: string | null
          created_at?: string
          custom_event_type?: string | null
          deleted_at?: string | null
          deposit_paid?: number | null
          deposit_required?: number | null
          description?: string | null
          end_time?: string | null
          event_date?: string | null
          event_notes?: string | null
          event_time?: string | null
          event_type?: string | null
          event_visibility?: string
          gift_registry_url?: string | null
          guest_target?: number | null
          id?: string
          invitation_guidance?: string | null
          invitation_last_sent_at?: string | null
          is_published?: boolean
          is_sample?: boolean
          is_test_seed?: boolean
          lead_source?: string | null
          location?: string | null
          name?: string
          owner_id?: string
          payment_status?: string | null
          preferred_contact?: string | null
          public_description?: string | null
          public_faqs?: Json
          sample_metadata?: Json | null
          show_rsvp_public?: boolean
          show_schedule_public?: boolean
          source_draft_id?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          ticket_accent_color?: string
          ticket_cancellation_policy?: string
          ticket_cancellation_terms?: string | null
          ticket_cancellation_window_hours?: number | null
          ticket_contact_email?: string | null
          ticket_contact_name?: string | null
          ticket_primary_color?: string
          tickets_enabled?: boolean
          updated_at?: string
          venue_city?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_place_id?: string | null
          venue_state?: string | null
          venue_street?: string | null
          venue_zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_source_draft_id_fkey"
            columns: ["source_draft_id"]
            isOneToOne: false
            referencedRelation: "event_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string | null
          event_id: string
          full_name: string
          household: string | null
          id: string
          invited_at: string | null
          is_sample: boolean
          is_test_seed: boolean
          meal_choice: string | null
          notes: string | null
          phone: string | null
          plus_ones: number
          rsvp_status: Database["public"]["Enums"]["guest_rsvp"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          event_id: string
          full_name: string
          household?: string | null
          id?: string
          invited_at?: string | null
          is_sample?: boolean
          is_test_seed?: boolean
          meal_choice?: string | null
          notes?: string | null
          phone?: string | null
          plus_ones?: number
          rsvp_status?: Database["public"]["Enums"]["guest_rsvp"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          event_id?: string
          full_name?: string
          household?: string | null
          id?: string
          invited_at?: string | null
          is_sample?: boolean
          is_test_seed?: boolean
          meal_choice?: string | null
          notes?: string | null
          phone?: string | null
          plus_ones?: number
          rsvp_status?: Database["public"]["Enums"]["guest_rsvp"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      message_template_versions: {
        Row: {
          body: string
          created_at: string
          edited_by: string | null
          id: string
          template_id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          edited_by?: string | null
          id?: string
          template_id: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          edited_by?: string | null
          id?: string
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          is_archived: boolean
          is_favorite: boolean
          last_used_at: string | null
          owner_id: string | null
          title: string
          tone: string | null
          updated_at: string
          usage_count: number
          variables: string[]
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_favorite?: boolean
          last_used_at?: string | null
          owner_id?: string | null
          title: string
          tone?: string | null
          updated_at?: string
          usage_count?: number
          variables?: string[]
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_favorite?: boolean
          last_used_at?: string | null
          owner_id?: string | null
          title?: string
          tone?: string | null
          updated_at?: string
          usage_count?: number
          variables?: string[]
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachments: Json
          body: string | null
          conversation_id: string
          created_at: string
          id: string
          is_sample: boolean
          is_test_seed: boolean
          read_at: string | null
          sender_id: string
          status: string
        }
        Insert: {
          attachments?: Json
          body?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          is_sample?: boolean
          is_test_seed?: boolean
          read_at?: string | null
          sender_id: string
          status?: string
        }
        Update: {
          attachments?: Json
          body?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_sample?: boolean
          is_test_seed?: boolean
          read_at?: string | null
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          calendar_enabled: boolean
          category: string
          channel: string
          created_at: string
          email_enabled: boolean
          event_id: string | null
          frequency: string
          id: string
          in_app_enabled: boolean
          push_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          sms_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_enabled?: boolean
          category?: string
          channel: string
          created_at?: string
          email_enabled?: boolean
          event_id?: string | null
          frequency?: string
          id?: string
          in_app_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sms_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_enabled?: boolean
          category?: string
          channel?: string
          created_at?: string
          email_enabled?: boolean
          event_id?: string | null
          frequency?: string
          id?: string
          in_app_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          href: string | null
          icon: string | null
          id: string
          is_sample: boolean
          is_test_seed: boolean
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          href?: string | null
          icon?: string | null
          id?: string
          is_sample?: boolean
          is_test_seed?: boolean
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          href?: string | null
          icon?: string | null
          id?: string
          is_sample?: boolean
          is_test_seed?: boolean
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          ics_token: string | null
          id: string
          is_organization: boolean
          is_test_seed: boolean
          onboarding_completed: boolean
          organization_name: string | null
          organization_type: string | null
          planning_priorities: string[] | null
          primary_role: string | null
          sample_mode: boolean
          sample_seeded_at: string | null
          updated_at: string
        }
        Insert: {
          account_type?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          ics_token?: string | null
          id: string
          is_organization?: boolean
          is_test_seed?: boolean
          onboarding_completed?: boolean
          organization_name?: string | null
          organization_type?: string | null
          planning_priorities?: string[] | null
          primary_role?: string | null
          sample_mode?: boolean
          sample_seeded_at?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          ics_token?: string | null
          id?: string
          is_organization?: boolean
          is_test_seed?: boolean
          onboarding_completed?: boolean
          organization_name?: string | null
          organization_type?: string | null
          planning_priorities?: string[] | null
          primary_role?: string | null
          sample_mode?: boolean
          sample_seeded_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          recipients: string[]
          send_at: string
          status: string
          subject: string
          template_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          recipients?: string[]
          send_at: string
          status?: string
          subject?: string
          template_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          recipients?: string[]
          send_at?: string
          status?: string
          subject?: string
          template_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      search_favorites: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          href: string
          id: string
          subtitle: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          href: string
          id?: string
          subtitle?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          href?: string
          id?: string
          subtitle?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      search_recents: {
        Row: {
          entity_id: string | null
          entity_type: string | null
          href: string | null
          id: string
          kind: string
          opened_at: string
          query: string | null
          subtitle: string | null
          title: string
          user_id: string
        }
        Insert: {
          entity_id?: string | null
          entity_type?: string | null
          href?: string | null
          id?: string
          kind: string
          opened_at?: string
          query?: string | null
          subtitle?: string | null
          title: string
          user_id: string
        }
        Update: {
          entity_id?: string | null
          entity_type?: string | null
          href?: string | null
          id?: string
          kind?: string
          opened_at?: string
          query?: string | null
          subtitle?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      studio_designs: {
        Row: {
          canvas_json: Json | null
          created_at: string
          event_id: string | null
          height: number
          id: string
          template_id: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          user_id: string
          width: number
        }
        Insert: {
          canvas_json?: Json | null
          created_at?: string
          event_id?: string | null
          height?: number
          id?: string
          template_id?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id: string
          width?: number
        }
        Update: {
          canvas_json?: Json | null
          created_at?: string
          event_id?: string | null
          height?: number
          id?: string
          template_id?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "studio_designs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_admin_alerts: {
        Row: {
          created_at: string
          environment: string
          event_id: string
          id: string
          plan_name: string
          resolved_at: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          environment: string
          event_id: string
          id?: string
          plan_name: string
          resolved_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          environment?: string
          event_id?: string
          id?: string
          plan_name?: string
          resolved_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          is_test_seed: boolean
          price_id: string
          product_id: string
          status: string
          stripe_event_created_at: number | null
          stripe_event_id: string | null
          stripe_event_priority: number | null
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          is_test_seed?: boolean
          price_id: string
          product_id: string
          status?: string
          stripe_event_created_at?: number | null
          stripe_event_id?: string | null
          stripe_event_priority?: number | null
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          is_test_seed?: boolean
          price_id?: string
          product_id?: string
          status?: string
          stripe_event_created_at?: number | null
          stripe_event_id?: string | null
          stripe_event_priority?: number | null
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          event_id: string
          id: string
          is_sample: boolean
          is_test_seed: boolean
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          event_id: string
          id?: string
          is_sample?: boolean
          is_test_seed?: boolean
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          event_id?: string
          id?: string
          is_sample?: boolean
          is_test_seed?: boolean
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_attendees: {
        Row: {
          checked_in_at: string | null
          created_at: string
          email: string | null
          event_id: string
          full_name: string | null
          id: string
          order_id: string
          qr_code: string
        }
        Insert: {
          checked_in_at?: string | null
          created_at?: string
          email?: string | null
          event_id: string
          full_name?: string | null
          id?: string
          order_id: string
          qr_code?: string
        }
        Update: {
          checked_in_at?: string | null
          created_at?: string
          email?: string | null
          event_id?: string
          full_name?: string | null
          id?: string
          order_id?: string
          qr_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attendees_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "ticket_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_orders: {
        Row: {
          access_token: string
          amount_cents: number
          buyer_email: string
          buyer_name: string | null
          created_at: string
          currency: string
          email_sent_at: string | null
          event_id: string
          failure_reason: string | null
          finalized_at: string | null
          id: string
          quantity: number
          refund_amount_cents: number
          refund_reason: string | null
          refunded_at: string | null
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          ticket_type_id: string
          updated_at: string
        }
        Insert: {
          access_token?: string
          amount_cents?: number
          buyer_email: string
          buyer_name?: string | null
          created_at?: string
          currency?: string
          email_sent_at?: string | null
          event_id: string
          failure_reason?: string | null
          finalized_at?: string | null
          id?: string
          quantity: number
          refund_amount_cents?: number
          refund_reason?: string | null
          refunded_at?: string | null
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          ticket_type_id: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          amount_cents?: number
          buyer_email?: string
          buyer_name?: string | null
          created_at?: string
          currency?: string
          email_sent_at?: string | null
          event_id?: string
          failure_reason?: string | null
          finalized_at?: string | null
          id?: string
          quantity?: number
          refund_amount_cents?: number
          refund_reason?: string | null
          refunded_at?: string | null
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          ticket_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_orders_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_types: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          early_bird_ends_at: string | null
          early_bird_price_cents: number | null
          event_id: string
          id: string
          is_active: boolean
          max_per_order: number
          name: string
          price_cents: number
          promo_code: string | null
          promo_discount_percent: number | null
          quantity: number | null
          sales_end: string | null
          sales_start: string | null
          sold_count: number
          sort_order: number
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          early_bird_ends_at?: string | null
          early_bird_price_cents?: number | null
          event_id: string
          id?: string
          is_active?: boolean
          max_per_order?: number
          name: string
          price_cents?: number
          promo_code?: string | null
          promo_discount_percent?: number | null
          quantity?: number | null
          sales_end?: string | null
          sales_start?: string | null
          sold_count?: number
          sort_order?: number
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          early_bird_ends_at?: string | null
          early_bird_price_cents?: number | null
          event_id?: string
          id?: string
          is_active?: boolean
          max_per_order?: number
          name?: string
          price_cents?: number
          promo_code?: string | null
          promo_discount_percent?: number | null
          quantity?: number | null
          sales_end?: string | null
          sales_start?: string | null
          sold_count?: number
          sort_order?: number
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_waitlist: {
        Row: {
          created_at: string
          email: string
          event_id: string
          full_name: string
          id: string
          note: string | null
          notified_at: string | null
          quantity: number
          ticket_type_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          event_id: string
          full_name: string
          id?: string
          note?: string | null
          notified_at?: string | null
          quantity?: number
          ticket_type_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          event_id?: string
          full_name?: string
          id?: string
          note?: string | null
          notified_at?: string | null
          quantity?: number
          ticket_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_waitlist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_waitlist_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_booking_events: {
        Row: {
          actor_id: string | null
          booking_id: string
          id: string
          metadata: Json
          note: string | null
          occurred_at: string
          stage: Database["public"]["Enums"]["booking_stage"]
        }
        Insert: {
          actor_id?: string | null
          booking_id: string
          id?: string
          metadata?: Json
          note?: string | null
          occurred_at?: string
          stage: Database["public"]["Enums"]["booking_stage"]
        }
        Update: {
          actor_id?: string | null
          booking_id?: string
          id?: string
          metadata?: Json
          note?: string | null
          occurred_at?: string
          stage?: Database["public"]["Enums"]["booking_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "vendor_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "vendor_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_booking_settings: {
        Row: {
          auto_advance: boolean
          confirmation_rule: Database["public"]["Enums"]["booking_confirmation_rule"]
          created_at: string
          requires_deposit: boolean
          updated_at: string
          vendor_id: string
        }
        Insert: {
          auto_advance?: boolean
          confirmation_rule?: Database["public"]["Enums"]["booking_confirmation_rule"]
          created_at?: string
          requires_deposit?: boolean
          updated_at?: string
          vendor_id: string
        }
        Update: {
          auto_advance?: boolean
          confirmation_rule?: Database["public"]["Enums"]["booking_confirmation_rule"]
          created_at?: string
          requires_deposit?: boolean
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_booking_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_booking_settings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendor_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_bookings: {
        Row: {
          cancelled_at: string | null
          category: string
          completed_at: string | null
          confirmed_at: string | null
          contract_sent_at: string | null
          contract_signed_at: string | null
          created_at: string
          created_by: string
          current_stage: Database["public"]["Enums"]["booking_stage"]
          deposit_amount: number | null
          deposit_paid_amount: number
          deposit_paid_at: string | null
          event_id: string | null
          id: string
          in_progress_at: string | null
          is_sample: boolean
          lost_at: string | null
          no_response_at: string | null
          notes: string | null
          planner_id: string
          quote_accepted_at: string | null
          quote_amount: number | null
          quote_sent_at: string | null
          quote_viewed_at: string | null
          review_requested_at: string | null
          reviewed_at: string | null
          title: string
          total_paid: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          cancelled_at?: string | null
          category: string
          completed_at?: string | null
          confirmed_at?: string | null
          contract_sent_at?: string | null
          contract_signed_at?: string | null
          created_at?: string
          created_by: string
          current_stage?: Database["public"]["Enums"]["booking_stage"]
          deposit_amount?: number | null
          deposit_paid_amount?: number
          deposit_paid_at?: string | null
          event_id?: string | null
          id?: string
          in_progress_at?: string | null
          is_sample?: boolean
          lost_at?: string | null
          no_response_at?: string | null
          notes?: string | null
          planner_id: string
          quote_accepted_at?: string | null
          quote_amount?: number | null
          quote_sent_at?: string | null
          quote_viewed_at?: string | null
          review_requested_at?: string | null
          reviewed_at?: string | null
          title: string
          total_paid?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          cancelled_at?: string | null
          category?: string
          completed_at?: string | null
          confirmed_at?: string | null
          contract_sent_at?: string | null
          contract_signed_at?: string | null
          created_at?: string
          created_by?: string
          current_stage?: Database["public"]["Enums"]["booking_stage"]
          deposit_amount?: number | null
          deposit_paid_amount?: number
          deposit_paid_at?: string | null
          event_id?: string | null
          id?: string
          in_progress_at?: string | null
          is_sample?: boolean
          lost_at?: string | null
          no_response_at?: string | null
          notes?: string | null
          planner_id?: string
          quote_accepted_at?: string | null
          quote_amount?: number | null
          quote_sent_at?: string | null
          quote_viewed_at?: string | null
          review_requested_at?: string | null
          reviewed_at?: string | null
          title?: string
          total_paid?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_packages: {
        Row: {
          add_ons: string[]
          category_fields: Json
          created_at: string
          description: string
          duration: string
          id: string
          inclusions: string[]
          is_featured: boolean
          name: string
          photos: string[]
          price_basis: string | null
          price_unit: string | null
          price_cents: number | null
          price_type: string
          sort_order: number
          service_category: string | null
          is_visible: boolean
          updated_at: string
          vendor_id: string
        }
        Insert: {
          add_ons?: string[]
          category_fields?: Json
          created_at?: string
          description?: string
          duration?: string
          id?: string
          inclusions?: string[]
          is_featured?: boolean
          name?: string
          photos?: string[]
          price_basis?: string | null
          price_unit?: string | null
          price_cents?: number | null
          price_type?: string
          sort_order?: number
          service_category?: string | null
          is_visible?: boolean
          updated_at?: string
          vendor_id: string
        }
        Update: {
          add_ons?: string[]
          category_fields?: Json
          created_at?: string
          description?: string
          duration?: string
          id?: string
          inclusions?: string[]
          is_featured?: boolean
          name?: string
          photos?: string[]
          price_basis?: string | null
          price_unit?: string | null
          price_cents?: number | null
          price_type?: string
          sort_order?: number
          service_category?: string | null
          is_visible?: boolean
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_packages_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_packages_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_profiles: {
        Row: {
          accepted_terms: boolean
          business_address: string | null
          business_categories: string[] | null
          custom_service_types: string[]
          business_category: string
          business_description: string | null
          business_hours: Json | null
          business_name: string
          city: string | null
          created_at: string
          email: string | null
          id: string
          is_sample: boolean
          is_test_seed: boolean
          is_verified: boolean
          logo_url: string | null
          mobile_service: boolean | null
          onboarding_completed: boolean
          phone: string | null
          portfolio_urls: string[] | null
          social_links: Json | null
          starting_price: number | null
          state: string | null
          travel_radius: number | null
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
          virtual_services: string | null
          website: string | null
          years_in_business: number | null
          zip_code: string | null
        }
        Insert: {
          accepted_terms?: boolean
          business_address?: string | null
          business_categories?: string[] | null
          custom_service_types?: string[]
          business_category: string
          business_description?: string | null
          business_hours?: Json | null
          business_name: string
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_sample?: boolean
          is_test_seed?: boolean
          is_verified?: boolean
          logo_url?: string | null
          mobile_service?: boolean | null
          onboarding_completed?: boolean
          phone?: string | null
          portfolio_urls?: string[] | null
          social_links?: Json | null
          starting_price?: number | null
          state?: string | null
          travel_radius?: number | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
          virtual_services?: string | null
          website?: string | null
          years_in_business?: number | null
          zip_code?: string | null
        }
        Update: {
          accepted_terms?: boolean
          business_address?: string | null
          business_categories?: string[] | null
          custom_service_types?: string[]
          business_category?: string
          business_description?: string | null
          business_hours?: Json | null
          business_name?: string
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_sample?: boolean
          is_test_seed?: boolean
          is_verified?: boolean
          logo_url?: string | null
          mobile_service?: boolean | null
          onboarding_completed?: boolean
          phone?: string | null
          portfolio_urls?: string[] | null
          social_links?: Json | null
          starting_price?: number | null
          state?: string | null
          travel_radius?: number | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
          virtual_services?: string | null
          website?: string | null
          years_in_business?: number | null
          zip_code?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      vendor_profiles_public: {
        Row: {
          business_categories: string[] | null
          custom_service_types: string[]
          business_category: string | null
          business_description: string | null
          business_hours: Json | null
          business_name: string | null
          city: string | null
          created_at: string | null
          faqs: Json | null
          id: string | null
          is_verified: boolean | null
          logo_url: string | null
          mobile_service: boolean | null
          onboarding_completed: boolean | null
          portfolio_urls: string[] | null
          social_links: Json | null
          starting_price: number | null
          state: string | null
          travel_radius: number | null
          updated_at: string | null
          user_id: string | null
          vendor_photos: Json | null
          virtual_services: string | null
          website: string | null
          years_in_business: number | null
          zip_code: string | null
        }
        Insert: {
          business_categories?: string[] | null
          custom_service_types?: string[]
          business_category?: string | null
          business_description?: string | null
          business_hours?: Json | null
          business_name?: string | null
          city?: string | null
          created_at?: string | null
          faqs?: Json | null
          id?: string | null
          is_verified?: boolean | null
          logo_url?: string | null
          mobile_service?: boolean | null
          onboarding_completed?: boolean | null
          portfolio_urls?: string[] | null
          social_links?: Json | null
          starting_price?: number | null
          state?: string | null
          travel_radius?: number | null
          updated_at?: string | null
          user_id?: string | null
          vendor_photos?: Json | null
          virtual_services?: string | null
          website?: string | null
          years_in_business?: number | null
          zip_code?: string | null
        }
        Update: {
          business_categories?: string[] | null
          custom_service_types?: string[]
          business_category?: string | null
          business_description?: string | null
          business_hours?: Json | null
          business_name?: string | null
          city?: string | null
          created_at?: string | null
          faqs?: Json | null
          id?: string | null
          is_verified?: boolean | null
          logo_url?: string | null
          mobile_service?: boolean | null
          onboarding_completed?: boolean | null
          portfolio_urls?: string[] | null
          social_links?: Json | null
          starting_price?: number | null
          state?: string | null
          travel_radius?: number | null
          updated_at?: string | null
          user_id?: string | null
          vendor_photos?: Json | null
          virtual_services?: string | null
          website?: string | null
          years_in_business?: number | null
          zip_code?: string | null
        }
        Relationships: []
      }
      studio_designs: {
        Row: {
          id: string
          user_id: string
          event_id: string | null
          title: string
          template_id: string | null
          canvas_json: Json | null
          thumbnail_url: string | null
          width: number
          height: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_id?: string | null
          title?: string
          template_id?: string | null
          canvas_json?: Json | null
          thumbnail_url?: string | null
          width?: number
          height?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          event_id?: string | null
          title?: string
          template_id?: string | null
          canvas_json?: Json | null
          thumbnail_url?: string | null
          width?: number
          height?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_designs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_designs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_complimentary_ticket: {
        Args: {
          _event_id: string
          _guest_email: string
          _guest_name: string
          _ticket_type_id: string
        }
        Returns: string
      }
      assert_admin_deletable: {
        Args: { _user_id: string }
        Returns: undefined
      }
      replace_user_primary_role: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      apply_ticket_refund: {
        Args: {
          _order_id: string
          _reason?: string
          _refund_delta_cents: number
        }
        Returns: {
          refund_amount_cents: number
          released: boolean
          status: string
        }[]
      }
      claim_free_tickets: {
        Args: {
          _buyer_email: string
          _buyer_name: string
          _promo_code?: string
          _quantity: number
          _ticket_type_id: string
        }
        Returns: string
      }
      event_role_rank: {
        Args: { _role: Database["public"]["Enums"]["event_role"] }
        Returns: number
      }
      fn_compute_booking_stage: {
        Args: { _booking_id: string }
        Returns: Database["public"]["Enums"]["booking_stage"]
      }
      fn_recompute_booking_stage: {
        Args: { _booking_id: string }
        Returns: undefined
      }
      fn_recompute_time_based_stages: { Args: never; Returns: number }
      get_public_event_page: {
        Args: { p_event_id: string }
        Returns: {
          cover_image_url: string
          description: string
          event_date: string
          event_time: string
          event_type: string
          gift_registry_url: string
          id: string
          location: string
          name: string
          public_description: string
          public_faqs: Json
          show_rsvp_public: boolean
          show_schedule_public: boolean
          tickets_enabled: boolean
        }[]
      }
      get_public_runsheet: {
        Args: { p_event_id: string }
        Returns: {
          duration_min: number
          id: string
          owner: string
          sort_order: number
          start_time: string
          status: string
          title: string
        }[]
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_booking_party: {
        Args: { _booking_id: string; _user: string }
        Returns: boolean
      }
      purge_trashed_events: { Args: never; Returns: number }
      seed_test_data: {
        Args: { admin_id: string; planner_id: string; vendor_id: string }
        Returns: Json
      }
      sync_subscription_stripe_event: {
        Args: {
          _cancel_at_period_end: boolean
          _current_period_end: string | null
          _current_period_start: string | null
          _environment: string
          _event_created_at: number
          _event_id: string
          _event_priority: number
          _plan_name: string
          _price_id: string
          _product_id: string
          _status: string
          _stripe_customer_id: string
          _stripe_subscription_id: string
          _user_email: string | null
          _user_id: string
        }
        Returns: boolean
      }
      wipe_test_data: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "personal" | "organization" | "vendor" | "admin"
      booking_confirmation_rule:
        | "contract_only"
        | "deposit_only"
        | "contract_and_deposit"
        | "manual"
      booking_stage:
        | "saved"
        | "contacted"
        | "consultation_scheduled"
        | "quote_sent"
        | "quote_under_review"
        | "contract_sent"
        | "contract_signed"
        | "deposit_paid"
        | "booked"
        | "in_progress"
        | "completed"
        | "review_requested"
        | "reviewed"
        | "cancelled"
        | "quote_viewed"
        | "quote_accepted"
        | "no_response"
        | "lost"
      calendar_block_reason: "day_off" | "vacation" | "travel"
      calendar_event_source: "native" | "external"
      calendar_event_status:
        | "inquiry"
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "declined"
      calendar_provider: "google" | "outlook"
      calendar_request_status:
        | "pending"
        | "approved"
        | "declined"
        | "alternate_proposed"
        | "cancelled"
      calendar_sync_direction: "push" | "pull" | "two_way"
      event_draft_source:
        | "email"
        | "message"
        | "voice"
        | "manual_paste"
        | "assistant"
      event_draft_status: "pending" | "approved" | "edited" | "discarded"
      event_role: "owner" | "admin" | "editor" | "commenter" | "viewer"
      event_status:
        | "draft"
        | "planning"
        | "confirmed"
        | "completed"
        | "archived"
        | "inquiry"
        | "consultation_scheduled"
        | "quote_sent"
        | "tentative"
        | "cancelled"
      guest_rsvp: "pending" | "yes" | "no" | "maybe"
      invoice_status: "draft" | "sent" | "partial" | "paid" | "overdue" | "void"
      payment_schedule_status: "pending" | "paid" | "overdue" | "waived"
      runsheet_status:
        | "planned"
        | "in_progress"
        | "complete"
        | "delayed"
        | "critical"
        | "skipped"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "done"
      vendor_need_status: "required" | "recommended" | "optional"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["personal", "organization", "vendor", "admin"],
      booking_confirmation_rule: [
        "contract_only",
        "deposit_only",
        "contract_and_deposit",
        "manual",
      ],
      booking_stage: [
        "saved",
        "contacted",
        "consultation_scheduled",
        "quote_sent",
        "quote_under_review",
        "contract_sent",
        "contract_signed",
        "deposit_paid",
        "booked",
        "in_progress",
        "completed",
        "review_requested",
        "reviewed",
        "cancelled",
        "quote_viewed",
        "quote_accepted",
        "no_response",
        "lost",
      ],
      calendar_block_reason: ["day_off", "vacation", "travel"],
      calendar_event_source: ["native", "external"],
      calendar_event_status: [
        "inquiry",
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "declined",
      ],
      calendar_provider: ["google", "outlook"],
      calendar_request_status: [
        "pending",
        "approved",
        "declined",
        "alternate_proposed",
        "cancelled",
      ],
      calendar_sync_direction: ["push", "pull", "two_way"],
      event_draft_source: [
        "email",
        "message",
        "voice",
        "manual_paste",
        "assistant",
      ],
      event_draft_status: ["pending", "approved", "edited", "discarded"],
      event_role: ["owner", "admin", "editor", "commenter", "viewer"],
      event_status: [
        "draft",
        "planning",
        "confirmed",
        "completed",
        "archived",
        "inquiry",
        "consultation_scheduled",
        "quote_sent",
        "tentative",
        "cancelled",
      ],
      guest_rsvp: ["pending", "yes", "no", "maybe"],
      invoice_status: ["draft", "sent", "partial", "paid", "overdue", "void"],
      payment_schedule_status: ["pending", "paid", "overdue", "waived"],
      runsheet_status: [
        "planned",
        "in_progress",
        "complete",
        "delayed",
        "critical",
        "skipped",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "done"],
      vendor_need_status: ["required", "recommended", "optional"],
    },
  },
} as const
