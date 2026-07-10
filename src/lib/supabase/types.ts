/**
 * Hand-written subset of the generated Supabase `Database` type, covering
 * the tables Phase 1 code paths touch. Once a real Supabase project exists,
 * replace this file with `supabase gen types typescript` output (see
 * DATABASE.md) — the shape below intentionally matches what that command
 * produces so the swap is a drop-in.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      profiles: Table<
        {
          id: string;
          username: string | null;
          display_name: string | null;
          avatar_url: string | null;
          country_code: string | null;
          preferred_currency_code: string | null;
          preferred_language: string;
          account_purpose: "buy" | "sell" | "both" | null;
          onboarding_step: string;
          onboarding_completed_at: string | null;
          is_suspended: boolean;
          suspended_reason: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          country_code?: string | null;
          preferred_currency_code?: string | null;
          preferred_language?: string;
          account_purpose?: "buy" | "sell" | "both" | null;
          onboarding_step?: string;
          onboarding_completed_at?: string | null;
        }
      >;
      user_roles: Table<
        { id: string; user_id: string; role: string; granted_by: string | null; created_at: string },
        { user_id: string; role: string; granted_by?: string | null }
      >;
      creator_accounts: Table<
        {
          id: string;
          owner_id: string;
          business_type: string | null;
          plan_code: string;
          country_code: string | null;
          support_email: string | null;
          is_suspended: boolean;
          suspended_reason: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          owner_id: string;
          business_type?: string | null;
          plan_code?: string;
          country_code?: string | null;
          support_email?: string | null;
        }
      >;
      creator_members: Table<
        {
          id: string;
          creator_id: string;
          user_id: string;
          role: string;
          invited_by: string | null;
          invited_at: string;
          accepted_at: string | null;
          created_at: string;
        },
        { creator_id: string; user_id: string; role: string; invited_by?: string | null; accepted_at?: string | null }
      >;
      seller_verifications: Table<
        {
          id: string;
          creator_id: string;
          status: "not_started" | "pending" | "approved" | "restricted" | "rejected";
          submitted_at: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          rejection_reason: string | null;
          documents: Json;
          created_at: string;
          updated_at: string;
        },
        { creator_id: string; status?: string; submitted_at?: string | null; documents?: Json }
      >;
      storefronts: Table<
        {
          id: string;
          creator_id: string;
          slug: string;
          store_name: string;
          tagline: string | null;
          description: string | null;
          category: string | null;
          logo_url: string | null;
          cover_image_url: string | null;
          accent_color: string | null;
          seo_title: string | null;
          seo_description: string | null;
          is_published: boolean;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          creator_id: string;
          slug: string;
          store_name: string;
          tagline?: string | null;
          description?: string | null;
          category?: string | null;
          logo_url?: string | null;
          cover_image_url?: string | null;
          is_published?: boolean;
          published_at?: string | null;
        }
      >;
      storefront_links: Table<
        { id: string; storefront_id: string; label: string; url: string; sort_order: number; created_at: string },
        { storefront_id: string; label: string; url: string; sort_order?: number }
      >;
      followers: Table<
        { id: string; storefront_id: string; follower_id: string; created_at: string },
        { storefront_id: string; follower_id: string }
      >;
      product_categories: Table<
        {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          parent_id: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        },
        { slug: string; name: string; description?: string | null }
      >;
      product_tags: Table<
        { id: string; slug: string; name: string; created_at: string },
        { slug: string; name: string }
      >;
      products: Table<
        {
          id: string;
          creator_id: string;
          category_id: string | null;
          slug: string;
          title: string;
          short_description: string | null;
          full_description: string | null;
          product_type: string;
          status: "draft" | "in_review" | "published" | "rejected" | "unlisted" | "archived" | "suspended";
          visibility: "public" | "unlisted" | "private";
          pricing_model: "fixed" | "pay_what_you_want" | "free";
          base_price_minor: number;
          compare_at_price_minor: number | null;
          pwyw_minimum_minor: number;
          currency_code: string;
          license_type: string | null;
          sales_limit: number | null;
          units_sold: number;
          launch_date: string | null;
          demo_url: string | null;
          refund_policy: string | null;
          support_terms: string | null;
          service_delivery_days: number | null;
          faqs: Json;
          is_marketplace_submitted: boolean;
          published_at: string | null;
          rejected_reason: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          creator_id: string;
          category_id?: string | null;
          slug: string;
          title: string;
          short_description?: string | null;
          full_description?: string | null;
          product_type: string;
          status?: string;
          visibility?: string;
          pricing_model?: string;
          base_price_minor?: number;
          compare_at_price_minor?: number | null;
          pwyw_minimum_minor?: number;
          currency_code?: string;
          license_type?: string | null;
          sales_limit?: number | null;
          launch_date?: string | null;
          demo_url?: string | null;
          refund_policy?: string | null;
          support_terms?: string | null;
          service_delivery_days?: number | null;
          faqs?: Json;
          is_marketplace_submitted?: boolean;
          published_at?: string | null;
          rejected_reason?: string | null;
          created_by: string;
        }
      >;
      product_media: Table<
        {
          id: string;
          product_id: string;
          media_type: "cover" | "gallery" | "preview";
          storage_path: string | null;
          external_url: string | null;
          alt_text: string | null;
          sort_order: number;
          created_at: string;
        },
        {
          product_id: string;
          media_type: string;
          storage_path?: string | null;
          external_url?: string | null;
          alt_text?: string | null;
          sort_order?: number;
        }
      >;
      product_files: Table<
        {
          id: string;
          product_id: string;
          file_name: string;
          storage_path: string;
          size_bytes: number;
          content_type: string | null;
          version: string;
          download_limit: number | null;
          sort_order: number;
          created_at: string;
        },
        {
          product_id: string;
          file_name: string;
          storage_path: string;
          size_bytes: number;
          content_type?: string | null;
          version?: string;
          download_limit?: number | null;
        }
      >;
      product_category_assignments: Table<
        { product_id: string; category_id: string },
        { product_id: string; category_id: string }
      >;
      product_tag_assignments: Table<
        { product_id: string; tag_id: string },
        { product_id: string; tag_id: string }
      >;
      product_submissions: Table<
        {
          id: string;
          product_id: string;
          status: "pending" | "approved" | "rejected" | "changes_requested";
          notes: string | null;
          submitted_by: string;
          submitted_at: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
        },
        { product_id: string; submitted_by: string; notes?: string | null }
      >;
      coupons: Table<
        {
          id: string;
          creator_id: string;
          code: string;
          discount_type: "percentage" | "fixed";
          discount_value: number;
          currency_code: string | null;
          max_redemptions: number | null;
          redemption_count: number;
          starts_at: string;
          expires_at: string | null;
          is_active: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        },
        {
          creator_id: string;
          code: string;
          discount_type: string;
          discount_value: number;
          currency_code?: string | null;
          max_redemptions?: number | null;
          expires_at?: string | null;
          is_active?: boolean;
          created_by: string;
        }
      >;
      coupon_redemptions: Table<
        {
          id: string;
          coupon_id: string;
          order_id: string;
          buyer_id: string | null;
          discount_minor: number;
          created_at: string;
        },
        { coupon_id: string; order_id: string; buyer_id?: string | null; discount_minor: number }
      >;
      platform_fee_rules: Table<
        {
          id: string;
          name: string;
          product_type: string | null;
          country_code: string | null;
          plan_code: string | null;
          percentage_bps: number;
          fixed_fee_minor: number;
          currency_code: string;
          is_active: boolean;
          effective_from: string;
          effective_to: string | null;
          created_at: string;
          updated_at: string;
        },
        { name: string; percentage_bps?: number; fixed_fee_minor?: number; currency_code?: string }
      >;
      checkout_sessions: Table<
        {
          id: string;
          buyer_id: string | null;
          buyer_email: string;
          product_id: string;
          creator_id: string;
          coupon_id: string | null;
          affiliate_link_code: string | null;
          pwyw_amount_minor: number | null;
          currency_code: string;
          subtotal_minor: number;
          discount_minor: number;
          platform_fee_minor: number;
          tax_minor: number;
          total_minor: number;
          status: "open" | "completed" | "expired" | "cancelled";
          completed_order_id: string | null;
          created_at: string;
          expires_at: string;
        },
        {
          buyer_id?: string | null;
          buyer_email: string;
          product_id: string;
          creator_id: string;
          coupon_id?: string | null;
          pwyw_amount_minor?: number | null;
          currency_code: string;
          subtotal_minor: number;
          discount_minor?: number;
          platform_fee_minor?: number;
          tax_minor?: number;
          total_minor: number;
          status?: string;
        }
      >;
      orders: Table<
        {
          id: string;
          order_number: string;
          checkout_session_id: string | null;
          buyer_id: string | null;
          buyer_email: string;
          creator_id: string;
          currency_code: string;
          subtotal_minor: number;
          discount_minor: number;
          platform_fee_minor: number;
          tax_minor: number;
          total_minor: number;
          coupon_id: string | null;
          affiliate_link_code: string | null;
          status: "pending" | "processing" | "paid" | "fulfilled" | "partially_refunded" | "refunded" | "failed" | "disputed" | "cancelled";
          created_at: string;
          updated_at: string;
        },
        {
          order_number: string;
          checkout_session_id?: string | null;
          buyer_id?: string | null;
          buyer_email: string;
          creator_id: string;
          currency_code: string;
          subtotal_minor: number;
          discount_minor?: number;
          platform_fee_minor?: number;
          tax_minor?: number;
          total_minor: number;
          coupon_id?: string | null;
          status?: string;
        }
      >;
      order_items: Table<
        {
          id: string;
          order_id: string;
          product_id: string;
          product_title_snapshot: string;
          product_type_snapshot: string;
          unit_price_minor: number;
          quantity: number;
          line_subtotal_minor: number;
          creator_net_minor: number;
          platform_fee_minor: number;
          created_at: string;
        },
        {
          order_id: string;
          product_id: string;
          product_title_snapshot: string;
          product_type_snapshot: string;
          unit_price_minor: number;
          quantity?: number;
          line_subtotal_minor: number;
          creator_net_minor: number;
          platform_fee_minor?: number;
        }
      >;
      payments: Table<
        {
          id: string;
          order_id: string;
          provider: "mock" | "stripe" | "paystack" | "flutterwave";
          provider_reference: string | null;
          status: "requires_payment" | "processing" | "succeeded" | "failed" | "refunded" | "partially_refunded";
          amount_minor: number;
          currency_code: string;
          failure_reason: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          order_id: string;
          provider: string;
          provider_reference?: string | null;
          status?: string;
          amount_minor: number;
          currency_code: string;
          failure_reason?: string | null;
        }
      >;
      payment_events: Table<
        {
          id: string;
          payment_id: string | null;
          provider: string;
          provider_event_id: string;
          event_type: string;
          payload: Json;
          processed_at: string | null;
          processing_error: string | null;
          created_at: string;
        },
        {
          payment_id?: string | null;
          provider: string;
          provider_event_id: string;
          event_type: string;
          payload?: Json;
          processed_at?: string | null;
        }
      >;
      entitlements: Table<
        {
          id: string;
          order_item_id: string;
          product_id: string;
          buyer_id: string;
          status: "active" | "revoked" | "expired";
          download_limit: number | null;
          downloads_used: number;
          expires_at: string | null;
          revoked_reason: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          order_item_id: string;
          product_id: string;
          buyer_id: string;
          status?: string;
          download_limit?: number | null;
        }
      >;
      download_events: Table<
        {
          id: string;
          entitlement_id: string;
          product_file_id: string | null;
          buyer_id: string;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        },
        {
          entitlement_id: string;
          product_file_id?: string | null;
          buyer_id: string;
          ip_address?: string | null;
          user_agent?: string | null;
        }
      >;
      ledger_entries: Table<
        {
          id: string;
          entry_type: string;
          direction: "debit" | "credit";
          amount_minor: number;
          currency_code: string;
          order_id: string | null;
          payment_id: string | null;
          creator_id: string | null;
          affiliate_id: string | null;
          provider: string | null;
          provider_reference: string | null;
          status: string;
          metadata: Json;
          created_at: string;
        },
        {
          entry_type: string;
          direction: string;
          amount_minor: number;
          currency_code: string;
          order_id?: string | null;
          payment_id?: string | null;
          creator_id?: string | null;
          provider?: string | null;
          metadata?: Json;
        }
      >;
      creator_balances: Table<
        {
          creator_id: string;
          currency_code: string;
          available_minor: number;
          pending_minor: number;
          lifetime_earnings_minor: number;
          updated_at: string;
        },
        {
          creator_id: string;
          currency_code: string;
          available_minor?: number;
          pending_minor?: number;
          lifetime_earnings_minor?: number;
        }
      >;
      customers: Table<
        {
          id: string;
          creator_id: string;
          buyer_id: string | null;
          email: string;
          first_order_at: string;
          last_order_at: string;
          orders_count: number;
          lifetime_spend_minor: number;
          currency_code: string | null;
          created_at: string;
          updated_at: string;
        },
        { creator_id: string; buyer_id?: string | null; email: string; currency_code?: string | null }
      >;
      countries: Table<
        {
          code: string;
          name: string;
          default_currency_code: string | null;
          is_launch_market: boolean;
          is_active: boolean;
          sort_order: number;
        },
        { code: string; name: string }
      >;
      currencies: Table<
        { code: string; name: string; minor_unit_exponent: number; is_active: boolean },
        { code: string; name: string }
      >;
      platform_plans: Table<
        {
          id: string;
          code: string;
          name: string;
          description: string | null;
          monthly_price_minor: number;
          annual_price_minor: number;
          currency_code: string;
          max_active_products: number | null;
          default_transaction_fee_bps: number;
          features: Json;
          is_active: boolean;
          sort_order: number;
        },
        { code: string; name: string }
      >;
      audit_logs: Table<
        {
          id: string;
          actor_id: string | null;
          actor_role: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          before_state: Json | null;
          after_state: Json | null;
          metadata: Json;
          ip_address: string | null;
          created_at: string;
        },
        {
          actor_id?: string | null;
          actor_role?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          before_state?: Json | null;
          after_state?: Json | null;
          metadata?: Json;
        }
      >;
      analytics_events: Table<
        {
          id: string;
          event_name: string;
          actor_id: string | null;
          creator_id: string | null;
          product_id: string | null;
          session_id: string | null;
          properties: Json;
          created_at: string;
        },
        {
          event_name: string;
          actor_id?: string | null;
          creator_id?: string | null;
          product_id?: string | null;
          session_id?: string | null;
          properties?: Json;
        }
      >;
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
