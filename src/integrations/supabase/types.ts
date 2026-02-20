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
      access_logs: {
        Row: {
          checkin_id: string | null
          created_at: string
          created_by: string | null
          event_type: Database["public"]["Enums"]["access_event_type"]
          gym_id: string
          id: string
          metadata: Json
          reason: string | null
          result: Database["public"]["Enums"]["access_result"]
          user_id: string | null
        }
        Insert: {
          checkin_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type: Database["public"]["Enums"]["access_event_type"]
          gym_id: string
          id?: string
          metadata?: Json
          reason?: string | null
          result: Database["public"]["Enums"]["access_result"]
          user_id?: string | null
        }
        Update: {
          checkin_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type?: Database["public"]["Enums"]["access_event_type"]
          gym_id?: string
          id?: string
          metadata?: Json
          reason?: string | null
          result?: Database["public"]["Enums"]["access_result"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "gym_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_role: string | null
          actor_user_id: string | null
          created_at: string
          entry_hash: string
          id: string
          integrity_seq: number
          integrity_version: number
          ip_address: string | null
          metadata: Json
          prev_entry_hash: string | null
          reason: string | null
          target_id: string | null
          target_table: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          entry_hash: string
          id?: string
          integrity_seq: number
          integrity_version?: number
          ip_address?: string | null
          metadata?: Json
          prev_entry_hash?: string | null
          reason?: string | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          entry_hash?: string
          id?: string
          integrity_seq?: number
          integrity_version?: number
          ip_address?: string | null
          metadata?: Json
          prev_entry_hash?: string | null
          reason?: string | null
          target_id?: string | null
          target_table?: string | null
          user_agent?: string | null
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
      challenge_participants: {
        Row: {
          challenge_id: string
          completed: boolean
          id: string
          joined_at: string
          score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean
          id?: string
          joined_at?: string
          score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean
          id?: string
          joined_at?: string
          score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          challenge_type: Database["public"]["Enums"]["challenge_type"]
          created_at: string
          creator_user_id: string
          description: string | null
          ends_at: string
          gym_id: string | null
          id: string
          points_per_unit: number
          starts_at: string
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["challenge_visibility"]
        }
        Insert: {
          challenge_type: Database["public"]["Enums"]["challenge_type"]
          created_at?: string
          creator_user_id: string
          description?: string | null
          ends_at: string
          gym_id?: string | null
          id?: string
          points_per_unit?: number
          starts_at: string
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["challenge_visibility"]
        }
        Update: {
          challenge_type?: Database["public"]["Enums"]["challenge_type"]
          created_at?: string
          creator_user_id?: string
          description?: string | null
          ends_at?: string
          gym_id?: string | null
          id?: string
          points_per_unit?: number
          starts_at?: string
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["challenge_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "challenges_creator_user_id_fkey"
            columns: ["creator_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      class_bookings: {
        Row: {
          booked_at: string
          checked_in_at: string | null
          class_id: string
          id: string
          source_channel: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          booked_at?: string
          checked_in_at?: string | null
          class_id: string
          id?: string
          source_channel?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          booked_at?: string
          checked_in_at?: string | null
          class_id?: string
          id?: string
          source_channel?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_bookings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "gym_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_waitlist: {
        Row: {
          class_id: string
          created_at: string
          expires_at: string | null
          id: string
          notified_at: string | null
          position: number
          promoted_at: string | null
          status: Database["public"]["Enums"]["waitlist_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          notified_at?: string | null
          position: number
          promoted_at?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          notified_at?: string | null
          position?: number
          promoted_at?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_waitlist_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "gym_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_waitlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at: string
          evidence: Json
          granted: boolean
          granted_at: string
          id: string
          ip_address: string | null
          locale: string | null
          policy_version_id: string | null
          revoked_at: string | null
          source: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at?: string
          evidence?: Json
          granted: boolean
          granted_at?: string
          id?: string
          ip_address?: string | null
          locale?: string | null
          policy_version_id?: string | null
          revoked_at?: string | null
          source?: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          consent_type?: Database["public"]["Enums"]["consent_type"]
          created_at?: string
          evidence?: Json
          granted?: boolean
          granted_at?: string
          id?: string
          ip_address?: string | null
          locale?: string | null
          policy_version_id?: string | null
          revoked_at?: string | null
          source?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "policy_version_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consumer_entitlements: {
        Row: {
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          id: string
          last_verified_at: string | null
          metadata: Json
          plan_id: string | null
          provider: string
          provider_customer_id: string | null
          provider_original_transaction_id: string | null
          provider_subscription_id: string | null
          raw_receipt: Json
          started_at: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          last_verified_at?: string | null
          metadata?: Json
          plan_id?: string | null
          provider?: string
          provider_customer_id?: string | null
          provider_original_transaction_id?: string | null
          provider_subscription_id?: string | null
          raw_receipt?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          last_verified_at?: string | null
          metadata?: Json
          plan_id?: string | null
          provider?: string
          provider_customer_id?: string | null
          provider_original_transaction_id?: string | null
          provider_subscription_id?: string | null
          raw_receipt?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumer_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "consumer_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumer_entitlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consumer_plan_prices: {
        Row: {
          amount_cents: number
          billing_period: string
          billing_period_count: number
          country_code: string | null
          created_at: string
          currency: string
          ends_at: string | null
          id: string
          is_default: boolean
          metadata: Json
          plan_id: string
          provider: string
          provider_price_id: string | null
          provider_product_id: string | null
          starts_at: string | null
          trial_days: number | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          billing_period?: string
          billing_period_count?: number
          country_code?: string | null
          created_at?: string
          currency?: string
          ends_at?: string | null
          id?: string
          is_default?: boolean
          metadata?: Json
          plan_id: string
          provider?: string
          provider_price_id?: string | null
          provider_product_id?: string | null
          starts_at?: string | null
          trial_days?: number | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          billing_period?: string
          billing_period_count?: number
          country_code?: string | null
          created_at?: string
          currency?: string
          ends_at?: string | null
          id?: string
          is_default?: boolean
          metadata?: Json
          plan_id?: string
          provider?: string
          provider_price_id?: string | null
          provider_product_id?: string | null
          starts_at?: string | null
          trial_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumer_plan_prices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "consumer_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      consumer_plans: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_acceptances: {
        Row: {
          accepted_at: string
          contract_id: string
          created_at: string
          gym_membership_id: string | null
          id: string
          ip_address: string | null
          locale: string | null
          signature_data: Json
          source: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          contract_id: string
          created_at?: string
          gym_membership_id?: string | null
          id?: string
          ip_address?: string | null
          locale?: string | null
          signature_data?: Json
          source?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          contract_id?: string
          created_at?: string
          gym_membership_id?: string | null
          id?: string
          ip_address?: string | null
          locale?: string | null
          signature_data?: Json
          source?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_acceptances_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_acceptances_gym_membership_id_fkey"
            columns: ["gym_membership_id"]
            isOneToOne: false
            referencedRelation: "gym_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_acceptances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          contract_type: string
          created_at: string
          created_by: string | null
          document_url: string
          effective_at: string
          gym_id: string
          id: string
          is_active: boolean
          language_code: string
          policy_version: string
          title: string
          updated_at: string
        }
        Insert: {
          contract_type?: string
          created_at?: string
          created_by?: string | null
          document_url: string
          effective_at?: string
          gym_id: string
          id?: string
          is_active?: boolean
          language_code?: string
          policy_version: string
          title: string
          updated_at?: string
        }
        Update: {
          contract_type?: string
          created_at?: string
          created_by?: string | null
          document_url?: string
          effective_at?: string
          gym_id?: string
          id?: string
          is_active?: boolean
          language_code?: string
          policy_version?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      data_aggregation_jobs: {
        Row: {
          aggregation_spec: Json
          completed_at: string | null
          created_at: string
          error_message: string | null
          failed_at: string | null
          id: string
          job_status: Database["public"]["Enums"]["data_aggregation_job_status"]
          k_anonymity_floor: number
          metadata: Json
          min_group_size_observed: number | null
          output_row_count: number
          output_summary: Json
          product_id: string
          requested_by: string | null
          source_window_end: string | null
          source_window_start: string | null
          started_at: string | null
          total_source_rows: number
          updated_at: string
        }
        Insert: {
          aggregation_spec?: Json
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          job_status?: Database["public"]["Enums"]["data_aggregation_job_status"]
          k_anonymity_floor?: number
          metadata?: Json
          min_group_size_observed?: number | null
          output_row_count?: number
          output_summary?: Json
          product_id: string
          requested_by?: string | null
          source_window_end?: string | null
          source_window_start?: string | null
          started_at?: string | null
          total_source_rows?: number
          updated_at?: string
        }
        Update: {
          aggregation_spec?: Json
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_at?: string | null
          id?: string
          job_status?: Database["public"]["Enums"]["data_aggregation_job_status"]
          k_anonymity_floor?: number
          metadata?: Json
          min_group_size_observed?: number | null
          output_row_count?: number
          output_summary?: Json
          product_id?: string
          requested_by?: string | null
          source_window_end?: string | null
          source_window_start?: string | null
          started_at?: string | null
          total_source_rows?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_aggregation_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "data_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_aggregation_jobs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_anonymization_checks: {
        Row: {
          aggregation_job_id: string
          check_type: string
          checked_at: string
          checked_by: string | null
          created_at: string
          details: Json
          id: string
          observed_value: number | null
          status: Database["public"]["Enums"]["anonymization_check_status"]
          threshold_value: number | null
        }
        Insert: {
          aggregation_job_id: string
          check_type: string
          checked_at?: string
          checked_by?: string | null
          created_at?: string
          details?: Json
          id?: string
          observed_value?: number | null
          status?: Database["public"]["Enums"]["anonymization_check_status"]
          threshold_value?: number | null
        }
        Update: {
          aggregation_job_id?: string
          check_type?: string
          checked_at?: string
          checked_by?: string | null
          created_at?: string
          details?: Json
          id?: string
          observed_value?: number | null
          status?: Database["public"]["Enums"]["anonymization_check_status"]
          threshold_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "data_anonymization_checks_aggregation_job_id_fkey"
            columns: ["aggregation_job_id"]
            isOneToOne: false
            referencedRelation: "data_aggregation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_anonymization_checks_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_partner_access_grants: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          ends_at: string | null
          id: string
          legal_basis: string
          metadata: Json
          note: string | null
          partner_id: string
          product_id: string
          starts_at: string | null
          status: Database["public"]["Enums"]["data_partner_grant_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          legal_basis: string
          metadata?: Json
          note?: string | null
          partner_id: string
          product_id: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["data_partner_grant_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          legal_basis?: string
          metadata?: Json
          note?: string | null
          partner_id?: string
          product_id?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["data_partner_grant_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_partner_access_grants_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_partner_access_grants_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "data_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_partner_access_grants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "data_products"
            referencedColumns: ["id"]
          },
        ]
      }
      data_partner_exports: {
        Row: {
          access_grant_id: string | null
          approved_by: string | null
          checksum_sha256: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          export_level: Database["public"]["Enums"]["data_product_access_level"]
          export_status: Database["public"]["Enums"]["data_partner_export_status"]
          failed_at: string | null
          generated_at: string | null
          generated_by: string | null
          id: string
          includes_personal_data: boolean
          metadata: Json
          output_uri: string | null
          partner_id: string
          product_id: string
          requested_by: string | null
          rows_exported: number
          updated_at: string
        }
        Insert: {
          access_grant_id?: string | null
          approved_by?: string | null
          checksum_sha256?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          export_level?: Database["public"]["Enums"]["data_product_access_level"]
          export_status?: Database["public"]["Enums"]["data_partner_export_status"]
          failed_at?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          includes_personal_data?: boolean
          metadata?: Json
          output_uri?: string | null
          partner_id: string
          product_id: string
          requested_by?: string | null
          rows_exported?: number
          updated_at?: string
        }
        Update: {
          access_grant_id?: string | null
          approved_by?: string | null
          checksum_sha256?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          export_level?: Database["public"]["Enums"]["data_product_access_level"]
          export_status?: Database["public"]["Enums"]["data_partner_export_status"]
          failed_at?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          includes_personal_data?: boolean
          metadata?: Json
          output_uri?: string | null
          partner_id?: string
          product_id?: string
          requested_by?: string | null
          rows_exported?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_partner_exports_access_grant_id_fkey"
            columns: ["access_grant_id"]
            isOneToOne: false
            referencedRelation: "data_partner_access_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_partner_exports_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_partner_exports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_partner_exports_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "data_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_partner_exports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "data_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_partner_exports_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_partners: {
        Row: {
          allowed_regions: string[]
          contact_email: string
          country_code: string | null
          created_at: string
          created_by: string | null
          display_name: string
          dpa_reference: string | null
          dpa_signed_at: string | null
          id: string
          legal_name: string
          metadata: Json
          notes: string | null
          prohibited_data_categories: string[]
          status: Database["public"]["Enums"]["data_partner_status"]
          updated_at: string
        }
        Insert: {
          allowed_regions?: string[]
          contact_email: string
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          dpa_reference?: string | null
          dpa_signed_at?: string | null
          id?: string
          legal_name: string
          metadata?: Json
          notes?: string | null
          prohibited_data_categories?: string[]
          status?: Database["public"]["Enums"]["data_partner_status"]
          updated_at?: string
        }
        Update: {
          allowed_regions?: string[]
          contact_email?: string
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          dpa_reference?: string | null
          dpa_signed_at?: string | null
          id?: string
          legal_name?: string
          metadata?: Json
          notes?: string | null
          prohibited_data_categories?: string[]
          status?: Database["public"]["Enums"]["data_partner_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_partners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_products: {
        Row: {
          access_level: Database["public"]["Enums"]["data_product_access_level"]
          allowed_metrics: string[]
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          metadata: Json
          min_k_anonymity: number
          name: string
          requires_user_opt_in: boolean
          retention_days: number | null
          updated_at: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["data_product_access_level"]
          allowed_metrics?: string[]
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          min_k_anonymity?: number
          name: string
          requires_user_opt_in?: boolean
          retention_days?: number | null
          updated_at?: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["data_product_access_level"]
          allowed_metrics?: string[]
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          min_k_anonymity?: number
          name?: string
          requires_user_opt_in?: boolean
          retention_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_release_approvals: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          export_id: string
          id: string
          metadata: Json
          reason: string | null
          required_approval_type: string
          status: Database["public"]["Enums"]["data_release_approval_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          export_id: string
          id?: string
          metadata?: Json
          reason?: string | null
          required_approval_type: string
          status?: Database["public"]["Enums"]["data_release_approval_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          export_id?: string
          id?: string
          metadata?: Json
          reason?: string | null
          required_approval_type?: string
          status?: Database["public"]["Enums"]["data_release_approval_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_release_approvals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_release_approvals_export_id_fkey"
            columns: ["export_id"]
            isOneToOne: false
            referencedRelation: "data_partner_exports"
            referencedColumns: ["id"]
          },
        ]
      }
      device_connections: {
        Row: {
          access_token_encrypted: string | null
          created_at: string
          id: string
          last_error: string | null
          last_synced_at: string | null
          metadata: Json
          provider: Database["public"]["Enums"]["integration_provider"]
          provider_user_id: string | null
          refresh_token_encrypted: string | null
          scopes: string[]
          status: Database["public"]["Enums"]["integration_connection_status"]
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          metadata?: Json
          provider: Database["public"]["Enums"]["integration_provider"]
          provider_user_id?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string[]
          status?: Database["public"]["Enums"]["integration_connection_status"]
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          metadata?: Json
          provider?: Database["public"]["Enums"]["integration_provider"]
          provider_user_id?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string[]
          status?: Database["public"]["Enums"]["integration_connection_status"]
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_sync_cursors: {
        Row: {
          connection_id: string
          created_at: string
          cursor: Json
          id: string
          last_error: string | null
          last_job_id: string | null
          last_synced_at: string | null
          last_webhook_event_id: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          cursor?: Json
          id?: string
          last_error?: string | null
          last_job_id?: string | null
          last_synced_at?: string | null
          last_webhook_event_id?: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          cursor?: Json
          id?: string
          last_error?: string | null
          last_job_id?: string | null
          last_synced_at?: string | null
          last_webhook_event_id?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_sync_cursors_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "device_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_sync_cursors_last_job_id_fkey"
            columns: ["last_job_id"]
            isOneToOne: false
            referencedRelation: "device_sync_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_sync_cursors_last_webhook_event_id_fkey"
            columns: ["last_webhook_event_id"]
            isOneToOne: false
            referencedRelation: "integration_webhook_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_sync_cursors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_sync_jobs: {
        Row: {
          connection_id: string
          created_at: string
          cursor: Json
          error_message: string | null
          finished_at: string | null
          id: string
          job_type: string
          next_retry_at: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          requested_by: string | null
          retry_count: number
          source_webhook_event_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["sync_job_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          cursor?: Json
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_type?: string
          next_retry_at?: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          requested_by?: string | null
          retry_count?: number
          source_webhook_event_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_job_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          cursor?: Json
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_type?: string
          next_retry_at?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          requested_by?: string | null
          retry_count?: number
          source_webhook_event_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_job_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_sync_jobs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "device_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_sync_jobs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_sync_jobs_source_webhook_event_id_fkey"
            columns: ["source_webhook_event_id"]
            isOneToOne: false
            referencedRelation: "integration_webhook_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_sync_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_campaigns: {
        Row: {
          amount_off_cents: number | null
          code: string
          created_at: string
          created_by: string | null
          currency: string | null
          description: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          eligible_filters: Json
          ends_at: string | null
          gym_id: string | null
          id: string
          is_active: boolean
          max_redemptions: number | null
          max_redemptions_per_user: number | null
          metadata: Json
          name: string
          percent_off: number | null
          scope: Database["public"]["Enums"]["billing_scope"]
          starts_at: string | null
          trial_days_off: number | null
          updated_at: string
        }
        Insert: {
          amount_off_cents?: number | null
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          eligible_filters?: Json
          ends_at?: string | null
          gym_id?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          max_redemptions_per_user?: number | null
          metadata?: Json
          name: string
          percent_off?: number | null
          scope: Database["public"]["Enums"]["billing_scope"]
          starts_at?: string | null
          trial_days_off?: number | null
          updated_at?: string
        }
        Update: {
          amount_off_cents?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          eligible_filters?: Json
          ends_at?: string | null
          gym_id?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          max_redemptions_per_user?: number | null
          metadata?: Json
          name?: string
          percent_off?: number | null
          scope?: Database["public"]["Enums"]["billing_scope"]
          starts_at?: string | null
          trial_days_off?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_campaigns_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_redemptions: {
        Row: {
          amount_discount_cents: number
          campaign_id: string
          consumer_entitlement_id: string | null
          created_at: string
          currency: string | null
          gym_id: string | null
          gym_platform_invoice_id: string | null
          id: string
          invoice_id: string | null
          member_subscription_id: string | null
          metadata: Json
          redeemed_at: string
          user_id: string | null
        }
        Insert: {
          amount_discount_cents?: number
          campaign_id: string
          consumer_entitlement_id?: string | null
          created_at?: string
          currency?: string | null
          gym_id?: string | null
          gym_platform_invoice_id?: string | null
          id?: string
          invoice_id?: string | null
          member_subscription_id?: string | null
          metadata?: Json
          redeemed_at?: string
          user_id?: string | null
        }
        Update: {
          amount_discount_cents?: number
          campaign_id?: string
          consumer_entitlement_id?: string | null
          created_at?: string
          currency?: string | null
          gym_id?: string | null
          gym_platform_invoice_id?: string | null
          id?: string
          invoice_id?: string | null
          member_subscription_id?: string | null
          metadata?: Json
          redeemed_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_redemptions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "discount_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_consumer_entitlement_id_fkey"
            columns: ["consumer_entitlement_id"]
            isOneToOne: false
            referencedRelation: "consumer_entitlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_gym_platform_invoice_id_fkey"
            columns: ["gym_platform_invoice_id"]
            isOneToOne: false
            referencedRelation: "gym_platform_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_member_subscription_id_fkey"
            columns: ["member_subscription_id"]
            isOneToOne: false
            referencedRelation: "member_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dunning_events: {
        Row: {
          attempt_number: number
          created_at: string
          id: string
          invoice_id: string | null
          metadata: Json
          note: string | null
          result: string | null
          scheduled_for: string | null
          sent_at: string | null
          stage: Database["public"]["Enums"]["dunning_stage"]
          subscription_id: string
          updated_at: string
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json
          note?: string | null
          result?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          stage: Database["public"]["Enums"]["dunning_stage"]
          subscription_id: string
          updated_at?: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json
          note?: string | null
          result?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          stage?: Database["public"]["Enums"]["dunning_stage"]
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dunning_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dunning_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "member_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_outbox: {
        Row: {
          aggregate_id: string | null
          aggregate_type: string
          created_at: string
          event_type: string
          id: string
          payload: Json
          published: boolean
          published_at: string | null
        }
        Insert: {
          aggregate_id?: string | null
          aggregate_type: string
          created_at?: string
          event_type: string
          id?: string
          payload: Json
          published?: boolean
          published_at?: string | null
        }
        Update: {
          aggregate_id?: string | null
          aggregate_type?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          published?: boolean
          published_at?: string | null
        }
        Relationships: []
      }
      exercises: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          equipment: string | null
          id: string
          is_public: boolean
          movement_pattern: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          equipment?: string | null
          id?: string
          is_public?: boolean
          movement_pattern?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          equipment?: string | null
          id?: string
          is_public?: boolean
          movement_pattern?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      external_activity_imports: {
        Row: {
          activity_type: string | null
          average_hr: number | null
          calories: number | null
          connection_id: string
          created_at: string
          distance_m: number | null
          duration_seconds: number | null
          ended_at: string | null
          external_activity_id: string
          id: string
          imported_at: string
          mapped_workout_id: string | null
          max_hr: number | null
          provider: Database["public"]["Enums"]["integration_provider"]
          raw_data: Json
          started_at: string | null
          user_id: string
        }
        Insert: {
          activity_type?: string | null
          average_hr?: number | null
          calories?: number | null
          connection_id: string
          created_at?: string
          distance_m?: number | null
          duration_seconds?: number | null
          ended_at?: string | null
          external_activity_id: string
          id?: string
          imported_at?: string
          mapped_workout_id?: string | null
          max_hr?: number | null
          provider: Database["public"]["Enums"]["integration_provider"]
          raw_data?: Json
          started_at?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string | null
          average_hr?: number | null
          calories?: number | null
          connection_id?: string
          created_at?: string
          distance_m?: number | null
          duration_seconds?: number | null
          ended_at?: string | null
          external_activity_id?: string
          id?: string
          imported_at?: string
          mapped_workout_id?: string | null
          max_hr?: number | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          raw_data?: Json
          started_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_activity_imports_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "device_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_activity_imports_mapped_workout_id_fkey"
            columns: ["mapped_workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_activity_imports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string
          enabled: boolean
          key: string
          rollout_percentage: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description: string
          enabled?: boolean
          key: string
          rollout_percentage?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          enabled?: boolean
          key?: string
          rollout_percentage?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      feed_events: {
        Row: {
          caption: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          user_id: string
          workout_id: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          user_id: string
          workout_id?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          user_id?: string
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_events_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_addon_catalog: {
        Row: {
          billing_scope: Database["public"]["Enums"]["billing_scope"]
          category: Database["public"]["Enums"]["gym_addon_category"]
          code: string
          created_at: string
          currency: string
          default_price_cents: number
          description: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          billing_scope?: Database["public"]["Enums"]["billing_scope"]
          category: Database["public"]["Enums"]["gym_addon_category"]
          code: string
          created_at?: string
          currency?: string
          default_price_cents?: number
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          billing_scope?: Database["public"]["Enums"]["billing_scope"]
          category?: Database["public"]["Enums"]["gym_addon_category"]
          code?: string
          created_at?: string
          currency?: string
          default_price_cents?: number
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      gym_addon_subscriptions: {
        Row: {
          addon_id: string
          billing_reference: string | null
          config: Json
          created_at: string
          created_by: string | null
          ends_at: string | null
          gym_id: string
          id: string
          metadata: Json
          provider: string
          provider_subscription_id: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["gym_addon_subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          addon_id: string
          billing_reference?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          gym_id: string
          id?: string
          metadata?: Json
          provider?: string
          provider_subscription_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["gym_addon_subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          addon_id?: string
          billing_reference?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          gym_id?: string
          id?: string
          metadata?: Json
          provider?: string
          provider_subscription_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["gym_addon_subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_addon_subscriptions_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "gym_addon_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_addon_subscriptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_addon_subscriptions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_advanced_analytics_views: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          gym_id: string
          id: string
          metadata: Json
          name: string
          query_spec: Json
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          gym_id: string
          id?: string
          metadata?: Json
          name: string
          query_spec?: Json
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          gym_id?: string
          id?: string
          metadata?: Json
          name?: string
          query_spec?: Json
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_advanced_analytics_views_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_advanced_analytics_views_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_automation_playbooks: {
        Row: {
          action_plan: Json
          addon_subscription_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          gym_id: string
          id: string
          is_active: boolean
          metadata: Json
          name: string
          requires_human_approval: boolean
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action_plan?: Json
          addon_subscription_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          gym_id: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          requires_human_approval?: boolean
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action_plan?: Json
          addon_subscription_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          gym_id?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          requires_human_approval?: boolean
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_automation_playbooks_addon_subscription_id_fkey"
            columns: ["addon_subscription_id"]
            isOneToOne: false
            referencedRelation: "gym_addon_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_automation_playbooks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_automation_playbooks_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_automation_runs: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          executed_actions: Json
          gym_id: string
          id: string
          metadata: Json
          planned_actions: Json
          playbook_id: string
          requires_human_approval: boolean
          run_status: Database["public"]["Enums"]["gym_automation_run_status"]
          started_at: string | null
          trigger_payload: Json
          triggered_by: string
          updated_at: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          executed_actions?: Json
          gym_id: string
          id?: string
          metadata?: Json
          planned_actions?: Json
          playbook_id: string
          requires_human_approval?: boolean
          run_status?: Database["public"]["Enums"]["gym_automation_run_status"]
          started_at?: string | null
          trigger_payload?: Json
          triggered_by?: string
          updated_at?: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          executed_actions?: Json
          gym_id?: string
          id?: string
          metadata?: Json
          planned_actions?: Json
          playbook_id?: string
          requires_human_approval?: boolean
          run_status?: Database["public"]["Enums"]["gym_automation_run_status"]
          started_at?: string | null
          trigger_payload?: Json
          triggered_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_automation_runs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_automation_runs_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_automation_runs_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "gym_automation_playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_brand_settings: {
        Row: {
          accent_color: string | null
          app_display_name: string | null
          background_color: string | null
          banner_url: string | null
          body_font: string | null
          created_at: string
          gym_id: string
          headline_font: string | null
          icon_url: string | null
          launch_screen_message: string | null
          logo_url: string | null
          metadata: Json
          primary_color: string | null
          privacy_url: string | null
          stats_font: string | null
          support_email: string | null
          surface_color: string | null
          terms_url: string | null
          text_color: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          app_display_name?: string | null
          background_color?: string | null
          banner_url?: string | null
          body_font?: string | null
          created_at?: string
          gym_id: string
          headline_font?: string | null
          icon_url?: string | null
          launch_screen_message?: string | null
          logo_url?: string | null
          metadata?: Json
          primary_color?: string | null
          privacy_url?: string | null
          stats_font?: string | null
          support_email?: string | null
          surface_color?: string | null
          terms_url?: string | null
          text_color?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          app_display_name?: string | null
          background_color?: string | null
          banner_url?: string | null
          body_font?: string | null
          created_at?: string
          gym_id?: string
          headline_font?: string | null
          icon_url?: string | null
          launch_screen_message?: string | null
          logo_url?: string | null
          metadata?: Json
          primary_color?: string | null
          privacy_url?: string | null
          stats_font?: string | null
          support_email?: string | null
          surface_color?: string | null
          terms_url?: string | null
          text_color?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_brand_settings_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: true
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_checkins: {
        Row: {
          checked_in_at: string
          class_id: string | null
          created_at: string
          created_by: string | null
          event_type: Database["public"]["Enums"]["access_event_type"]
          gym_id: string
          id: string
          membership_id: string | null
          note: string | null
          result: Database["public"]["Enums"]["access_result"]
          source_channel: string
          user_id: string
        }
        Insert: {
          checked_in_at?: string
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type: Database["public"]["Enums"]["access_event_type"]
          gym_id: string
          id?: string
          membership_id?: string | null
          note?: string | null
          result: Database["public"]["Enums"]["access_result"]
          source_channel?: string
          user_id: string
        }
        Update: {
          checked_in_at?: string
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type?: Database["public"]["Enums"]["access_event_type"]
          gym_id?: string
          id?: string
          membership_id?: string | null
          note?: string | null
          result?: Database["public"]["Enums"]["access_result"]
          source_channel?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_checkins_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "gym_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_checkins_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_checkins_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_checkins_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "gym_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_classes: {
        Row: {
          booking_closes_at: string | null
          booking_opens_at: string | null
          capacity: number
          coach_user_id: string | null
          created_at: string
          description: string | null
          ends_at: string
          gym_id: string
          id: string
          starts_at: string
          status: Database["public"]["Enums"]["class_status"]
          title: string
          updated_at: string
        }
        Insert: {
          booking_closes_at?: string | null
          booking_opens_at?: string | null
          capacity: number
          coach_user_id?: string | null
          created_at?: string
          description?: string | null
          ends_at: string
          gym_id: string
          id?: string
          starts_at: string
          status?: Database["public"]["Enums"]["class_status"]
          title: string
          updated_at?: string
        }
        Update: {
          booking_closes_at?: string | null
          booking_opens_at?: string | null
          capacity?: number
          coach_user_id?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string
          gym_id?: string
          id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["class_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_classes_coach_user_id_fkey"
            columns: ["coach_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_classes_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_crm_lead_activities: {
        Row: {
          activity_at: string
          activity_type: string
          actor_user_id: string | null
          created_at: string
          details: Json
          gym_id: string
          id: string
          lead_id: string
          summary: string
        }
        Insert: {
          activity_at?: string
          activity_type: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          gym_id: string
          id?: string
          lead_id: string
          summary: string
        }
        Update: {
          activity_at?: string
          activity_type?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          gym_id?: string
          id?: string
          lead_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_crm_lead_activities_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_crm_lead_activities_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_crm_lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "gym_crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_crm_leads: {
        Row: {
          converted_membership_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          gym_id: string
          id: string
          interested_services: string[]
          last_contacted_at: string | null
          metadata: Json
          next_follow_up_at: string | null
          notes: string | null
          owner_user_id: string | null
          phone: string | null
          source: string
          status: Database["public"]["Enums"]["crm_lead_status"]
          tags: string[]
          trial_ends_at: string | null
          trial_starts_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          converted_membership_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          gym_id: string
          id?: string
          interested_services?: string[]
          last_contacted_at?: string | null
          metadata?: Json
          next_follow_up_at?: string | null
          notes?: string | null
          owner_user_id?: string | null
          phone?: string | null
          source?: string
          status?: Database["public"]["Enums"]["crm_lead_status"]
          tags?: string[]
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          converted_membership_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          gym_id?: string
          id?: string
          interested_services?: string[]
          last_contacted_at?: string | null
          metadata?: Json
          next_follow_up_at?: string | null
          notes?: string | null
          owner_user_id?: string | null
          phone?: string | null
          source?: string
          status?: Database["public"]["Enums"]["crm_lead_status"]
          tags?: string[]
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gym_crm_leads_converted_membership_id_fkey"
            columns: ["converted_membership_id"]
            isOneToOne: false
            referencedRelation: "gym_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_crm_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_crm_leads_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_crm_leads_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_crm_leads_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_feature_settings: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          feature_key: string
          gym_id: string
          id: string
          note: string | null
          rollout_percentage: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          feature_key: string
          gym_id: string
          id?: string
          note?: string | null
          rollout_percentage?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          feature_key?: string
          gym_id?: string
          id?: string
          note?: string | null
          rollout_percentage?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gym_feature_settings_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_feature_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_kpi_daily_snapshots: {
        Row: {
          active_members: number
          average_chain_days: number | null
          average_class_fill_rate: number | null
          cancelled_memberships: number
          checkins_count: number
          class_attendance_count: number
          class_bookings_count: number
          created_at: string
          gym_id: string
          id: string
          metadata: Json
          metric_date: string
          mrr_cents: number
          new_memberships: number
          revenue_cents: number
          updated_at: string
          waitlist_promotions_count: number
        }
        Insert: {
          active_members?: number
          average_chain_days?: number | null
          average_class_fill_rate?: number | null
          cancelled_memberships?: number
          checkins_count?: number
          class_attendance_count?: number
          class_bookings_count?: number
          created_at?: string
          gym_id: string
          id?: string
          metadata?: Json
          metric_date: string
          mrr_cents?: number
          new_memberships?: number
          revenue_cents?: number
          updated_at?: string
          waitlist_promotions_count?: number
        }
        Update: {
          active_members?: number
          average_chain_days?: number | null
          average_class_fill_rate?: number | null
          cancelled_memberships?: number
          checkins_count?: number
          class_attendance_count?: number
          class_bookings_count?: number
          created_at?: string
          gym_id?: string
          id?: string
          metadata?: Json
          metric_date?: string
          mrr_cents?: number
          new_memberships?: number
          revenue_cents?: number
          updated_at?: string
          waitlist_promotions_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "gym_kpi_daily_snapshots_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_membership_plans: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_interval"]
          cancel_policy: string | null
          class_credits_per_cycle: number | null
          created_at: string
          currency: string
          gym_id: string
          id: string
          is_active: boolean
          name: string
          price_cents: number
          provider_price_id: string | null
          provider_product_id: string | null
          trial_days: number | null
          updated_at: string
        }
        Insert: {
          billing_cycle: Database["public"]["Enums"]["billing_interval"]
          cancel_policy?: string | null
          class_credits_per_cycle?: number | null
          created_at?: string
          currency?: string
          gym_id: string
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          provider_price_id?: string | null
          provider_product_id?: string | null
          trial_days?: number | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_interval"]
          cancel_policy?: string | null
          class_credits_per_cycle?: number | null
          created_at?: string
          currency?: string
          gym_id?: string
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          provider_price_id?: string | null
          provider_product_id?: string | null
          trial_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_membership_plans_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_memberships: {
        Row: {
          created_at: string
          ends_at: string | null
          gym_id: string
          id: string
          membership_plan_id: string | null
          membership_status: Database["public"]["Enums"]["membership_status"]
          role: Database["public"]["Enums"]["gym_role"]
          started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          gym_id: string
          id?: string
          membership_plan_id?: string | null
          membership_status?: Database["public"]["Enums"]["membership_status"]
          role?: Database["public"]["Enums"]["gym_role"]
          started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          gym_id?: string
          id?: string
          membership_plan_id?: string | null
          membership_status?: Database["public"]["Enums"]["membership_status"]
          role?: Database["public"]["Enums"]["gym_role"]
          started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_memberships_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_memberships_membership_plan_id_fkey"
            columns: ["membership_plan_id"]
            isOneToOne: false
            referencedRelation: "gym_membership_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_partner_app_installs: {
        Row: {
          billing_reference: string | null
          config: Json
          created_at: string
          external_account_id: string | null
          gym_id: string
          id: string
          install_status: Database["public"]["Enums"]["partner_install_status"]
          installed_at: string
          installed_by: string | null
          last_error: string | null
          last_sync_at: string | null
          metadata: Json
          partner_app_id: string
          updated_at: string
        }
        Insert: {
          billing_reference?: string | null
          config?: Json
          created_at?: string
          external_account_id?: string | null
          gym_id: string
          id?: string
          install_status?: Database["public"]["Enums"]["partner_install_status"]
          installed_at?: string
          installed_by?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          metadata?: Json
          partner_app_id: string
          updated_at?: string
        }
        Update: {
          billing_reference?: string | null
          config?: Json
          created_at?: string
          external_account_id?: string | null
          gym_id?: string
          id?: string
          install_status?: Database["public"]["Enums"]["partner_install_status"]
          installed_at?: string
          installed_by?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          metadata?: Json
          partner_app_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_partner_app_installs_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_partner_app_installs_installed_by_fkey"
            columns: ["installed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_partner_app_installs_partner_app_id_fkey"
            columns: ["partner_app_id"]
            isOneToOne: false
            referencedRelation: "partner_marketplace_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_permission_catalog: {
        Row: {
          category: string
          created_at: string
          description: string | null
          is_active: boolean
          label: string
          metadata: Json
          permission_key: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          label: string
          metadata?: Json
          permission_key: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          label?: string
          metadata?: Json
          permission_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      gym_platform_invoices: {
        Row: {
          amount_due_cents: number
          amount_paid_cents: number
          created_at: string
          currency: string
          due_at: string | null
          gym_id: string
          gym_platform_subscription_id: string | null
          id: string
          invoice_pdf_url: string | null
          metadata: Json
          paid_at: string | null
          provider: string
          provider_invoice_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          updated_at: string
        }
        Insert: {
          amount_due_cents?: number
          amount_paid_cents?: number
          created_at?: string
          currency?: string
          due_at?: string | null
          gym_id: string
          gym_platform_subscription_id?: string | null
          id?: string
          invoice_pdf_url?: string | null
          metadata?: Json
          paid_at?: string | null
          provider?: string
          provider_invoice_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Update: {
          amount_due_cents?: number
          amount_paid_cents?: number
          created_at?: string
          currency?: string
          due_at?: string | null
          gym_id?: string
          gym_platform_subscription_id?: string | null
          id?: string
          invoice_pdf_url?: string | null
          metadata?: Json
          paid_at?: string | null
          provider?: string
          provider_invoice_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_platform_invoices_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_platform_invoices_gym_platform_subscription_id_fkey"
            columns: ["gym_platform_subscription_id"]
            isOneToOne: false
            referencedRelation: "gym_platform_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_platform_payment_transactions: {
        Row: {
          amount_cents: number
          captured_at: string | null
          created_at: string
          currency: string
          failure_code: string | null
          failure_message: string | null
          fee_cents: number
          gym_id: string
          gym_platform_invoice_id: string | null
          id: string
          metadata: Json
          net_cents: number
          payment_method_type: string | null
          provider: string
          provider_charge_id: string | null
          provider_payment_intent_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          tax_cents: number
          updated_at: string
        }
        Insert: {
          amount_cents: number
          captured_at?: string | null
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          fee_cents?: number
          gym_id: string
          gym_platform_invoice_id?: string | null
          id?: string
          metadata?: Json
          net_cents?: number
          payment_method_type?: string | null
          provider?: string
          provider_charge_id?: string | null
          provider_payment_intent_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tax_cents?: number
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          captured_at?: string | null
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          fee_cents?: number
          gym_id?: string
          gym_platform_invoice_id?: string | null
          id?: string
          metadata?: Json
          net_cents?: number
          payment_method_type?: string | null
          provider?: string
          provider_charge_id?: string | null
          provider_payment_intent_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tax_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_platform_payment_transactions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_platform_payment_transactions_gym_platform_invoice_id_fkey"
            columns: ["gym_platform_invoice_id"]
            isOneToOne: false
            referencedRelation: "gym_platform_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_platform_refunds: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          gym_platform_payment_transaction_id: string
          id: string
          metadata: Json
          processed_at: string | null
          provider_refund_id: string | null
          reason: string | null
          status: Database["public"]["Enums"]["refund_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          gym_platform_payment_transaction_id: string
          id?: string
          metadata?: Json
          processed_at?: string | null
          provider_refund_id?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          gym_platform_payment_transaction_id?: string
          id?: string
          metadata?: Json
          processed_at?: string | null
          provider_refund_id?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_platform_refunds_gym_platform_payment_transaction_id_fkey"
            columns: ["gym_platform_payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "gym_platform_payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_platform_subscriptions: {
        Row: {
          billing_contact_email: string | null
          cancel_at: string | null
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          gym_id: string
          id: string
          metadata: Json
          platform_plan_id: string | null
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_contact_email?: string | null
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          gym_id: string
          id?: string
          metadata?: Json
          platform_plan_id?: string | null
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_contact_email?: string | null
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          gym_id?: string
          id?: string
          metadata?: Json
          platform_plan_id?: string | null
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_platform_subscriptions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_platform_subscriptions_platform_plan_id_fkey"
            columns: ["platform_plan_id"]
            isOneToOne: false
            referencedRelation: "platform_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_role_permissions: {
        Row: {
          created_at: string
          gym_id: string
          id: string
          is_allowed: boolean
          metadata: Json
          permission_key: string
          role: Database["public"]["Enums"]["gym_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          gym_id: string
          id?: string
          is_allowed?: boolean
          metadata?: Json
          permission_key: string
          role: Database["public"]["Enums"]["gym_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          gym_id?: string
          id?: string
          is_allowed?: boolean
          metadata?: Json
          permission_key?: string
          role?: Database["public"]["Enums"]["gym_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gym_role_permissions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "gym_permission_catalog"
            referencedColumns: ["permission_key"]
          },
          {
            foreignKeyName: "gym_role_permissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_support_access_grants: {
        Row: {
          approved_by_user_id: string | null
          created_at: string
          ends_at: string | null
          gym_id: string
          id: string
          metadata: Json
          note: string | null
          operator_user_id: string
          permission_scope: string[]
          reason: string
          requested_by_user_id: string | null
          revoked_at: string | null
          revoked_by_user_id: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["support_access_grant_status"]
          updated_at: string
        }
        Insert: {
          approved_by_user_id?: string | null
          created_at?: string
          ends_at?: string | null
          gym_id: string
          id?: string
          metadata?: Json
          note?: string | null
          operator_user_id: string
          permission_scope?: string[]
          reason: string
          requested_by_user_id?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["support_access_grant_status"]
          updated_at?: string
        }
        Update: {
          approved_by_user_id?: string | null
          created_at?: string
          ends_at?: string | null
          gym_id?: string
          id?: string
          metadata?: Json
          note?: string | null
          operator_user_id?: string
          permission_scope?: string[]
          reason?: string
          requested_by_user_id?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["support_access_grant_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_support_access_grants_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_support_access_grants_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_support_access_grants_operator_user_id_fkey"
            columns: ["operator_user_id"]
            isOneToOne: false
            referencedRelation: "platform_operator_accounts"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "gym_support_access_grants_requested_by_user_id_fkey"
            columns: ["requested_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_support_access_grants_revoked_by_user_id_fkey"
            columns: ["revoked_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_support_access_sessions: {
        Row: {
          actions_summary: Json
          created_at: string
          ended_at: string | null
          grant_id: string
          gym_id: string
          id: string
          justification: string
          metadata: Json
          operator_user_id: string
          session_status: Database["public"]["Enums"]["support_access_session_status"]
          started_at: string
          support_ticket_id: string | null
          terminated_reason: string | null
          updated_at: string
        }
        Insert: {
          actions_summary?: Json
          created_at?: string
          ended_at?: string | null
          grant_id: string
          gym_id: string
          id?: string
          justification: string
          metadata?: Json
          operator_user_id: string
          session_status?: Database["public"]["Enums"]["support_access_session_status"]
          started_at?: string
          support_ticket_id?: string | null
          terminated_reason?: string | null
          updated_at?: string
        }
        Update: {
          actions_summary?: Json
          created_at?: string
          ended_at?: string | null
          grant_id?: string
          gym_id?: string
          id?: string
          justification?: string
          metadata?: Json
          operator_user_id?: string
          session_status?: Database["public"]["Enums"]["support_access_session_status"]
          started_at?: string
          support_ticket_id?: string | null
          terminated_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_support_access_sessions_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "gym_support_access_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_support_access_sessions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_support_access_sessions_operator_user_id_fkey"
            columns: ["operator_user_id"]
            isOneToOne: false
            referencedRelation: "platform_operator_accounts"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "gym_support_access_sessions_support_ticket_id_fkey"
            columns: ["support_ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_user_permission_overrides: {
        Row: {
          created_at: string
          gym_id: string
          id: string
          is_allowed: boolean
          metadata: Json
          permission_key: string
          reason: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          gym_id: string
          id?: string
          is_allowed: boolean
          metadata?: Json
          permission_key: string
          reason?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          gym_id?: string
          id?: string
          is_allowed?: boolean
          metadata?: Json
          permission_key?: string
          reason?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_user_permission_overrides_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_user_permission_overrides_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "gym_permission_catalog"
            referencedColumns: ["permission_key"]
          },
          {
            foreignKeyName: "gym_user_permission_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_user_permission_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gyms: {
        Row: {
          banner_url: string | null
          charges_enabled: boolean
          city: string | null
          country_code: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          motto: string | null
          name: string
          owner_user_id: string
          payment_provider: string | null
          payouts_enabled: boolean
          provider_account_id: string | null
          sigil_url: string | null
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          charges_enabled?: boolean
          city?: string | null
          country_code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          motto?: string | null
          name: string
          owner_user_id: string
          payment_provider?: string | null
          payouts_enabled?: boolean
          provider_account_id?: string | null
          sigil_url?: string | null
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          charges_enabled?: boolean
          city?: string | null
          country_code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          motto?: string | null
          name?: string
          owner_user_id?: string
          payment_provider?: string | null
          payouts_enabled?: boolean
          provider_account_id?: string | null
          sigil_url?: string | null
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      incident_actions: {
        Row: {
          action_note: string | null
          action_type: string
          actor_role: string | null
          actor_user_id: string | null
          created_at: string
          id: string
          incident_id: string
          metadata: Json
        }
        Insert: {
          action_note?: string | null
          action_type: string
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          incident_id: string
          metadata?: Json
        }
        Update: {
          action_note?: string | null
          action_type?: string
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          incident_id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "incident_actions_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_actions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "security_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_notification_jobs: {
        Row: {
          attempt_count: number
          channel: string
          created_at: string
          created_by: string | null
          delivery_mode: string
          destination: string
          finished_at: string | null
          id: string
          incident_id: string
          last_error: string | null
          next_attempt_at: string | null
          payload: Json
          provider: string
          response_payload: Json
          started_at: string | null
          status: Database["public"]["Enums"]["sync_job_status"]
          template_key: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          channel: string
          created_at?: string
          created_by?: string | null
          delivery_mode: string
          destination: string
          finished_at?: string | null
          id?: string
          incident_id: string
          last_error?: string | null
          next_attempt_at?: string | null
          payload?: Json
          provider?: string
          response_payload?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_job_status"]
          template_key?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          channel?: string
          created_at?: string
          created_by?: string | null
          delivery_mode?: string
          destination?: string
          finished_at?: string | null
          id?: string
          incident_id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          payload?: Json
          provider?: string
          response_payload?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_job_status"]
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_notification_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_notification_jobs_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "security_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_webhook_events: {
        Row: {
          error_message: string | null
          event_type: string
          id: string
          next_retry_at: string | null
          payload_hash: string
          payload_json: Json
          processed_at: string | null
          processing_status: Database["public"]["Enums"]["integration_processing_status"]
          provider: Database["public"]["Enums"]["integration_provider"]
          provider_event_id: string
          received_at: string
          retry_count: number
        }
        Insert: {
          error_message?: string | null
          event_type: string
          id?: string
          next_retry_at?: string | null
          payload_hash: string
          payload_json: Json
          processed_at?: string | null
          processing_status?: Database["public"]["Enums"]["integration_processing_status"]
          provider: Database["public"]["Enums"]["integration_provider"]
          provider_event_id: string
          received_at?: string
          retry_count?: number
        }
        Update: {
          error_message?: string | null
          event_type?: string
          id?: string
          next_retry_at?: string | null
          payload_hash?: string
          payload_json?: Json
          processed_at?: string | null
          processing_status?: Database["public"]["Enums"]["integration_processing_status"]
          provider?: Database["public"]["Enums"]["integration_provider"]
          provider_event_id?: string
          received_at?: string
          retry_count?: number
        }
        Relationships: []
      }
      invoice_compliance_profiles: {
        Row: {
          country_code: string
          created_at: string
          default_currency: string
          gym_id: string
          invoice_scheme: string
          legal_entity_name: string
          locale: string
          metadata: Json
          pec_email: string | null
          registration_number: string | null
          sdi_destination_code: string | null
          tax_code: string | null
          tax_regime: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          country_code: string
          created_at?: string
          default_currency?: string
          gym_id: string
          invoice_scheme?: string
          legal_entity_name: string
          locale?: string
          metadata?: Json
          pec_email?: string | null
          registration_number?: string | null
          sdi_destination_code?: string | null
          tax_code?: string | null
          tax_regime?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          country_code?: string
          created_at?: string
          default_currency?: string
          gym_id?: string
          invoice_scheme?: string
          legal_entity_name?: string
          locale?: string
          metadata?: Json
          pec_email?: string | null
          registration_number?: string | null
          sdi_destination_code?: string | null
          tax_code?: string | null
          tax_regime?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_compliance_profiles_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: true
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_delivery_jobs: {
        Row: {
          attempt_count: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          delivery_channel: string
          error_message: string | null
          gym_id: string
          id: string
          idempotency_key: string
          invoice_id: string
          next_retry_at: string | null
          payload_format: string
          provider_connection_id: string | null
          provider_document_id: string | null
          provider_response: Json
          status: Database["public"]["Enums"]["invoice_delivery_status"]
          submitted_at: string | null
          target_country_code: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivery_channel?: string
          error_message?: string | null
          gym_id: string
          id?: string
          idempotency_key: string
          invoice_id: string
          next_retry_at?: string | null
          payload_format?: string
          provider_connection_id?: string | null
          provider_document_id?: string | null
          provider_response?: Json
          status?: Database["public"]["Enums"]["invoice_delivery_status"]
          submitted_at?: string | null
          target_country_code: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delivery_channel?: string
          error_message?: string | null
          gym_id?: string
          id?: string
          idempotency_key?: string
          invoice_id?: string
          next_retry_at?: string | null
          payload_format?: string
          provider_connection_id?: string | null
          provider_document_id?: string | null
          provider_response?: Json
          status?: Database["public"]["Enums"]["invoice_delivery_status"]
          submitted_at?: string | null
          target_country_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_delivery_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_delivery_jobs_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_delivery_jobs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_delivery_jobs_provider_connection_id_fkey"
            columns: ["provider_connection_id"]
            isOneToOne: false
            referencedRelation: "invoice_provider_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_provider_connections: {
        Row: {
          account_identifier: string | null
          connected_at: string | null
          connection_status: Database["public"]["Enums"]["invoice_connection_status"]
          created_at: string
          credentials_reference: string | null
          disconnected_at: string | null
          display_name: string | null
          environment: string
          gym_id: string
          id: string
          is_default: boolean
          last_error: string | null
          last_verified_at: string | null
          metadata: Json
          provider_slug: string
          supported_countries: string[]
          updated_at: string
          webhook_secret_reference: string | null
        }
        Insert: {
          account_identifier?: string | null
          connected_at?: string | null
          connection_status?: Database["public"]["Enums"]["invoice_connection_status"]
          created_at?: string
          credentials_reference?: string | null
          disconnected_at?: string | null
          display_name?: string | null
          environment?: string
          gym_id: string
          id?: string
          is_default?: boolean
          last_error?: string | null
          last_verified_at?: string | null
          metadata?: Json
          provider_slug: string
          supported_countries?: string[]
          updated_at?: string
          webhook_secret_reference?: string | null
        }
        Update: {
          account_identifier?: string | null
          connected_at?: string | null
          connection_status?: Database["public"]["Enums"]["invoice_connection_status"]
          created_at?: string
          credentials_reference?: string | null
          disconnected_at?: string | null
          display_name?: string | null
          environment?: string
          gym_id?: string
          id?: string
          is_default?: boolean
          last_error?: string | null
          last_verified_at?: string | null
          metadata?: Json
          provider_slug?: string
          supported_countries?: string[]
          updated_at?: string
          webhook_secret_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_provider_connections_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due_cents: number
          amount_paid_cents: number
          created_at: string
          currency: string
          due_at: string | null
          gym_id: string
          id: string
          invoice_pdf_url: string | null
          metadata: Json
          paid_at: string | null
          provider_invoice_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          subscription_id: string | null
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_due_cents?: number
          amount_paid_cents?: number
          created_at?: string
          currency?: string
          due_at?: string | null
          gym_id: string
          id?: string
          invoice_pdf_url?: string | null
          metadata?: Json
          paid_at?: string | null
          provider_invoice_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_due_cents?: number
          amount_paid_cents?: number
          created_at?: string
          currency?: string
          due_at?: string | null
          gym_id?: string
          id?: string
          invoice_pdf_url?: string | null
          metadata?: Json
          paid_at?: string | null
          provider_invoice_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "member_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_entries: {
        Row: {
          calculated_at: string
          details: Json
          id: string
          leaderboard_id: string
          rank: number
          score: number
          user_id: string
        }
        Insert: {
          calculated_at?: string
          details?: Json
          id?: string
          leaderboard_id: string
          rank: number
          score: number
          user_id: string
        }
        Update: {
          calculated_at?: string
          details?: Json
          id?: string
          leaderboard_id?: string
          rank?: number
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_leaderboard_id_fkey"
            columns: ["leaderboard_id"]
            isOneToOne: false
            referencedRelation: "leaderboards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboards: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          is_active: boolean
          metric: Database["public"]["Enums"]["leaderboard_metric"]
          name: string
          scope: Database["public"]["Enums"]["leaderboard_scope"]
          scope_challenge_id: string | null
          scope_exercise_id: string | null
          scope_gym_id: string | null
          starts_at: string
          timeframe: Database["public"]["Enums"]["leaderboard_timeframe"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          is_active?: boolean
          metric: Database["public"]["Enums"]["leaderboard_metric"]
          name: string
          scope: Database["public"]["Enums"]["leaderboard_scope"]
          scope_challenge_id?: string | null
          scope_exercise_id?: string | null
          scope_gym_id?: string | null
          starts_at: string
          timeframe?: Database["public"]["Enums"]["leaderboard_timeframe"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          metric?: Database["public"]["Enums"]["leaderboard_metric"]
          name?: string
          scope?: Database["public"]["Enums"]["leaderboard_scope"]
          scope_challenge_id?: string | null
          scope_exercise_id?: string | null
          scope_gym_id?: string | null
          starts_at?: string
          timeframe?: Database["public"]["Enums"]["leaderboard_timeframe"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboards_scope_challenge_id_fkey"
            columns: ["scope_challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboards_scope_exercise_id_fkey"
            columns: ["scope_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboards_scope_gym_id_fkey"
            columns: ["scope_gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_copy_keys: {
        Row: {
          copy_key: string
          created_at: string
          default_text: string
          description: string | null
          updated_at: string
        }
        Insert: {
          copy_key: string
          created_at?: string
          default_text: string
          description?: string | null
          updated_at?: string
        }
        Update: {
          copy_key?: string
          created_at?: string
          default_text?: string
          description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      legal_copy_translations: {
        Row: {
          copy_key: string
          created_at: string
          id: string
          locale: string
          translated_text: string
          updated_at: string
        }
        Insert: {
          copy_key: string
          created_at?: string
          id?: string
          locale: string
          translated_text: string
          updated_at?: string
        }
        Update: {
          copy_key?: string
          created_at?: string
          id?: string
          locale?: string
          translated_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_copy_translations_copy_key_fkey"
            columns: ["copy_key"]
            isOneToOne: false
            referencedRelation: "legal_copy_keys"
            referencedColumns: ["copy_key"]
          },
        ]
      }
      legal_holds: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          hold_type: string
          id: string
          is_active: boolean
          metadata: Json
          privacy_request_id: string | null
          reason: string
          released_at: string | null
          released_by: string | null
          starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          hold_type: string
          id?: string
          is_active?: boolean
          metadata?: Json
          privacy_request_id?: string | null
          reason: string
          released_at?: string | null
          released_by?: string | null
          starts_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          hold_type?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          privacy_request_id?: string | null
          reason?: string
          released_at?: string | null
          released_by?: string | null
          starts_at?: string
          updated_at?: string
          user_id?: string
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
            foreignKeyName: "legal_holds_privacy_request_id_fkey"
            columns: ["privacy_request_id"]
            isOneToOne: false
            referencedRelation: "privacy_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_holds_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_holds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_subscriptions: {
        Row: {
          cancel_at: string | null
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          gym_id: string
          id: string
          membership_plan_id: string | null
          metadata: Json
          payment_method_brand: string | null
          payment_method_last4: string | null
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          gym_id: string
          id?: string
          membership_plan_id?: string | null
          metadata?: Json
          payment_method_brand?: string | null
          payment_method_last4?: string | null
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          gym_id?: string
          id?: string
          membership_plan_id?: string | null
          metadata?: Json
          payment_method_brand?: string | null
          payment_method_last4?: string | null
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_subscriptions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_subscriptions_membership_plan_id_fkey"
            columns: ["membership_plan_id"]
            isOneToOne: false
            referencedRelation: "gym_membership_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          challenge_updates_enabled: boolean
          class_reminders_enabled: boolean
          comments_enabled: boolean
          created_at: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          marketing_enabled: boolean
          push_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          timezone: string
          updated_at: string
          user_id: string
          workout_reactions_enabled: boolean
        }
        Insert: {
          challenge_updates_enabled?: boolean
          class_reminders_enabled?: boolean
          comments_enabled?: boolean
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          marketing_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
          workout_reactions_enabled?: boolean
        }
        Update: {
          challenge_updates_enabled?: boolean
          class_reminders_enabled?: boolean
          comments_enabled?: boolean
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          marketing_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
          workout_reactions_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_marketplace_apps: {
        Row: {
          app_code: string
          category: string
          created_at: string
          description: string | null
          docs_url: string | null
          id: string
          install_url: string | null
          is_active: boolean
          metadata: Json
          name: string
          partner_id: string
          pricing_model: string
          revenue_share_bps: number | null
          status: Database["public"]["Enums"]["partner_app_status"]
          updated_at: string
        }
        Insert: {
          app_code: string
          category: string
          created_at?: string
          description?: string | null
          docs_url?: string | null
          id?: string
          install_url?: string | null
          is_active?: boolean
          metadata?: Json
          name: string
          partner_id: string
          pricing_model?: string
          revenue_share_bps?: number | null
          status?: Database["public"]["Enums"]["partner_app_status"]
          updated_at?: string
        }
        Update: {
          app_code?: string
          category?: string
          created_at?: string
          description?: string | null
          docs_url?: string | null
          id?: string
          install_url?: string | null
          is_active?: boolean
          metadata?: Json
          name?: string
          partner_id?: string
          pricing_model?: string
          revenue_share_bps?: number | null
          status?: Database["public"]["Enums"]["partner_app_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_marketplace_apps_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "data_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_revenue_events: {
        Row: {
          created_at: string
          currency: string
          event_status: Database["public"]["Enums"]["partner_revenue_event_status"]
          event_type: string
          gross_amount_cents: number
          gym_id: string | null
          id: string
          metadata: Json
          paid_at: string | null
          partner_amount_cents: number
          partner_app_id: string | null
          partner_id: string
          period_end: string | null
          period_start: string | null
          platform_amount_cents: number
          recognized_at: string | null
          source_reference: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          event_status?: Database["public"]["Enums"]["partner_revenue_event_status"]
          event_type: string
          gross_amount_cents?: number
          gym_id?: string | null
          id?: string
          metadata?: Json
          paid_at?: string | null
          partner_amount_cents?: number
          partner_app_id?: string | null
          partner_id: string
          period_end?: string | null
          period_start?: string | null
          platform_amount_cents?: number
          recognized_at?: string | null
          source_reference?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          event_status?: Database["public"]["Enums"]["partner_revenue_event_status"]
          event_type?: string
          gross_amount_cents?: number
          gym_id?: string | null
          id?: string
          metadata?: Json
          paid_at?: string | null
          partner_amount_cents?: number
          partner_app_id?: string | null
          partner_id?: string
          period_end?: string | null
          period_start?: string | null
          platform_amount_cents?: number
          recognized_at?: string | null
          source_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_revenue_events_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_revenue_events_partner_app_id_fkey"
            columns: ["partner_app_id"]
            isOneToOne: false
            referencedRelation: "partner_marketplace_apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_revenue_events_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "data_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount_cents: number
          captured_at: string | null
          created_at: string
          currency: string
          failure_code: string | null
          failure_message: string | null
          fee_cents: number
          gym_id: string
          id: string
          invoice_id: string | null
          metadata: Json
          net_cents: number | null
          payment_method_type: string | null
          provider: string
          provider_charge_id: string | null
          provider_payment_intent_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          subscription_id: string | null
          tax_cents: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          captured_at?: string | null
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          fee_cents?: number
          gym_id: string
          id?: string
          invoice_id?: string | null
          metadata?: Json
          net_cents?: number | null
          payment_method_type?: string | null
          provider?: string
          provider_charge_id?: string | null
          provider_payment_intent_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          tax_cents?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          captured_at?: string | null
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          fee_cents?: number
          gym_id?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json
          net_cents?: number | null
          payment_method_type?: string | null
          provider?: string
          provider_charge_id?: string | null
          provider_payment_intent_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          tax_cents?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "member_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_feature_overrides: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          id: string
          metadata: Json
          note: string | null
          rollout_percentage: number
          target_scope: string
          target_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          id?: string
          metadata?: Json
          note?: string | null
          rollout_percentage?: number
          target_scope: string
          target_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          id?: string
          metadata?: Json
          note?: string | null
          rollout_percentage?: number
          target_scope?: string
          target_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_feature_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_kpi_daily_snapshots: {
        Row: {
          active_gyms_7d: number
          active_users_7d: number
          churn_rate_percent: number | null
          class_bookings_count: number
          connected_devices_count: number
          created_at: string
          id: string
          metadata: Json
          metric_date: string
          mrr_cents: number
          proof_posts_count: number
          support_tickets_open: number
          total_users: number
          updated_at: string
          workouts_logged_count: number
        }
        Insert: {
          active_gyms_7d?: number
          active_users_7d?: number
          churn_rate_percent?: number | null
          class_bookings_count?: number
          connected_devices_count?: number
          created_at?: string
          id?: string
          metadata?: Json
          metric_date: string
          mrr_cents?: number
          proof_posts_count?: number
          support_tickets_open?: number
          total_users?: number
          updated_at?: string
          workouts_logged_count?: number
        }
        Update: {
          active_gyms_7d?: number
          active_users_7d?: number
          churn_rate_percent?: number | null
          class_bookings_count?: number
          connected_devices_count?: number
          created_at?: string
          id?: string
          metadata?: Json
          metric_date?: string
          mrr_cents?: number
          proof_posts_count?: number
          support_tickets_open?: number
          total_users?: number
          updated_at?: string
          workouts_logged_count?: number
        }
        Relationships: []
      }
      platform_operator_accounts: {
        Row: {
          created_at: string
          created_by: string | null
          is_active: boolean
          last_login_at: string | null
          metadata: Json
          mfa_required: boolean
          role: Database["public"]["Enums"]["platform_operator_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          last_login_at?: string | null
          metadata?: Json
          mfa_required?: boolean
          role?: Database["public"]["Enums"]["platform_operator_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          last_login_at?: string | null
          metadata?: Json
          mfa_required?: boolean
          role?: Database["public"]["Enums"]["platform_operator_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_operator_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_operator_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_operator_permission_overrides: {
        Row: {
          created_at: string
          id: string
          is_allowed: boolean
          metadata: Json
          permission_key: string
          reason: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_allowed: boolean
          metadata?: Json
          permission_key: string
          reason?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_allowed?: boolean
          metadata?: Json
          permission_key?: string
          reason?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_operator_permission_overrides_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "platform_permission_catalog"
            referencedColumns: ["permission_key"]
          },
          {
            foreignKeyName: "platform_operator_permission_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_operator_permission_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "platform_operator_accounts"
            referencedColumns: ["user_id"]
          },
        ]
      }
      platform_permission_catalog: {
        Row: {
          category: string
          created_at: string
          description: string | null
          is_active: boolean
          is_sensitive: boolean
          label: string
          metadata: Json
          permission_key: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          is_sensitive?: boolean
          label: string
          metadata?: Json
          permission_key: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          is_sensitive?: boolean
          label?: string
          metadata?: Json
          permission_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_plans: {
        Row: {
          amount_cents: number
          billing_period: string
          code: string
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
          metadata: Json
          modules: string[]
          name: string
          provider: string
          provider_price_id: string | null
          provider_product_id: string | null
          trial_days: number | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          billing_period?: string
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          modules?: string[]
          name: string
          provider?: string
          provider_price_id?: string | null
          provider_product_id?: string | null
          trial_days?: number | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          billing_period?: string
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          modules?: string[]
          name?: string
          provider?: string
          provider_price_id?: string | null
          provider_product_id?: string | null
          trial_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      platform_role_permissions: {
        Row: {
          created_at: string
          id: string
          is_allowed: boolean
          metadata: Json
          permission_key: string
          role: Database["public"]["Enums"]["platform_operator_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_allowed?: boolean
          metadata?: Json
          permission_key: string
          role: Database["public"]["Enums"]["platform_operator_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_allowed?: boolean
          metadata?: Json
          permission_key?: string
          role?: Database["public"]["Enums"]["platform_operator_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "platform_permission_catalog"
            referencedColumns: ["permission_key"]
          },
        ]
      }
      policy_version_tracking: {
        Row: {
          change_summary: string | null
          checksum: string | null
          created_at: string
          created_by: string | null
          document_url: string
          effective_at: string
          id: string
          is_active: boolean
          label: string | null
          policy_type: Database["public"]["Enums"]["policy_type"]
          published_at: string
          requires_reconsent: boolean
          supersedes_policy_version_id: string | null
          version: string
        }
        Insert: {
          change_summary?: string | null
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          document_url: string
          effective_at: string
          id?: string
          is_active?: boolean
          label?: string | null
          policy_type: Database["public"]["Enums"]["policy_type"]
          published_at?: string
          requires_reconsent?: boolean
          supersedes_policy_version_id?: string | null
          version: string
        }
        Update: {
          change_summary?: string | null
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          document_url?: string
          effective_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          policy_type?: Database["public"]["Enums"]["policy_type"]
          published_at?: string
          requires_reconsent?: boolean
          supersedes_policy_version_id?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_version_tracking_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_version_tracking_supersedes_policy_version_id_fkey"
            columns: ["supersedes_policy_version_id"]
            isOneToOne: false
            referencedRelation: "policy_version_tracking"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_experiment_assignments: {
        Row: {
          assigned_at: string
          assignment_status: Database["public"]["Enums"]["pricing_assignment_status"]
          conversion_reference: string | null
          converted_at: string | null
          created_at: string
          experiment_id: string
          first_exposed_at: string | null
          gym_id: string | null
          id: string
          metadata: Json
          updated_at: string
          user_id: string | null
          variant_id: string
        }
        Insert: {
          assigned_at?: string
          assignment_status?: Database["public"]["Enums"]["pricing_assignment_status"]
          conversion_reference?: string | null
          converted_at?: string | null
          created_at?: string
          experiment_id: string
          first_exposed_at?: string | null
          gym_id?: string | null
          id?: string
          metadata?: Json
          updated_at?: string
          user_id?: string | null
          variant_id: string
        }
        Update: {
          assigned_at?: string
          assignment_status?: Database["public"]["Enums"]["pricing_assignment_status"]
          conversion_reference?: string | null
          converted_at?: string | null
          created_at?: string
          experiment_id?: string
          first_exposed_at?: string | null
          gym_id?: string | null
          id?: string
          metadata?: Json
          updated_at?: string
          user_id?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_experiment_assignments_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "pricing_experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_experiment_assignments_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_experiment_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_experiment_assignments_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "pricing_experiment_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_experiment_variants: {
        Row: {
          allocation_percent: number
          created_at: string
          experiment_id: string
          id: string
          is_control: boolean
          metadata: Json
          target_id: string
          target_type: string
          updated_at: string
          variant_key: string
        }
        Insert: {
          allocation_percent: number
          created_at?: string
          experiment_id: string
          id?: string
          is_control?: boolean
          metadata?: Json
          target_id: string
          target_type: string
          updated_at?: string
          variant_key: string
        }
        Update: {
          allocation_percent?: number
          created_at?: string
          experiment_id?: string
          id?: string
          is_control?: boolean
          metadata?: Json
          target_id?: string
          target_type?: string
          updated_at?: string
          variant_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_experiment_variants_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "pricing_experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_experiments: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          gym_id: string | null
          hypothesis: string | null
          id: string
          name: string
          scope: Database["public"]["Enums"]["billing_scope"]
          starts_at: string | null
          status: Database["public"]["Enums"]["pricing_experiment_status"]
          target_filters: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          gym_id?: string | null
          hypothesis?: string | null
          id?: string
          name: string
          scope: Database["public"]["Enums"]["billing_scope"]
          starts_at?: string | null
          status?: Database["public"]["Enums"]["pricing_experiment_status"]
          target_filters?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          gym_id?: string | null
          hypothesis?: string | null
          id?: string
          name?: string
          scope?: Database["public"]["Enums"]["billing_scope"]
          starts_at?: string | null
          status?: Database["public"]["Enums"]["pricing_experiment_status"]
          target_filters?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_experiments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_experiments_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_delete_jobs: {
        Row: {
          anonymization_summary: Json
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          next_retry_at: string | null
          privacy_request_id: string
          retry_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["sync_job_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          anonymization_summary?: Json
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          next_retry_at?: string | null
          privacy_request_id: string
          retry_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_job_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          anonymization_summary?: Json
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          next_retry_at?: string | null
          privacy_request_id?: string
          retry_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_job_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_delete_jobs_privacy_request_id_fkey"
            columns: ["privacy_request_id"]
            isOneToOne: true
            referencedRelation: "privacy_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_delete_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_export_jobs: {
        Row: {
          created_at: string
          error_message: string | null
          file_bytes: number | null
          finished_at: string | null
          id: string
          next_retry_at: string | null
          privacy_request_id: string
          record_count: number | null
          retry_count: number
          signed_url: string | null
          signed_url_expires_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["sync_job_status"]
          storage_bucket: string | null
          storage_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          file_bytes?: number | null
          finished_at?: string | null
          id?: string
          next_retry_at?: string | null
          privacy_request_id: string
          record_count?: number | null
          retry_count?: number
          signed_url?: string | null
          signed_url_expires_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_job_status"]
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          file_bytes?: number | null
          finished_at?: string | null
          id?: string
          next_retry_at?: string | null
          privacy_request_id?: string
          record_count?: number | null
          retry_count?: number
          signed_url?: string | null
          signed_url_expires_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["sync_job_status"]
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_export_jobs_privacy_request_id_fkey"
            columns: ["privacy_request_id"]
            isOneToOne: true
            referencedRelation: "privacy_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_export_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_requests: {
        Row: {
          created_at: string
          due_at: string
          handled_by: string | null
          id: string
          in_progress_at: string | null
          notes: string | null
          reason: string | null
          request_type: Database["public"]["Enums"]["privacy_request_type"]
          resolved_at: string | null
          response_bytes: number | null
          response_content_type: string | null
          response_expires_at: string | null
          response_location: string | null
          sla_breached_at: string | null
          status: Database["public"]["Enums"]["privacy_request_status"]
          submitted_at: string
          triaged_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_at?: string
          handled_by?: string | null
          id?: string
          in_progress_at?: string | null
          notes?: string | null
          reason?: string | null
          request_type: Database["public"]["Enums"]["privacy_request_type"]
          resolved_at?: string | null
          response_bytes?: number | null
          response_content_type?: string | null
          response_expires_at?: string | null
          response_location?: string | null
          sla_breached_at?: string | null
          status?: Database["public"]["Enums"]["privacy_request_status"]
          submitted_at?: string
          triaged_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_at?: string
          handled_by?: string | null
          id?: string
          in_progress_at?: string | null
          notes?: string | null
          reason?: string | null
          request_type?: Database["public"]["Enums"]["privacy_request_type"]
          resolved_at?: string | null
          response_bytes?: number | null
          response_content_type?: string | null
          response_expires_at?: string | null
          response_location?: string | null
          sla_breached_at?: string | null
          status?: Database["public"]["Enums"]["privacy_request_status"]
          submitted_at?: string
          triaged_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_requests_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          chain_days: number
          created_at: string
          display_name: string
          home_gym_id: string | null
          id: string
          is_public: boolean
          last_workout_at: string | null
          level: number
          locale: string | null
          preferred_units: string
          rank_tier: Database["public"]["Enums"]["rank_tier"]
          updated_at: string
          username: string
          xp_total: number
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          chain_days?: number
          created_at?: string
          display_name: string
          home_gym_id?: string | null
          id: string
          is_public?: boolean
          last_workout_at?: string | null
          level?: number
          locale?: string | null
          preferred_units?: string
          rank_tier?: Database["public"]["Enums"]["rank_tier"]
          updated_at?: string
          username: string
          xp_total?: number
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          chain_days?: number
          created_at?: string
          display_name?: string
          home_gym_id?: string | null
          id?: string
          is_public?: boolean
          last_workout_at?: string | null
          level?: number
          locale?: string | null
          preferred_units?: string
          rank_tier?: Database["public"]["Enums"]["rank_tier"]
          updated_at?: string
          username?: string
          xp_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_home_gym_id_fkey"
            columns: ["home_gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notification_tokens: {
        Row: {
          created_at: string
          device_id: string
          id: string
          is_active: boolean
          last_seen_at: string
          platform: string
          push_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform: string
          push_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform?: string
          push_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_notification_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          metadata: Json
          payment_transaction_id: string
          processed_at: string | null
          provider_refund_id: string | null
          reason: string | null
          status: Database["public"]["Enums"]["refund_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          payment_transaction_id: string
          processed_at?: string | null
          provider_refund_id?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          payment_transaction_id?: string
          processed_at?: string | null
          provider_refund_id?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      security_incidents: {
        Row: {
          affected_gym_count: number
          affected_user_count: number
          closed_at: string | null
          contained_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          detected_at: string
          drill_mode: boolean
          first_triaged_at: string | null
          ftc_notice_due_at: string | null
          gdpr_notice_due_at: string | null
          gym_id: string | null
          id: string
          investigation_started_at: string | null
          metadata: Json
          notified_at: string | null
          requires_ftc_notice: boolean
          requires_gdpr_notice: boolean
          resolved_at: string | null
          severity: string
          source: string
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          affected_gym_count?: number
          affected_user_count?: number
          closed_at?: string | null
          contained_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          detected_at?: string
          drill_mode?: boolean
          first_triaged_at?: string | null
          ftc_notice_due_at?: string | null
          gdpr_notice_due_at?: string | null
          gym_id?: string | null
          id?: string
          investigation_started_at?: string | null
          metadata?: Json
          notified_at?: string | null
          requires_ftc_notice?: boolean
          requires_gdpr_notice?: boolean
          resolved_at?: string | null
          severity?: string
          source?: string
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          affected_gym_count?: number
          affected_user_count?: number
          closed_at?: string | null
          contained_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          detected_at?: string
          drill_mode?: boolean
          first_triaged_at?: string | null
          ftc_notice_due_at?: string | null
          gdpr_notice_due_at?: string | null
          gym_id?: string | null
          id?: string
          investigation_started_at?: string | null
          metadata?: Json
          notified_at?: string | null
          requires_ftc_notice?: boolean
          requires_gdpr_notice?: boolean
          resolved_at?: string | null
          severity?: string
          source?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_incidents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_incidents_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_incidents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_connections: {
        Row: {
          created_at: string
          followed_user_id: string
          follower_user_id: string
          id: string
          status: Database["public"]["Enums"]["social_connection_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          followed_user_id: string
          follower_user_id: string
          id?: string
          status?: Database["public"]["Enums"]["social_connection_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          followed_user_id?: string
          follower_user_id?: string
          id?: string
          status?: Database["public"]["Enums"]["social_connection_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_connections_followed_user_id_fkey"
            columns: ["followed_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_connections_follower_user_id_fkey"
            columns: ["follower_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_interactions: {
        Row: {
          actor_user_id: string
          comment_text: string | null
          created_at: string
          id: string
          interaction_type: Database["public"]["Enums"]["social_interaction_type"]
          parent_interaction_id: string | null
          reaction_type: Database["public"]["Enums"]["reaction_type"] | null
          updated_at: string
          workout_id: string
        }
        Insert: {
          actor_user_id: string
          comment_text?: string | null
          created_at?: string
          id?: string
          interaction_type: Database["public"]["Enums"]["social_interaction_type"]
          parent_interaction_id?: string | null
          reaction_type?: Database["public"]["Enums"]["reaction_type"] | null
          updated_at?: string
          workout_id: string
        }
        Update: {
          actor_user_id?: string
          comment_text?: string | null
          created_at?: string
          id?: string
          interaction_type?: Database["public"]["Enums"]["social_interaction_type"]
          parent_interaction_id?: string | null
          reaction_type?: Database["public"]["Enums"]["reaction_type"] | null
          updated_at?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_interactions_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_interactions_parent_interaction_id_fkey"
            columns: ["parent_interaction_id"]
            isOneToOne: false
            referencedRelation: "social_interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_interactions_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_shifts: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          gym_id: string
          hourly_rate_cents: number | null
          id: string
          metadata: Json
          notes: string | null
          shift_role: string | null
          staff_user_id: string
          starts_at: string
          status: Database["public"]["Enums"]["staff_shift_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          gym_id: string
          hourly_rate_cents?: number | null
          id?: string
          metadata?: Json
          notes?: string | null
          shift_role?: string | null
          staff_user_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["staff_shift_status"]
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          gym_id?: string
          hourly_rate_cents?: number | null
          id?: string
          metadata?: Json
          notes?: string | null
          shift_role?: string | null
          staff_user_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["staff_shift_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_shifts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shifts_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_shifts_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_time_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          break_minutes: number
          clock_in_at: string
          clock_out_at: string | null
          created_at: string
          gym_id: string
          id: string
          metadata: Json
          note: string | null
          shift_id: string | null
          source_channel: string
          staff_user_id: string
          status: Database["public"]["Enums"]["staff_time_entry_status"]
          updated_at: string
          worked_minutes: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number
          clock_in_at: string
          clock_out_at?: string | null
          created_at?: string
          gym_id: string
          id?: string
          metadata?: Json
          note?: string | null
          shift_id?: string | null
          source_channel?: string
          staff_user_id: string
          status?: Database["public"]["Enums"]["staff_time_entry_status"]
          updated_at?: string
          worked_minutes?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number
          clock_in_at?: string
          clock_out_at?: string | null
          created_at?: string
          gym_id?: string
          id?: string
          metadata?: Json
          note?: string | null
          shift_id?: string | null
          source_channel?: string
          staff_user_id?: string
          status?: Database["public"]["Enums"]["staff_time_entry_status"]
          updated_at?: string
          worked_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_time_entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_time_entries_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_time_entries_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "staff_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_time_entries_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_automation_runs: {
        Row: {
          agent_name: string
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          error_message: string | null
          executed_at: string | null
          id: string
          notification_sent_at: string | null
          plan_json: Json
          proposed_changes: Json
          requires_approval: boolean
          result_payload: Json
          result_summary: string | null
          run_status: Database["public"]["Enums"]["support_run_status"]
          ticket_id: string
          trigger_source: string
          updated_at: string
        }
        Insert: {
          agent_name: string
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          notification_sent_at?: string | null
          plan_json?: Json
          proposed_changes?: Json
          requires_approval?: boolean
          result_payload?: Json
          result_summary?: string | null
          run_status?: Database["public"]["Enums"]["support_run_status"]
          ticket_id: string
          trigger_source?: string
          updated_at?: string
        }
        Update: {
          agent_name?: string
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          notification_sent_at?: string | null
          plan_json?: Json
          proposed_changes?: Json
          requires_approval?: boolean
          result_payload?: Json
          result_summary?: string | null
          run_status?: Database["public"]["Enums"]["support_run_status"]
          ticket_id?: string
          trigger_source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_automation_runs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_automation_runs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          actor_label: string | null
          actor_type: Database["public"]["Enums"]["support_actor_type"]
          actor_user_id: string | null
          attachments: Json
          body: string
          created_at: string
          id: string
          is_internal: boolean
          metadata: Json
          ticket_id: string
        }
        Insert: {
          actor_label?: string | null
          actor_type: Database["public"]["Enums"]["support_actor_type"]
          actor_user_id?: string | null
          attachments?: Json
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          metadata?: Json
          ticket_id: string
        }
        Update: {
          actor_label?: string | null
          actor_type?: Database["public"]["Enums"]["support_actor_type"]
          actor_user_id?: string | null
          attachments?: Json
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          metadata?: Json
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          affected_surface: string | null
          ai_confidence: number | null
          ai_recommended_actions: Json
          ai_summary: string | null
          ai_triage_labels: string[]
          category: string
          channel: Database["public"]["Enums"]["support_ticket_channel"]
          closed_at: string | null
          created_at: string
          description: string
          first_response_due_at: string | null
          gym_id: string | null
          id: string
          impacted_users_count: number
          last_customer_reply_at: string | null
          metadata: Json
          owner_user_id: string | null
          priority: Database["public"]["Enums"]["support_ticket_priority"]
          reporter_email: string | null
          reporter_user_id: string | null
          requires_human_approval: boolean
          resolution_due_at: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          ticket_number: number
          updated_at: string
        }
        Insert: {
          affected_surface?: string | null
          ai_confidence?: number | null
          ai_recommended_actions?: Json
          ai_summary?: string | null
          ai_triage_labels?: string[]
          category?: string
          channel?: Database["public"]["Enums"]["support_ticket_channel"]
          closed_at?: string | null
          created_at?: string
          description: string
          first_response_due_at?: string | null
          gym_id?: string | null
          id?: string
          impacted_users_count?: number
          last_customer_reply_at?: string | null
          metadata?: Json
          owner_user_id?: string | null
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          reporter_email?: string | null
          reporter_user_id?: string | null
          requires_human_approval?: boolean
          resolution_due_at?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          ticket_number?: never
          updated_at?: string
        }
        Update: {
          affected_surface?: string | null
          ai_confidence?: number | null
          ai_recommended_actions?: Json
          ai_summary?: string | null
          ai_triage_labels?: string[]
          category?: string
          channel?: Database["public"]["Enums"]["support_ticket_channel"]
          closed_at?: string | null
          created_at?: string
          description?: string
          first_response_due_at?: string | null
          gym_id?: string | null
          id?: string
          impacted_users_count?: number
          last_customer_reply_at?: string | null
          metadata?: Json
          owner_user_id?: string | null
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          reporter_email?: string | null
          reporter_user_id?: string | null
          requires_human_approval?: boolean
          resolution_due_at?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject?: string
          ticket_number?: never
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_auth_events: {
        Row: {
          created_at: string
          device_id: string | null
          event_type: Database["public"]["Enums"]["auth_event_type"]
          failure_reason: string | null
          id: string
          ip_address: unknown
          metadata: Json
          occurred_at: string
          platform: string | null
          risk_level: Database["public"]["Enums"]["auth_event_risk_level"]
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          event_type: Database["public"]["Enums"]["auth_event_type"]
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json
          occurred_at?: string
          platform?: string | null
          risk_level?: Database["public"]["Enums"]["auth_event_risk_level"]
          success?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          event_type?: Database["public"]["Enums"]["auth_event_type"]
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json
          occurred_at?: string
          platform?: string | null
          risk_level?: Database["public"]["Enums"]["auth_event_risk_level"]
          success?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_auth_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_user_id: string
          blocker_user_id: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_user_id: string
          blocker_user_id: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_user_id?: string
          blocker_user_id?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_user_id_fkey"
            columns: ["blocked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_user_id_fkey"
            columns: ["blocker_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_data_sharing_preferences: {
        Row: {
          allow_aggregated_analytics: boolean
          allow_pseudonymous_research: boolean
          allow_third_party_aggregated_sharing: boolean
          created_at: string
          granted_at: string
          metadata: Json
          revoked_at: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_aggregated_analytics?: boolean
          allow_pseudonymous_research?: boolean
          allow_third_party_aggregated_sharing?: boolean
          created_at?: string
          granted_at?: string
          metadata?: Json
          revoked_at?: string | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_aggregated_analytics?: boolean
          allow_pseudonymous_research?: boolean
          allow_third_party_aggregated_sharing?: boolean
          created_at?: string
          granted_at?: string
          metadata?: Json
          revoked_at?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_data_sharing_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_user_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_user_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id: string
          target_type: Database["public"]["Enums"]["report_target_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_user_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reports_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_security_settings: {
        Row: {
          allow_multi_device_sessions: boolean
          created_at: string
          last_security_reviewed_at: string | null
          login_alert_channel: string
          metadata: Json
          mfa_enabled: boolean
          mfa_required: boolean
          new_device_alerts: boolean
          passkey_enabled: boolean
          password_updated_at: string | null
          session_timeout_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_multi_device_sessions?: boolean
          created_at?: string
          last_security_reviewed_at?: string | null
          login_alert_channel?: string
          metadata?: Json
          mfa_enabled?: boolean
          mfa_required?: boolean
          new_device_alerts?: boolean
          passkey_enabled?: boolean
          password_updated_at?: string | null
          session_timeout_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_multi_device_sessions?: boolean
          created_at?: string
          last_security_reviewed_at?: string | null
          login_alert_channel?: string
          metadata?: Json
          mfa_enabled?: boolean
          mfa_required?: boolean
          new_device_alerts?: boolean
          passkey_enabled?: boolean
          password_updated_at?: string | null
          session_timeout_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_security_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_trusted_devices: {
        Row: {
          app_version: string | null
          created_at: string
          device_id: string
          device_name: string | null
          first_seen_at: string
          id: string
          is_active: boolean
          last_ip: unknown
          last_seen_at: string
          metadata: Json
          os_version: string | null
          platform: string
          revoked_at: string | null
          revoked_by_user_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_id: string
          device_name?: string | null
          first_seen_at?: string
          id?: string
          is_active?: boolean
          last_ip?: unknown
          last_seen_at?: string
          metadata?: Json
          os_version?: string | null
          platform: string
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_id?: string
          device_name?: string | null
          first_seen_at?: string
          id?: string
          is_active?: boolean
          last_ip?: unknown
          last_seen_at?: string
          metadata?: Json
          os_version?: string | null
          platform?: string
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_trusted_devices_revoked_by_user_id_fkey"
            columns: ["revoked_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_trusted_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waiver_acceptances: {
        Row: {
          accepted_at: string
          created_at: string
          gym_membership_id: string | null
          id: string
          ip_address: string | null
          locale: string | null
          signature_data: Json
          source: string
          user_agent: string | null
          user_id: string
          waiver_id: string
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          gym_membership_id?: string | null
          id?: string
          ip_address?: string | null
          locale?: string | null
          signature_data?: Json
          source?: string
          user_agent?: string | null
          user_id: string
          waiver_id: string
        }
        Update: {
          accepted_at?: string
          created_at?: string
          gym_membership_id?: string | null
          id?: string
          ip_address?: string | null
          locale?: string | null
          signature_data?: Json
          source?: string
          user_agent?: string | null
          user_id?: string
          waiver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiver_acceptances_gym_membership_id_fkey"
            columns: ["gym_membership_id"]
            isOneToOne: false
            referencedRelation: "gym_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiver_acceptances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiver_acceptances_waiver_id_fkey"
            columns: ["waiver_id"]
            isOneToOne: false
            referencedRelation: "waivers"
            referencedColumns: ["id"]
          },
        ]
      }
      waivers: {
        Row: {
          created_at: string
          created_by: string | null
          document_url: string
          effective_at: string
          gym_id: string
          id: string
          is_active: boolean
          language_code: string
          policy_version: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_url: string
          effective_at?: string
          gym_id: string
          id?: string
          is_active?: boolean
          language_code?: string
          policy_version: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_url?: string
          effective_at?: string
          gym_id?: string
          id?: string
          is_active?: boolean
          language_code?: string
          policy_version?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waivers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waivers_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_exercises: {
        Row: {
          block_id: string | null
          block_type: Database["public"]["Enums"]["workout_block_type"]
          created_at: string
          exercise_id: string
          id: string
          notes: string | null
          order_index: number
          target_reps: string | null
          target_weight_kg: number | null
          updated_at: string
          workout_id: string
        }
        Insert: {
          block_id?: string | null
          block_type?: Database["public"]["Enums"]["workout_block_type"]
          created_at?: string
          exercise_id: string
          id?: string
          notes?: string | null
          order_index: number
          target_reps?: string | null
          target_weight_kg?: number | null
          updated_at?: string
          workout_id: string
        }
        Update: {
          block_id?: string | null
          block_type?: Database["public"]["Enums"]["workout_block_type"]
          created_at?: string
          exercise_id?: string
          id?: string
          notes?: string | null
          order_index?: number
          target_reps?: string | null
          target_weight_kg?: number | null
          updated_at?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sets: {
        Row: {
          completed_at: string
          distance_m: number | null
          duration_seconds: number | null
          id: string
          is_pr: boolean
          reps: number | null
          rpe: number | null
          set_index: number
          weight_kg: number | null
          workout_exercise_id: string
        }
        Insert: {
          completed_at?: string
          distance_m?: number | null
          duration_seconds?: number | null
          id?: string
          is_pr?: boolean
          reps?: number | null
          rpe?: number | null
          set_index: number
          weight_kg?: number | null
          workout_exercise_id: string
        }
        Update: {
          completed_at?: string
          distance_m?: number | null
          duration_seconds?: number | null
          id?: string
          is_pr?: boolean
          reps?: number | null
          rpe?: number | null
          set_index?: number
          weight_kg?: number | null
          workout_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          created_at: string
          ended_at: string | null
          external_activity_id: string | null
          gym_id: string | null
          id: string
          is_pr: boolean
          notes: string | null
          rpe: number | null
          source: Database["public"]["Enums"]["integration_provider"]
          started_at: string
          title: string
          total_sets: number
          total_volume_kg: number
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["workout_visibility"]
          workout_type: Database["public"]["Enums"]["workout_type"]
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          external_activity_id?: string | null
          gym_id?: string | null
          id?: string
          is_pr?: boolean
          notes?: string | null
          rpe?: number | null
          source?: Database["public"]["Enums"]["integration_provider"]
          started_at: string
          title: string
          total_sets?: number
          total_volume_kg?: number
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["workout_visibility"]
          workout_type?: Database["public"]["Enums"]["workout_type"]
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          external_activity_id?: string | null
          gym_id?: string | null
          id?: string
          is_pr?: boolean
          notes?: string | null
          rpe?: number | null
          source?: Database["public"]["Enums"]["integration_provider"]
          started_at?: string
          title?: string
          total_sets?: number
          total_volume_kg?: number
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["workout_visibility"]
          workout_type?: Database["public"]["Enums"]["workout_type"]
        }
        Relationships: [
          {
            foreignKeyName: "workouts_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      checkins: {
        Row: {
          checked_in_at: string | null
          class_id: string | null
          created_at: string | null
          created_by: string | null
          event_type: Database["public"]["Enums"]["access_event_type"] | null
          gym_id: string | null
          id: string | null
          membership_id: string | null
          note: string | null
          result: Database["public"]["Enums"]["access_result"] | null
          source_channel: string | null
          user_id: string | null
        }
        Insert: {
          checked_in_at?: string | null
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          event_type?: Database["public"]["Enums"]["access_event_type"] | null
          gym_id?: string | null
          id?: string | null
          membership_id?: string | null
          note?: string | null
          result?: Database["public"]["Enums"]["access_result"] | null
          source_channel?: string | null
          user_id?: string | null
        }
        Update: {
          checked_in_at?: string | null
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          event_type?: Database["public"]["Enums"]["access_event_type"] | null
          gym_id?: string | null
          id?: string | null
          membership_id?: string | null
          note?: string | null
          result?: Database["public"]["Enums"]["access_result"] | null
          source_channel?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gym_checkins_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "gym_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_checkins_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_checkins_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_checkins_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "gym_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks_reports: {
        Row: {
          actor_user_id: string | null
          created_at: string | null
          id: string | null
          reason: string | null
          record_type: string | null
          status: string | null
          target_user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_get_gym_ops_summary: {
        Args: { p_gym_id: string }
        Returns: {
          active_or_trial_members: number
          gym_id: string
          open_privacy_requests: number
          pending_memberships: number
          pending_waitlist_entries: number
          upcoming_classes: number
        }[]
      }
      admin_get_privacy_ops_metrics: {
        Args: { p_gym_id: string; p_window_days?: number }
        Returns: {
          avg_completion_hours: number
          fulfilled_requests_window: number
          gym_id: string
          measured_window_days: number
          open_requests: number
          overdue_requests: number
          rejected_requests_window: number
        }[]
      }
      admin_list_open_privacy_requests: {
        Args: { p_gym_id: string }
        Returns: {
          due_at: string
          id: string
          is_overdue: boolean
          request_type: Database["public"]["Enums"]["privacy_request_type"]
          sla_breached_at: string
          status: Database["public"]["Enums"]["privacy_request_status"]
          submitted_at: string
          user_id: string
        }[]
      }
      admin_list_security_incidents: {
        Args: { p_gym_id: string; p_limit?: number; p_status_filter?: string }
        Returns: {
          affected_gym_count: number
          affected_user_count: number
          detected_at: string
          drill_mode: boolean
          ftc_notice_due_at: string
          gdpr_notice_due_at: string
          gym_id: string
          id: string
          is_deadline_breached: boolean
          next_deadline_at: string
          next_deadline_label: string
          requires_ftc_notice: boolean
          requires_gdpr_notice: boolean
          seconds_to_next_deadline: number
          severity: string
          status: string
          title: string
          updated_at: string
        }[]
      }
      admin_list_user_consents: {
        Args: { p_gym_id: string; p_user_id: string }
        Returns: {
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at: string
          evidence: Json
          granted: boolean
          granted_at: string
          id: string
          ip_address: string | null
          locale: string | null
          policy_version_id: string | null
          revoked_at: string | null
          source: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "consents"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_record_contract_acceptance: {
        Args: {
          p_contract_id: string
          p_membership_id?: string
          p_signature_data?: Json
          p_source?: string
          p_user_id: string
        }
        Returns: string
      }
      admin_record_waiver_acceptance: {
        Args: {
          p_membership_id?: string
          p_signature_data?: Json
          p_source?: string
          p_user_id: string
          p_waiver_id: string
        }
        Returns: string
      }
      append_audit_log: {
        Args: {
          _action: string
          _metadata?: Json
          _reason?: string
          _target_id: string
          _target_table: string
        }
        Returns: string
      }
      apply_user_anonymization: {
        Args: { p_privacy_request_id?: string; p_user_id: string }
        Returns: Json
      }
      approve_support_automation_run: {
        Args: { p_approve: boolean; p_note?: string; p_run_id: string }
        Returns: {
          agent_name: string
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          error_message: string | null
          executed_at: string | null
          id: string
          notification_sent_at: string | null
          plan_json: Json
          proposed_changes: Json
          requires_approval: boolean
          result_payload: Json
          result_summary: string | null
          run_status: Database["public"]["Enums"]["support_run_status"]
          ticket_id: string
          trigger_source: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "support_automation_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      audit_log_compute_hash: {
        Args: {
          p_action: string
          p_actor_role: string
          p_actor_user_id: string
          p_created_at: string
          p_integrity_seq: number
          p_ip_address: string
          p_metadata: Json
          p_prev_entry_hash: string
          p_reason: string
          p_target_id: string
          p_target_table: string
          p_user_agent: string
        }
        Returns: string
      }
      audit_log_integrity_drift: {
        Args: { p_limit?: number }
        Returns: {
          actual: string
          audit_log_id: string
          expected: string
          integrity_seq: number
          issue: string
        }[]
      }
      audit_log_integrity_summary: { Args: { p_limit?: number }; Returns: Json }
      build_privacy_export_payload: {
        Args: { p_user_id?: string }
        Returns: Json
      }
      calculate_level_from_xp: { Args: { _xp: number }; Returns: number }
      can_manage_discount_campaign: {
        Args: { _campaign_id: string; _viewer?: string }
        Returns: boolean
      }
      can_manage_gym_config: {
        Args: { _gym_id: string; _viewer?: string }
        Returns: boolean
      }
      can_manage_pricing_experiment: {
        Args: { _experiment_id: string; _viewer?: string }
        Returns: boolean
      }
      can_manage_privacy_user: {
        Args: { p_actor_user_id?: string; p_target_user_id: string }
        Returns: boolean
      }
      can_manage_subscription: {
        Args: { _subscription_id: string; _viewer?: string }
        Returns: boolean
      }
      can_manage_support_ticket: {
        Args: { _ticket_id: string; _viewer?: string }
        Returns: boolean
      }
      can_staff_manage_privacy_user: {
        Args: { p_actor_user_id?: string; p_target_user_id: string }
        Returns: boolean
      }
      can_view_gym: {
        Args: { _gym_id: string; _viewer?: string }
        Returns: boolean
      }
      can_view_security_incident: {
        Args: { p_actor_user_id?: string; p_incident_id: string }
        Returns: boolean
      }
      can_view_support_ticket: {
        Args: { _ticket_id: string; _viewer?: string }
        Returns: boolean
      }
      can_view_workout: {
        Args: {
          _gym_id: string
          _owner: string
          _viewer?: string
          _visibility: Database["public"]["Enums"]["workout_visibility"]
        }
        Returns: boolean
      }
      claim_incident_notification_jobs: {
        Args: { p_limit?: number }
        Returns: {
          attempt_count: number
          channel: string
          created_at: string
          created_by: string | null
          delivery_mode: string
          destination: string
          finished_at: string | null
          id: string
          incident_id: string
          last_error: string | null
          next_attempt_at: string | null
          payload: Json
          provider: string
          response_payload: Json
          started_at: string | null
          status: Database["public"]["Enums"]["sync_job_status"]
          template_key: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "incident_notification_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_privacy_delete_jobs: {
        Args: { p_limit?: number }
        Returns: {
          anonymization_summary: Json
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          next_retry_at: string | null
          privacy_request_id: string
          retry_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["sync_job_status"]
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "privacy_delete_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_privacy_export_jobs: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          error_message: string | null
          file_bytes: number | null
          finished_at: string | null
          id: string
          next_retry_at: string | null
          privacy_request_id: string
          record_count: number | null
          retry_count: number
          signed_url: string | null
          signed_url_expires_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["sync_job_status"]
          storage_bucket: string | null
          storage_path: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "privacy_export_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_incident_notification_job: {
        Args: { p_job_id: string; p_response_payload?: Json }
        Returns: string
      }
      complete_privacy_delete_job: {
        Args: { p_anonymization_summary?: Json; p_job_id: string }
        Returns: string
      }
      complete_privacy_export_job: {
        Args: {
          p_content_type?: string
          p_file_bytes?: number
          p_job_id: string
          p_record_count?: number
          p_signed_url: string
          p_signed_url_expires_at: string
          p_storage_bucket: string
          p_storage_path: string
        }
        Returns: string
      }
      compute_incident_notice_deadlines: {
        Args: {
          p_detected_at: string
          p_ftc_deadline_hours?: number
          p_gdpr_deadline_hours?: number
          p_requires_ftc_notice: boolean
          p_requires_gdpr_notice: boolean
        }
        Returns: Json
      }
      consent_policy_type_from_consent_type: {
        Args: { p_consent_type: Database["public"]["Enums"]["consent_type"] }
        Returns: Database["public"]["Enums"]["policy_type"]
      }
      create_security_incident: {
        Args: {
          p_affected_gym_count?: number
          p_affected_user_count?: number
          p_description?: string
          p_detected_at?: string
          p_drill_mode?: boolean
          p_ftc_deadline_hours?: number
          p_gdpr_deadline_hours?: number
          p_gym_id: string
          p_metadata?: Json
          p_requires_ftc_notice?: boolean
          p_requires_gdpr_notice?: boolean
          p_severity?: string
          p_source?: string
          p_title: string
        }
        Returns: string
      }
      current_policy_version_id: {
        Args: {
          p_as_of?: string
          p_policy_type: Database["public"]["Enums"]["policy_type"]
        }
        Returns: string
      }
      ensure_user_security_settings: {
        Args: { _user_id: string }
        Returns: undefined
      }
      fail_incident_notification_job: {
        Args: {
          p_error: string
          p_job_id: string
          p_max_retries?: number
          p_retry_delay_seconds?: number
        }
        Returns: Json
      }
      fail_privacy_delete_job: {
        Args: {
          p_error: string
          p_force_final?: boolean
          p_job_id: string
          p_max_retries?: number
          p_retry_delay_seconds?: number
        }
        Returns: Json
      }
      fail_privacy_export_job: {
        Args: {
          p_error: string
          p_job_id: string
          p_max_retries?: number
          p_retry_delay_seconds?: number
        }
        Returns: Json
      }
      get_platform_admin_overview: { Args: never; Returns: Json }
      has_active_legal_hold: { Args: { p_user_id?: string }; Returns: boolean }
      is_gym_member: {
        Args: { _gym_id: string; _viewer?: string }
        Returns: boolean
      }
      is_gym_staff: {
        Args: { _gym_id: string; _viewer?: string }
        Returns: boolean
      }
      is_incident_open_status: { Args: { p_status: string }; Returns: boolean }
      is_platform_operator: { Args: { _viewer?: string }; Returns: boolean }
      is_privacy_request_open_status: {
        Args: { _status: Database["public"]["Enums"]["privacy_request_status"] }
        Returns: boolean
      }
      is_security_relevant_event_type: {
        Args: { p_event_type: string }
        Returns: boolean
      }
      is_service_role: { Args: never; Returns: boolean }
      join_challenge: { Args: { p_challenge_id: string }; Returns: string }
      join_waitlist: { Args: { p_class_id: string }; Returns: string }
      leave_challenge: { Args: { p_challenge_id: string }; Returns: boolean }
      legal_locale_fallback_chain: {
        Args: { p_locale?: string }
        Returns: string[]
      }
      list_legal_copy_bundle: {
        Args: { p_locale?: string; p_prefix?: string }
        Returns: {
          copy_key: string
          fallback_rank: number
          localized_text: string
          requested_locale: string
          resolved_locale: string
        }[]
      }
      list_missing_required_consents: {
        Args: { p_user_id?: string }
        Returns: {
          consent_type: Database["public"]["Enums"]["consent_type"]
          reason: string
          required_policy_version: string
          required_policy_version_id: string
        }[]
      }
      log_user_auth_event: {
        Args: {
          p_device_id?: string
          p_event_type: Database["public"]["Enums"]["auth_event_type"]
          p_failure_reason?: string
          p_ip_address?: unknown
          p_metadata?: Json
          p_platform?: string
          p_risk_level?: Database["public"]["Enums"]["auth_event_risk_level"]
          p_success?: boolean
          p_user_agent?: string
        }
        Returns: {
          created_at: string
          device_id: string | null
          event_type: Database["public"]["Enums"]["auth_event_type"]
          failure_reason: string | null
          id: string
          ip_address: unknown
          metadata: Json
          occurred_at: string
          platform: string | null
          risk_level: Database["public"]["Enums"]["auth_event_risk_level"]
          success: boolean
          user_agent: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_auth_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_workout_atomic: {
        Args: { p_exercises: Json; p_workout: Json }
        Returns: string
      }
      normalize_legal_locale: { Args: { p_locale?: string }; Returns: string }
      platform_has_approved_gym_support_grant: {
        Args: {
          _gym_id: string
          _operator_user_id?: string
          _required_scope?: string
        }
        Returns: boolean
      }
      platform_operator_has_permission: {
        Args: { _permission_key: string; _viewer?: string }
        Returns: boolean
      }
      process_privacy_request_queue: {
        Args: { p_overdue_limit?: number; p_triage_limit?: number }
        Returns: Json
      }
      promote_waitlist_member: { Args: { p_class_id: string }; Returns: string }
      publish_policy_version: {
        Args: {
          p_change_summary?: string
          p_document_url: string
          p_effective_at?: string
          p_is_active?: boolean
          p_label?: string
          p_policy_type: Database["public"]["Enums"]["policy_type"]
          p_requires_reconsent?: boolean
          p_supersedes_policy_version_id?: string
          p_version: string
        }
        Returns: string
      }
      queue_incident_escalation_notifications: {
        Args: {
          p_channels?: string[]
          p_email_destination?: string
          p_force_live?: boolean
          p_incident_id: string
          p_payload?: Json
          p_reason?: string
          p_template_key?: string
          p_webhook_destination?: string
        }
        Returns: number
      }
      queue_privacy_delete_jobs: { Args: { p_limit?: number }; Returns: number }
      queue_privacy_export_jobs: { Args: { p_limit?: number }; Returns: number }
      rebuild_leaderboard_scope: {
        Args: { p_leaderboard_id: string }
        Returns: number
      }
      recompute_security_incident_deadlines: {
        Args: {
          p_ftc_deadline_hours?: number
          p_gdpr_deadline_hours?: number
          p_incident_id: string
          p_note?: string
        }
        Returns: string
      }
      record_user_consent: {
        Args: {
          p_consent_type: Database["public"]["Enums"]["consent_type"]
          p_evidence?: Json
          p_granted: boolean
          p_ip_address?: string
          p_locale?: string
          p_policy_version_id?: string
          p_source?: string
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: string
      }
      record_waiver_acceptance: {
        Args: {
          p_membership_id?: string
          p_signature_data?: Json
          p_waiver_id: string
        }
        Returns: string
      }
      refresh_workout_totals: {
        Args: { _workout_id: string }
        Returns: undefined
      }
      resolve_legal_copy: {
        Args: { p_copy_key: string; p_locale?: string }
        Returns: {
          copy_key: string
          localized_text: string
          requested_locale: string
          resolved_locale: string
        }[]
      }
      seed_default_gym_permissions: {
        Args: { _gym_id: string }
        Returns: undefined
      }
      submit_challenge_progress: {
        Args: {
          p_challenge_id: string
          p_mark_completed?: boolean
          p_score_delta: number
        }
        Returns: number
      }
      submit_privacy_request: {
        Args: {
          p_reason?: string
          p_request_type: Database["public"]["Enums"]["privacy_request_type"]
        }
        Returns: string
      }
      submit_support_ticket: {
        Args: {
          p_category?: string
          p_channel?: Database["public"]["Enums"]["support_ticket_channel"]
          p_description: string
          p_gym_id?: string
          p_metadata?: Json
          p_priority?: Database["public"]["Enums"]["support_ticket_priority"]
          p_reporter_email?: string
          p_subject: string
        }
        Returns: {
          affected_surface: string | null
          ai_confidence: number | null
          ai_recommended_actions: Json
          ai_summary: string | null
          ai_triage_labels: string[]
          category: string
          channel: Database["public"]["Enums"]["support_ticket_channel"]
          closed_at: string | null
          created_at: string
          description: string
          first_response_due_at: string | null
          gym_id: string | null
          id: string
          impacted_users_count: number
          last_customer_reply_at: string | null
          metadata: Json
          owner_user_id: string | null
          priority: Database["public"]["Enums"]["support_ticket_priority"]
          reporter_email: string | null
          reporter_user_id: string | null
          requires_human_approval: boolean
          resolution_due_at: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          ticket_number: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "support_tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_privacy_request_status: {
        Args: {
          p_next_status: Database["public"]["Enums"]["privacy_request_status"]
          p_notes?: string
          p_request_id: string
        }
        Returns: string
      }
      transition_security_incident_status: {
        Args: {
          p_incident_id: string
          p_metadata?: Json
          p_next_status: string
          p_note?: string
        }
        Returns: string
      }
      user_has_gym_permission: {
        Args: { _gym_id: string; _permission_key: string; _viewer?: string }
        Returns: boolean
      }
      user_has_required_consents: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
    }
    Enums: {
      access_event_type:
        | "door_checkin"
        | "door_denied"
        | "frontdesk_checkin"
        | "manual_override"
      access_result: "allowed" | "denied" | "override_allowed"
      anonymization_check_status: "passed" | "failed" | "waived"
      auth_event_risk_level: "low" | "medium" | "high"
      auth_event_type:
        | "login_success"
        | "login_failed"
        | "logout"
        | "password_changed"
        | "mfa_enabled"
        | "mfa_disabled"
        | "token_refreshed"
        | "new_device_trusted"
        | "trusted_device_revoked"
        | "session_revoked"
      billing_interval: "monthly" | "quarterly" | "yearly" | "dropin"
      billing_scope: "b2c" | "b2b"
      booking_status:
        | "booked"
        | "waitlisted"
        | "cancelled"
        | "attended"
        | "no_show"
      challenge_type: "volume" | "consistency" | "max_effort" | "time_based"
      challenge_visibility: "public" | "gym" | "invite_only"
      class_status: "scheduled" | "cancelled" | "completed"
      consent_type:
        | "terms"
        | "privacy"
        | "health_data_processing"
        | "marketing_email"
        | "push_notifications"
      crm_lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "trial_scheduled"
        | "trial_completed"
        | "won"
        | "lost"
      data_aggregation_job_status:
        | "queued"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
      data_partner_export_status:
        | "queued"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
      data_partner_grant_status:
        | "requested"
        | "approved"
        | "denied"
        | "revoked"
        | "expired"
      data_partner_status: "prospect" | "active" | "suspended" | "terminated"
      data_product_access_level: "aggregate_anonymous" | "pseudonymous"
      data_release_approval_status: "pending" | "approved" | "rejected"
      discount_type: "percent" | "amount" | "trial_days"
      dunning_stage:
        | "payment_failed"
        | "retry_1"
        | "retry_2"
        | "retry_3"
        | "final_notice"
        | "cancelled"
      gym_addon_category:
        | "analytics"
        | "workforce"
        | "automation"
        | "engagement"
        | "integrations"
        | "other"
      gym_addon_subscription_status:
        | "trialing"
        | "active"
        | "paused"
        | "past_due"
        | "canceled"
      gym_automation_run_status:
        | "queued"
        | "running"
        | "awaiting_approval"
        | "succeeded"
        | "failed"
        | "cancelled"
      gym_role: "leader" | "officer" | "coach" | "member"
      integration_connection_status: "active" | "revoked" | "expired" | "error"
      integration_processing_status:
        | "pending"
        | "processed"
        | "failed"
        | "ignored"
      integration_provider:
        | "apple_health"
        | "garmin"
        | "fitbit"
        | "huawei_health"
        | "suunto"
        | "oura"
        | "whoop"
        | "manual"
      invoice_connection_status:
        | "disconnected"
        | "pending"
        | "active"
        | "error"
        | "revoked"
      invoice_delivery_status:
        | "queued"
        | "processing"
        | "submitted"
        | "accepted"
        | "rejected"
        | "failed"
        | "cancelled"
      leaderboard_metric:
        | "xp"
        | "volume_kg"
        | "estimated_1rm"
        | "consistency_days"
        | "challenge_score"
      leaderboard_scope: "global" | "gym" | "exercise" | "challenge"
      leaderboard_timeframe: "daily" | "weekly" | "monthly" | "all_time"
      membership_status: "pending" | "trial" | "active" | "paused" | "cancelled"
      partner_app_status: "draft" | "active" | "suspended" | "retired"
      partner_install_status: "active" | "paused" | "revoked" | "error"
      partner_revenue_event_status:
        | "pending"
        | "recognized"
        | "invoiced"
        | "paid"
        | "void"
      payment_status:
        | "draft"
        | "open"
        | "paid"
        | "void"
        | "uncollectible"
        | "refunded"
        | "partially_refunded"
        | "failed"
      platform_operator_role:
        | "founder"
        | "ops_admin"
        | "support_admin"
        | "compliance_admin"
        | "analyst"
        | "read_only"
      policy_type: "terms" | "privacy" | "health_data" | "waiver"
      pricing_assignment_status:
        | "assigned"
        | "exposed"
        | "converted"
        | "expired"
      pricing_experiment_status:
        | "draft"
        | "running"
        | "paused"
        | "completed"
        | "archived"
      privacy_request_status:
        | "submitted"
        | "in_review"
        | "completed"
        | "rejected"
        | "triaged"
        | "in_progress"
        | "fulfilled"
      privacy_request_type:
        | "access"
        | "export"
        | "delete"
        | "rectify"
        | "restrict_processing"
      rank_tier:
        | "initiate"
        | "apprentice"
        | "trainee"
        | "grinder"
        | "forged"
        | "vanguard"
        | "sentinel"
        | "warden"
        | "champion"
        | "paragon"
        | "titan"
        | "legend"
      reaction_type: "fist" | "fire" | "shield" | "clap" | "crown"
      refund_status: "pending" | "succeeded" | "failed" | "canceled"
      report_target_type: "workout" | "comment" | "profile" | "gym"
      social_connection_status: "pending" | "accepted" | "blocked"
      social_interaction_type: "reaction" | "comment"
      staff_shift_status:
        | "scheduled"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "missed"
        | "cancelled"
      staff_time_entry_status: "open" | "submitted" | "approved" | "rejected"
      subscription_status:
        | "incomplete"
        | "trialing"
        | "active"
        | "past_due"
        | "paused"
        | "canceled"
        | "unpaid"
      support_access_grant_status:
        | "requested"
        | "approved"
        | "denied"
        | "revoked"
        | "expired"
      support_access_session_status: "active" | "ended" | "terminated"
      support_actor_type: "user" | "staff" | "agent" | "system"
      support_run_status:
        | "queued"
        | "running"
        | "awaiting_approval"
        | "approved"
        | "rejected"
        | "executed"
        | "failed"
        | "cancelled"
      support_ticket_channel: "in_app" | "email" | "web" | "phone" | "api"
      support_ticket_priority: "low" | "normal" | "high" | "urgent"
      support_ticket_status:
        | "open"
        | "triaged"
        | "waiting_user"
        | "in_progress"
        | "waiting_approval"
        | "resolved"
        | "closed"
        | "spam"
      sync_job_status:
        | "queued"
        | "running"
        | "succeeded"
        | "failed"
        | "retry_scheduled"
      waitlist_status: "pending" | "promoted" | "expired" | "cancelled"
      workout_block_type:
        | "straight_set"
        | "superset"
        | "circuit"
        | "emom"
        | "amrap"
      workout_type:
        | "strength"
        | "functional"
        | "hyrox"
        | "crossfit"
        | "conditioning"
        | "custom"
      workout_visibility: "public" | "followers" | "gym" | "private"
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
      access_event_type: [
        "door_checkin",
        "door_denied",
        "frontdesk_checkin",
        "manual_override",
      ],
      access_result: ["allowed", "denied", "override_allowed"],
      anonymization_check_status: ["passed", "failed", "waived"],
      auth_event_risk_level: ["low", "medium", "high"],
      auth_event_type: [
        "login_success",
        "login_failed",
        "logout",
        "password_changed",
        "mfa_enabled",
        "mfa_disabled",
        "token_refreshed",
        "new_device_trusted",
        "trusted_device_revoked",
        "session_revoked",
      ],
      billing_interval: ["monthly", "quarterly", "yearly", "dropin"],
      billing_scope: ["b2c", "b2b"],
      booking_status: [
        "booked",
        "waitlisted",
        "cancelled",
        "attended",
        "no_show",
      ],
      challenge_type: ["volume", "consistency", "max_effort", "time_based"],
      challenge_visibility: ["public", "gym", "invite_only"],
      class_status: ["scheduled", "cancelled", "completed"],
      consent_type: [
        "terms",
        "privacy",
        "health_data_processing",
        "marketing_email",
        "push_notifications",
      ],
      crm_lead_status: [
        "new",
        "contacted",
        "qualified",
        "trial_scheduled",
        "trial_completed",
        "won",
        "lost",
      ],
      data_aggregation_job_status: [
        "queued",
        "running",
        "completed",
        "failed",
        "cancelled",
      ],
      data_partner_export_status: [
        "queued",
        "running",
        "completed",
        "failed",
        "cancelled",
      ],
      data_partner_grant_status: [
        "requested",
        "approved",
        "denied",
        "revoked",
        "expired",
      ],
      data_partner_status: ["prospect", "active", "suspended", "terminated"],
      data_product_access_level: ["aggregate_anonymous", "pseudonymous"],
      data_release_approval_status: ["pending", "approved", "rejected"],
      discount_type: ["percent", "amount", "trial_days"],
      dunning_stage: [
        "payment_failed",
        "retry_1",
        "retry_2",
        "retry_3",
        "final_notice",
        "cancelled",
      ],
      gym_addon_category: [
        "analytics",
        "workforce",
        "automation",
        "engagement",
        "integrations",
        "other",
      ],
      gym_addon_subscription_status: [
        "trialing",
        "active",
        "paused",
        "past_due",
        "canceled",
      ],
      gym_automation_run_status: [
        "queued",
        "running",
        "awaiting_approval",
        "succeeded",
        "failed",
        "cancelled",
      ],
      gym_role: ["leader", "officer", "coach", "member"],
      integration_connection_status: ["active", "revoked", "expired", "error"],
      integration_processing_status: [
        "pending",
        "processed",
        "failed",
        "ignored",
      ],
      integration_provider: [
        "apple_health",
        "garmin",
        "fitbit",
        "huawei_health",
        "suunto",
        "oura",
        "whoop",
        "manual",
      ],
      invoice_connection_status: [
        "disconnected",
        "pending",
        "active",
        "error",
        "revoked",
      ],
      invoice_delivery_status: [
        "queued",
        "processing",
        "submitted",
        "accepted",
        "rejected",
        "failed",
        "cancelled",
      ],
      leaderboard_metric: [
        "xp",
        "volume_kg",
        "estimated_1rm",
        "consistency_days",
        "challenge_score",
      ],
      leaderboard_scope: ["global", "gym", "exercise", "challenge"],
      leaderboard_timeframe: ["daily", "weekly", "monthly", "all_time"],
      membership_status: ["pending", "trial", "active", "paused", "cancelled"],
      partner_app_status: ["draft", "active", "suspended", "retired"],
      partner_install_status: ["active", "paused", "revoked", "error"],
      partner_revenue_event_status: [
        "pending",
        "recognized",
        "invoiced",
        "paid",
        "void",
      ],
      payment_status: [
        "draft",
        "open",
        "paid",
        "void",
        "uncollectible",
        "refunded",
        "partially_refunded",
        "failed",
      ],
      platform_operator_role: [
        "founder",
        "ops_admin",
        "support_admin",
        "compliance_admin",
        "analyst",
        "read_only",
      ],
      policy_type: ["terms", "privacy", "health_data", "waiver"],
      pricing_assignment_status: [
        "assigned",
        "exposed",
        "converted",
        "expired",
      ],
      pricing_experiment_status: [
        "draft",
        "running",
        "paused",
        "completed",
        "archived",
      ],
      privacy_request_status: [
        "submitted",
        "in_review",
        "completed",
        "rejected",
        "triaged",
        "in_progress",
        "fulfilled",
      ],
      privacy_request_type: [
        "access",
        "export",
        "delete",
        "rectify",
        "restrict_processing",
      ],
      rank_tier: [
        "initiate",
        "apprentice",
        "trainee",
        "grinder",
        "forged",
        "vanguard",
        "sentinel",
        "warden",
        "champion",
        "paragon",
        "titan",
        "legend",
      ],
      reaction_type: ["fist", "fire", "shield", "clap", "crown"],
      refund_status: ["pending", "succeeded", "failed", "canceled"],
      report_target_type: ["workout", "comment", "profile", "gym"],
      social_connection_status: ["pending", "accepted", "blocked"],
      social_interaction_type: ["reaction", "comment"],
      staff_shift_status: [
        "scheduled",
        "confirmed",
        "in_progress",
        "completed",
        "missed",
        "cancelled",
      ],
      staff_time_entry_status: ["open", "submitted", "approved", "rejected"],
      subscription_status: [
        "incomplete",
        "trialing",
        "active",
        "past_due",
        "paused",
        "canceled",
        "unpaid",
      ],
      support_access_grant_status: [
        "requested",
        "approved",
        "denied",
        "revoked",
        "expired",
      ],
      support_access_session_status: ["active", "ended", "terminated"],
      support_actor_type: ["user", "staff", "agent", "system"],
      support_run_status: [
        "queued",
        "running",
        "awaiting_approval",
        "approved",
        "rejected",
        "executed",
        "failed",
        "cancelled",
      ],
      support_ticket_channel: ["in_app", "email", "web", "phone", "api"],
      support_ticket_priority: ["low", "normal", "high", "urgent"],
      support_ticket_status: [
        "open",
        "triaged",
        "waiting_user",
        "in_progress",
        "waiting_approval",
        "resolved",
        "closed",
        "spam",
      ],
      sync_job_status: [
        "queued",
        "running",
        "succeeded",
        "failed",
        "retry_scheduled",
      ],
      waitlist_status: ["pending", "promoted", "expired", "cancelled"],
      workout_block_type: [
        "straight_set",
        "superset",
        "circuit",
        "emom",
        "amrap",
      ],
      workout_type: [
        "strength",
        "functional",
        "hyrox",
        "crossfit",
        "conditioning",
        "custom",
      ],
      workout_visibility: ["public", "followers", "gym", "private"],
    },
  },
} as const
