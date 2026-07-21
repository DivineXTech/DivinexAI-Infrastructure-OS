import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env.js";

/**
 * Server-only client authenticated as the Supabase service role. This BYPASSES
 * Row-Level Security entirely, per Supabase's own semantics — every query
 * issued through it must re-check tenant membership explicitly in application
 * code (see `assertTenantMembership` in `tenant.ts`). Never import this module
 * from client-side/browser code; `SUPABASE_SERVICE_ROLE_KEY` must never ship
 * in a browser bundle (source brief rule #9).
 */
export function createServiceRoleClient(): SupabaseClient {
  const env = getEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Request-scoped client authenticated as the calling end user (their access
 * token, forwarded from the request). Row-Level Security applies exactly as
 * it does for any other Supabase client using this token — this is the
 * preferred way to read/write tenant-owned data, since RLS enforcement
 * happens at the database layer without any application code needing to
 * remember to check it.
 */
export function createUserScopedClient(accessToken: string): SupabaseClient {
  const env = getEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}
