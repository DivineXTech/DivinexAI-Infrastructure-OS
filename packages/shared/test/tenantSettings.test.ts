import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { asUser, resetAndMigrate } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { PgTenantAccessEvaluator } from "../src/policy.js";
import { PgTenantSettingsService } from "../src/tenantSettings.js";
import { TenantAuthorizationError } from "../src/tenant.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test";
const TEST_DATABASE_URL_AUTHENTICATED =
  process.env.TEST_DATABASE_URL_AUTHENTICATED ??
  "postgres://authenticated:authenticated@127.0.0.1:5432/agentflow_test";

const ownerPool = new Pool({ connectionString: TEST_DATABASE_URL });
const authPool = new Pool({ connectionString: TEST_DATABASE_URL_AUTHENTICATED });

let fixtures: CoreFixtures;
const service = new PgTenantSettingsService(ownerPool, new PgTenantAccessEvaluator(ownerPool));

beforeAll(async () => {
  await resetAndMigrate(ownerPool);
  fixtures = await seedCoreFixtures(ownerPool);
});

afterAll(async () => {
  await ownerPool.end();
  await authPool.end();
});

describe("PgTenantSettingsService", () => {
  it("get() returns an empty object when no settings row exists yet", async () => {
    const settings = await service.get(fixtures.tenantA);
    expect(settings).toEqual({});
  });

  it("update() rejects a caller without the tenant.manage permission", async () => {
    await expect(
      service.update({
        tenantId: fixtures.tenantA,
        userId: fixtures.userAMember,
        patch: { theme: "hacked" },
      }),
    ).rejects.toThrow(TenantAuthorizationError);

    const settings = await service.get(fixtures.tenantA);
    expect(settings).toEqual({});
  });

  it("update() rejects a caller who is not a member of the target tenant at all", async () => {
    await expect(
      service.update({
        tenantId: fixtures.tenantB,
        userId: fixtures.userAOwner,
        patch: { theme: "cross-tenant" },
      }),
    ).rejects.toThrow(TenantAuthorizationError);
  });

  it("update() succeeds for a caller with tenant.manage and merges into existing settings", async () => {
    await service.update({
      tenantId: fixtures.tenantA,
      userId: fixtures.userAOwner,
      patch: { theme: "dark" },
    });
    expect(await service.get(fixtures.tenantA)).toEqual({ theme: "dark" });

    await service.update({
      tenantId: fixtures.tenantA,
      userId: fixtures.userAOwner,
      patch: { locale: "en-US" },
    });
    expect(await service.get(fixtures.tenantA)).toEqual({ theme: "dark", locale: "en-US" });
  });

  it("a permitted update via the service also satisfies RLS when read back through the restricted role", async () => {
    const rows = await asUser(authPool, fixtures.userAOwner, async (client) => {
      const res = await client.query("select settings from tenant_settings where tenant_id = $1", [
        fixtures.tenantA,
      ]);
      return res.rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.settings).toEqual({ theme: "dark", locale: "en-US" });
  });
});
