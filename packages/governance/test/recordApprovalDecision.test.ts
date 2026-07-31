import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PgTenantAccessEvaluator } from "@repo/shared";
import { resetAndMigrate } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { seedPlatformRiskClassificationCatalog } from "../src/seedPlatformRiskClassificationCatalog.js";
import { PgPlatformRiskClassificationCatalog } from "../src/platformRiskClassificationCatalog.js";
import { ApprovalFixtureBuilder } from "./approvalFixtures.js";
import { recordApprovalDecision } from "../src/recordApprovalDecision.js";
import {
  AlreadyResolvedError,
  NotAssignedApproverError,
} from "../src/errors.js";
import { SelfApprovalProhibitedError } from "../src/separationOfDuties.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_governance";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const riskCatalog = new PgPlatformRiskClassificationCatalog(pool);
const access = new PgTenantAccessEvaluator(pool);
const builder = new ApprovalFixtureBuilder(pool);

let fixtures: CoreFixtures;
let riskClassificationVersionId: string;

async function assignApprover(
  approvalRequestId: string,
  tenantId: string,
  userId: string,
): Promise<void> {
  await pool.query(
    "insert into approval_assignments (tenant_id, approval_request_id, assignee_user_id) values ($1, $2, $3)",
    [tenantId, approvalRequestId, userId],
  );
}

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

describe("recordApprovalDecision — single approval", () => {
  it("requiredApprovalCount = 1 reaches APPROVED on the first decision, and resumes the step", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
      { requiredApprovalCount: 1 },
    );
    await assignApprover(request.id, fixtures.tenantA, fixtures.userADecider);

    const updated = await recordApprovalDecision(pool, access, {
      approvalRequestId: request.id,
      deciderUserId: fixtures.userADecider,
      decision: "APPROVED",
    });

    expect(updated.status).toBe("APPROVED");
    expect(updated.continuationCommitted).toBe(true);

    const { rows: stepRows } = await pool.query<{ status: string; output: unknown }>(
      "select status, output from workflow_steps where id = $1",
      [request.workflowStepId],
    );
    expect(stepRows[0]!.status).toBe("SUCCEEDED");
    expect(stepRows[0]!.output).toEqual({ summary: "done" });
  });
});

describe("recordApprovalDecision — multi-approval quorum", () => {
  it("requiredApprovalCount = 2: first decision -> PARTIALLY_APPROVED, second -> APPROVED", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
      { requiredApprovalCount: 2 },
    );
    await assignApprover(request.id, fixtures.tenantA, fixtures.userAOwner);
    await assignApprover(request.id, fixtures.tenantA, fixtures.userADecider);

    const first = await recordApprovalDecision(pool, access, {
      approvalRequestId: request.id,
      deciderUserId: fixtures.userAOwner,
      decision: "APPROVED",
    });
    expect(first.status).toBe("PARTIALLY_APPROVED");

    const second = await recordApprovalDecision(pool, access, {
      approvalRequestId: request.id,
      deciderUserId: fixtures.userADecider,
      decision: "APPROVED",
    });
    expect(second.status).toBe("APPROVED");
  });
});

describe("recordApprovalDecision — distinct approver enforcement", () => {
  it("the same decider deciding twice is absorbed, not double-counted toward quorum", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
      { requiredApprovalCount: 2 },
    );
    await assignApprover(request.id, fixtures.tenantA, fixtures.userAOwner);
    await assignApprover(request.id, fixtures.tenantA, fixtures.userAMember);

    const first = await recordApprovalDecision(pool, access, {
      approvalRequestId: request.id,
      deciderUserId: fixtures.userAOwner,
      decision: "APPROVED",
    });
    expect(first.status).toBe("PARTIALLY_APPROVED");

    // Same decider decides again — absorbed by the unique(approval_request_id,
    // decided_by_user_id) constraint, not a second vote.
    const second = await recordApprovalDecision(pool, access, {
      approvalRequestId: request.id,
      deciderUserId: fixtures.userAOwner,
      decision: "APPROVED",
    });
    expect(second.status).toBe("PARTIALLY_APPROVED");

    const { rows } = await pool.query(
      "select count(*)::int as count from approval_decisions where approval_request_id = $1",
      [request.id],
    );
    expect(rows[0]!.count).toBe(1);
  });
});

describe("recordApprovalDecision — rejection behavior", () => {
  it("short-circuits to REJECTED with rejectOnFirstRejection = true, and rejects the step", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
      { requiredApprovalCount: 2, rejectOnFirstRejection: true },
    );
    await assignApprover(request.id, fixtures.tenantA, fixtures.userAOwner);

    const updated = await recordApprovalDecision(pool, access, {
      approvalRequestId: request.id,
      deciderUserId: fixtures.userAOwner,
      decision: "REJECTED",
      comment: "not authorized for this quarter",
    });
    expect(updated.status).toBe("REJECTED");

    const { rows: stepRows } = await pool.query<{ status: string; error: { code: string } }>(
      "select status, error from workflow_steps where id = $1",
      [request.workflowStepId],
    );
    expect(stepRows[0]!.status).toBe("FAILED");
    expect(stepRows[0]!.error.code).toBe("approval_rejected");
  });
});

describe("recordApprovalDecision — authorization and integrity", () => {
  it("rejects a user with tenant.decide_approvals but no assignment", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    // userAOwner holds every permission but was never assigned to this request.
    await expect(
      recordApprovalDecision(pool, access, {
        approvalRequestId: request.id,
        deciderUserId: fixtures.userAOwner,
        decision: "APPROVED",
      }),
    ).rejects.toThrow(NotAssignedApproverError);
  });

  it("rejects the requesting user deciding their own request (separation of duties)", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
      { requestingActor: { type: "user", id: fixtures.userAOwner } },
    );
    await assignApprover(request.id, fixtures.tenantA, fixtures.userAOwner);

    await expect(
      recordApprovalDecision(pool, access, {
        approvalRequestId: request.id,
        deciderUserId: fixtures.userAOwner,
        decision: "APPROVED",
      }),
    ).rejects.toThrow(SelfApprovalProhibitedError);
  });

  it("rejects a decision on an already-terminal request", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    await assignApprover(request.id, fixtures.tenantA, fixtures.userADecider);
    await recordApprovalDecision(pool, access, {
      approvalRequestId: request.id,
      deciderUserId: fixtures.userADecider,
      decision: "APPROVED",
    });

    await expect(
      recordApprovalDecision(pool, access, {
        approvalRequestId: request.id,
        deciderUserId: fixtures.userADecider,
        decision: "APPROVED",
      }),
    ).rejects.toThrow(AlreadyResolvedError);
  });

  it("rejects a user without tenant.decide_approvals entirely, even if assigned", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    await assignApprover(request.id, fixtures.tenantA, fixtures.userAMember);
    await expect(
      recordApprovalDecision(pool, access, {
        approvalRequestId: request.id,
        deciderUserId: fixtures.userAMember,
        decision: "APPROVED",
      }),
    ).rejects.toThrow();
  });

  it("rejects a decider who is not a member of the request's tenant at all", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    await expect(
      recordApprovalDecision(pool, access, {
        approvalRequestId: request.id,
        deciderUserId: fixtures.userB,
        decision: "APPROVED",
      }),
    ).rejects.toThrow();
  });
});
