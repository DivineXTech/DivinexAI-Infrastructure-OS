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
  cancelWorkflowRun,
  resumeWorkflowRunAfterApproval,
} from "../src/workflowRunService.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_workflow_engine";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const catalog = new PgPlatformWorkflowCatalog(pool);
const resolver = createStubAgentResolver();

let fixtures: CoreFixtures;
let tenantWorkflowId: string;
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

describe("createWorkflowRun", () => {
  it("creates a DRAFT run", async () => {
    const run = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId,
      workflowVersionId,
      requestedByUserId: fixtures.userAOwner,
      input: { clientName: "Acme", clientBrief: "Expand into new markets" },
      traceId: "trace-create-1",
    });
    expect(run.status).toBe("DRAFT");
    expect(run.tenantId).toBe(fixtures.tenantA);
  });

  it("returns the same run when called twice with the same idempotency key", async () => {
    const first = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId,
      workflowVersionId,
      requestedByUserId: fixtures.userAOwner,
      input: {},
      idempotencyKey: "idem-key-1",
      traceId: "trace-idem-1",
    });
    const second = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId,
      workflowVersionId,
      requestedByUserId: fixtures.userAOwner,
      input: { different: "input, ignored on conflict" },
      idempotencyKey: "idem-key-1",
      traceId: "trace-idem-2",
    });
    expect(second.id).toBe(first.id);

    const { rows } = await pool.query(
      "select count(*)::int as count from workflow_runs where idempotency_key = 'idem-key-1'",
    );
    expect(rows[0]!.count).toBe(1);
  });

  it("creates a new run each time when no idempotency key is given", async () => {
    const first = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId,
      workflowVersionId,
      requestedByUserId: fixtures.userAOwner,
      input: {},
      traceId: "trace-no-idem-1",
    });
    const second = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId,
      workflowVersionId,
      requestedByUserId: fixtures.userAOwner,
      input: {},
      traceId: "trace-no-idem-2",
    });
    expect(second.id).not.toBe(first.id);
  });
});

describe("materializeSteps", () => {
  it("creates all seven steps and their dependency edges, and is idempotent on re-run", async () => {
    const run = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId,
      workflowVersionId,
      requestedByUserId: fixtures.userAOwner,
      input: {},
      traceId: "trace-materialize-1",
    });

    await materializeSteps(
      pool,
      fixtures.tenantA,
      run.id,
      clientSolutionAssessmentManifest.steps,
    );

    const { rows: steps } = await pool.query(
      "select step_key from workflow_steps where workflow_run_id = $1",
      [run.id],
    );
    expect(steps).toHaveLength(7);

    const { rows: deps } = await pool.query(
      "select count(*)::int as count from workflow_step_dependencies where workflow_run_id = $1",
      [run.id],
    );
    // sara_interpret(0) + nova_plan(1) + pulse/reven/forge(1 each) + guardian(3) + sara_synthesize(1) = 1+1+1+1+3+1 = 8
    expect(deps[0]!.count).toBe(8);

    // Re-run: idempotent, no duplicates.
    await materializeSteps(
      pool,
      fixtures.tenantA,
      run.id,
      clientSolutionAssessmentManifest.steps,
    );
    const { rows: stepsAgain } = await pool.query(
      "select count(*)::int as count from workflow_steps where workflow_run_id = $1",
      [run.id],
    );
    expect(stepsAgain[0]!.count).toBe(7);
    const { rows: depsAgain } = await pool.query(
      "select count(*)::int as count from workflow_step_dependencies where workflow_run_id = $1",
      [run.id],
    );
    expect(depsAgain[0]!.count).toBe(8);
  });

  it("throws for a capability-kind step (not supported for execution in Phase 3)", async () => {
    const run = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId,
      workflowVersionId,
      requestedByUserId: fixtures.userAOwner,
      input: {},
      traceId: "trace-capability-1",
    });

    await expect(
      materializeSteps(pool, fixtures.tenantA, run.id, [
        {
          stepKey: "cap_step",
          assignment: { kind: "capability", capability: "pricing-analysis" },
          dependsOn: [],
          approvalRequired: false,
          retryPolicy: {
            maxAttempts: 3,
            backoff: "fixed",
            backoffMs: 1000,
            timeoutMs: 60000,
            deadLetterOnExhaustion: true,
          },
          governedAction: null,
        },
      ]),
    ).rejects.toThrow(/capability-based assignment is not yet supported/);
  });
});

