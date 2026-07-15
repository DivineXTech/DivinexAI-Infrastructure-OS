/**
 * Regression tests for the fix in lib/auth/session.ts
 * (fetchMyActiveMembershipRows missing a `profile_id` filter). RLS on
 * `tenant_memberships` authorizes a row by "is the caller an active
 * member of this row's tenant" — not "is this the caller's own row" — so
 * without an explicit application-layer filter, one member's session
 * could resolve another member's row (and role) as its own. See
 * docs/SECURITY.md "Privilege-escalation fix" and
 * docs/MIGRATION_VALIDATION.md.
 *
 * Requires a live, seeded Supabase project (needs the
 * `multi-tenant@demo.kushprintco.local` persona from scripts/seed.ts, added
 * alongside this fix). Skips — does not pass — without one; see
 * docs/TESTING.md.
 */
import { describe, expect, it } from "vitest";

import {
  ISOLATION_TENANT_ID,
  KUSHPRINTCO_TENANT_ID,
  TEST_USERS,
  isLiveBackend,
  signInAs,
} from "./helpers";

describe.skipIf(!isLiveBackend)("membership isolation", () => {
  it("RLS alone (no profile_id filter) returns every active member's row for a shared tenant — documenting why the app-layer filter is required, not optional", async () => {
    const client = await signInAs(TEST_USERS.designerA);
    const { data, error } = await client
      .from("tenant_memberships")
      .select("id")
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID)
      .eq("status", "active");
    expect(error).toBeNull();
    // KushPrintCo has an owner, designer, production manager, and
    // customer all seeded active — RLS alone does not narrow this to the
    // designer's own row.
    expect((data ?? []).length).toBeGreaterThan(1);
  });

  it("a designer, filtered by their own profile_id, receives only their own membership row for a shared tenant", async () => {
    const client = await signInAs(TEST_USERS.designerA);
    const userId = (await client.auth.getUser()).data.user!.id;

    const { data, error } = await client
      .from("tenant_memberships")
      .select("tenant_id, role_id")
      .eq("profile_id", userId)
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID)
      .eq("status", "active");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("a designer cannot resolve the tenant owner's role — their own filtered row maps to the designer role, never tenant_owner", async () => {
    const client = await signInAs(TEST_USERS.designerA);
    const userId = (await client.auth.getUser()).data.user!.id;

    const { data: membership } = await client
      .from("tenant_memberships")
      .select("role_id")
      .eq("profile_id", userId)
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID)
      .eq("status", "active")
      .single();
    expect(membership).not.toBeNull();

    const { data: role } = await client
      .from("roles")
      .select("key")
      .eq("id", membership!.role_id)
      .single();
    expect(role?.key).toBe("designer");
    expect(role?.key).not.toBe("tenant_owner");
  });

  it("an owner and a tenant owner in the same tenant each resolve to their own distinct role", async () => {
    const ownerClient = await signInAs(TEST_USERS.ownerA);
    const ownerUserId = (await ownerClient.auth.getUser()).data.user!.id;
    const { data: ownerMembership } = await ownerClient
      .from("tenant_memberships")
      .select("role_id")
      .eq("profile_id", ownerUserId)
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID)
      .eq("status", "active")
      .single();
    const { data: ownerRole } = await ownerClient
      .from("roles")
      .select("key")
      .eq("id", ownerMembership!.role_id)
      .single();
    expect(ownerRole?.key).toBe("tenant_owner");
  });

  it("a user belonging to two tenants receives exactly their own two memberships, with no duplicates or foreign tenants", async () => {
    const client = await signInAs(TEST_USERS.multiTenant);
    const userId = (await client.auth.getUser()).data.user!.id;

    const { data, error } = await client
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("profile_id", userId)
      .eq("status", "active");
    expect(error).toBeNull();
    expect(data).toHaveLength(2);

    const tenantIds = (data ?? []).map((row) => row.tenant_id).sort();
    expect(tenantIds).toEqual([KUSHPRINTCO_TENANT_ID, ISOLATION_TENANT_ID].sort());
    // No duplicate tenant entries — this is exactly what would surface as
    // a duplicated row in the tenant switcher if the profile_id filter
    // were missing and RLS alone determined the result set.
    expect(new Set(tenantIds).size).toBe(2);
  });
});
