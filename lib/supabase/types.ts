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
