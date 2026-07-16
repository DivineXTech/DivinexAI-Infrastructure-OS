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
      garment_templates: {
        Row: {
          id: string;
          tenant_id: string | null;
          slug: string;
          name: string;
          category: string;
          manufacturer: string | null;
          style_number: string | null;
          description: string | null;
          fabric_composition: string | null;
          weight: string | null;
          fit: string | null;
          audience: string | null;
          supported_production_methods: string[];
          base_wholesale_cost_cents: number | null;
          status: "draft" | "active" | "archived";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          slug: string;
          name: string;
          category: string;
          manufacturer?: string | null;
          style_number?: string | null;
          description?: string | null;
          fabric_composition?: string | null;
          weight?: string | null;
          fit?: string | null;
          audience?: string | null;
          supported_production_methods?: string[];
          base_wholesale_cost_cents?: number | null;
          status?: "draft" | "active" | "archived";
          created_by?: string | null;
        };
        Update: {
          slug?: string;
          name?: string;
          category?: string;
          manufacturer?: string | null;
          style_number?: string | null;
          description?: string | null;
          fabric_composition?: string | null;
          weight?: string | null;
          fit?: string | null;
          audience?: string | null;
          supported_production_methods?: string[];
          base_wholesale_cost_cents?: number | null;
          status?: "draft" | "active" | "archived";
        };
        Relationships: Relationship[];
      };
      garment_template_views: {
        Row: {
          id: string;
          garment_template_id: string;
          tenant_id: string | null;
          view_key: "front" | "back" | "left" | "right" | "detail";
          image_path: string | null;
          svg_markup: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          garment_template_id: string;
          tenant_id?: string | null;
          view_key: "front" | "back" | "left" | "right" | "detail";
          image_path?: string | null;
          svg_markup?: string | null;
          sort_order?: number;
        };
        Update: {
          image_path?: string | null;
          svg_markup?: string | null;
          sort_order?: number;
        };
        Relationships: Relationship[];
      };
      garment_template_colors: {
        Row: {
          id: string;
          garment_template_id: string;
          tenant_id: string | null;
          name: string;
          hex_value: string;
          swatch_image_path: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          garment_template_id: string;
          tenant_id?: string | null;
          name: string;
          hex_value: string;
          swatch_image_path?: string | null;
          sort_order?: number;
        };
        Update: {
          name?: string;
          hex_value?: string;
          swatch_image_path?: string | null;
          sort_order?: number;
        };
        Relationships: Relationship[];
      };
      garment_template_sizes: {
        Row: {
          id: string;
          garment_template_id: string;
          tenant_id: string | null;
          size_label: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          garment_template_id: string;
          tenant_id?: string | null;
          size_label: string;
          sort_order?: number;
        };
        Update: {
          size_label?: string;
          sort_order?: number;
        };
        Relationships: Relationship[];
      };
      garment_print_zones: {
        Row: {
          id: string;
          garment_template_id: string;
          tenant_id: string | null;
          zone_key: string;
          view_key: "front" | "back" | "left" | "right";
          x: number;
          y: number;
          width: number;
          height: number;
          safe_width: number | null;
          safe_height: number | null;
          max_width_inches: number | null;
          max_height_inches: number | null;
          supported_production_methods: string[];
          rotation_locked: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          garment_template_id: string;
          tenant_id?: string | null;
          zone_key: string;
          view_key: "front" | "back" | "left" | "right";
          x: number;
          y: number;
          width: number;
          height: number;
          safe_width?: number | null;
          safe_height?: number | null;
          max_width_inches?: number | null;
          max_height_inches?: number | null;
          supported_production_methods?: string[];
          rotation_locked?: boolean;
        };
        Update: {
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          safe_width?: number | null;
          safe_height?: number | null;
          max_width_inches?: number | null;
          max_height_inches?: number | null;
          supported_production_methods?: string[];
          rotation_locked?: boolean;
        };
        Relationships: Relationship[];
      };
      design_projects: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          status:
            | "draft"
            | "needs_artwork"
            | "ready_for_review"
            | "changes_requested"
            | "approved"
            | "converted_to_product"
            | "archived";
          garment_template_id: string | null;
          garment_color_id: string | null;
          production_method: string | null;
          owner_profile_id: string | null;
          assigned_designer_id: string | null;
          internal_notes: string | null;
          customer_notes: string | null;
          created_from: "manual" | "onboarding";
          current_version_id: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name?: string;
          status?:
            | "draft"
            | "needs_artwork"
            | "ready_for_review"
            | "changes_requested"
            | "approved"
            | "converted_to_product"
            | "archived";
          garment_template_id?: string | null;
          garment_color_id?: string | null;
          production_method?: string | null;
          owner_profile_id?: string | null;
          assigned_designer_id?: string | null;
          internal_notes?: string | null;
          customer_notes?: string | null;
          created_from?: "manual" | "onboarding";
          current_version_id?: string | null;
        };
        Update: {
          name?: string;
          status?:
            | "draft"
            | "needs_artwork"
            | "ready_for_review"
            | "changes_requested"
            | "approved"
            | "converted_to_product"
            | "archived";
          garment_template_id?: string | null;
          garment_color_id?: string | null;
          production_method?: string | null;
          assigned_designer_id?: string | null;
          internal_notes?: string | null;
          customer_notes?: string | null;
          current_version_id?: string | null;
          archived_at?: string | null;
        };
        Relationships: Relationship[];
      };
      design_project_versions: {
        Row: {
          id: string;
          design_project_id: string;
          tenant_id: string;
          version_number: number;
          label: string | null;
          state: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          design_project_id: string;
          tenant_id: string;
          version_number: number;
          label?: string | null;
          state: Json;
          created_by?: string | null;
        };
        Update: never;
        Relationships: Relationship[];
      };
      design_assets: {
        Row: {
          id: string;
          tenant_id: string;
          design_project_id: string | null;
          storage_path: string;
          original_filename: string;
          mime_type: "image/png" | "image/jpeg" | "image/svg+xml" | "image/webp";
          file_size_bytes: number;
          width_px: number | null;
          height_px: number | null;
          estimated_dpi: number | null;
          has_transparency: boolean | null;
          checksum: string | null;
          status: "active" | "replaced" | "deleted";
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          design_project_id?: string | null;
          storage_path: string;
          original_filename: string;
          mime_type: "image/png" | "image/jpeg" | "image/svg+xml" | "image/webp";
          file_size_bytes: number;
          width_px?: number | null;
          height_px?: number | null;
          estimated_dpi?: number | null;
          has_transparency?: boolean | null;
          checksum?: string | null;
          status?: "active" | "replaced" | "deleted";
          uploaded_by?: string | null;
        };
        Update: {
          design_project_id?: string | null;
          status?: "active" | "replaced" | "deleted";
        };
        Relationships: Relationship[];
      };
      design_elements: {
        Row: {
          id: string;
          design_project_id: string;
          tenant_id: string;
          element_type: "text" | "image";
          z_index: number;
          locked: boolean;
          hidden: boolean;
          text_content: string | null;
          font_key: string | null;
          font_size: number | null;
          text_color: string | null;
          text_align: "left" | "center" | "right" | null;
          design_asset_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          design_project_id: string;
          tenant_id: string;
          element_type: "text" | "image";
          z_index?: number;
          locked?: boolean;
          hidden?: boolean;
          text_content?: string | null;
          font_key?: string | null;
          font_size?: number | null;
          text_color?: string | null;
          text_align?: "left" | "center" | "right" | null;
          design_asset_id?: string | null;
        };
        Update: {
          z_index?: number;
          locked?: boolean;
          hidden?: boolean;
          text_content?: string | null;
          font_key?: string | null;
          font_size?: number | null;
          text_color?: string | null;
          text_align?: "left" | "center" | "right" | null;
          design_asset_id?: string | null;
        };
        Relationships: Relationship[];
      };
      design_placements: {
        Row: {
          id: string;
          design_element_id: string;
          tenant_id: string;
          print_zone_id: string | null;
          garment_view: "front" | "back" | "left" | "right";
          x: number;
          y: number;
          width: number;
          height: number;
          rotation: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          design_element_id: string;
          tenant_id: string;
          print_zone_id?: string | null;
          garment_view: "front" | "back" | "left" | "right";
          x: number;
          y: number;
          width: number;
          height: number;
          rotation?: number;
        };
        Update: {
          print_zone_id?: string | null;
          garment_view?: "front" | "back" | "left" | "right";
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          rotation?: number;
        };
        Relationships: Relationship[];
      };
      mockups: {
        Row: {
          id: string;
          tenant_id: string;
          design_project_id: string | null;
          design_project_version_id: string | null;
          status: "generated" | "downloaded";
          has_watermark: boolean;
          generated_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          design_project_id?: string | null;
          design_project_version_id?: string | null;
          status?: "generated" | "downloaded";
          has_watermark?: boolean;
          generated_by?: string | null;
        };
        Update: {
          status?: "generated" | "downloaded";
        };
        Relationships: Relationship[];
      };
      mockup_views: {
        Row: {
          id: string;
          mockup_id: string;
          tenant_id: string;
          view_key: "front" | "back" | "left" | "right" | "composite";
          image_path: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          mockup_id: string;
          tenant_id: string;
          view_key: "front" | "back" | "left" | "right" | "composite";
          image_path: string;
        };
        Update: never;
        Relationships: Relationship[];
      };
      products: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          slug: string;
          short_description: string | null;
          full_description: string | null;
          category: string | null;
          garment_template_id: string | null;
          design_project_id: string | null;
          production_method: string | null;
          status: "draft" | "ready_for_review" | "approved" | "active" | "paused" | "archived";
          sales_channels: string[];
          is_featured: boolean;
          seo_title: string | null;
          seo_description: string | null;
          tags: string[];
          primary_image_path: string | null;
          internal_notes: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          slug: string;
          short_description?: string | null;
          full_description?: string | null;
          category?: string | null;
          garment_template_id?: string | null;
          design_project_id?: string | null;
          production_method?: string | null;
          status?: "draft" | "ready_for_review" | "approved" | "active" | "paused" | "archived";
          sales_channels?: string[];
          is_featured?: boolean;
          seo_title?: string | null;
          seo_description?: string | null;
          tags?: string[];
          primary_image_path?: string | null;
          internal_notes?: string | null;
        };
        Update: {
          name?: string;
          slug?: string;
          short_description?: string | null;
          full_description?: string | null;
          category?: string | null;
          garment_template_id?: string | null;
          design_project_id?: string | null;
          production_method?: string | null;
          status?: "draft" | "ready_for_review" | "approved" | "active" | "paused" | "archived";
          sales_channels?: string[];
          is_featured?: boolean;
          seo_title?: string | null;
          seo_description?: string | null;
          tags?: string[];
          primary_image_path?: string | null;
          internal_notes?: string | null;
          archived_at?: string | null;
        };
        Relationships: Relationship[];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          tenant_id: string;
          sku: string;
          barcode: string | null;
          size_label: string | null;
          color_name: string | null;
          garment_style: string | null;
          material: string | null;
          print_location: string | null;
          base_garment_cost_cents: number;
          print_cost_cents: number;
          packaging_cost_cents: number;
          additional_cost_cents: number;
          retail_price_cents: number | null;
          wholesale_price_cents: number | null;
          compare_at_price_cents: number | null;
          weight_grams: number | null;
          is_active: boolean;
          track_inventory: boolean;
          supplier_reference: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          tenant_id: string;
          sku: string;
          barcode?: string | null;
          size_label?: string | null;
          color_name?: string | null;
          garment_style?: string | null;
          material?: string | null;
          print_location?: string | null;
          base_garment_cost_cents?: number;
          print_cost_cents?: number;
          packaging_cost_cents?: number;
          additional_cost_cents?: number;
          retail_price_cents?: number | null;
          wholesale_price_cents?: number | null;
          compare_at_price_cents?: number | null;
          weight_grams?: number | null;
          is_active?: boolean;
          track_inventory?: boolean;
          supplier_reference?: string | null;
        };
        Update: {
          sku?: string;
          barcode?: string | null;
          size_label?: string | null;
          color_name?: string | null;
          garment_style?: string | null;
          material?: string | null;
          print_location?: string | null;
          base_garment_cost_cents?: number;
          print_cost_cents?: number;
          packaging_cost_cents?: number;
          additional_cost_cents?: number;
          retail_price_cents?: number | null;
          wholesale_price_cents?: number | null;
          compare_at_price_cents?: number | null;
          weight_grams?: number | null;
          is_active?: boolean;
          track_inventory?: boolean;
          supplier_reference?: string | null;
        };
        Relationships: Relationship[];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          tenant_id: string;
          image_path: string;
          alt_text: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          tenant_id: string;
          image_path: string;
          alt_text?: string | null;
          sort_order?: number;
        };
        Update: {
          image_path?: string;
          alt_text?: string | null;
          sort_order?: number;
        };
        Relationships: Relationship[];
      };
      product_design_links: {
        Row: {
          id: string;
          product_id: string;
          design_project_id: string;
          tenant_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          design_project_id: string;
          tenant_id: string;
        };
        Update: never;
        Relationships: Relationship[];
      };
      product_cost_components: {
        Row: {
          id: string;
          product_variant_id: string;
          tenant_id: string;
          component_key:
            | "blank_garment"
            | "printing"
            | "packaging"
            | "labor"
            | "transaction_estimate"
            | "fulfillment"
            | "other";
          amount_cents: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_variant_id: string;
          tenant_id: string;
          component_key:
            | "blank_garment"
            | "printing"
            | "packaging"
            | "labor"
            | "transaction_estimate"
            | "fulfillment"
            | "other";
          amount_cents?: number;
        };
        Update: {
          amount_cents?: number;
        };
        Relationships: Relationship[];
      };
      product_price_history: {
        Row: {
          id: string;
          product_variant_id: string;
          tenant_id: string;
          retail_price_cents: number | null;
          wholesale_price_cents: number | null;
          compare_at_price_cents: number | null;
          changed_by: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_variant_id: string;
          tenant_id: string;
          retail_price_cents?: number | null;
          wholesale_price_cents?: number | null;
          compare_at_price_cents?: number | null;
          changed_by?: string | null;
          reason?: string | null;
        };
        Update: never;
        Relationships: Relationship[];
      };
      product_status_history: {
        Row: {
          id: string;
          product_id: string;
          tenant_id: string;
          from_status: string | null;
          to_status: string;
          changed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          tenant_id: string;
          from_status?: string | null;
          to_status: string;
          changed_by?: string | null;
        };
        Update: never;
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
