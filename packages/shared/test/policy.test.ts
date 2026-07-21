import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { resetAndMigrate } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { PgTenantAccessEvaluator } from "../src/policy.js";

/**
 * Contract tests for the deterministic `TenantAccessEvaluator`
 * (`src/policy.ts`). Run against the owner/superuser connection deliberately
 * — this evaluator exists precisely for service-role-equivalent code paths
 * that bypass RLS, so its correctness must not depend on RLS being present.
 */

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const evaluator = new PgTenantAccessEvaluator(pool);

let fixtures: CoreFixtures;

beforeAll(async () => {
  await resetAndMigrate(pool);
  fixtures = await seedCoreFixtures(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("PgTenantAccessEvaluator", () => {
  it("allows membership check for an active member", async () => {
    const decision = await evaluator.checkMembership({
      tenantId: fixtures.tenantA,
      userId: fixtures.userAOwner,
    });
    expect(decision).toEqual({ allowed: true });
  });

  it("denies membership check for a non-member", async () => {
    const decision = await evaluator.checkMembership({
      tenantId: fixtures.tenantB,
      userId: fixtures.userAOwner,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe("not_an_active_tenant_member");
    }
  });

  it("allows a permission check for a member whose role grants it", async () => {
    const decision = await evaluator.checkPermission({
      tenantId: fixtures.tenantA,
      userId: fixtures.userAOwner,
      permissionKey: "tenant.manage",
    });
    expect(decision).toEqual({ allowed: true });
  });

  it("denies a permission check for a member whose role does not grant it", async () => {
    const decision = await evaluator.checkPermission({
      tenantId: fixtures.tenantA,
      userId: fixtures.userAMember,
      permissionKey: "tenant.manage",
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe("missing_permission:tenant.manage");
    }
  });

  it("denies a permission check for a user with the right permission in a different tenant", async () => {
    // userB is an "owner" (has tenant.manage) in tenant B, not tenant A.
    const decision = await evaluator.checkPermission({
      tenantId: fixtures.tenantA,
      userId: fixtures.userB,
      permissionKey: "tenant.manage",
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe("not_an_active_tenant_member");
    }
  });

  it("denies a permission check for an unknown permission key", async () => {
    const decision = await evaluator.checkPermission({
      tenantId: fixtures.tenantA,
      userId: fixtures.userAOwner,
      permissionKey: "tenant.does_not_exist",
    });
    expect(decision.allowed).toBe(false);
  });
});
