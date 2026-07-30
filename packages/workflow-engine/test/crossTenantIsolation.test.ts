import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { resetAndMigrate, asUser } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { seedPlatformWorkflowCatalog } from "../src/seedPlatformWorkflowCatalog.js";
import { clientSolutionAssessmentManifest } from "../src/reference/clientSolutionAssessment.js";
import { createStubAgentResolver } from "./stubAgentResolver.js";
import { PgPlatformWorkflowCatalog } from "../src/platformWorkflowCatalog.js";

/**
 * RLS tests for the Phase 3 migrations
 * (20260721000006_workflow_platform_catalog.sql,
 * 20260721000007_tenant_workflow_installations.sql), against real Postgres
 * with the same restricted `authenticated` role used throughout Phase 1/2 —
 * mirrors packages/agent-runtime/test/crossTenantIsolation.test.ts.
 */

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_workflow_engine";
const TEST_DATABASE_URL_AUTHENTICATED =
  process.env.TEST_DATABASE_URL_AUTHENTICATED ??
  "postgres://authenticated:authenticated@127.0.0.1:5432/agentflow_test_workflow_engine";

const ownerPool = new Pool({ connectionString: TEST_DATABASE_URL });
const authPool = new Pool({
  connectionString: TEST_DATABASE_URL_AUTHENTICATED,
});
const catalog = new PgPlatformWorkflowCatalog(ownerPool);
const resolver = createStubAgentResolver();

let fixtures: CoreFixtures;
let workflowDefinitionId: string;
let workflowVersionId: string;
let draftVersionId: string;
let tenantAWorkflowId: string;
let tenantBWorkflowId: string;
let tenantARunId: string;
let tenantAStepId: string;
let tenantBRunId: string;

beforeAll(async () => {
  await resetAndMigrate(ownerPool);
  fixtures = await seedCoreFixtures(ownerPool);
  await seedPlatformWorkflowCatalog(ownerPool, resolver, [
    clientSolutionAssessmentManifest,
  ]);

  const definition = await catalog.getDefinitionBySlug(
    "client_solution_assessment",
  );
  workflowDefinitionId = definition!.id;
  const [version] = await catalog.listPublishedVersions(workflowDefinitionId);
  workflowVersionId = version!.id;

  // A non-published (draft) version, to prove it stays invisible to tenant users.
  const { rows: draftRows } = await ownerPool.query<{ id: string }>(
    `insert into workflow_versions (workflow_definition_id, version, manifest, manifest_hash, status)
     values ($1, '2.0.0', '{}'::jsonb, 'draft-hash', 'draft')
     returning id`,
    [workflowDefinitionId],
  );
  draftVersionId = draftRows[0]!.id;

  const { rows: tenantAWorkflowRows } = await ownerPool.query<{ id: string }>(
    `insert into tenant_workflows (tenant_id, workflow_definition_id, workflow_version_id)
     values ($1, $2, $3) returning id`,
    [fixtures.tenantA, workflowDefinitionId, workflowVersionId],
  );
  tenantAWorkflowId = tenantAWorkflowRows[0]!.id;

  const { rows: tenantBWorkflowRows } = await ownerPool.query<{ id: string }>(
    `insert into tenant_workflows (tenant_id, workflow_definition_id, workflow_version_id)
     values ($1, $2, $3) returning id`,
    [fixtures.tenantB, workflowDefinitionId, workflowVersionId],
  );
  tenantBWorkflowId = tenantBWorkflowRows[0]!.id;

  const { rows: tenantARunRows } = await ownerPool.query<{ id: string }>(
    `insert into workflow_runs (tenant_id, tenant_workflow_id, workflow_version_id, trace_id)
     values ($1, $2, $3, 'trace-a') returning id`,
    [fixtures.tenantA, tenantAWorkflowId, workflowVersionId],
  );
  tenantARunId = tenantARunRows[0]!.id;

  const { rows: tenantAStepRows } = await ownerPool.query<{ id: string }>(
    `insert into workflow_steps (tenant_id, workflow_run_id, step_key, agent_slug, timeout_ms)
     values ($1, $2, 'step_one', 'sara', 60000) returning id`,
    [fixtures.tenantA, tenantARunId],
  );
  tenantAStepId = tenantAStepRows[0]!.id;

  const { rows: tenantBRunRows } = await ownerPool.query<{ id: string }>(
    `insert into workflow_runs (tenant_id, tenant_workflow_id, workflow_version_id, trace_id)
     values ($1, $2, $3, 'trace-b') returning id`,
    [fixtures.tenantB, tenantBWorkflowId, workflowVersionId],
  );
  tenantBRunId = tenantBRunRows[0]!.id;

  await ownerPool.query(
    `insert into workflow_execution_events
       (tenant_id, workflow_run_id, event_type, actor_type, trace_id, correlation_id, sequence_number)
     values ($1, $2, 'run.created', 'system', 'trace-a', $3, 0)`,
    [fixtures.tenantA, tenantARunId, tenantARunId],
  );
});

afterAll(async () => {
  await ownerPool.end();
  await authPool.end();
});

