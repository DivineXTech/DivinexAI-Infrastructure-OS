import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

let cachedClient: SupabaseClient<Database> | null = null;

/**
 * Server-only Supabase client authenticated with the service role key.
 * Row-Level Security locks the `subscribers` table to service-role access
 * only (see supabase/migrations/0001_init.sql), so this client — used
 * exclusively from API routes and Server Components — is the sole path to
 * subscriber data.
 *
 * Returns `null` when Supabase env vars are not configured, so callers can
 * fall back to the in-memory dev store (see `src/lib/store`).
 */
export function getSupabaseAdmin(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) return null;
  if (cachedClient) return cachedClient;

  cachedClient = createClient<Database>(env.supabaseUrl!, env.supabaseServiceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}
