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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      enquiries: {
        Row: {
          closed_at: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          property_id: string
          property_revision_id_at_submission: string
          recipient_id: string
          sender_id: string | null
          status: Database["public"]["Enums"]["enquiry_status"]
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          property_id: string
          property_revision_id_at_submission: string
          recipient_id: string
          sender_id?: string | null
          status?: Database["public"]["Enums"]["enquiry_status"]
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          property_id?: string
          property_revision_id_at_submission?: string
          recipient_id?: string
          sender_id?: string | null
          status?: Database["public"]["Enums"]["enquiry_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enquiries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_property_revision_id_at_submission_property_id_fkey"
            columns: ["property_revision_id_at_submission", "property_id"]
            isOneToOne: false
            referencedRelation: "property_revisions"
            referencedColumns: ["id", "property_id"]
          },
          {
            foreignKeyName: "enquiries_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_holds: {
        Row: {
          created_at: string
          created_by: string
          entity_id: string
          entity_kind: string
          id: string
          reason: string
          release_reason: string | null
          released_at: string | null
          released_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          entity_id: string
          entity_kind: string
          id?: string
          reason: string
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          entity_id?: string
          entity_kind?: string
          id?: string
          reason?: string
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_holds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_holds_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_approvals: {
        Row: {
          created_at: string
          decision: Database["public"]["Enums"]["approval_decision"]
          id: string
          notes: string | null
          property_id: string
          property_snapshot: Json
          reviewer_id: string
          revision_id: string
        }
        Insert: {
          created_at?: string
          decision: Database["public"]["Enums"]["approval_decision"]
          id?: string
          notes?: string | null
          property_id: string
          property_snapshot: Json
          reviewer_id: string
          revision_id: string
        }
        Update: {
          created_at?: string
          decision?: Database["public"]["Enums"]["approval_decision"]
          id?: string
          notes?: string | null
          property_id?: string
          property_snapshot?: Json
          reviewer_id?: string
          revision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_approvals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_approvals_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_approvals_revision_id_property_id_fkey"
            columns: ["revision_id", "property_id"]
            isOneToOne: false
            referencedRelation: "property_revisions"
            referencedColumns: ["id", "property_id"]
          },
        ]
      }
      listing_badge_audit_log: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          new_badge: string | null
          previous_badge: string | null
          property_id: string
          reason: string
          revision_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          new_badge?: string | null
          previous_badge?: string | null
          property_id: string
          reason: string
          revision_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          new_badge?: string | null
          previous_badge?: string | null
          property_id?: string
          reason?: string
          revision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_badge_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_badge_audit_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_badge_audit_log_revision_id_property_id_fkey"
            columns: ["revision_id", "property_id"]
            isOneToOne: false
            referencedRelation: "property_revisions"
            referencedColumns: ["id", "property_id"]
          },
        ]
      }
      profiles: {
        Row: {
          agency_name: string | null
          avatar_path: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          agency_name?: string | null
          avatar_path?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          agency_name?: string | null
          avatar_path?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          owner_id: string
          published_revision_id: string | null
          retention_not_before: string | null
          retention_notice_sent_at: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          owner_id: string
          published_revision_id?: string | null
          retention_not_before?: string | null
          retention_notice_sent_at?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          published_revision_id?: string | null
          retention_not_before?: string | null
          retention_notice_sent_at?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_published_revision_fk"
            columns: ["published_revision_id", "id"]
            isOneToOne: false
            referencedRelation: "property_revisions"
            referencedColumns: ["id", "property_id"]
          },
        ]
      }
      property_images: {
        Row: {
          alt_text: string
          created_at: string
          created_by: string
          height: number
          id: string
          mime_type: string
          position: number
          revision_id: string
          size_bytes: number
          source_kind: string
          storage_path: string
          width: number
        }
        Insert: {
          alt_text: string
          created_at?: string
          created_by: string
          height: number
          id?: string
          mime_type: string
          position: number
          revision_id: string
          size_bytes: number
          source_kind: string
          storage_path: string
          width: number
        }
        Update: {
          alt_text?: string
          created_at?: string
          created_by?: string
          height?: number
          id?: string
          mime_type?: string
          position?: number
          revision_id?: string
          size_bytes?: number
          source_kind?: string
          storage_path?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_images_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_images_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "property_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      property_revisions: {
        Row: {
          approved_at: string | null
          area_sq_ft: number
          badge: string | null
          bathrooms: number
          bedrooms: number
          city: string
          construction_status: Database["public"]["Enums"]["construction_status"]
          created_at: string
          created_by: string
          description: string
          id: string
          latitude: number
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          locality: string
          location: unknown
          longitude: number
          postal_code: string | null
          price_inr: number
          property_id: string
          property_type: Database["public"]["Enums"]["property_type"]
          published_at: string | null
          rejection_reason: string | null
          replaces_revision_id: string | null
          rera_approved: boolean
          rera_number: string | null
          retention_not_before: string | null
          retention_notice_sent_at: string | null
          revision_number: number
          state: string
          status: Database["public"]["Enums"]["revision_status"]
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          area_sq_ft: number
          badge?: string | null
          bathrooms: number
          bedrooms: number
          city?: string
          construction_status: Database["public"]["Enums"]["construction_status"]
          created_at?: string
          created_by: string
          description?: string
          id?: string
          latitude: number
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          locality: string
          location?: unknown
          longitude: number
          postal_code?: string | null
          price_inr: number
          property_id: string
          property_type: Database["public"]["Enums"]["property_type"]
          published_at?: string | null
          rejection_reason?: string | null
          replaces_revision_id?: string | null
          rera_approved?: boolean
          rera_number?: string | null
          retention_not_before?: string | null
          retention_notice_sent_at?: string | null
          revision_number: number
          state?: string
          status?: Database["public"]["Enums"]["revision_status"]
          submitted_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          area_sq_ft?: number
          badge?: string | null
          bathrooms?: number
          bedrooms?: number
          city?: string
          construction_status?: Database["public"]["Enums"]["construction_status"]
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          latitude?: number
          listing_intent?: Database["public"]["Enums"]["listing_intent"]
          locality?: string
          location?: unknown
          longitude?: number
          postal_code?: string | null
          price_inr?: number
          property_id?: string
          property_type?: Database["public"]["Enums"]["property_type"]
          published_at?: string | null
          rejection_reason?: string | null
          replaces_revision_id?: string | null
          rera_approved?: boolean
          rera_number?: string | null
          retention_not_before?: string | null
          retention_notice_sent_at?: string | null
          revision_number?: number
          state?: string
          status?: Database["public"]["Enums"]["revision_status"]
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_revisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_revisions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_revisions_replaces_same_property_fk"
            columns: ["replaces_revision_id", "property_id"]
            isOneToOne: false
            referencedRelation: "property_revisions"
            referencedColumns: ["id", "property_id"]
          },
        ]
      }
      retention_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          batch_id: string
          created_at: string
          entity_id: string
          entity_kind: string
          id: string
          result: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          batch_id: string
          created_at?: string
          entity_id: string
          entity_kind: string
          id?: string
          result: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          batch_id?: string
          created_at?: string
          entity_id?: string
          entity_kind?: string
          id?: string
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "retention_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_audit_log: {
        Row: {
          actor_id: string | null
          actor_kind: string
          created_at: string
          id: string
          new_role: Database["public"]["Enums"]["app_role"]
          previous_role: Database["public"]["Enums"]["app_role"] | null
          reason: string
          target_profile_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_kind: string
          created_at?: string
          id?: string
          new_role: Database["public"]["Enums"]["app_role"]
          previous_role?: Database["public"]["Enums"]["app_role"] | null
          reason: string
          target_profile_id: string
        }
        Update: {
          actor_id?: string | null
          actor_kind?: string
          created_at?: string
          id?: string
          new_role?: Database["public"]["Enums"]["app_role"]
          previous_role?: Database["public"]["Enums"]["app_role"] | null
          reason?: string
          target_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_audit_log_target_profile_id_fkey"
            columns: ["target_profile_id"]
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
      approve_listing: {
        Args: { p_notes?: string; p_revision_id: string }
        Returns: {
          approved_at: string | null
          area_sq_ft: number
          badge: string | null
          bathrooms: number
          bedrooms: number
          city: string
          construction_status: Database["public"]["Enums"]["construction_status"]
          created_at: string
          created_by: string
          description: string
          id: string
          latitude: number
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          locality: string
          location: unknown
          longitude: number
          postal_code: string | null
          price_inr: number
          property_id: string
          property_type: Database["public"]["Enums"]["property_type"]
          published_at: string | null
          rejection_reason: string | null
          replaces_revision_id: string | null
          rera_approved: boolean
          rera_number: string | null
          retention_not_before: string | null
          retention_notice_sent_at: string | null
          revision_number: number
          state: string
          status: Database["public"]["Enums"]["revision_status"]
          submitted_at: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "property_revisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_listing: {
        Args: { p_property_id: string }
        Returns: {
          archived_at: string | null
          created_at: string
          id: string
          owner_id: string
          published_revision_id: string | null
          retention_not_before: string | null
          retention_notice_sent_at: string | null
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "properties"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bootstrap_first_admin: {
        Args: { p_reason: string; p_target_id: string }
        Returns: {
          agency_name: string | null
          avatar_path: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
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
      create_draft_listing: {
        Args: { p_listing: Json }
        Returns: {
          approved_at: string | null
          area_sq_ft: number
          badge: string | null
          bathrooms: number
          bedrooms: number
          city: string
          construction_status: Database["public"]["Enums"]["construction_status"]
          created_at: string
          created_by: string
          description: string
          id: string
          latitude: number
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          locality: string
          location: unknown
          longitude: number
          postal_code: string | null
          price_inr: number
          property_id: string
          property_type: Database["public"]["Enums"]["property_type"]
          published_at: string | null
          rejection_reason: string | null
          replaces_revision_id: string | null
          rera_approved: boolean
          rera_number: string | null
          retention_not_before: string | null
          retention_notice_sent_at: string | null
          revision_number: number
          state: string
          status: Database["public"]["Enums"]["revision_status"]
          submitted_at: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "property_revisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_listing_revision: {
        Args: { p_property_id: string }
        Returns: {
          approved_at: string | null
          area_sq_ft: number
          badge: string | null
          bathrooms: number
          bedrooms: number
          city: string
          construction_status: Database["public"]["Enums"]["construction_status"]
          created_at: string
          created_by: string
          description: string
          id: string
          latitude: number
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          locality: string
          location: unknown
          longitude: number
          postal_code: string | null
          price_inr: number
          property_id: string
          property_type: Database["public"]["Enums"]["property_type"]
          published_at: string | null
          rejection_reason: string | null
          replaces_revision_id: string | null
          rera_approved: boolean
          rera_number: string | null
          retention_not_before: string | null
          retention_notice_sent_at: string | null
          revision_number: number
          state: string
          status: Database["public"]["Enums"]["revision_status"]
          submitted_at: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "property_revisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_listing: {
        Args: { p_revision_id: string }
        Returns: {
          approved_at: string | null
          area_sq_ft: number
          badge: string | null
          bathrooms: number
          bedrooms: number
          city: string
          construction_status: Database["public"]["Enums"]["construction_status"]
          created_at: string
          created_by: string
          description: string
          id: string
          latitude: number
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          locality: string
          location: unknown
          longitude: number
          postal_code: string | null
          price_inr: number
          property_id: string
          property_type: Database["public"]["Enums"]["property_type"]
          published_at: string | null
          rejection_reason: string | null
          replaces_revision_id: string | null
          rera_approved: boolean
          rera_number: string | null
          retention_not_before: string | null
          retention_notice_sent_at: string | null
          revision_number: number
          state: string
          status: Database["public"]["Enums"]["revision_status"]
          submitted_at: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "property_revisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_listing: {
        Args: { p_notes: string; p_revision_id: string }
        Returns: {
          approved_at: string | null
          area_sq_ft: number
          badge: string | null
          bathrooms: number
          bedrooms: number
          city: string
          construction_status: Database["public"]["Enums"]["construction_status"]
          created_at: string
          created_by: string
          description: string
          id: string
          latitude: number
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          locality: string
          location: unknown
          longitude: number
          postal_code: string | null
          price_inr: number
          property_id: string
          property_type: Database["public"]["Enums"]["property_type"]
          published_at: string | null
          rejection_reason: string | null
          replaces_revision_id: string | null
          rera_approved: boolean
          rera_number: string | null
          retention_not_before: string | null
          retention_notice_sent_at: string | null
          revision_number: number
          state: string
          status: Database["public"]["Enums"]["revision_status"]
          submitted_at: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "property_revisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_listing_badge: {
        Args: { p_badge: string; p_reason: string; p_revision_id: string }
        Returns: {
          approved_at: string | null
          area_sq_ft: number
          badge: string | null
          bathrooms: number
          bedrooms: number
          city: string
          construction_status: Database["public"]["Enums"]["construction_status"]
          created_at: string
          created_by: string
          description: string
          id: string
          latitude: number
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          locality: string
          location: unknown
          longitude: number
          postal_code: string | null
          price_inr: number
          property_id: string
          property_type: Database["public"]["Enums"]["property_type"]
          published_at: string | null
          rejection_reason: string | null
          replaces_revision_id: string | null
          rera_approved: boolean
          rera_number: string | null
          retention_not_before: string | null
          retention_notice_sent_at: string | null
          revision_number: number
          state: string
          status: Database["public"]["Enums"]["revision_status"]
          submitted_at: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "property_revisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_user_role: {
        Args: {
          p_reason: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_target_id: string
        }
        Returns: {
          agency_name: string | null
          avatar_path: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
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
      submit_listing: {
        Args: { p_revision_id: string }
        Returns: {
          approved_at: string | null
          area_sq_ft: number
          badge: string | null
          bathrooms: number
          bedrooms: number
          city: string
          construction_status: Database["public"]["Enums"]["construction_status"]
          created_at: string
          created_by: string
          description: string
          id: string
          latitude: number
          listing_intent: Database["public"]["Enums"]["listing_intent"]
          locality: string
          location: unknown
          longitude: number
          postal_code: string | null
          price_inr: number
          property_id: string
          property_type: Database["public"]["Enums"]["property_type"]
          published_at: string | null
          rejection_reason: string | null
          replaces_revision_id: string | null
          rera_approved: boolean
          rera_number: string | null
          retention_not_before: string | null
          retention_notice_sent_at: string | null
          revision_number: number
          state: string
          status: Database["public"]["Enums"]["revision_status"]
          submitted_at: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "property_revisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_property_enquiry: {
        Args: {
          p_email: string
          p_message: string
          p_name: string
          p_phone: string
          p_property_id: string
        }
        Returns: string
      }
      update_enquiry_status: {
        Args: {
          p_enquiry_id: string
          p_status: Database["public"]["Enums"]["enquiry_status"]
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "user" | "owner_agent" | "admin"
      approval_decision: "approved" | "rejected"
      construction_status: "ready_to_move" | "under_construction"
      enquiry_status: "new" | "contacted" | "closed" | "spam"
      listing_intent: "buy" | "rent"
      property_type: "apartment" | "villa" | "independent_house" | "plot"
      revision_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "published"
        | "superseded"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["user", "owner_agent", "admin"],
      approval_decision: ["approved", "rejected"],
      construction_status: ["ready_to_move", "under_construction"],
      enquiry_status: ["new", "contacted", "closed", "spam"],
      listing_intent: ["buy", "rent"],
      property_type: ["apartment", "villa", "independent_house", "plot"],
      revision_status: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "published",
        "superseded",
      ],
    },
  },
} as const
