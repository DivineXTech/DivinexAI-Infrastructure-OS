import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { resetAndMigrate, asUser } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { seedPlatformAgentCatalog } from "../src/seedPlatformCatalog.js";
import { CANONICAL_AGENT_MANIFESTS } from "../src/agents/index.js";
import { PgPlatformAgentCatalog } from "../src/platformCatalog.js";

/**
 * RLS tests for the Phase 2 migrations
 * (20260721000004_agent_platform_catalog.sql,
 * 20260721000005_tenant_agent_installations.sql), against real Postgres
 * with the same restricted `authenticated` role used throughout Phase 1 —
 * see packages/shared/test/tenant-isolation.test.ts for the original
 * pattern this follows.
 */

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_agent_runtime";
const TEST_DATABASE_URL_AUTHENTICATED =
  process.env.TEST_DATABASE_URL_AUTHENTICATED ??
  "postgres://authenticated:authenticated@127.0.0.1:5432/agentflow_test_agent_runtime";

const ownerPool = new Pool({ connectionString: TEST_DATABASE_URL });
const authPool = new Pool({
  connectionString: TEST_DATABASE_URL_AUTHENTICATED,
});
const catalog = new PgPlatformAgentCatalog(ownerPool);

let fixtures: CoreFixtures;
let saraDefinitionId: string;
let saraVersionId: string;
let tenantAAgentId: string;
let tenantBAgentId: string;
let draftVersionId: string;

beforeAll(async () => {
  await resetAndMigrate(ownerPool);
  fixtures = await seedCoreFixtures(ownerPool);
  await seedPlatformAgentCatalog(ownerPool, CANONICAL_AGENT_MANIFESTS);

  const sara = await catalog.getDefinitionBySlug("sara");
  saraDefinitionId = sara!.id;
  const [version] = await catalog.listPublishedVersions(saraDefinitionId);
  saraVersionId = version!.id;

  // A non-published (draft) version, to prove it stays invisible to tenant users.
  const { rows: draftRows } = await ownerPool.query<{ id: string }>(
    `insert into agent_versions (agent_definition_id, version, manifest, manifest_hash, status)
     values ($1, '0.2.0', '{}'::jsonb, 'draft-hash', 'draft')
     returning id`,
    [saraDefinitionId],
  );
  draftVersionId = draftRows[0]!.id;

  const { rows: tenantAAgentRows } = await ownerPool.query<{ id: string }>(
    `insert into tenant_agents (tenant_id, agent_definition_id, agent_version_id)
     values ($1, $2, $3) returning id`,
    [fixtures.tenantA, saraDefinitionId, saraVersionId],
  );
  tenantAAgentId = tenantAAgentRows[0]!.id;

  const { rows: tenantBAgentRows } = await ownerPool.query<{ id: string }>(
    `insert into tenant_agents (tenant_id, agent_definition_id, agent_version_id)
     values ($1, $2, $3) returning id`,
    [fixtures.tenantB, saraDefinitionId, saraVersionId],
  );
  tenantBAgentId = tenantBAgentRows[0]!.id;

  await ownerPool.query(
    "insert into agent_tool_permissions (tenant_id, tenant_agent_id, tool_id) values ($1, $2, 'mock-tool')",
    [fixtures.tenantA, tenantAAgentId],
  );
});

afterAll(async () => {
  await ownerPool.end();
  await authPool.end();
});

describe("platform catalog RLS", () => {
  it("any authenticated user can read agent_definitions", async () => {
    const rows = await asUser(authPool, fixtures.userAOwner, async (client) => {
      const res = await client.query("select slug from agent_definitions");
      return res.rows;
    });
    expect(rows.length).toBeGreaterThanOrEqual(6);
  });

  it("an unauthenticated session sees zero agent_definitions", async () => {
    const rows = await asUser(authPool, null, async (client) => {
      const res = await client.query("select slug from agent_definitions");
      return res.rows;
    });
    expect(rows).toHaveLength(0);
  });

  it("an authenticated user sees a published version but not a draft one", async () => {
    const rows = await asUser(authPool, fixtures.userAOwner, async (client) => {
      const res = await client.query(
        "select id, status from agent_versions where agent_definition_id = $1",
        [saraDefinitionId],
      );
      return res.rows;
    });
    expect(rows.map((r) => r.id)).toContain(saraVersionId);
    expect(rows.map((r) => r.id)).not.toContain(draftVersionId);
  });

  it("no authenticated user can insert into agent_definitions (platform writes are service-role-only)", async () => {
    await expect(
      asUser(authPool, fixtures.userAOwner, async (client) =>
        client.query(
          "insert into agent_definitions (slug, display_name, role, description) values ('rogue', 'Rogue', 'x', 'x')",
        ),
      ),
    ).rejects.toThrow();
  });

  it("no authenticated user can update a published agent_versions row", async () => {
    const result = await asUser(authPool, fixtures.userAOwner, async (client) =>
      client.query(
        "update agent_versions set status = 'retired' where id = $1",
        [saraVersionId],
      ),
    );
    expect(result.rowCount).toBe(0);
  });
});

