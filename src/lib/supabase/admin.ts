import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getEnv } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS entirely — this is the only client
 * allowed to write orders, payments, entitlements, and ledger entries.
 * Never import this module from a Client Component or expose the key to
 * the browser.
 */
export function createSupabaseAdminClient() {
  const env = getEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase admin client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
