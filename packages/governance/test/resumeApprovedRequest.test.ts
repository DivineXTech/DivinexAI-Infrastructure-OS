import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { resetAndMigrate } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { seedPlatformRiskClassificationCatalog } from "../src/seedPlatformRiskClassificationCatalog.js";
import { PgPlatformRiskClassificationCatalog } from "../src/platformRiskClassificationCatalog.js";
import { ApprovalFixtureBuilder } from "./approvalFixtures.js";
import { resumeApprovedRequest } from "../src/resumeApprovedRequest.js";
import { PayloadIntegrityError } from "../src/errors.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_governance";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const riskCatalog = new PgPlatformRiskClassificationCatalog(pool);
const builder = new ApprovalFixtureBuilder(pool);

let fixtures: CoreFixtures;
let riskClassificationVersionId: string;

async function forceApprovedNotYetResumed(requestId: string): Promise<void> {
  await pool.query(
    "update approval_requests set status = 'APPROVED', continuation_committed = false, resolved_at = now() where id = $1",
    [requestId],
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

describe("resumeApprovedRequest", () => {
  it("resumes the step exactly once and commits continuation_committed", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    await forceApprovedNotYetResumed(request.id);

    const result = await resumeApprovedRequest(pool, request.id);
    expect(result.resumed).toBe(true);

    const { rows } = await pool.query<{ status: string; output: unknown }>(
      "select status, output from workflow_steps where id = $1",
      [request.workflowStepId],
    );
    expect(rows[0]!.status).toBe("SUCCEEDED");
    expect(rows[0]!.output).toEqual({ summary: "done" });
  });

  it("is a no-op when continuation_committed is already true (already resumed)", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    await forceApprovedNotYetResumed(request.id);
    const first = await resumeApprovedRequest(pool, request.id);
    expect(first.resumed).toBe(true);

    const second = await resumeApprovedRequest(pool, request.id);
    expect(second.resumed).toBe(false);
  });

  it("fails closed on a corrupted action snapshot (payload-hash mismatch)", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    await forceApprovedNotYetResumed(request.id);
    // Corrupt the snapshot's parameters without recomputing payload_hash —
    // simulates data corruption/tampering.
    await pool.query(
      `update approval_requests
       set action_snapshot = jsonb_set(action_snapshot, '{parameters,recipient}', '"attacker@example.com"')
       where id = $1`,
      [request.id],
    );

    await expect(resumeApprovedRequest(pool, request.id)).rejects.toThrow(
      PayloadIntegrityError,
    );

    const { rows } = await pool.query<{ status: string }>(
      "select status from workflow_steps where id = $1",
      [request.workflowStepId],
    );
    expect(rows[0]!.status).toBe("WAITING_FOR_APPROVAL"); // not resumed
  });

  it("exactly-once resume under concurrency: two concurrent calls apply the transition exactly once", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    await forceApprovedNotYetResumed(request.id);

    const [a, b] = await Promise.all([
      resumeApprovedRequest(pool, request.id),
      resumeApprovedRequest(pool, request.id),
    ]);
    const resumedCount = [a.resumed, b.resumed].filter(Boolean).length;
    expect(resumedCount).toBe(1);

    const { rows } = await pool.query<{ status: string }>(
      "select status from workflow_steps where id = $1",
      [request.workflowStepId],
    );
    expect(rows[0]!.status).toBe("SUCCEEDED");

    const { rows: events } = await pool.query(
      "select count(*)::int as count from governance_events where approval_request_id = $1 and event_type = 'workflow.resumed'",
      [request.id],
    );
    expect(events[0]!.count).toBe(1);
  });
});
