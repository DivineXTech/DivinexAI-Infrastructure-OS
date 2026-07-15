/**
 * Shared plumbing for the Phase 1.5 integration test suite. All of these
 * tests exercise a real Supabase project (RLS, Storage policies, auth) —
 * see docs/TESTING.md and docs/SECURITY.md for what "skip" means here vs.
 * an actual pass, and don't confuse the two.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isLiveBackend =
  !!SUPABASE_URL &&
  !!ANON_KEY &&
  !SUPABASE_URL.includes("placeholder") &&
  ANON_KEY !== "placeholder-anon-key";

export const hasServiceRole = isLiveBackend && !!SERVICE_ROLE_KEY;

export const KUSHPRINTCO_TENANT_ID = "11111111-1111-1111-1111-111111111111";
export const ISOLATION_TENANT_ID = "22222222-2222-2222-2222-222222222222";

export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? "demo-password-123!";

export const TEST_USERS = {
  superAdmin: process.env.TEST_USER_SUPER_ADMIN_EMAIL ?? "admin@demo.kushprintco.local",
  ownerA: process.env.TEST_USER_OWNER_A_EMAIL ?? "owner@demo.kushprintco.local",
  designerA:
    process.env.TEST_USER_DESIGNER_A_EMAIL ?? "designer@demo.kushprintco.local",
  productionA:
    process.env.TEST_USER_PRODUCTION_A_EMAIL ?? "production@demo.kushprintco.local",
  ownerB:
    process.env.TEST_USER_OWNER_B_EMAIL ?? "owner@demo.isolation-tenant.local",
  noTenant:
    process.env.TEST_USER_NO_TENANT_EMAIL ?? "no-tenant@demo.kushprintco.local",
} as const;

/** A fresh anon-key client, signed in as the given seeded persona. */
export async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL!, ANON_KEY!);
  const { error } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (error) {
    throw new Error(`Failed to sign in as ${email}: ${error.message}`);
  }
  return client;
}

export function serviceRoleClient(): SupabaseClient {
  return createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
