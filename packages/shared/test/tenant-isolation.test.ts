import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { asUser, resetAndMigrate } from "./setupTestDb.js";
import { seedCoreFixtures } from "./seedFixtures.js";

/**
 * Exercises the RLS policies in
 * `supabase/migrations/20260721000001_core_tenancy.sql` against a real
 * Postgres instance (not mocked) — see `ADR-0012`. `ownerPool` seeds data the
 * way a service-role client or a migration seed script would (bypassing
 * RLS by connecting as the table owner); `authPool` is the restricted
 * `authenticated` role that real end-user requests use, so RLS is actually
 * enforced for every assertion below.
 */

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test";
const TEST_DATABASE_URL_AUTHENTICATED =
  process.env.TEST_DATABASE_URL_AUTHENTICATED ??
  "postgres://authenticated:authenticated@127.0.0.1:5432/agentflow_test";

const ownerPool = new Pool({ connectionString: TEST_DATABASE_URL });
const authPool = new Pool({ connectionString: TEST_DATABASE_URL_AUTHENTICATED });

let tenantA: string;
let tenantB: string;
let userAOwner: string; // member of tenant A with the "owner" role (has tenant.manage*)
let userAMember: string; // member of tenant A with the plain "member" role (no elevated perms)
let userB: string; // member of tenant B only

beforeAll(async () => {
  await resetAndMigrate(ownerPool);
  ({ tenantA, tenantB, userAOwner, userAMember, userB } = await seedCoreFixtures(ownerPool));

  await ownerPool.query(
    "insert into tenant_settings (tenant_id, settings) values ($1, $2::jsonb), ($3, $4::jsonb)",
    [tenantA, JSON.stringify({ theme: "a" }), tenantB, JSON.stringify({ theme: "b" })],
  );
  await ownerPool.query(
    "insert into tenant_feature_flags (tenant_id, key, enabled) values ($1, 'beta', true), ($2, 'beta', false)",
    [tenantA, tenantB],
  );
});

afterAll(async () => {
  await ownerPool.end();
  await authPool.end();
});

describe("tenant isolation (RLS)", () => {
  it("an authenticated member sees only their own tenant in `tenants`", async () => {
    const rows = await asUser(authPool, userAOwner, async (client) => {
      const res = await client.query("select id, name from tenants order by name");
      return res.rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(tenantA);
  });

  it("a user with no JWT claim (unauthenticated) sees no tenants", async () => {
    const rows = await asUser(authPool, null, async (client) => {
      const res = await client.query("select id from tenants");
      return res.rows;
    });
    expect(rows).toHaveLength(0);
  });

  it("a member cannot see another tenant's membership rows", async () => {
    const rows = await asUser(authPool, userAOwner, async (client) => {
      const res = await client.query("select tenant_id, user_id from tenant_memberships");
      return res.rows;
    });
    expect(rows.every((r) => r.tenant_id === tenantA)).toBe(true);
    expect(rows.some((r) => r.user_id === userB)).toBe(false);
  });

  it("a member sees only their own tenant's settings", async () => {
    const rows = await asUser(authPool, userAOwner, async (client) => {
      const res = await client.query("select tenant_id, settings from tenant_settings");
      return res.rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tenant_id).toBe(tenantA);
    expect(rows[0]!.settings).toEqual({ theme: "a" });
  });

  it("a plain member (no tenant.manage) cannot update their own tenant's settings", async () => {
    const result = await asUser(authPool, userAMember, async (client) =>
      client.query(
        "update tenant_settings set settings = '{\"theme\":\"hacked\"}' where tenant_id = $1",
        [tenantA],
      ),
    );
    expect(result.rowCount).toBe(0);

    const stillOriginal = await asUser(authPool, userAOwner, async (client) => {
      const res = await client.query(
        "select settings from tenant_settings where tenant_id = $1",
        [tenantA],
      );
      return res.rows[0]!.settings;
    });
    expect(stillOriginal).toEqual({ theme: "a" });
  });

  it("an owner (has tenant.manage) can update their own tenant's settings", async () => {
    const result = await asUser(authPool, userAOwner, async (client) =>
      client.query("update tenant_settings set settings = $1 where tenant_id = $2", [
        { theme: "updated-by-owner" },
        tenantA,
      ]),
    );
    expect(result.rowCount).toBe(1);
  });

  it("an owner of tenant A cannot update tenant B's settings even with the right permission shape", async () => {
    const result = await asUser(authPool, userAOwner, async (client) =>
      client.query("update tenant_settings set settings = $1 where tenant_id = $2", [
        { theme: "cross-tenant-attack" },
        tenantB,
      ]),
    );
    expect(result.rowCount).toBe(0);

    const stillOriginal = await asUser(authPool, userB, async (client) => {
      const res = await client.query(
        "select settings from tenant_settings where tenant_id = $1",
        [tenantB],
      );
      return res.rows[0]!.settings;
    });
    expect(stillOriginal).toEqual({ theme: "b" });
  });

  it("a member cannot insert a membership row for another tenant, even knowing its role id (privilege escalation attempt)", async () => {
    // Fetched via the owner/service-role connection to simulate an attacker
    // who already knows tenant B's role id (e.g. leaked elsewhere) — the
    // real defense here must be the RLS policy on the INSERT itself, not
    // merely that `roles` hides the id via its own SELECT policy.
    const { rows } = await ownerPool.query<{ id: string }>(
      "select id from roles where tenant_id = $1 and key = 'owner'",
      [tenantB],
    );
    const tenantBOwnerRoleId = rows[0]!.id;

    await expect(
      asUser(authPool, userAOwner, async (client) =>
        client.query(
          "insert into tenant_memberships (tenant_id, user_id, role_id) values ($1, $2, $3)",
          [tenantB, userAOwner, tenantBOwnerRoleId],
        ),
      ),
    ).rejects.toThrow();
  });

  it("feature flags: a member sees their tenant's flag but not another tenant's", async () => {
    const rows = await asUser(authPool, userAOwner, async (client) => {
      const res = await client.query(
        "select tenant_id, enabled from tenant_feature_flags where key = 'beta'",
      );
      return res.rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tenant_id).toBe(tenantA);
    expect(rows[0]!.enabled).toBe(true);
  });
});