describe("tenant_agents and related tables: cross-tenant isolation", () => {
  it("a tenant A member sees only tenant A's tenant_agents row", async () => {
    const rows = await asUser(authPool, fixtures.userAOwner, async (client) => {
      const res = await client.query("select id, tenant_id from tenant_agents");
      return res.rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(tenantAAgentId);
  });

  it("a tenant A member cannot see tenant B's agent_tool_permissions", async () => {
    await ownerPool.query(
      "insert into agent_tool_permissions (tenant_id, tenant_agent_id, tool_id) values ($1, $2, 'mock-tool')",
      [fixtures.tenantB, tenantBAgentId],
    );
    const rows = await asUser(authPool, fixtures.userAOwner, async (client) => {
      const res = await client.query(
        "select tenant_id from agent_tool_permissions",
      );
      return res.rows;
    });
    expect(rows.every((r) => r.tenant_id === fixtures.tenantA)).toBe(true);
  });

  it("a plain member (no tenant.manage_agents) cannot insert a tenant_agents row, even for their own tenant", async () => {
    const forgeDefinition = await catalog.getDefinitionBySlug("forge");
    const [forgeVersion] = await catalog.listPublishedVersions(
      forgeDefinition!.id,
    );

    const result = await asUser(
      authPool,
      fixtures.userAMember,
      async (client) =>
        client.query(
          "insert into tenant_agents (tenant_id, agent_definition_id, agent_version_id) values ($1, $2, $3)",
          [fixtures.tenantA, forgeDefinition!.id, forgeVersion!.id],
        ),
    ).catch((err) => err);
    expect(result).toBeInstanceOf(Error);
  });

  it("an owner (has tenant.manage_agents) can insert a tenant_agents row for their own tenant", async () => {
    const forgeDefinition = await catalog.getDefinitionBySlug("forge");
    const [forgeVersion] = await catalog.listPublishedVersions(
      forgeDefinition!.id,
    );

    const result = await asUser(authPool, fixtures.userAOwner, async (client) =>
      client.query(
        "insert into tenant_agents (tenant_id, agent_definition_id, agent_version_id) values ($1, $2, $3)",
        [fixtures.tenantA, forgeDefinition!.id, forgeVersion!.id],
      ),
    );
    expect(result.rowCount).toBe(1);
  });

  it("an owner of tenant A cannot insert a tenant_agents row for tenant B, even knowing its ids", async () => {
    const guardianDefinition = await catalog.getDefinitionBySlug("guardian");
    const [guardianVersion] = await catalog.listPublishedVersions(
      guardianDefinition!.id,
    );

    const result = await asUser(authPool, fixtures.userAOwner, async (client) =>
      client.query(
        "insert into tenant_agents (tenant_id, agent_definition_id, agent_version_id) values ($1, $2, $3)",
        [fixtures.tenantB, guardianDefinition!.id, guardianVersion!.id],
      ),
    ).catch((err) => err);
    expect(result).toBeInstanceOf(Error);
  });

  it("an unauthenticated session sees zero rows across all four tenant-owned tables", async () => {
    for (const table of [
      "tenant_agents",
      "tenant_agent_capabilities",
      "agent_tool_permissions",
      "agent_knowledge_sources",
    ]) {
      const rows = await asUser(authPool, null, async (client) => {
        const res = await client.query(`select 1 from ${table}`);
        return res.rows;
      });
      expect(rows).toHaveLength(0);
    }
  });
});

describe("tenant_id consistency enforcement (composite foreign key, no trigger)", () => {
  it("rejects an agent_tool_permissions row whose tenant_id does not match its tenant_agent's tenant_id", async () => {
    await expect(
      ownerPool.query(
        "insert into agent_tool_permissions (tenant_id, tenant_agent_id, tool_id) values ($1, $2, 'mismatched')",
        [fixtures.tenantB, tenantAAgentId], // tenantAAgentId actually belongs to tenant A
      ),
    ).rejects.toThrow();
  });
});
