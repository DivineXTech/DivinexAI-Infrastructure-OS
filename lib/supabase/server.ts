import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { serverEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Server-side Supabase client bound to the current request's cookies.
 * Uses the anon key + RLS for normal request-scoped access — this is the
 * client every Server Component, Server Action, and Route Handler should
 * use. Never pass the service-role key through this factory.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component with no response to write to
            // (e.g. during a prefetch). Safe to ignore when session
            // refresh is also handled in `proxy.ts`.
          }
        },
      },
    },
  );
}

/**
 * Service-role client for privileged, server-only operations (admin tooling,
 * background jobs). Bypasses RLS entirely — never import this from code
 * that is reachable by a Client Component, and never expose its output
 * without re-applying tenant/role checks in application code.
 */
export function createSupabaseServiceRoleClient() {
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Service-role access is unavailable in this environment.",
    );
  }

  return createServerClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // Service-role client is not request-bound; no cookies to write.
        },
      },
    },
  );
}
