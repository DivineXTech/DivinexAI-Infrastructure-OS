import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import {
  PgTenantAccessEvaluator,
  TenantAuthorizationError,
} from "@repo/shared";
import { resetAndMigrate } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { seedPlatformRiskClassificationCatalog } from "../src/seedPlatformRiskClassificationCatalog.js";
import { PgPlatformRiskClassificationCatalog } from "../src/platformRiskClassificationCatalog.js";
import { ApprovalFixtureBuilder } from "./approvalFixtures.js";
import { cancelApprovalRequest } from "../src/cancelApprovalRequest.js";
import { recordApprovalDecision } from "../src/recordApprovalDecision.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_governance";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const riskCatalog = new PgPlatformRiskClassificationCatalog(pool);
const access = new PgTenantAccessEvaluator(pool);
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

describe("cancelApprovalRequest", () => {
  it("cancels a pending request and cancels the linked step", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    const updated = await cancelApprovalRequest(
      pool,
      access,
      request.id,
      fixtures.userAOwner,
    );
    expect(updated.status).toBe("CANCELLED");

    const { rows } = await pool.query<{ status: string }>(
      "select status from workflow_steps where id = $1",
      [request.workflowStepId],
    );
    expect(rows[0]!.status).toBe("CANCELLED");
  });

  it("is idempotent on an already-terminal request (successful no-op, not an error)", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    await cancelApprovalRequest(pool, access, request.id, fixtures.userAOwner);
    await expect(
      cancelApprovalRequest(pool, access, request.id, fixtures.userAOwner),
    ).resolves.toMatchObject({ status: "CANCELLED" });
  });

  it("rejects an actor without tenant.decide_approvals", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    await expect(
      cancelApprovalRequest(pool, access, request.id, fixtures.userAMember),
    ).rejects.toThrow(TenantAuthorizationError);
  });

  it("is idempotent on a request already resolved via recordApprovalDecision", async () => {
    const request = await builder.createFullApprovalRequest(
      fixtures.tenantA,
      riskClassificationVersionId,
    );
    await pool.query(
      "insert into approval_assignments (tenant_id, approval_request_id, assignee_user_id) values ($1, $2, $3)",
      [fixtures.tenantA, request.id, fixtures.userADecider],
    );
    await recordApprovalDecision(pool, access, {
      approvalRequestId: request.id,
      deciderUserId: fixtures.userADecider,
      decision: "APPROVED",
    });

    const result = await cancelApprovalRequest(
      pool,
      access,
      request.id,
      fixtures.userAOwner,
    );
    expect(result.status).toBe("APPROVED"); // no-op, cancellation cannot override an already-terminal outcome
  });
});
