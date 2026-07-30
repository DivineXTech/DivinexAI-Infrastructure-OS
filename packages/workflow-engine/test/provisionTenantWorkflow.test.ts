import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import {
  PgTenantAccessEvaluator,
  TenantAuthorizationError,
} from "@repo/shared";
import { resetAndMigrate } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { seedPlatformWorkflowCatalog } from "../src/seedPlatformWorkflowCatalog.js";
import { clientSolutionAssessmentManifest } from "../src/reference/clientSolutionAssessment.js";
import { createStubAgentResolver } from "./stubAgentResolver.js";
import { PgPlatformWorkflowCatalog } from "../src/platformWorkflowCatalog.js";
import { provisionTenantWorkflow } from "../src/provisionTenantWorkflow.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_workflow_engine";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const catalog = new PgPlatformWorkflowCatalog(pool);
const access = new PgTenantAccessEvaluator(pool);
const resolver = createStubAgentResolver();

let fixtures: CoreFixtures;
let workflowVersionId: string;

beforeAll(async () => {
  await resetAndMigrate(pool);
  fixtures = await seedCoreFixtures(pool);
  await seedPlatformWorkflowCatalog(pool, resolver, [
    clientSolutionAssessmentManifest,
  ]);

  const definition = await catalog.getDefinitionBySlug(
    "client_solution_assessment",
  );
  const [version] = await catalog.listPublishedVersions(definition!.id);
  workflowVersionId = version!.id;
});

afterAll(async () => {
  await pool.end();
});

describe("provisionTenantWorkflow", () => {
  it("rejects a caller without tenant.manage_workflows before writing anything", async () => {
    await expect(
      provisionTenantWorkflow(pool, catalog, access, {
        tenantId: fixtures.tenantA,
        actorUserId: fixtures.userAMember,
        workflowDefinitionSlug: "client_solution_assessment",
        workflowVersionId,
      }),
    ).rejects.toThrow(TenantAuthorizationError);

    const { rows } = await pool.query(
      "select count(*)::int as count from tenant_workflows where tenant_id = $1",
      [fixtures.tenantA],
    );
    expect(rows[0]!.count).toBe(0);
  });

  it("creates a disabled installation and records one audit event", async () => {
    const result = await provisionTenantWorkflow(pool, catalog, access, {
      tenantId: fixtures.tenantA,
      actorUserId: fixtures.userAOwner,
      workflowDefinitionSlug: "client_solution_assessment",
      workflowVersionId,
    });

    expect(result.created).toBe(true);
    expect(result.installation.enabled).toBe(false);

    const { rows: events } = await pool.query(
      "select count(*)::int as count from audit_events where tenant_id = $1 and event_type = 'tenant_workflow.provisioned'",
      [fixtures.tenantA],
    );
    expect(events[0]!.count).toBe(1);
  });

  it("is idempotent — re-running returns the existing installation and records no new audit event", async () => {
    const result = await provisionTenantWorkflow(pool, catalog, access, {
      tenantId: fixtures.tenantA,
      actorUserId: fixtures.userAOwner,
      workflowDefinitionSlug: "client_solution_assessment",
      workflowVersionId,
    });

    expect(result.created).toBe(false);

    const { rows: installations } = await pool.query(
      "select count(*)::int as count from tenant_workflows where tenant_id = $1",
      [fixtures.tenantA],
    );
    expect(installations[0]!.count).toBe(1);

    const { rows: events } = await pool.query(
      "select count(*)::int as count from audit_events where tenant_id = $1 and event_type = 'tenant_workflow.provisioned'",
      [fixtures.tenantA],
    );
    expect(events[0]!.count).toBe(1);
  });

  it("provisioning tenant B is independent of tenant A's installation", async () => {
    const result = await provisionTenantWorkflow(pool, catalog, access, {
      tenantId: fixtures.tenantB,
      actorUserId: fixtures.userB,
      workflowDefinitionSlug: "client_solution_assessment",
      workflowVersionId,
    });
    expect(result.created).toBe(true);

    const { rows } = await pool.query(
      "select count(*)::int as count from tenant_workflows where tenant_id = $1",
      [fixtures.tenantB],
    );
    expect(rows[0]!.count).toBe(1);
  });
});
