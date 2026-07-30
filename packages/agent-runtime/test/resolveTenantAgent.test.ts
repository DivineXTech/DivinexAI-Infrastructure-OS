import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { resetAndMigrate } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { seedPlatformAgentCatalog } from "../src/seedPlatformCatalog.js";
import { CANONICAL_AGENT_MANIFESTS } from "../src/agents/index.js";
import { PgPlatformAgentCatalog } from "../src/platformCatalog.js";
import {
  PgTenantAgentRegistry,
  resolveTenantAgent,
  UnknownAgentSlugError,
  TenantAgentNotInstalledError,
} from "../src/tenantAgentRegistry.js";

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

  const sara = await catalog.getDefinitionBySlug("sara");
  const [version] = await catalog.listPublishedVersions(sara!.id);
  await pool.query(
    `insert into tenant_agents (tenant_id, agent_definition_id, agent_version_id) values ($1, $2, $3)`,
    [fixtures.tenantA, sara!.id, version!.id],
  );
});

afterAll(async () => {
  await pool.end();
});

describe("resolveTenantAgent", () => {
  it("resolves the installation, definition, and version for an installed agent", async () => {
    const resolved = await resolveTenantAgent(
      registry,
      catalog,
      fixtures.tenantA,
      "sara",
    );
    expect(resolved.definition.slug).toBe("sara");
    expect(resolved.installation.tenantId).toBe(fixtures.tenantA);
    expect(resolved.version.version).toBe("0.1.0");
  });

  it("throws UnknownAgentSlugError for a slug with no platform definition", async () => {
    await expect(
      resolveTenantAgent(registry, catalog, fixtures.tenantA, "does-not-exist"),
    ).rejects.toThrow(UnknownAgentSlugError);
  });

  it("throws TenantAgentNotInstalledError when the tenant has no installation of a known agent", async () => {
    await expect(
      resolveTenantAgent(registry, catalog, fixtures.tenantB, "sara"),
    ).rejects.toThrow(TenantAgentNotInstalledError);
  });
});
