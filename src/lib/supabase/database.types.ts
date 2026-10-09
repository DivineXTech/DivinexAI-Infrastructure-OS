/**
 * Hand-written types mirroring supabase/migrations/*.sql.
 *
 * If you evolve the schema, regenerate with the Supabase CLI instead of
 * editing by hand: `supabase gen types typescript --linked > src/lib/supabase/database.types.ts`
 */
export interface Database {
  public: {
    Tables: {
      subscribers: {
        Row: {
          id: string;
          first_name: string;
          last_name: string | null;
          email: string;
          phone: string | null;
          country: string | null;
          marketing_consent: boolean;
          terms_accepted: boolean;
          accepted_early_access_terms_at: string;
          referral_code: string;
          referred_by: string | null;
          social_follow_confirmed: boolean;
          social_like_confirmed: boolean;
          social_share_confirmed: boolean;
          chapter12_accessed_at: string | null;
          chapter12_access_revoked: boolean;
          unsubscribed: boolean;
          unsubscribed_at: string | null;
          source: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["subscribers"]["Row"]> & {
          first_name: string;
          email: string;
          referral_code: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscribers"]["Row"]>;
        Relationships: [];
      };
      reward_grants: {
        Row: {
          id: string;
          subscriber_id: string;
          milestone_id: string;
          qualified_count_at_grant: number;
          status: "pending_review" | "approved" | "denied" | "fulfilled";
          fraud_flag: boolean;
          fraud_reason: string | null;
          denied_reason: string | null;
          approved_by: string | null;
          approved_at: string | null;
          fulfilled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["reward_grants"]["Row"]> & {
          subscriber_id: string;
          milestone_id: string;
          qualified_count_at_grant: number;
          status: "pending_review" | "approved" | "denied" | "fulfilled";
        };
        Update: Partial<Database["public"]["Tables"]["reward_grants"]["Row"]>;
        Relationships: [];
      };
      email_logs: {
        Row: {
          id: string;
          subscriber_id: string | null;
          email_type: string;
          to_email: string;
          delivered: boolean;
          simulated: boolean;
          error: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["email_logs"]["Row"]> & {
          email_type: string;
          to_email: string;
          delivered: boolean;
          simulated: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["email_logs"]["Row"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor: string;
          action: string;
          target: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]> & {
          actor: string;
          action: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]>;
        Relationships: [];
      };
      purchases: {
        Row: {
          id: string;
          subscriber_id: string | null;
          email: string;
          stripe_session_id: string;
          stripe_payment_intent_id: string | null;
          amount_cents: number;
          currency: string;
          status: "pending" | "paid" | "fulfilled" | "refunded";
          fulfilled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["purchases"]["Row"]> & {
          email: string;
          stripe_session_id: string;
          amount_cents: number;
          currency: string;
          status: "pending" | "paid" | "fulfilled" | "refunded";
        };
        Update: Partial<Database["public"]["Tables"]["purchases"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