describe("platform workflow catalog RLS", () => {
  it("any authenticated user can read workflow_definitions", async () => {
    const rows = await asUser(authPool, fixtures.userAOwner, async (client) => {
      const res = await client.query("select slug from workflow_definitions");
      return res.rows;
    });
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("an unauthenticated session sees zero workflow_definitions", async () => {
    const rows = await asUser(authPool, null, async (client) => {
      const res = await client.query("select slug from workflow_definitions");
      return res.rows;
    });
    expect(rows).toHaveLength(0);
  });

  it("an authenticated user sees a published version but not a draft one", async () => {
    const rows = await asUser(authPool, fixtures.userAOwner, async (client) => {
      const res = await client.query(
        "select id, status from workflow_versions where workflow_definition_id = $1",
        [workflowDefinitionId],
      );
      return res.rows;
    });
    expect(rows.map((r) => r.id)).toContain(workflowVersionId);
    expect(rows.map((r) => r.id)).not.toContain(draftVersionId);
  });

  it("no authenticated user can insert into workflow_definitions (platform writes are service-role-only)", async () => {
    await expect(
      asUser(authPool, fixtures.userAOwner, async (client) =>
        client.query(
          "insert into workflow_definitions (slug, display_name, description) values ('rogue', 'Rogue', 'x')",
        ),
      ),
    ).rejects.toThrow();
  });

  it("no authenticated user can update a published workflow_versions row", async () => {
    const result = await asUser(authPool, fixtures.userAOwner, async (client) =>
      client.query(
        "update workflow_versions set status = 'retired' where id = $1",
        [workflowVersionId],
      ),
    );
    expect(result.rowCount).toBe(0);
  });
});

describe("tenant-owned workflow tables: cross-tenant isolation", () => {
  it("a tenant A member sees only tenant A's tenant_workflows row", async () => {
    const rows = await asUser(authPool, fixtures.userAOwner, async (client) => {
      const res = await client.query(
        "select id, tenant_id from tenant_workflows",
      );
      return res.rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(tenantAWorkflowId);
  });

  it("a tenant A member sees only tenant A's workflow_runs row", async () => {
    const rows = await asUser(authPool, fixtures.userAOwner, async (client) => {
      const res = await client.query("select id from workflow_runs");
      return res.rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(tenantARunId);
  });

  it("a tenant A member cannot select tenant B's workflow_runs row directly by id", async () => {
    const rows = await asUser(authPool, fixtures.userAOwner, async (client) => {
      const res = await client.query(
        "select id from workflow_runs where id = $1",
        [tenantBRunId],
      );
      return res.rows;
    });
    expect(rows).toHaveLength(0);
  });

  it("a tenant A member sees only tenant A's workflow_steps row", async () => {
    const rows = await asUser(authPool, fixtures.userAOwner, async (client) => {
      const res = await client.query("select id from workflow_steps");
      return res.rows;
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(tenantAStepId);
  });

  it("a tenant A member sees only tenant A's workflow_execution_events row", async () => {
    const rows = await asUser(authPool, fixtures.userAOwner, async (client) => {
      const res = await client.query(
        "select tenant_id from workflow_execution_events",
      );
      return res.rows;
    });
    expect(rows.every((r) => r.tenant_id === fixtures.tenantA)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("no authenticated user can insert into workflow_execution_events (append-only, service-role-only)", async () => {
    await expect(
      asUser(authPool, fixtures.userAOwner, async (client) =>
        client.query(
          `insert into workflow_execution_events
             (tenant_id, workflow_run_id, event_type, actor_type, trace_id, correlation_id, sequence_number)
           values ($1, $2, 'rogue.event', 'user', 'trace-x', $3, 999)`,
          [fixtures.tenantA, tenantARunId, tenantARunId],
        ),
      ),
    ).rejects.toThrow();
  });

  it("a plain member (no tenant.manage_workflows) cannot insert a tenant_workflows row, even for their own tenant", async () => {
    const result = await asUser(
      authPool,
      fixtures.userAMember,
      async (client) =>
        client.query(
          "insert into tenant_workflows (tenant_id, workflow_definition_id, workflow_version_id) values ($1, $2, $3)",
          [fixtures.tenantA, workflowDefinitionId, workflowVersionId],
        ),
    ).catch((err) => err);
    expect(result).toBeInstanceOf(Error);
  });

  it("an owner of tenant A cannot insert a workflow_runs row for tenant B, even knowing its ids", async () => {
    const result = await asUser(authPool, fixtures.userAOwner, async (client) =>
      client.query(
        "insert into workflow_runs (tenant_id, tenant_workflow_id, workflow_version_id, trace_id) values ($1, $2, $3, 'trace-x')",
        [fixtures.tenantB, tenantBWorkflowId, workflowVersionId],
      ),
    ).catch((err) => err);
    expect(result).toBeInstanceOf(Error);
  });

  it("an unauthenticated session sees zero rows across all six tenant-owned tables", async () => {
    for (const table of [
      "tenant_workflows",
      "workflow_runs",
      "workflow_steps",
      "workflow_step_dependencies",
      "workflow_execution_events",
      "workflow_dead_letters",
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
  it("rejects a workflow_steps row whose tenant_id does not match its run's tenant_id", async () => {
    await expect(
      ownerPool.query(
        "insert into workflow_steps (tenant_id, workflow_run_id, step_key, agent_slug, timeout_ms) values ($1, $2, 'mismatched', 'sara', 60000)",
        [fixtures.tenantB, tenantARunId], // tenantARunId actually belongs to tenant A
      ),
    ).rejects.toThrow();
  });

  it("rejects a workflow_dead_letters row whose tenant_id does not match its step's tenant_id", async () => {
    await expect(
      ownerPool.query(
        "insert into workflow_dead_letters (tenant_id, workflow_run_id, workflow_step_id, reason, attempt_count) values ($1, $2, $3, 'mismatched', 1)",
        [fixtures.tenantB, tenantARunId, tenantAStepId],
      ),
    ).rejects.toThrow();
  });
});