describe("cancelWorkflowRun", () => {
  it("cancels a run and its PENDING steps, leaving nothing else to touch", async () => {
    const run = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId,
      workflowVersionId,
      requestedByUserId: fixtures.userAOwner,
      input: {},
      traceId: "trace-cancel-1",
    });
    await materializeSteps(
      pool,
      fixtures.tenantA,
      run.id,
      clientSolutionAssessmentManifest.steps,
    );

    await cancelWorkflowRun(pool, run.id);

    const { rows: runRows } = await pool.query(
      "select status from workflow_runs where id = $1",
      [run.id],
    );
    expect(runRows[0]!.status).toBe("CANCELLED");

    const { rows: stepRows } = await pool.query(
      "select count(*)::int as count from workflow_steps where workflow_run_id = $1 and status = 'CANCELLED'",
      [run.id],
    );
    expect(stepRows[0]!.count).toBe(7);
  });

  it("is a no-op (does not throw) when the run is already terminal", async () => {
    const run = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId,
      workflowVersionId,
      requestedByUserId: fixtures.userAOwner,
      input: {},
      traceId: "trace-cancel-2",
    });
    await cancelWorkflowRun(pool, run.id);
    await expect(cancelWorkflowRun(pool, run.id)).resolves.not.toThrow();

    const { rows } = await pool.query(
      "select status from workflow_runs where id = $1",
      [run.id],
    );
    expect(rows[0]!.status).toBe("CANCELLED");
  });

  it("leaves already-SUCCEEDED steps untouched", async () => {
    const run = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId,
      workflowVersionId,
      requestedByUserId: fixtures.userAOwner,
      input: {},
      traceId: "trace-cancel-3",
    });
    await materializeSteps(
      pool,
      fixtures.tenantA,
      run.id,
      clientSolutionAssessmentManifest.steps,
    );
    await pool.query(
      "update workflow_steps set status = 'SUCCEEDED' where workflow_run_id = $1 and step_key = 'sara_interpret'",
      [run.id],
    );

    await cancelWorkflowRun(pool, run.id);

    const { rows } = await pool.query(
      "select status from workflow_steps where workflow_run_id = $1 and step_key = 'sara_interpret'",
      [run.id],
    );
    expect(rows[0]!.status).toBe("SUCCEEDED");
  });
});

describe("resumeWorkflowRunAfterApproval", () => {
  it("moves a WAITING_FOR_APPROVAL run to RUNNING on approval", async () => {
    const run = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId,
      workflowVersionId,
      requestedByUserId: fixtures.userAOwner,
      input: {},
      traceId: "trace-approve-1",
    });
    await pool.query(
      "update workflow_runs set status = 'WAITING_FOR_APPROVAL' where id = $1",
      [run.id],
    );

    await resumeWorkflowRunAfterApproval(pool, run.id, "approved");

    const { rows } = await pool.query(
      "select status from workflow_runs where id = $1",
      [run.id],
    );
    expect(rows[0]!.status).toBe("RUNNING");
  });

  it("moves a WAITING_FOR_APPROVAL run to REJECTED on rejection, and sets completed_at", async () => {
    const run = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId,
      workflowVersionId,
      requestedByUserId: fixtures.userAOwner,
      input: {},
      traceId: "trace-reject-1",
    });
    await pool.query(
      "update workflow_runs set status = 'WAITING_FOR_APPROVAL' where id = $1",
      [run.id],
    );

    await resumeWorkflowRunAfterApproval(pool, run.id, "rejected");

    const { rows } = await pool.query(
      "select status, completed_at from workflow_runs where id = $1",
      [run.id],
    );
    expect(rows[0]!.status).toBe("REJECTED");
    expect(rows[0]!.completed_at).not.toBeNull();
  });

  it("is a no-op when the run is not currently WAITING_FOR_APPROVAL", async () => {
    const run = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId,
      workflowVersionId,
      requestedByUserId: fixtures.userAOwner,
      input: {},
      traceId: "trace-noop-1",
    });
    await resumeWorkflowRunAfterApproval(pool, run.id, "approved");

    const { rows } = await pool.query(
      "select status from workflow_runs where id = $1",
      [run.id],
    );
    expect(rows[0]!.status).toBe("DRAFT");
  });
});
