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
      budget_items: {
        Row: {
          actual_amount: number
          category: string
          created_at: string
          created_by: string | null
          estimated_amount: number
          event_id: string
          id: string
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
          estimated_amount?: number
          event_id: string
          id?: string
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
          estimated_amount?: number
          event_id?: string
          id?: string
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
      event_files: {
        Row: {
          category: string
          created_at: string
          event_id: string
          filename: string
          id: string
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
          event_id: string
          filename: string
          id?: string
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
          event_id?: string
          filename?: string
          id?: string
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
          role: Database["public"]["Enums"]["event_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["event_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          invited_email?: string | null
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
      events: {
        Row: {
          budget_target: number | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          event_date: string | null
          event_time: string | null
          event_type: string | null
          guest_target: number | null
          id: string
          location: string | null
          name: string
          owner_id: string
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
        }
        Insert: {
          budget_target?: number | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          event_time?: string | null
          event_type?: string | null
          guest_target?: number | null
          id?: string
          location?: string | null
          name: string
          owner_id: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
        }
        Update: {
          budget_target?: number | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          event_time?: string | null
          event_type?: string | null
          guest_target?: number | null
          id?: string
          location?: string | null
          name?: string
          owner_id?: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
        }
        Relationships: []
      }
      guests: {
        Row: {
          created_at: string
          email: string | null
          event_id: string
          full_name: string
          household: string | null
          id: string
          meal_choice: string | null
          notes: string | null
          phone: string | null
          plus_ones: number
          rsvp_status: Database["public"]["Enums"]["guest_rsvp"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_id: string
          full_name: string
          household?: string | null
          id?: string
          meal_choice?: string | null
          notes?: string | null
          phone?: string | null
          plus_ones?: number
          rsvp_status?: Database["public"]["Enums"]["guest_rsvp"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          event_id?: string
          full_name?: string
          household?: string | null
          id?: string
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
      profiles: {
        Row: {
          account_type: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_organization: boolean
          onboarding_completed: boolean
          organization_name: string | null
          organization_type: string | null
          planning_priorities: string[] | null
          primary_role: string | null
          updated_at: string
        }
        Insert: {
          account_type?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          is_organization?: boolean
          onboarding_completed?: boolean
          organization_name?: string | null
          organization_type?: string | null
          planning_priorities?: string[] | null
          primary_role?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_organization?: boolean
          onboarding_completed?: boolean
          organization_name?: string | null
          organization_type?: string | null
          planning_priorities?: string[] | null
          primary_role?: string | null
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
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          event_id: string
          id: string
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
          description?: string | null
          due_date?: string | null
          event_id: string
          id?: string
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
          description?: string | null
          due_date?: string | null
          event_id?: string
          id?: string
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
      vendor_profiles: {
        Row: {
          accepted_terms: boolean
          business_address: string | null
          business_category: string
          business_description: string | null
          business_hours: Json | null
          business_name: string
          city: string | null
          created_at: string
          email: string | null
          id: string
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
          virtual_services: string | null
          website: string | null
          years_in_business: number | null
        }
        Insert: {
          accepted_terms?: boolean
          business_address?: string | null
          business_category: string
          business_description?: string | null
          business_hours?: Json | null
          business_name: string
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
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
          virtual_services?: string | null
          website?: string | null
          years_in_business?: number | null
        }
        Update: {
          accepted_terms?: boolean
          business_address?: string | null
          business_category?: string
          business_description?: string | null
          business_hours?: Json | null
          business_name?: string
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
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
          virtual_services?: string | null
          website?: string | null
          years_in_business?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      event_role_rank: {
        Args: { _role: Database["public"]["Enums"]["event_role"] }
        Returns: number
      }
    }
    Enums: {
      app_role: "planner" | "vendor" | "guest" | "admin"
      event_role: "owner" | "admin" | "editor" | "commenter" | "viewer"
      event_status:
        | "draft"
        | "planning"
        | "confirmed"
        | "completed"
        | "archived"
      guest_rsvp: "pending" | "yes" | "no" | "maybe"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "done"
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
      app_role: ["planner", "vendor", "guest", "admin"],
      event_role: ["owner", "admin", "editor", "commenter", "viewer"],
      event_status: ["draft", "planning", "confirmed", "completed", "archived"],
      guest_rsvp: ["pending", "yes", "no", "maybe"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "done"],
    },
  },
} as const
