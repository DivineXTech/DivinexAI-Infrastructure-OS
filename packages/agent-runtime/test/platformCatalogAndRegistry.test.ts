import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { resetAndMigrate } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { seedPlatformAgentCatalog } from "../src/seedPlatformCatalog.js";
import { CANONICAL_AGENT_MANIFESTS } from "../src/agents/index.js";
import { PgPlatformAgentCatalog } from "../src/platformCatalog.js";
import { PgTenantAgentRegistry } from "../src/tenantAgentRegistry.js";
import { InvalidTenantAgentTransitionError } from "../src/tenantAgentLifecycle.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_agent_runtime";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const catalog = new PgPlatformAgentCatalog(pool);
const registry = new PgTenantAgentRegistry(pool);

let fixtures: CoreFixtures;

beforeAll(async () => {
  await resetAndMigrate(pool);
  fixtures = await seedCoreFixtures(pool);
  await seedPlatformAgentCatalog(pool, CANONICAL_AGENT_MANIFESTS);
});

afterAll(async () => {
  await pool.end();
});

describe("PgPlatformAgentCatalog", () => {
  it("getDefinitionBySlug returns the seeded definition", async () => {
    const sara = await catalog.getDefinitionBySlug("sara");
    expect(sara).not.toBeNull();
    expect(sara!.displayName).toBe("Sara");
    expect(sara!.ownershipType).toBe("platform");
  });

  it("getDefinitionBySlug returns null for an unknown slug", async () => {
    expect(await catalog.getDefinitionBySlug("does-not-exist")).toBeNull();
  });

  it("listDefinitions returns all six, alphabetically", async () => {
    const definitions = await catalog.listDefinitions();
    expect(definitions.map((d) => d.slug)).toEqual([
      "forge",
      "guardian",
      "nova",
      "pulse",
      "reven",
      "sara",
    ]);
  });

  it("listPublishedVersions returns the one published 0.1.0 version for sara", async () => {
    const sara = await catalog.getDefinitionBySlug("sara");
    const versions = await catalog.listPublishedVersions(sara!.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]!.version).toBe("0.1.0");
    expect(versions[0]!.status).toBe("published");
    expect(versions[0]!.manifest.id).toBe("sara");
  });
});

describe("PgTenantAgentRegistry", () => {
  let tenantAgentId: string;

  beforeAll(async () => {
    const sara = await catalog.getDefinitionBySlug("sara");
    const [version] = await catalog.listPublishedVersions(sara!.id);
    const { rows } = await pool.query<{ id: string }>(
      `insert into tenant_agents (tenant_id, agent_definition_id, agent_version_id)
       values ($1, $2, $3) returning id`,
      [fixtures.tenantA, sara!.id, version!.id],
    );
    tenantAgentId = rows[0]!.id;
  });

  it("get returns the installation for the right tenant + definition", async () => {
    const sara = await catalog.getDefinitionBySlug("sara");
    const installation = await registry.get(fixtures.tenantA, sara!.id);
    expect(installation).not.toBeNull();
    expect(installation!.lifecycleStatus).toBe("REGISTERED");
    expect(installation!.enabled).toBe(false);
  });

  it("get returns null for a tenant with no installation of that agent", async () => {
    const sara = await catalog.getDefinitionBySlug("sara");
    expect(await registry.get(fixtures.tenantB, sara!.id)).toBeNull();
  });

  it("list returns only tenant A's installation", async () => {
    const list = await registry.list(fixtures.tenantA);
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(tenantAgentId);
  });

  it("transitionLifecycle allows a valid move and persists it", async () => {
    await registry.transitionLifecycle(tenantAgentId, "MOCK_EXECUTABLE");
    const sara = await catalog.getDefinitionBySlug("sara");
    const installation = await registry.get(fixtures.tenantA, sara!.id);
    expect(installation!.lifecycleStatus).toBe("MOCK_EXECUTABLE");
  });

  it("transitionLifecycle rejects an invalid move and leaves state unchanged", async () => {
    await expect(
      registry.transitionLifecycle(tenantAgentId, "ACTIVE"),
    ).rejects.toThrow(InvalidTenantAgentTransitionError);
    const sara = await catalog.getDefinitionBySlug("sara");
    const installation = await registry.get(fixtures.tenantA, sara!.id);
    expect(installation!.lifecycleStatus).toBe("MOCK_EXECUTABLE");
  });

  it("setEnabled toggles the enabled flag", async () => {
    await registry.setEnabled(tenantAgentId, true);
    const sara = await catalog.getDefinitionBySlug("sara");
    expect((await registry.get(fixtures.tenantA, sara!.id))!.enabled).toBe(
      true,
    );
  });
});
