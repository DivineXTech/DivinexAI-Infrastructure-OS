import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import {
  PgTenantAccessEvaluator,
  TenantAuthorizationError,
} from "@repo/shared";
import { resetAndMigrate } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { seedPlatformAgentCatalog } from "../src/seedPlatformCatalog.js";
import {
  CANONICAL_AGENT_MANIFESTS,
  CANONICAL_AGENT_SLUGS,
  type CanonicalAgentSlug,
} from "../src/agents/index.js";
import { PgPlatformAgentCatalog } from "../src/platformCatalog.js";
import { provisionTenantAgents } from "../src/provisionTenantAgents.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_agent_runtime";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const catalog = new PgPlatformAgentCatalog(pool);
const access = new PgTenantAccessEvaluator(pool);

let fixtures: CoreFixtures;
let versionsBySlug: Record<CanonicalAgentSlug, string>;

beforeAll(async () => {
  await resetAndMigrate(pool);
  fixtures = await seedCoreFixtures(pool);
  await seedPlatformAgentCatalog(pool, CANONICAL_AGENT_MANIFESTS);

  const entries = await Promise.all(
    CANONICAL_AGENT_SLUGS.map(async (slug) => {
      const definition = await catalog.getDefinitionBySlug(slug);
      const [version] = await catalog.listPublishedVersions(definition!.id);
      return [slug, version!.id] as const;
    }),
  );
  versionsBySlug = Object.fromEntries(entries) as Record<
    CanonicalAgentSlug,
    string
  >;
});

afterAll(async () => {
  await pool.end();
});

describe("provisionTenantAgents", () => {
  it("rejects a caller without tenant.manage_agents before writing anything", async () => {
    await expect(
      provisionTenantAgents(pool, catalog, access, {
        tenantId: fixtures.tenantA,
        actorUserId: fixtures.userAMember, // plain member, no elevated permissions
        versionsBySlug,
      }),
    ).rejects.toThrow(TenantAuthorizationError);

    const { rows } = await pool.query(
      "select count(*)::int as count from tenant_agents where tenant_id = $1",
      [fixtures.tenantA],
    );
    expect(rows[0]!.count).toBe(0);
  });

  it("creates exactly six REGISTERED, disabled installations and records six audit events", async () => {
    const result = await provisionTenantAgents(pool, catalog, access, {
      tenantId: fixtures.tenantA,
      actorUserId: fixtures.userAOwner,
      versionsBySlug,
    });

    expect(result.created).toHaveLength(6);
    expect(result.skipped).toHaveLength(0);
    expect(
      result.created.every((i) => i.lifecycleStatus === "REGISTERED"),
    ).toBe(true);
    expect(result.created.every((i) => i.enabled === false)).toBe(true);

    const { rows: installations } = await pool.query(
      "select count(*)::int as count from tenant_agents where tenant_id = $1",
      [fixtures.tenantA],
    );
    expect(installations[0]!.count).toBe(6);

    const { rows: events } = await pool.query(
      "select count(*)::int as count from audit_events where tenant_id = $1 and event_type = 'tenant_agent.provisioned'",
      [fixtures.tenantA],
    );
    expect(events[0]!.count).toBe(6);
  });

  it("is idempotent — re-running creates zero new installations and records zero new audit events", async () => {
    const result = await provisionTenantAgents(pool, catalog, access, {
      tenantId: fixtures.tenantA,
      actorUserId: fixtures.userAOwner,
      versionsBySlug,
    });

    expect(result.created).toHaveLength(0);
    expect(result.skipped).toEqual([...CANONICAL_AGENT_SLUGS]);

    const { rows: installations } = await pool.query(
      "select count(*)::int as count from tenant_agents where tenant_id = $1",
      [fixtures.tenantA],
    );
    expect(installations[0]!.count).toBe(6);

    const { rows: events } = await pool.query(
      "select count(*)::int as count from audit_events where tenant_id = $1 and event_type = 'tenant_agent.provisioned'",
      [fixtures.tenantA],
    );
    expect(events[0]!.count).toBe(6);
  });

  it("provisioning tenant B is independent of tenant A's installations", async () => {
    const result = await provisionTenantAgents(pool, catalog, access, {
      tenantId: fixtures.tenantB,
      actorUserId: fixtures.userB,
      versionsBySlug,
    });
    expect(result.created).toHaveLength(6);

    const { rows } = await pool.query(
      "select count(*)::int as count from tenant_agents where tenant_id = $1",
      [fixtures.tenantB],
    );
    expect(rows[0]!.count).toBe(6);
  });
});
