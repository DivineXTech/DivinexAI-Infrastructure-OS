/**
 * Hand-written placeholder matching supabase/migrations/20260715000000_foundation.sql.
 * Replace with `supabase gen types typescript --linked > lib/supabase/types.ts`
 * once a real Supabase project is linked (see docs/DEPLOYMENT.md). Keep this
 * file's shape in sync with migrations until then.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          is_platform_super_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          is_platform_super_admin?: boolean;
        };
        Update: {
          full_name?: string | null;
          avatar_url?: string | null;
          is_platform_super_admin?: boolean;
        };
        Relationships: Relationship[];
      };
      tenants: {
        Row: {
          id: string;
          slug: string;
          name: string;
          status: "active" | "suspended" | "archived";
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          status?: "active" | "suspended" | "archived";
        };
        Update: {
          slug?: string;
          name?: string;
          status?: "active" | "suspended" | "archived";
          deleted_at?: string | null;
        };
        Relationships: Relationship[];
      };
      roles: {
        Row: {
          id: string;
          key: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: { id?: string; key: string; name: string; description?: string | null };
        Update: { key?: string; name?: string; description?: string | null };
        Relationships: Relationship[];
      };
      permissions: {
        Row: {
          id: string;
          key: string;
          description: string | null;
          created_at: string;
        };
        Insert: { id?: string; key: string; description?: string | null };
        Update: { key?: string; description?: string | null };
        Relationships: Relationship[];
      };
      role_permissions: {
        Row: { role_id: string; permission_id: string };
        Insert: { role_id: string; permission_id: string };
        Update: { role_id?: string; permission_id?: string };
        Relationships: Relationship[];
      };
      tenant_memberships: {
        Row: {
          id: string;
          tenant_id: string;
          profile_id: string;
          role_id: string;
          status: "active" | "invited" | "suspended";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          profile_id: string;
          role_id: string;
          status?: "active" | "invited" | "suspended";
        };
        Update: {
          role_id?: string;
          status?: "active" | "invited" | "suspended";
        };
        Relationships: Relationship[];
      };
      audit_logs: {
        Row: {
          id: string;
          tenant_id: string | null;
          actor_profile_id: string | null;
          action: string;
          target_table: string | null;
          target_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          actor_profile_id?: string | null;
          action: string;
          target_table?: string | null;
          target_id?: string | null;
          metadata?: Json;
        };
        Update: never;
        Relationships: Relationship[];
      };
      leads: {
        Row: {
          id: string;
          lead_type:
            | "general_contact"
            | "consultation_request"
            | "startup_kit_interest"
            | "equipment_interest"
            | "white_label_interest"
            | "early_access_signup";
          full_name: string;
          email: string;
          message: string | null;
          consent_given: boolean;
          source: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          metadata: Json;
          status: "new" | "contacted" | "closed";
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_type:
            | "general_contact"
            | "consultation_request"
            | "startup_kit_interest"
            | "equipment_interest"
            | "white_label_interest"
            | "early_access_signup";
          full_name: string;
          email: string;
          message?: string | null;
          consent_given?: boolean;
          source?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          metadata?: Json;
          status?: "new" | "contacted" | "closed";
        };
        Update: {
          status?: "new" | "contacted" | "closed";
        };
        Relationships: Relationship[];
      };
      onboarding_sessions: {
        Row: {
          id: string;
          tenant_id: string;
          started_by: string;
          current_step: string;
          completion_percentage: number;
          status: "in_progress" | "needs_review" | "completed" | "archived";
          started_at: string;
          last_activity_at: string;
          completed_at: string | null;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          started_by: string;
          current_step?: string;
          completion_percentage?: number;
          status?: "in_progress" | "needs_review" | "completed" | "archived";
          started_at?: string;
          last_activity_at?: string;
          completed_at?: string | null;
          version?: number;
        };
        Update: {
          current_step?: string;
          completion_percentage?: number;
          status?: "in_progress" | "needs_review" | "completed" | "archived";
          last_activity_at?: string;
          completed_at?: string | null;
          version?: number;
        };
        Relationships: Relationship[];
      };
      onboarding_step_progress: {
        Row: {
          id: string;
          session_id: string;
          tenant_id: string;
          step_key: string;
          status: "not_started" | "in_progress" | "completed";
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          tenant_id: string;
          step_key: string;
          status?: "not_started" | "in_progress" | "completed";
          completed_at?: string | null;
        };
        Update: {
          status?: "not_started" | "in_progress" | "completed";
          completed_at?: string | null;
        };
        Relationships: Relationship[];
      };
      brand_profiles: {
        Row: {
          id: string;
          tenant_id: string;
          session_id: string | null;
          brand_name: string;
          tagline: string | null;
          description: string | null;
          logo_path: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          accent_color: string | null;
          typography: string | null;
          personality: string | null;
          personality_other: string | null;
          existing_website: string | null;
          social_links: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          session_id?: string | null;
          brand_name: string;
          tagline?: string | null;
          description?: string | null;
          logo_path?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          accent_color?: string | null;
          typography?: string | null;
          personality?: string | null;
          personality_other?: string | null;
          existing_website?: string | null;
          social_links?: Json;
        };
        Update: {
          brand_name?: string;
          tagline?: string | null;
          description?: string | null;
          logo_path?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          accent_color?: string | null;
          typography?: string | null;
          personality?: string | null;
          personality_other?: string | null;
          existing_website?: string | null;
          social_links?: Json;
        };
        Relationships: Relationship[];
      };
      brand_audiences: {
        Row: {
          id: string;
          tenant_id: string;
          session_id: string | null;
          customer_types: string[];
          age_ranges: string[];
          geographic_focus: string | null;
          market_type: "b2c" | "b2b" | "both" | null;
          style_preferences: string[];
          purchase_motivation: string | null;
          price_sensitivity: string | null;
          primary_sales_channel: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          session_id?: string | null;
          customer_types?: string[];
          age_ranges?: string[];
          geographic_focus?: string | null;
          market_type?: "b2c" | "b2b" | "both" | null;
          style_preferences?: string[];
          purchase_motivation?: string | null;
          price_sensitivity?: string | null;
          primary_sales_channel?: string | null;
        };
        Update: {
          customer_types?: string[];
          age_ranges?: string[];
          geographic_focus?: string | null;
          market_type?: "b2c" | "b2b" | "both" | null;
          style_preferences?: string[];
          purchase_motivation?: string | null;
          price_sensitivity?: string | null;
          primary_sales_channel?: string | null;
        };
        Relationships: Relationship[];
      };
      brand_product_preferences: {
        Row: {
          id: string;
          tenant_id: string;
          session_id: string | null;
          categories: string[];
          launch_quantity: number | null;
          initial_design_count: number | null;
          size_range: string | null;
          color_range: string | null;
          customization_requirements: string | null;
          sales_model: "retail" | "wholesale" | "both" | null;
          target_price_min_cents: number | null;
          target_price_max_cents: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          session_id?: string | null;
          categories?: string[];
          launch_quantity?: number | null;
          initial_design_count?: number | null;
          size_range?: string | null;
          color_range?: string | null;
          customization_requirements?: string | null;
          sales_model?: "retail" | "wholesale" | "both" | null;
          target_price_min_cents?: number | null;
          target_price_max_cents?: number | null;
        };
        Update: {
          categories?: string[];
          launch_quantity?: number | null;
          initial_design_count?: number | null;
          size_range?: string | null;
          color_range?: string | null;
          customization_requirements?: string | null;
          sales_model?: "retail" | "wholesale" | "both" | null;
          target_price_min_cents?: number | null;
          target_price_max_cents?: number | null;
        };
        Relationships: Relationship[];
      };
      production_preferences: {
        Row: {
          id: string;
          tenant_id: string;
          session_id: string | null;
          preferred_method: string | null;
          experience_level: "new" | "some_experience" | "experienced" | null;
          workspace: string | null;
          expected_monthly_volume: number | null;
          equipment_owned: boolean;
          existing_equipment: string | null;
          outsourcing_preference: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          session_id?: string | null;
          preferred_method?: string | null;
          experience_level?: "new" | "some_experience" | "experienced" | null;
          workspace?: string | null;
          expected_monthly_volume?: number | null;
          equipment_owned?: boolean;
          existing_equipment?: string | null;
          outsourcing_preference?: string | null;
        };
        Update: {
          preferred_method?: string | null;
          experience_level?: "new" | "some_experience" | "experienced" | null;
          workspace?: string | null;
          expected_monthly_volume?: number | null;
          equipment_owned?: boolean;
          existing_equipment?: string | null;
          outsourcing_preference?: string | null;
        };
        Relationships: Relationship[];
      };
      budget_profiles: {
        Row: {
          id: string;
          tenant_id: string;
          session_id: string | null;
          budget_band: string;
          precise_total_cents: number | null;
          allocation_equipment_cents: number | null;
          allocation_blank_apparel_cents: number | null;
          allocation_branding_cents: number | null;
          allocation_storefront_cents: number | null;
          allocation_marketing_cents: number | null;
          allocation_packaging_cents: number | null;
          allocation_training_cents: number | null;
          allocation_working_capital_cents: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          session_id?: string | null;
          budget_band: string;
          precise_total_cents?: number | null;
          allocation_equipment_cents?: number | null;
          allocation_blank_apparel_cents?: number | null;
          allocation_branding_cents?: number | null;
          allocation_storefront_cents?: number | null;
          allocation_marketing_cents?: number | null;
          allocation_packaging_cents?: number | null;
          allocation_training_cents?: number | null;
          allocation_working_capital_cents?: number | null;
        };
        Update: {
          budget_band?: string;
          precise_total_cents?: number | null;
          allocation_equipment_cents?: number | null;
          allocation_blank_apparel_cents?: number | null;
          allocation_branding_cents?: number | null;
          allocation_storefront_cents?: number | null;
          allocation_marketing_cents?: number | null;
          allocation_packaging_cents?: number | null;
          allocation_training_cents?: number | null;
          allocation_working_capital_cents?: number | null;
        };
        Relationships: Relationship[];
      };
      startup_kit_recommendations: {
        Row: {
          id: string;
          tenant_id: string;
          session_id: string | null;
          recommended_kit_slug: string;
          secondary_kit_slug: string | null;
          score: number;
          explanation: string;
          required_categories: string[];
          optional_categories: string[];
          owned_items: string[];
          estimated_range_min_cents: number | null;
          estimated_range_max_cents: number | null;
          risks: string[];
          next_steps: string[];
          rule_version: string;
          user_selected_kit_slug: string | null;
          overridden: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          session_id?: string | null;
          recommended_kit_slug: string;
          secondary_kit_slug?: string | null;
          score: number;
          explanation: string;
          required_categories?: string[];
          optional_categories?: string[];
          owned_items?: string[];
          estimated_range_min_cents?: number | null;
          estimated_range_max_cents?: number | null;
          risks?: string[];
          next_steps?: string[];
          rule_version: string;
          user_selected_kit_slug?: string | null;
          overridden?: boolean;
        };
        Update: {
          recommended_kit_slug?: string;
          secondary_kit_slug?: string | null;
          score?: number;
          explanation?: string;
          required_categories?: string[];
          optional_categories?: string[];
          owned_items?: string[];
          estimated_range_min_cents?: number | null;
          estimated_range_max_cents?: number | null;
          risks?: string[];
          next_steps?: string[];
          rule_version?: string;
          user_selected_kit_slug?: string | null;
          overridden?: boolean;
        };
        Relationships: Relationship[];
      };
      storefront_preferences: {
        Row: {
          id: string;
          tenant_id: string;
          session_id: string | null;
          storefront_name: string | null;
          theme_direction: string | null;
          hero_messaging: string | null;
          featured_categories: string[];
          domain_status: "none" | "have_domain" | "need_domain" | null;
          existing_domain: string | null;
          social_links: Json;
          contact_channel: string | null;
          announcement_bar_text: string | null;
          fulfillment_offer: "pickup" | "shipping" | "both" | null;
          planned_payment_methods: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          session_id?: string | null;
          storefront_name?: string | null;
          theme_direction?: string | null;
          hero_messaging?: string | null;
          featured_categories?: string[];
          domain_status?: "none" | "have_domain" | "need_domain" | null;
          existing_domain?: string | null;
          social_links?: Json;
          contact_channel?: string | null;
          announcement_bar_text?: string | null;
          fulfillment_offer?: "pickup" | "shipping" | "both" | null;
          planned_payment_methods?: Json;
        };
        Update: {
          storefront_name?: string | null;
          theme_direction?: string | null;
          hero_messaging?: string | null;
          featured_categories?: string[];
          domain_status?: "none" | "have_domain" | "need_domain" | null;
          existing_domain?: string | null;
          social_links?: Json;
          contact_channel?: string | null;
          announcement_bar_text?: string | null;
          fulfillment_offer?: "pickup" | "shipping" | "both" | null;
          planned_payment_methods?: Json;
        };
        Relationships: Relationship[];
      };
      fulfillment_preferences: {
        Row: {
          id: string;
          tenant_id: string;
          session_id: string | null;
          fulfillment_model: string | null;
          production_lead_time_days: number | null;
          pickup_location_placeholder: string | null;
          shipping_regions: string[];
          return_policy_status: "defined" | "in_progress" | "not_started" | null;
          packaging_preference: string | null;
          tracking_required: boolean;
          qc_responsibility: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          session_id?: string | null;
          fulfillment_model?: string | null;
          production_lead_time_days?: number | null;
          pickup_location_placeholder?: string | null;
          shipping_regions?: string[];
          return_policy_status?: "defined" | "in_progress" | "not_started" | null;
          packaging_preference?: string | null;
          tracking_required?: boolean;
          qc_responsibility?: string | null;
        };
        Update: {
          fulfillment_model?: string | null;
          production_lead_time_days?: number | null;
          pickup_location_placeholder?: string | null;
          shipping_regions?: string[];
          return_policy_status?: "defined" | "in_progress" | "not_started" | null;
          packaging_preference?: string | null;
          tracking_required?: boolean;
          qc_responsibility?: string | null;
        };
        Relationships: Relationship[];
      };
      launch_readiness_assessments: {
        Row: {
          id: string;
          tenant_id: string;
          session_id: string | null;
          total_score: number;
          category_scores: Json;
          strengths: string[];
          gaps: string[];
          priority_actions: string[];
          blocking_issues: string[];
          label: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          session_id?: string | null;
          total_score: number;
          category_scores?: Json;
          strengths?: string[];
          gaps?: string[];
          priority_actions?: string[];
          blocking_issues?: string[];
          label: string;
        };
        Update: {
          total_score?: number;
          category_scores?: Json;
          strengths?: string[];
          gaps?: string[];
          priority_actions?: string[];
          blocking_issues?: string[];
          label?: string;
        };
        Relationships: Relationship[];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_platform_super_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_tenant_member: {
        Args: { check_tenant_id: string };
        Returns: boolean;
      };
      has_tenant_role: {
        Args: { check_tenant_id: string; allowed_role_keys: string[] };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
};
