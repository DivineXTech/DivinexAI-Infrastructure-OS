/**
 * Proves that a member of one tenant cannot read another tenant's private
 * rows via RLS (see supabase/migrations/20260715000000_foundation.sql and
 * docs/SECURITY.md). Requires a running Supabase instance seeded via
 * `supabase db reset` (which applies supabase/seed/seed.sql) plus
 * `npm run seed` (creates the two demo tenant-owner auth users). Skips
 * automatically when pointed at the placeholder .env.local values so
 * `npm test` stays green without a live backend — see docs/TESTING.md for
 * how to run this for real.
 */
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isLiveBackend =
  !!SUPABASE_URL &&
  !!ANON_KEY &&
  !SUPABASE_URL.includes("placeholder") &&
  ANON_KEY !== "placeholder-anon-key";

const KUSHPRINTCO_TENANT_ID = "11111111-1111-1111-1111-111111111111";
const ISOLATION_TENANT_ID = "22222222-2222-2222-2222-222222222222";
const DEMO_PASSWORD = "demo-password-123!";

describe.skipIf(!isLiveBackend)("tenant isolation", () => {
  it("does not let tenant A's owner read tenant B's membership rows", async () => {
    const client = createClient(SUPABASE_URL!, ANON_KEY!);
    const { error: signInError } = await client.auth.signInWithPassword({
      email: "owner@demo.kushprintco.local",
      password: DEMO_PASSWORD,
    });
    expect(signInError).toBeNull();

    const { data: ownTenant, error: ownError } = await client
      .from("tenants")
      .select("id")
      .eq("id", KUSHPRINTCO_TENANT_ID)
      .maybeSingle();
    expect(ownError).toBeNull();
    expect(ownTenant).not.toBeNull();

    const { data: otherTenant, error: otherError } = await client
      .from("tenants")
      .select("id")
      .eq("id", ISOLATION_TENANT_ID)
      .maybeSingle();
    expect(otherError).toBeNull();
    expect(otherTenant).toBeNull();

    const { data: otherMemberships, error: membershipError } = await client
      .from("tenant_memberships")
      .select("id")
      .eq("tenant_id", ISOLATION_TENANT_ID);
    expect(membershipError).toBeNull();
    expect(otherMemberships).toEqual([]);
  });
});
