import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { resetAndMigrate } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { seedPlatformWorkflowCatalog } from "../src/seedPlatformWorkflowCatalog.js";
import { clientSolutionAssessmentManifest } from "../src/reference/clientSolutionAssessment.js";
import { createStubAgentResolver } from "./stubAgentResolver.js";
import { PgPlatformWorkflowCatalog } from "../src/platformWorkflowCatalog.js";
import {
  createWorkflowRun,
  materializeSteps,
} from "../src/workflowRunService.js";
import { computeReadySteps } from "../src/stepScheduler.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_workflow_engine";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const catalog = new PgPlatformWorkflowCatalog(pool);
const resolver = createStubAgentResolver();

let fixtures: CoreFixtures;
let tenantWorkflowId: string;
let workflowVersionId: string;

async function statusOf(runId: string, stepKey: string): Promise<string> {
  const { rows } = await pool.query<{ status: string }>(
    "select status from workflow_steps where workflow_run_id = $1 and step_key = $2",
    [runId, stepKey],
  );
  return rows[0]!.status;
}

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

  const { rows } = await pool.query<{ id: string }>(
    `insert into tenant_workflows (tenant_id, workflow_definition_id, workflow_version_id)
     values ($1, $2, $3) returning id`,
    [fixtures.tenantA, definition!.id, workflowVersionId],
  );
  tenantWorkflowId = rows[0]!.id;
});

afterAll(async () => {
  await pool.end();
});

describe("computeReadySteps", () => {
  it("readies only the entry step immediately after materialization", async () => {
    const run = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId,
      workflowVersionId,
      requestedByUserId: fixtures.userAOwner,
      input: {},
      traceId: "trace-sched-1",
    });
    await materializeSteps(
      pool,
      fixtures.tenantA,
      run.id,
      clientSolutionAssessmentManifest.steps,
    );

    const readied = await computeReadySteps(pool, run.id);
    expect(readied).toHaveLength(1);
    expect(await statusOf(run.id, "sara_interpret")).toBe("READY");
    expect(await statusOf(run.id, "nova_plan")).toBe("PENDING");
  });

  it("is idempotent — calling it again with nothing new to ready returns an empty array", async () => {
    const run = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId,
      workflowVersionId,
      requestedByUserId: fixtures.userAOwner,
      input: {},
      traceId: "trace-sched-2",
    });
    await materializeSteps(
      pool,
      fixtures.tenantA,
      run.id,
      clientSolutionAssessmentManifest.steps,
    );
    await computeReadySteps(pool, run.id);

    const readiedAgain = await computeReadySteps(pool, run.id);
    expect(readiedAgain).toHaveLength(0);
  });

  it("readies pulse/reven/forge together once nova_plan succeeds (parallel branch eligibility)", async () => {
    const run = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId,
      workflowVersionId,
      requestedByUserId: fixtures.userAOwner,
      input: {},
      traceId: "trace-sched-3",
    });
    await materializeSteps(
      pool,
      fixtures.tenantA,
      run.id,
      clientSolutionAssessmentManifest.steps,
    );
    await computeReadySteps(pool, run.id); // readies sara_interpret

    await pool.query(
      "update workflow_steps set status = 'SUCCEEDED' where workflow_run_id = $1 and step_key = 'sara_interpret'",
      [run.id],
    );
    await computeReadySteps(pool, run.id); // readies nova_plan
    await pool.query(
      "update workflow_steps set status = 'SUCCEEDED' where workflow_run_id = $1 and step_key = 'nova_plan'",
      [run.id],
    );

    const readied = await computeReadySteps(pool, run.id);
    expect(readied).toHaveLength(3);
    expect(await statusOf(run.id, "pulse_market")).toBe("READY");
    expect(await statusOf(run.id, "reven_pricing")).toBe("READY");
    expect(await statusOf(run.id, "forge_technical")).toBe("READY");
    expect(await statusOf(run.id, "guardian_review")).toBe("PENDING");
  });

  it("guardian_review stays PENDING until all three siblings SUCCEEDED (dependency gating)", async () => {
    const run = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId,
      workflowVersionId,
      requestedByUserId: fixtures.userAOwner,
      input: {},
      traceId: "trace-sched-4",
    });
    await materializeSteps(
      pool,
      fixtures.tenantA,
      run.id,
      clientSolutionAssessmentManifest.steps,
    );
    await computeReadySteps(pool, run.id);
    await pool.query(
      "update workflow_steps set status = 'SUCCEEDED' where workflow_run_id = $1 and step_key = 'sara_interpret'",
      [run.id],
    );
    await computeReadySteps(pool, run.id);
    await pool.query(
      "update workflow_steps set status = 'SUCCEEDED' where workflow_run_id = $1 and step_key = 'nova_plan'",
      [run.id],
    );
    await computeReadySteps(pool, run.id);

    // Succeed two of three siblings only.
    await pool.query(
      "update workflow_steps set status = 'SUCCEEDED' where workflow_run_id = $1 and step_key in ('pulse_market', 'reven_pricing')",
      [run.id],
    );
    await computeReadySteps(pool, run.id);
    expect(await statusOf(run.id, "guardian_review")).toBe("PENDING");

    // Succeed the last sibling — now guardian_review should ready.
    await pool.query(
      "update workflow_steps set status = 'SUCCEEDED' where workflow_run_id = $1 and step_key = 'forge_technical'",
      [run.id],
    );
    await computeReadySteps(pool, run.id);
    expect(await statusOf(run.id, "guardian_review")).toBe("READY");
  });
});
