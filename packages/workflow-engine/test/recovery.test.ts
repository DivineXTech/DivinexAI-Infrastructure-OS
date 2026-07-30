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
import { PgStepLeasing } from "../src/stepLeasing.js";
import { reconcileWorkflowRuntime } from "../src/recovery.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_workflow_engine";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const catalog = new PgPlatformWorkflowCatalog(pool);
const resolver = createStubAgentResolver();
const leasing = new PgStepLeasing(pool);

let fixtures: CoreFixtures;
let tenantWorkflowId: string;
let workflowVersionId: string;

async function newMaterializedRun(traceId: string): Promise<string> {
  const run = await createWorkflowRun(pool, {
    tenantId: fixtures.tenantA,
    tenantWorkflowId,
    workflowVersionId,
    requestedByUserId: fixtures.userAOwner,
    input: {},
    traceId,
  });
  await materializeSteps(
    pool,
    fixtures.tenantA,
    run.id,
    clientSolutionAssessmentManifest.steps,
  );
  await computeReadySteps(pool, run.id);
  return run.id;
}

async function expireLease(stepId: string): Promise<void> {
  await pool.query(
    "update workflow_steps set lease_expires_at = now() - interval '1 hour' where id = $1",
    [stepId],
  );
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

describe("reconcileWorkflowRuntime", () => {
  it("reclaims an expired LEASED step and schedules a retry (attempt below max)", async () => {
    const runId = await newMaterializedRun("trace-recovery-1");
    const { rows: stepRows } = await pool.query<{ id: string }>(
      "select id from workflow_steps where workflow_run_id = $1 and step_key = 'sara_interpret'",
      [runId],
    );
    const stepId = stepRows[0]!.id;
    await leasing.claimStep(stepId, "worker-a", 30000);
    await expireLease(stepId);

    const result = await reconcileWorkflowRuntime(pool);
    expect(result.leasesReclaimed).toBeGreaterThanOrEqual(1);

    const { rows } = await pool.query(
      "select status, attempt, lease_token from workflow_steps where id = $1",
      [stepId],
    );
    expect(rows[0]!.status).toBe("RETRY_SCHEDULED");
    expect(rows[0]!.attempt).toBe(1);
    expect(rows[0]!.lease_token).toBeNull();
  });

  it("appends a step.lease_reclaimed execution event for the reclaimed step", async () => {
    const runId = await newMaterializedRun("trace-recovery-2");
    const { rows: stepRows } = await pool.query<{ id: string }>(
      "select id from workflow_steps where workflow_run_id = $1 and step_key = 'sara_interpret'",
      [runId],
    );
    const stepId = stepRows[0]!.id;
    await leasing.claimStep(stepId, "worker-a", 30000);
    await expireLease(stepId);

    await reconcileWorkflowRuntime(pool);

    const { rows: events } = await pool.query(
      "select event_type from workflow_execution_events where workflow_step_id = $1 and event_type = 'step.lease_reclaimed'",
      [stepId],
    );
    expect(events).toHaveLength(1);
  });

  it("dead-letters an expired step once max attempts are exhausted", async () => {
    const runId = await newMaterializedRun("trace-recovery-3");
    const { rows: stepRows } = await pool.query<{ id: string }>(
      "select id from workflow_steps where workflow_run_id = $1 and step_key = 'sara_interpret'",
      [runId],
    );
    const stepId = stepRows[0]!.id;
    // sara_interpret's manifest retryPolicy has maxAttempts: 3 — push attempt to 2 so this expiry is the 3rd (exhausting).
    await pool.query("update workflow_steps set attempt = 2 where id = $1", [
      stepId,
    ]);
    await leasing.claimStep(stepId, "worker-a", 30000);
    await expireLease(stepId);

    await reconcileWorkflowRuntime(pool);

    const { rows } = await pool.query(
      "select status from workflow_steps where id = $1",
      [stepId],
    );
    expect(rows[0]!.status).toBe("DEAD_LETTERED");

    const { rows: deadLetters } = await pool.query(
      "select 1 from workflow_dead_letters where workflow_step_id = $1",
      [stepId],
    );
    expect(deadLetters).toHaveLength(1);
  });

  it("requeues a due RETRY_SCHEDULED step to READY", async () => {
    const runId = await newMaterializedRun("trace-recovery-4");
    const { rows: stepRows } = await pool.query<{ id: string }>(
      "select id from workflow_steps where workflow_run_id = $1 and step_key = 'sara_interpret'",
      [runId],
    );
    const stepId = stepRows[0]!.id;
    await pool.query(
      "update workflow_steps set status = 'RETRY_SCHEDULED', next_attempt_at = now() - interval '1 minute' where id = $1",
      [stepId],
    );

    const result = await reconcileWorkflowRuntime(pool);
    expect(result.retriesRequeued).toBeGreaterThanOrEqual(1);

    const { rows } = await pool.query(
      "select status from workflow_steps where id = $1",
      [stepId],
    );
    expect(rows[0]!.status).toBe("READY");
  });

  it("does not requeue a RETRY_SCHEDULED step whose next_attempt_at is in the future", async () => {
    const runId = await newMaterializedRun("trace-recovery-5");
    const { rows: stepRows } = await pool.query<{ id: string }>(
      "select id from workflow_steps where workflow_run_id = $1 and step_key = 'sara_interpret'",
      [runId],
    );
    const stepId = stepRows[0]!.id;
    await pool.query(
      "update workflow_steps set status = 'RETRY_SCHEDULED', next_attempt_at = now() + interval '1 hour' where id = $1",
      [stepId],
    );

    await reconcileWorkflowRuntime(pool);

    const { rows } = await pool.query(
      "select status from workflow_steps where id = $1",
      [stepId],
    );
    expect(rows[0]!.status).toBe("RETRY_SCHEDULED");
  });

  it("advances dependency-satisfied steps for non-terminal runs (dependency-based rescheduling)", async () => {
    const runId = await newMaterializedRun("trace-recovery-6");
    await pool.query(
      "update workflow_steps set status = 'SUCCEEDED' where workflow_run_id = $1 and step_key = 'sara_interpret'",
      [runId],
    );

    const result = await reconcileWorkflowRuntime(pool);
    expect(result.stepsReadied.length).toBeGreaterThanOrEqual(1);

    const { rows } = await pool.query(
      "select status from workflow_steps where workflow_run_id = $1 and step_key = 'nova_plan'",
      [runId],
    );
    expect(rows[0]!.status).toBe("READY");
  });

  it("never touches a step that already committed a terminal status", async () => {
    const runId = await newMaterializedRun("trace-recovery-7");
    const { rows: stepRows } = await pool.query<{ id: string }>(
      "select id from workflow_steps where workflow_run_id = $1 and step_key = 'sara_interpret'",
      [runId],
    );
    const stepId = stepRows[0]!.id;
    await pool.query(
      "update workflow_steps set status = 'SUCCEEDED', completed_at = now() where id = $1",
      [stepId],
    );

    await reconcileWorkflowRuntime(pool);

    const { rows } = await pool.query(
      "select status from workflow_steps where id = $1",
      [stepId],
    );
    expect(rows[0]!.status).toBe("SUCCEEDED");
  });

  it("is safe to run repeatedly with nothing to do", async () => {
    await expect(reconcileWorkflowRuntime(pool)).resolves.toBeDefined();
    await expect(reconcileWorkflowRuntime(pool)).resolves.toBeDefined();
  });
});
