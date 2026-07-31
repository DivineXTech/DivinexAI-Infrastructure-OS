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
import { reconcileWorkflowRunOutcome } from "../src/reconcileWorkflowRunOutcome.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_workflow_engine";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const catalog = new PgPlatformWorkflowCatalog(pool);
const resolver = createStubAgentResolver();

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
  return run.id;
}

async function setAllStepStatus(
  runId: string,
  status: string,
  stepKeys?: string[],
): Promise<void> {
  if (stepKeys) {
    await pool.query(
      "update workflow_steps set status = $2, completed_at = now() where workflow_run_id = $1 and step_key = any($3::text[])",
      [runId, status, stepKeys],
    );
  } else {
    await pool.query(
      "update workflow_steps set status = $2, completed_at = now() where workflow_run_id = $1",
      [runId, status],
    );
  }
}

async function runStatus(runId: string): Promise<string> {
  const { rows } = await pool.query<{ status: string }>(
    "select status from workflow_runs where id = $1",
    [runId],
  );
  return rows[0]!.status;
}

const ALL_STEP_KEYS = [
  "sara_interpret",
  "nova_plan",
  "pulse_market",
  "reven_pricing",
  "forge_technical",
  "guardian_review",
  "sara_synthesize",
];

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

describe("reconcileWorkflowRunOutcome", () => {
  it("advances a freshly-materialized DRAFT run onward once its steps exist", async () => {
    const runId = await newMaterializedRun("trace-outcome-onset");
    const result = await reconcileWorkflowRunOutcome(pool, runId);
    expect(result.changed).toBe(true);
    expect(await runStatus(runId)).not.toBe("DRAFT");
  });

  it("all required steps succeeded/skipped: run reaches VALIDATING then COMPLETED", async () => {
    const runId = await newMaterializedRun("trace-outcome-complete");
    await setAllStepStatus(runId, "SUCCEEDED", ALL_STEP_KEYS);

    const result = await reconcileWorkflowRunOutcome(pool, runId);
    expect(result.outcome).toBe("COMPLETED");
    expect(await runStatus(runId)).toBe("COMPLETED");

    const { rows: events } = await pool.query(
      "select event_type from workflow_execution_events where workflow_run_id = $1 and event_type = 'run.completed'",
      [runId],
    );
    expect(events).toHaveLength(1);
  });

  it("a required step hard-fails: run reaches FAILED", async () => {
    const runId = await newMaterializedRun("trace-outcome-failed");
    await setAllStepStatus(runId, "SUCCEEDED", [
      "sara_interpret",
      "nova_plan",
      "pulse_market",
      "reven_pricing",
      "forge_technical",
      "guardian_review",
    ]);
    await pool.query(
      "update workflow_steps set status = 'FAILED', error = $2::jsonb, completed_at = now() where workflow_run_id = $1 and step_key = 'sara_synthesize'",
      [runId, JSON.stringify({ retryable: false, code: "worker_error", message: "boom" })],
    );

    const result = await reconcileWorkflowRunOutcome(pool, runId);
    expect(result.outcome).toBe("FAILED");
    expect(await runStatus(runId)).toBe("FAILED");
  });

  it("approval rejection: run reaches REJECTED, not generic FAILED", async () => {
    const runId = await newMaterializedRun("trace-outcome-rejected");
    await setAllStepStatus(runId, "SUCCEEDED", [
      "sara_interpret",
      "nova_plan",
      "pulse_market",
      "reven_pricing",
      "forge_technical",
      "guardian_review",
    ]);
    await pool.query(
      "update workflow_steps set status = 'WAITING_FOR_APPROVAL', updated_at = now() where workflow_run_id = $1 and step_key = 'sara_synthesize'",
      [runId],
    );
    // Park the run at WAITING_FOR_APPROVAL first (mirrors enterWaitingForApproval's effect).
    const parked = await reconcileWorkflowRunOutcome(pool, runId);
    expect(parked.outcome).toBe("WAITING_FOR_APPROVAL");

    await pool.query(
      "update workflow_steps set status = 'FAILED', error = $2::jsonb, completed_at = now() where workflow_run_id = $1 and step_key = 'sara_synthesize'",
      [
        runId,
        JSON.stringify({
          retryable: false,
          code: "approval_rejected",
          message: "rejected by reviewer",
        }),
      ],
    );

    const result = await reconcileWorkflowRunOutcome(pool, runId);
    expect(result.outcome).toBe("REJECTED");
    expect(await runStatus(runId)).toBe("REJECTED");
  });

  it("approval expiration: run reaches EXPIRED", async () => {
    const runId = await newMaterializedRun("trace-outcome-expired");
    await setAllStepStatus(runId, "SUCCEEDED", [
      "sara_interpret",
      "nova_plan",
      "pulse_market",
      "reven_pricing",
      "forge_technical",
      "guardian_review",
    ]);
    await pool.query(
      "update workflow_steps set status = 'WAITING_FOR_APPROVAL', updated_at = now() where workflow_run_id = $1 and step_key = 'sara_synthesize'",
      [runId],
    );
    await reconcileWorkflowRunOutcome(pool, runId); // park at WAITING_FOR_APPROVAL

    await pool.query(
      "update workflow_steps set status = 'EXPIRED', completed_at = now() where workflow_run_id = $1 and step_key = 'sara_synthesize'",
      [runId],
    );

    const result = await reconcileWorkflowRunOutcome(pool, runId);
    expect(result.outcome).toBe("EXPIRED");
    expect(await runStatus(runId)).toBe("EXPIRED");
  });

  it("cancellation: remaining non-terminal steps are cancelled and the run reaches CANCELLED", async () => {
    const runId = await newMaterializedRun("trace-outcome-cancelled");
    await setAllStepStatus(runId, "SUCCEEDED", [
      "sara_interpret",
      "nova_plan",
      "pulse_market",
      "reven_pricing",
      "forge_technical",
      "guardian_review",
    ]);
    await pool.query(
      "update workflow_steps set status = 'WAITING_FOR_APPROVAL', updated_at = now() where workflow_run_id = $1 and step_key = 'sara_synthesize'",
      [runId],
    );
    await reconcileWorkflowRunOutcome(pool, runId); // park at WAITING_FOR_APPROVAL

    await pool.query(
      "update workflow_steps set status = 'CANCELLED', completed_at = now() where workflow_run_id = $1 and step_key = 'sara_synthesize'",
      [runId],
    );

    const result = await reconcileWorkflowRunOutcome(pool, runId);
    expect(result.outcome).toBe("CANCELLED");
    expect(await runStatus(runId)).toBe("CANCELLED");
  });

  it("is idempotent: a second call on an already-terminal run changes nothing and produces no new event", async () => {
    const runId = await newMaterializedRun("trace-outcome-idempotent");
    await setAllStepStatus(runId, "SUCCEEDED", ALL_STEP_KEYS);
    await reconcileWorkflowRunOutcome(pool, runId);
    expect(await runStatus(runId)).toBe("COMPLETED");

    const before = await pool.query(
      "select count(*)::int as count from workflow_execution_events where workflow_run_id = $1",
      [runId],
    );
    const result = await reconcileWorkflowRunOutcome(pool, runId);
    expect(result).toEqual({ changed: false, outcome: null });
    const after = await pool.query(
      "select count(*)::int as count from workflow_execution_events where workflow_run_id = $1",
      [runId],
    );
    expect(after.rows[0]!.count).toBe(before.rows[0]!.count);
  });

  it("cannot bypass a legal transition: a FAILED step under a run status with no legal FAILED transition is a safe no-op", async () => {
    const runId = await newMaterializedRun("trace-outcome-illegal");
    await setAllStepStatus(runId, "SUCCEEDED", [
      "sara_interpret",
      "nova_plan",
      "pulse_market",
      "reven_pricing",
      "forge_technical",
      "guardian_review",
    ]);
    await pool.query(
      "update workflow_steps set status = 'FAILED', error = $2::jsonb, completed_at = now() where workflow_run_id = $1 and step_key = 'sara_synthesize'",
      [runId, JSON.stringify({ retryable: false, code: "worker_error", message: "boom" })],
    );
    // Contrive a run status with no legal transition to FAILED at all
    // (WAITING_FOR_INPUT -> RUNNING | EXPIRED | CANCELLED only).
    await pool.query(
      "update workflow_runs set status = 'WAITING_FOR_INPUT' where id = $1",
      [runId],
    );

    const result = await reconcileWorkflowRunOutcome(pool, runId);
    expect(result).toEqual({ changed: false, outcome: null });
    expect(await runStatus(runId)).toBe("WAITING_FOR_INPUT");
  });

  it("concurrency safety: two concurrent calls for the same completable run apply the transition exactly once", async () => {
    const runId = await newMaterializedRun("trace-outcome-concurrent");
    await setAllStepStatus(runId, "SUCCEEDED", ALL_STEP_KEYS);

    const [a, b] = await Promise.all([
      reconcileWorkflowRunOutcome(pool, runId),
      reconcileWorkflowRunOutcome(pool, runId),
    ]);
    expect([a.outcome, b.outcome]).toContain("COMPLETED");
    expect(await runStatus(runId)).toBe("COMPLETED");

    const { rows: events } = await pool.query(
      "select count(*)::int as count from workflow_execution_events where workflow_run_id = $1 and event_type = 'run.completed'",
      [runId],
    );
    expect(events[0]!.count).toBe(1);
  });

  it("throws for an unknown workflow run id", async () => {
    await expect(
      reconcileWorkflowRunOutcome(pool, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(/not found/);
  });

  it("is a no-op when the run has no materialized steps yet", async () => {
    const run = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId,
      workflowVersionId,
      requestedByUserId: fixtures.userAOwner,
      input: {},
      traceId: "trace-outcome-unmaterialized",
    });
    const result = await reconcileWorkflowRunOutcome(pool, run.id);
    expect(result).toEqual({ changed: false, outcome: null });
  });
});
