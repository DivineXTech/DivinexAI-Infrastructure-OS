/**
 * Hand-written types mirroring supabase/migrations/0001_init.sql.
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
