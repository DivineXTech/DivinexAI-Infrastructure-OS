import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { resetAndMigrate } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { PgFeatureFlagService } from "../src/featureFlags.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const flags = new PgFeatureFlagService(pool);

let fixtures: CoreFixtures;

beforeAll(async () => {
  await resetAndMigrate(pool);
  fixtures = await seedCoreFixtures(pool);

  // Platform-wide default: disabled.
  await pool.query(
    "insert into tenant_feature_flags (tenant_id, key, enabled) values (null, 'new-dashboard', false)",
  );
  // Tenant A overrides it on; tenant B has no override (falls back to the
  // platform default).
  await pool.query(
    "insert into tenant_feature_flags (tenant_id, key, enabled) values ($1, 'new-dashboard', true)",
    [fixtures.tenantA],
  );
});

afterAll(async () => {
  await pool.end();
});

describe("PgFeatureFlagService", () => {
  it("returns the tenant-specific override when one exists", async () => {
    const enabled = await flags.isEnabled({ tenantId: fixtures.tenantA, key: "new-dashboard" });
    expect(enabled).toBe(true);
  });

  it("falls back to the platform-wide default when no tenant override exists", async () => {
    const enabled = await flags.isEnabled({ tenantId: fixtures.tenantB, key: "new-dashboard" });
    expect(enabled).toBe(false);
  });

  it("returns false for an unknown flag key with no platform default", async () => {
    const enabled = await flags.isEnabled({ tenantId: fixtures.tenantA, key: "does-not-exist" });
    expect(enabled).toBe(false);
  });
});
