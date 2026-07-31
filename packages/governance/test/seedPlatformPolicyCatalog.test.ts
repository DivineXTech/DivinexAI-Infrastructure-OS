import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { resetAndMigrate } from "./setupTestDb.js";
import {
  seedPlatformPolicyCatalog,
  type PolicySeed,
} from "../src/seedPlatformPolicyCatalog.js";
import { PgPlatformPolicyCatalog } from "../src/platformPolicyCatalog.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_governance";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const catalog = new PgPlatformPolicyCatalog(pool);

function makeSeed(overrides: Partial<PolicySeed> = {}): PolicySeed {
  return {
    slug: "external-communication-approval",
    displayName: "External Communication Approval",
    description: "Requires approval before sending external communications.",
    version: "1.0.0",
    document: {
      appliesToActions: ["communication.send.external"],
      conditions: {
        field: "action",
        operator: "eq",
        value: "communication.send.external",
      },
      effect: "REQUIRE_APPROVAL",
      riskLevel: "MEDIUM",
      requiredPermissions: [],
      requiredApproverRoles: [],
      requiredApprovalCount: 1,
      rejectOnFirstRejection: true,
      approvalExpirationMs: null,
    },
    priority: 100,
    mandatory: true,
    overridePolicy: "immutable",
    ...overrides,
  };
}

beforeAll(async () => {
  await resetAndMigrate(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("seedPlatformPolicyCatalog", () => {
  it("creates a published policy version", async () => {
    await seedPlatformPolicyCatalog(pool, [makeSeed()]);
    const definition = await catalog.getDefinitionBySlug(
      "external-communication-approval",
    );
    expect(definition).not.toBeNull();
    const versions = await catalog.listPublishedVersions(definition!.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]!.version).toBe("1.0.0");
    expect(versions[0]!.mandatory).toBe(true);
  });

  it("is idempotent: re-seeding an unchanged document writes nothing new", async () => {
    await seedPlatformPolicyCatalog(pool, [makeSeed()]);
    const definition = await catalog.getDefinitionBySlug(
      "external-communication-approval",
    );
    const versions = await catalog.listPublishedVersions(definition!.id);
    expect(versions).toHaveLength(1);
  });

  it("throws if a published version's document changed without a version bump", async () => {
    const changed = makeSeed({
      document: {
        ...makeSeed().document,
        effect: "BLOCK",
      },
    });
    await expect(seedPlatformPolicyCatalog(pool, [changed])).rejects.toThrow(
      /changed without a version bump/,
    );
  });

  it("accepts a genuinely new version under a bumped version string", async () => {
    const bumped = makeSeed({
      version: "1.1.0",
      document: { ...makeSeed().document, effect: "BLOCK" },
    });
    await seedPlatformPolicyCatalog(pool, [bumped]);
    const definition = await catalog.getDefinitionBySlug(
      "external-communication-approval",
    );
    const versions = await catalog.listPublishedVersions(definition!.id);
    expect(versions.map((v) => v.version).sort()).toEqual(["1.0.0", "1.1.0"]);
  });
});
