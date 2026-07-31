import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { resetAndMigrate } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { seedPlatformRiskClassificationCatalog } from "../src/seedPlatformRiskClassificationCatalog.js";
import { PgPlatformRiskClassificationCatalog } from "../src/platformRiskClassificationCatalog.js";
import { ApprovalFixtureBuilder } from "./approvalFixtures.js";
import { reconcileGovernanceRuntime } from "../src/recovery.js";

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

describe("reconcileGovernanceRuntime", () => {
  it("expires a due request and transitions the linked step to EXPIRED", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    await pool.query(
      "update approval_requests set expires_at = now() - interval '1 minute' where id = $1",
      [request.id],
    );

    const result = await reconcileGovernanceRuntime(pool);
    expect(result.requestsExpired).toBeGreaterThanOrEqual(1);

    const { rows: requestRows } = await pool.query<{ status: string }>(
      "select status from approval_requests where id = $1",
      [request.id],
    );
    expect(requestRows[0]!.status).toBe("EXPIRED");

    const { rows: stepRows } = await pool.query<{ status: string }>(
      "select status from workflow_steps where id = $1",
      [request.workflowStepId],
    );
    expect(stepRows[0]!.status).toBe("EXPIRED");
  });

  it("does not touch a request whose expiry is in the future", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    await pool.query(
      "update approval_requests set expires_at = now() + interval '1 hour' where id = $1",
      [request.id],
    );

    await reconcileGovernanceRuntime(pool);

    const { rows } = await pool.query<{ status: string }>(
      "select status from approval_requests where id = $1",
      [request.id],
    );
    expect(rows[0]!.status).toBe("PENDING");
  });

  it("resumes an APPROVED-but-not-yet-committed request (simulated crash between decision and resumption)", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    await pool.query(
      "update approval_requests set status = 'APPROVED', continuation_committed = false where id = $1",
      [request.id],
    );

    const result = await reconcileGovernanceRuntime(pool);
    expect(result.requestsResumed).toBeGreaterThanOrEqual(1);

    const { rows: stepRows } = await pool.query<{ status: string }>(
      "select status from workflow_steps where id = $1",
      [request.workflowStepId],
    );
    expect(stepRows[0]!.status).toBe("SUCCEEDED");

    const { rows: requestRows } = await pool.query<{
      continuation_committed: boolean;
    }>("select continuation_committed from approval_requests where id = $1", [
      request.id,
    ]);
    expect(requestRows[0]!.continuation_committed).toBe(true);
  });

  it("reconciles a step still WAITING_FOR_APPROVAL whose request already reached a terminal state (missed transition)", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    // Simulate a crash: the request reached CANCELLED but the step never
    // got its own transition applied.
    await pool.query(
      "update approval_requests set status = 'CANCELLED', resolved_at = now() where id = $1",
      [request.id],
    );

    const result = await reconcileGovernanceRuntime(pool);
    expect(result.stepsReconciled).toBeGreaterThanOrEqual(1);

    const { rows } = await pool.query<{ status: string }>(
      "select status from workflow_steps where id = $1",
      [request.workflowStepId],
    );
    expect(rows[0]!.status).not.toBe("WAITING_FOR_APPROVAL");
  });

  it("is safe to run repeatedly with nothing to do", async () => {
    await expect(reconcileGovernanceRuntime(pool)).resolves.toBeDefined();
    await expect(reconcileGovernanceRuntime(pool)).resolves.toBeDefined();
  });

  it("full sweep: expiry, pending-continuation, and orphaned-terminal-step cases together in one call", async () => {
    const expiring = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    await pool.query(
      "update approval_requests set expires_at = now() - interval '1 minute' where id = $1",
      [expiring.id],
    );

    const pendingContinuation = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    await pool.query(
      "update approval_requests set status = 'APPROVED', continuation_committed = false where id = $1",
      [pendingContinuation.id],
    );

    const orphaned = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    await pool.query(
      "update approval_requests set status = 'REJECTED', resolved_at = now() where id = $1",
      [orphaned.id],
    );

    const result = await reconcileGovernanceRuntime(pool);
    expect(result.requestsExpired).toBeGreaterThanOrEqual(1);
    expect(result.requestsResumed).toBeGreaterThanOrEqual(1);
    expect(result.stepsReconciled).toBeGreaterThanOrEqual(1);

    const { rows } = await pool.query<{ id: string; status: string }>(
      `select id, status from workflow_steps where id in ($1, $2, $3)`,
      [expiring.workflowStepId, pendingContinuation.workflowStepId, orphaned.workflowStepId],
    );
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.status]));
    expect(byId[expiring.workflowStepId]).toBe("EXPIRED");
    expect(byId[pendingContinuation.workflowStepId]).toBe("SUCCEEDED");
    expect(byId[orphaned.workflowStepId]).not.toBe("WAITING_FOR_APPROVAL");
  });
});
