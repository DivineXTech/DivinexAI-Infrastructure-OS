import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { resetAndMigrate } from "./setupTestDb.js";
import { seedPlatformAgentCatalog } from "../src/seedPlatformCatalog.js";
import { CANONICAL_AGENT_MANIFESTS } from "../src/agents/index.js";
import { PgPlatformAgentCatalog } from "../src/platformCatalog.js";
import { CatalogAgentResolver } from "../src/agentResolver.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_agent_runtime";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const catalog = new PgPlatformAgentCatalog(pool);
const resolver = new CatalogAgentResolver(catalog);

beforeAll(async () => {
  await resetAndMigrate(pool);
  await seedPlatformAgentCatalog(pool, CANONICAL_AGENT_MANIFESTS);
});

afterAll(async () => {
  await pool.end();
});

describe("CatalogAgentResolver", () => {
  it("resolves a known, published agent slug as exists + publishable", async () => {
    const result = await resolver.resolveAgentSlug("sara");
    expect(result).toEqual({ exists: true, publishable: true });
  });

  it("resolves an unknown slug as not existing", async () => {
    const result = await resolver.resolveAgentSlug("does-not-exist");
    expect(result).toEqual({ exists: false, publishable: false });
  });

  it("resolves a slug that exists but has no published version as not publishable", async () => {
    const forge = await catalog.getDefinitionBySlug("forge");
    await pool.query(
      "update agent_versions set status = 'deprecated' where agent_definition_id = $1",
      [forge!.id],
    );

    const result = await resolver.resolveAgentSlug("forge");
    expect(result).toEqual({ exists: true, publishable: false });
  });
});
