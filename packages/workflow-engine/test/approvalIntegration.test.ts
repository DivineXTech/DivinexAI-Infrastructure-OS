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
import {
  enterWaitingForApproval,
  resumeWorkflowStepAfterApproval,
  rejectWorkflowStepApproval,
  expireWorkflowStepApproval,
  cancelWorkflowStepApproval,
} from "../src/approvalIntegration.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_workflow_engine";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const catalog = new PgPlatformWorkflowCatalog(pool);
const resolver = createStubAgentResolver();

let fixtures: CoreFixtures;
let tenantWorkflowId: string;
let workflowVersionId: string;

async function newStepId(traceId: string, status = "RUNNING"): Promise<string> {
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
  const { rows } = await pool.query<{ id: string }>(
    "select id from workflow_steps where workflow_run_id = $1 and step_key = 'sara_interpret'",
    [run.id],
  );
  const stepId = rows[0]!.id;
  await pool.query(
    "update workflow_steps set status = $2, lease_owner = 'w', lease_token = gen_random_uuid() where id = $1",
    [stepId, status],
  );
  return stepId;
}

async function stepStatus(stepId: string): Promise<string> {
  const { rows } = await pool.query<{ status: string }>(
    "select status from workflow_steps where id = $1",
    [stepId],
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

describe("enterWaitingForApproval", () => {
  it("transitions RUNNING -> WAITING_FOR_APPROVAL and releases the lease", async () => {
    const stepId = await newStepId("trace-enter-1");
    const applied = await enterWaitingForApproval(pool, stepId);
    expect(applied).toBe(true);
    expect(await stepStatus(stepId)).toBe("WAITING_FOR_APPROVAL");

    const { rows } = await pool.query(
      "select lease_token from workflow_steps where id = $1",
      [stepId],
    );
    expect(rows[0]!.lease_token).toBeNull();
  });

  it("is a no-op when the step is not currently RUNNING", async () => {
    const stepId = await newStepId("trace-enter-2", "PENDING");
    const applied = await enterWaitingForApproval(pool, stepId);
    expect(applied).toBe(false);
    expect(await stepStatus(stepId)).toBe("PENDING");
  });
});

describe("resumeWorkflowStepAfterApproval", () => {
  it("resumes WAITING_FOR_APPROVAL -> SUCCEEDED with the snapshotted output, never re-invoking the agent", async () => {
    const stepId = await newStepId("trace-resume-1", "WAITING_FOR_APPROVAL");
    const applied = await resumeWorkflowStepAfterApproval(pool, stepId, {
      approved: true,
    });
    expect(applied).toBe(true);
    const { rows } = await pool.query(
      "select status, output from workflow_steps where id = $1",
      [stepId],
    );
    expect(rows[0]!.status).toBe("SUCCEEDED");
    expect(rows[0]!.output).toEqual({ approved: true });
  });

  it("is a no-op when the step is not currently WAITING_FOR_APPROVAL (already resumed)", async () => {
    const stepId = await newStepId("trace-resume-2", "SUCCEEDED");
    const applied = await resumeWorkflowStepAfterApproval(pool, stepId, {});
    expect(applied).toBe(false);
  });
});

describe("rejectWorkflowStepApproval", () => {
  it("transitions WAITING_FOR_APPROVAL -> FAILED with a structured approval_rejected error", async () => {
    const stepId = await newStepId("trace-reject-1", "WAITING_FOR_APPROVAL");
    const applied = await rejectWorkflowStepApproval(pool, stepId, {
      retryable: false,
      code: "approval_rejected",
      message: "rejected by reviewer",
    });
    expect(applied).toBe(true);
    const { rows } = await pool.query(
      "select status, error from workflow_steps where id = $1",
      [stepId],
    );
    expect(rows[0]!.status).toBe("FAILED");
    expect(rows[0]!.error).toEqual({
      retryable: false,
      code: "approval_rejected",
      message: "rejected by reviewer",
    });
  });
});

describe("expireWorkflowStepApproval", () => {
  it("transitions WAITING_FOR_APPROVAL -> EXPIRED", async () => {
    const stepId = await newStepId("trace-expire-1", "WAITING_FOR_APPROVAL");
    const applied = await expireWorkflowStepApproval(pool, stepId);
    expect(applied).toBe(true);
    expect(await stepStatus(stepId)).toBe("EXPIRED");
  });
});

describe("cancelWorkflowStepApproval", () => {
  it("transitions WAITING_FOR_APPROVAL -> CANCELLED", async () => {
    const stepId = await newStepId("trace-cancel-1", "WAITING_FOR_APPROVAL");
    const applied = await cancelWorkflowStepApproval(pool, stepId);
    expect(applied).toBe(true);
    expect(await stepStatus(stepId)).toBe("CANCELLED");
  });
});
