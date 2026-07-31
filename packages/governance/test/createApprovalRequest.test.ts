import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { resetAndMigrate } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { seedPlatformRiskClassificationCatalog } from "../src/seedPlatformRiskClassificationCatalog.js";
import { PgPlatformRiskClassificationCatalog } from "../src/platformRiskClassificationCatalog.js";
import { createApprovalRequest } from "../src/createApprovalRequest.js";
import { ApprovalFixtureBuilder } from "./approvalFixtures.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_governance";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const riskCatalog = new PgPlatformRiskClassificationCatalog(pool);
const builder = new ApprovalFixtureBuilder(pool);

let fixtures: CoreFixtures;
let riskClassificationVersionId: string;

beforeAll(async () => {
  await resetAndMigrate(pool);
  fixtures = await seedCoreFixtures(pool);
  await seedPlatformRiskClassificationCatalog(pool, [
    { action: "*", version: "1.0.0", riskLevel: "LOW", rationale: "floor" },
  ]);
  const version = await riskCatalog.getPublishedVersionForAction("*");
  riskClassificationVersionId = version!.id;
});

afterAll(async () => {
  await pool.end();
});

describe("createApprovalRequest", () => {
  it("creates a PENDING request with the computed payload hash", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    expect(request.status).toBe("PENDING");
    expect(request.payloadHash).toHaveLength(64);
  });

  it("idempotent creation: same payload hash on the same step returns the existing request unchanged", async () => {
    const { workflowRunId, workflowStepId } = await builder.materializeRunAndStep(
      fixtures.tenantA,
    );
    const policyEvaluationId = await builder.insertPolicyEvaluation({
      tenantId: fixtures.tenantA,
      workflowRunId,
      workflowStepId,
      riskClassificationVersionId,
    });
    const snapshot = builder.buildSnapshot({
      workflowRunId,
      workflowStepId,
      policyDecisionId: policyEvaluationId,
      riskClassificationVersionId,
    });

    const first = await createApprovalRequest(pool, {
      tenantId: fixtures.tenantA,
      policyEvaluationId,
      workflowRunId,
      workflowStepId,
      actionSnapshot: snapshot,
      requiredApprovalCount: 1,
      requiredApproverRoles: [],
      rejectOnFirstRejection: true,
      expiresAt: null,
    });
    const second = await createApprovalRequest(pool, {
      tenantId: fixtures.tenantA,
      policyEvaluationId,
      workflowRunId,
      workflowStepId,
      actionSnapshot: snapshot,
      requiredApprovalCount: 1,
      requiredApproverRoles: [],
      rejectOnFirstRejection: true,
      expiresAt: null,
    });
    expect(second.id).toBe(first.id);

    const { rows } = await pool.query(
      "select count(*)::int as count from approval_requests where workflow_step_id = $1",
      [workflowStepId],
    );
    expect(rows[0]!.count).toBe(1);
  });

  it("supersession: a changed proposal supersedes the prior active request", async () => {
    const { workflowRunId, workflowStepId } = await builder.materializeRunAndStep(
      fixtures.tenantA,
    );
    const policyEvaluationId = await builder.insertPolicyEvaluation({
      tenantId: fixtures.tenantA,
      workflowRunId,
      workflowStepId,
      riskClassificationVersionId,
    });

    const original = await createApprovalRequest(pool, {
      tenantId: fixtures.tenantA,
      policyEvaluationId,
      workflowRunId,
      workflowStepId,
      actionSnapshot: builder.buildSnapshot({
        workflowRunId,
        workflowStepId,
        policyDecisionId: policyEvaluationId,
        riskClassificationVersionId,
        parameters: { recipient: "a@example.com" },
      }),
      requiredApprovalCount: 1,
      requiredApproverRoles: [],
      rejectOnFirstRejection: true,
      expiresAt: null,
    });

    const superseding = await createApprovalRequest(pool, {
      tenantId: fixtures.tenantA,
      policyEvaluationId,
      workflowRunId,
      workflowStepId,
      actionSnapshot: builder.buildSnapshot({
        workflowRunId,
        workflowStepId,
        policyDecisionId: policyEvaluationId,
        riskClassificationVersionId,
        parameters: { recipient: "b@example.com" }, // changed -> different payload hash
      }),
      requiredApprovalCount: 1,
      requiredApproverRoles: [],
      rejectOnFirstRejection: true,
      expiresAt: null,
    });

    expect(superseding.id).not.toBe(original.id);
    expect(superseding.status).toBe("PENDING");

    const { rows } = await pool.query<{ status: string; superseded_by_request_id: string }>(
      "select status, superseded_by_request_id from approval_requests where id = $1",
      [original.id],
    );
    expect(rows[0]!.status).toBe("SUPERSEDED");
    expect(rows[0]!.superseded_by_request_id).toBe(superseding.id);

    // Exactly one active (non-terminal) request remains for the step.
    const { rows: activeRows } = await pool.query(
      `select id from approval_requests
       where workflow_step_id = $1
         and status not in ('APPROVED','REJECTED','EXPIRED','CANCELLED','SUPERSEDED')`,
      [workflowStepId],
    );
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0]!.id).toBe(superseding.id);
  });
});
