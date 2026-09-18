/**
 * Proves that a member of one tenant cannot read another tenant's private
 * rows via RLS (see supabase/migrations/20260715000000_foundation.sql and
 * docs/SECURITY.md). Requires a running Supabase instance seeded via
 * `supabase db reset` (which applies supabase/seed/seed.sql) plus
 * `npm run seed` (creates the demo auth users). Skips automatically when
 * pointed at the placeholder .env.local values so `npm test` stays green
 * without a live backend — see docs/TESTING.md for how to run this for
 * real, and do not confuse a skip with a pass.
 */
import { describe, expect, it } from "vitest";

import {
  ISOLATION_TENANT_ID,
  KUSHPRINTCO_TENANT_ID,
  TEST_USERS,
  isLiveBackend,
  signInAs,
} from "./helpers";

describe.skipIf(!isLiveBackend)("tenant isolation", () => {
  it("does not let tenant A's owner read tenant B's rows", async () => {
    const client = await signInAs(TEST_USERS.ownerA);

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
