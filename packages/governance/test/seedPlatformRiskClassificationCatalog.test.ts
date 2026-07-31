import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { resetAndMigrate } from "./setupTestDb.js";
import {
  seedPlatformRiskClassificationCatalog,
  type RiskClassificationSeed,
} from "../src/seedPlatformRiskClassificationCatalog.js";
import { PgPlatformRiskClassificationCatalog } from "../src/platformRiskClassificationCatalog.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_governance";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const catalog = new PgPlatformRiskClassificationCatalog(pool);

function makeSeed(overrides: Partial<RiskClassificationSeed> = {}): RiskClassificationSeed {
  return {
    action: "*",
    version: "1.0.0",
    riskLevel: "LOW",
    rationale: "Platform-wide default floor.",
    ...overrides,
  };
}

beforeAll(async () => {
  await resetAndMigrate(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("seedPlatformRiskClassificationCatalog", () => {
  it("creates a published risk classification version", async () => {
    await seedPlatformRiskClassificationCatalog(pool, [makeSeed()]);
    const version = await catalog.getPublishedVersionForAction("*");
    expect(version).not.toBeNull();
    expect(version!.riskLevel).toBe("LOW");
  });

  it("is idempotent: re-seeding unchanged content writes nothing new", async () => {
    await seedPlatformRiskClassificationCatalog(pool, [makeSeed()]);
    const definition = await catalog.getDefinitionByAction("*");
    const versions = await catalog.listPublishedVersions(definition!.id);
    expect(versions).toHaveLength(1);
  });

  it("throws if a published version's risk level/rationale changed without a version bump", async () => {
    const changed = makeSeed({ riskLevel: "CRITICAL" });
    await expect(
      seedPlatformRiskClassificationCatalog(pool, [changed]),
    ).rejects.toThrow(/changed without a version bump/);
  });

  it("accepts a genuinely new version under a bumped version string", async () => {
    const bumped = makeSeed({ version: "1.1.0", riskLevel: "MEDIUM" });
    await seedPlatformRiskClassificationCatalog(pool, [bumped]);
    const definition = await catalog.getDefinitionByAction("*");
    const versions = await catalog.listPublishedVersions(definition!.id);
    expect(versions.map((v) => v.version).sort()).toEqual(["1.0.0", "1.1.0"]);
    // getPublishedVersionForAction resolves the most recent published version.
    const latest = await catalog.getPublishedVersionForAction("*");
    expect(latest!.version).toBe("1.1.0");
  });
});
