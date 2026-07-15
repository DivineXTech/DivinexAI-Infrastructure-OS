/**
 * Broader RLS/authorization proof beyond basic cross-tenant select denial
 * (see tenant-isolation.test.ts for that). Covers the specific scenarios
 * called out in the Phase 1.5 spec: cross-tenant write denial, self
 * role-escalation prevention (both the platform-super-admin trigger fix
 * and tenant self-assignment), designer-cannot-do-owner-ops, no-membership
 * denial, and explicit platform-super-admin behavior. Requires a live,
 * seeded Supabase project — see docs/TESTING.md. Skips (does not pass)
 * without one.
 */
import { describe, expect, it } from "vitest";

import {
  ISOLATION_TENANT_ID,
  KUSHPRINTCO_TENANT_ID,
  TEST_USERS,
  isLiveBackend,
  signInAs,
} from "./helpers";

describe.skipIf(!isLiveBackend)("RLS authorization", () => {
  it("does not let tenant A's owner insert a membership row into tenant B", async () => {
    const client = await signInAs(TEST_USERS.ownerA);
    const { error } = await client.from("tenant_memberships").insert({
      tenant_id: ISOLATION_TENANT_ID,
      profile_id: (await client.auth.getUser()).data.user!.id,
      // Arbitrary well-formed UUID — RLS must reject this insert before a
      // foreign-key check on role_id would ever matter.
      role_id: "00000000-0000-0000-0000-000000000000",
      status: "active",
    });
    expect(error).not.toBeNull();
  });

  it("does not let tenant A's owner update tenant B's tenant row", async () => {
    const client = await signInAs(TEST_USERS.ownerA);
    const { data, error } = await client
      .from("tenants")
      .update({ name: "Hijacked" })
      .eq("id", ISOLATION_TENANT_ID)
      .select();
    // RLS makes the target row invisible to the update rather than raising,
    // so the assertion is "zero rows affected", not necessarily an error.
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("does not let tenant A's owner delete tenant B's membership rows", async () => {
    const client = await signInAs(TEST_USERS.ownerA);
    const { data, error } = await client
      .from("tenant_memberships")
      .delete()
      .eq("tenant_id", ISOLATION_TENANT_ID)
      .select();
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("does not let a user flip their own is_platform_super_admin (privilege escalation)", async () => {
    const client = await signInAs(TEST_USERS.ownerA);
    const userId = (await client.auth.getUser()).data.user!.id;
    const { error } = await client
      .from("profiles")
      .update({ is_platform_super_admin: true })
      .eq("id", userId);
    // Must fail loudly — supabase/migrations/20260716010000_prevent_privilege_escalation.sql
    expect(error).not.toBeNull();

    const { data: profile } = await client
      .from("profiles")
      .select("is_platform_super_admin")
      .eq("id", userId)
      .single();
    expect(profile?.is_platform_super_admin).toBe(false);
  });

  it("does not let a designer perform an owner-only tenants update", async () => {
    const client = await signInAs(TEST_USERS.designerA);
    const { data, error } = await client
      .from("tenants")
      .update({ name: "Designer Was Here" })
      .eq("id", KUSHPRINTCO_TENANT_ID)
      .select();
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("returns zero rows from every tenant-owned table for a user with no membership", async () => {
    const client = await signInAs(TEST_USERS.noTenant);

    const { data: tenants, error: tenantsError } = await client
      .from("tenants")
      .select("id");
    expect(tenantsError).toBeNull();
    expect(tenants).toEqual([]);

    const { data: memberships, error: membershipsError } = await client
      .from("tenant_memberships")
      .select("id");
    expect(membershipsError).toBeNull();
    expect(memberships).toEqual([]);
  });

  it("lets a platform super admin read a tenant they have no membership in", async () => {
    const client = await signInAs(TEST_USERS.superAdmin);
    const { data, error } = await client
      .from("tenants")
      .select("id")
      .eq("id", ISOLATION_TENANT_ID)
      .maybeSingle();
    expect(error).toBeNull();
    // Explicit platform-level access, not membership-based — see
    // docs/ROLES_AND_PERMISSIONS.md "Platform Super Admin is two checks."
    expect(data).not.toBeNull();
  });
});
