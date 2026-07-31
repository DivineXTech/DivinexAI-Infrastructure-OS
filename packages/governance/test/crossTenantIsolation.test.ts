import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { resetAndMigrate, asUser } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { seedPlatformRiskClassificationCatalog } from "../src/seedPlatformRiskClassificationCatalog.js";
import { seedPlatformPolicyCatalog } from "../src/seedPlatformPolicyCatalog.js";
import { PgPlatformRiskClassificationCatalog } from "../src/platformRiskClassificationCatalog.js";
import { ApprovalFixtureBuilder } from "./approvalFixtures.js";

/**
 * RLS tests for the Phase 4 migrations (20260731000001, 20260731000002),
 * against real Postgres with the restricted `authenticated` role — mirrors
 * packages/workflow-engine/test/crossTenantIsolation.test.ts. The
 * `approval_requests`/`approval_decisions` cases are the ones required
 * explicitly by Decision 3's review: an authenticated user holding *every*
 * relevant permission still cannot INSERT/UPDATE/DELETE those two tables —
 * only SELECT succeeds.
 */

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_governance";
const TEST_DATABASE_URL_AUTHENTICATED =
  process.env.TEST_DATABASE_URL_AUTHENTICATED ??
  "postgres://authenticated:authenticated@127.0.0.1:5432/agentflow_test_governance";

const ownerPool = new Pool({ connectionString: TEST_DATABASE_URL });
const authPool = new Pool({
  connectionString: TEST_DATABASE_URL_AUTHENTICATED,
});
const riskCatalog = new PgPlatformRiskClassificationCatalog(ownerPool);
const builder = new ApprovalFixtureBuilder(ownerPool);

let fixtures: CoreFixtures;
let riskClassificationVersionId: string;
let tenantARequestId: string;
let tenantBRequestId: string;

async function assignApprover(
  approvalRequestId: string,
  tenantId: string,
  userId: string,
): Promise<void> {
  await ownerPool.query(
    "insert into approval_assignments (tenant_id, approval_request_id, assignee_user_id) values ($1, $2, $3)",
    [tenantId, approvalRequestId, userId],
  );
}

beforeAll(async () => {
  await resetAndMigrate(ownerPool);
  fixtures = await seedCoreFixtures(ownerPool);
  await seedPlatformRiskClassificationCatalog(ownerPool, [
    { action: "*", version: "1.0.0", riskLevel: "LOW", rationale: "floor" },
  ]);
  await seedPlatformPolicyCatalog(ownerPool, [
    {
      slug: "test-visible-policy",
      displayName: "Test Visible Policy",
      description: "test",
      version: "1.0.0",
      document: {
        appliesToActions: ["data.export"],
        conditions: { field: "action", operator: "eq", value: "data.export" },
        effect: "REQUIRE_APPROVAL",
        riskLevel: null,
        requiredPermissions: [],
        requiredApproverRoles: [],
        requiredApprovalCount: 1,
        rejectOnFirstRejection: true,
        approvalExpirationMs: null,
      },
      priority: 100,
      mandatory: false,
      overridePolicy: "overridable",
    },
  ]);
  const version = await riskCatalog.getPublishedVersionForAction("*");
  riskClassificationVersionId = version!.id;

  const tenantARequest = await builder.createFullApprovalRequest(
    fixtures.tenantA,
    riskClassificationVersionId,
  );
  tenantARequestId = tenantARequest.id;

  await assignApprover(
    tenantARequestId,
    fixtures.tenantA,
    fixtures.userADecider,
  );

  const tenantBRequest = await builder.createFullApprovalRequest(
    fixtures.tenantB,
    riskClassificationVersionId,
  );
  tenantBRequestId = tenantBRequest.id;
});

afterAll(async () => {
  await ownerPool.end();
  await authPool.end();
});

describe("platform policy/risk-classification catalog RLS", () => {
  it("any authenticated user can read policy_definitions and published policy_versions", async () => {
    const rows = await asUser(authPool, fixtures.userAOwner, async (client) => {
      const res = await client.query(
        "select pv.id from policy_versions pv join policy_definitions pd on pd.id = pv.policy_definition_id where pd.slug = 'test-visible-policy'",
      );
      return res.rows;
    });
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("an unauthenticated session sees zero policy_definitions", async () => {
    const rows = await asUser(authPool, null, async (client) => {
      const res = await client.query("select 1 from policy_definitions");
      return res.rows;
    });
    expect(rows).toHaveLength(0);
  });

  it("no authenticated user can insert into policy_definitions (platform writes are service-role-only)", async () => {
    await expect(
      asUser(authPool, fixtures.userAOwner, async (client) =>
        client.query(
          "insert into policy_definitions (slug, display_name, description) values ('rogue', 'Rogue', 'x')",
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("approval_requests: direct client mutation attempts (Decision 3)", () => {
  it("a user holding tenant.view_approvals and tenant.decide_approvals can SELECT tenant A's request", async () => {
    const rows = await asUser(authPool, fixtures.userAOwner, async (client) => {
      const res = await client.query(
        "select id from approval_requests where id = $1",
        [tenantARequestId],
      );
      return res.rows;
    });
    expect(rows).toHaveLength(1);
  });

  it("cannot INSERT into approval_requests, even holding every relevant permission", async () => {
    await expect(
      asUser(authPool, fixtures.userAOwner, async (client) =>
        client.query(
          `insert into approval_requests
             (tenant_id, policy_evaluation_id, workflow_run_id, workflow_step_id, action_snapshot, payload_hash)
           values ($1, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), '{}'::jsonb, 'x')`,
          [fixtures.tenantA],
        ),
      ),
    ).rejects.toThrow();
  });

  it("cannot UPDATE approval_requests.status directly, even as the tenant owner", async () => {
    const result = await asUser(authPool, fixtures.userAOwner, async (client) =>
      client.query(
        "update approval_requests set status = 'CANCELLED' where id = $1",
        [tenantARequestId],
      ),
    );
    expect(result.rowCount).toBe(0);

    const { rows } = await ownerPool.query<{ status: string }>(
      "select status from approval_requests where id = $1",
      [tenantARequestId],
    );
    expect(rows[0]!.status).toBe("PENDING");
  });

  it("cannot DELETE an approval_requests row", async () => {
    const result = await asUser(authPool, fixtures.userAOwner, async (client) =>
      client.query("delete from approval_requests where id = $1", [
        tenantARequestId,
      ]),
    );
    expect(result.rowCount).toBe(0);
  });

  it("a tenant A member cannot select tenant B's approval_requests row", async () => {
    const rows = await asUser(authPool, fixtures.userAOwner, async (client) => {
      const res = await client.query(
        "select id from approval_requests where id = $1",
        [tenantBRequestId],
      );
      return res.rows;
    });
    expect(rows).toHaveLength(0);
  });

  it("a user with no governance permission at all sees zero approval_requests rows", async () => {
    const rows = await asUser(
      authPool,
      fixtures.userAMember,
      async (client) => {
        const res = await client.query("select 1 from approval_requests");
        return res.rows;
      },
    );
    expect(rows).toHaveLength(0);
  });
});

describe("approval_decisions: direct client mutation attempts (Decision 3)", () => {
  it("cannot INSERT into approval_decisions directly, even holding tenant.decide_approvals", async () => {
    await expect(
      asUser(authPool, fixtures.userADecider, async (client) =>
        client.query(
          `insert into approval_decisions (tenant_id, approval_request_id, decision, decided_by_user_id)
           values ($1, $2, 'APPROVED', $3)`,
          [fixtures.tenantA, tenantARequestId, fixtures.userADecider],
        ),
      ),
    ).rejects.toThrow();
  });

  it("cannot UPDATE or DELETE an approval_decisions row (immutable after insertion)", async () => {
    await ownerPool.query(
      `insert into approval_decisions (tenant_id, approval_request_id, decision, decided_by_user_id)
       values ($1, $2, 'APPROVED', $3)`,
      [fixtures.tenantA, tenantARequestId, fixtures.userADecider],
    );
    const updateResult = await asUser(
      authPool,
      fixtures.userADecider,
      async (client) =>
        client.query(
          "update approval_decisions set comment = 'tampered' where approval_request_id = $1",
          [tenantARequestId],
        ),
    );
    expect(updateResult.rowCount).toBe(0);

    const deleteResult = await asUser(
      authPool,
      fixtures.userADecider,
      async (client) =>
        client.query(
          "delete from approval_decisions where approval_request_id = $1",
          [tenantARequestId],
        ),
    );
    expect(deleteResult.rowCount).toBe(0);
  });
});

describe("tenant-owned governance tables: cross-tenant isolation", () => {
  it("a tenant A member sees only tenant A's policy_evaluations rows", async () => {
    const rows = await asUser(authPool, fixtures.userAOwner, async (client) => {
      const res = await client.query(
        "select tenant_id from policy_evaluations",
      );
      return res.rows;
    });
    expect(rows.every((r) => r.tenant_id === fixtures.tenantA)).toBe(true);
  });

  it("no authenticated user can insert into governance_events (append-only, service-role-only)", async () => {
    await expect(
      asUser(authPool, fixtures.userAOwner, async (client) =>
        client.query(
          `insert into governance_events (tenant_id, event_type, actor_type, trace_id, correlation_id)
           values ($1, 'rogue.event', 'user', 'trace-x', 'corr-x')`,
          [fixtures.tenantA],
        ),
      ),
    ).rejects.toThrow();
  });

  it("an unauthenticated session sees zero rows across all 7 tenant-owned tables", async () => {
    for (const table of [
      "tenant_policy_assignments",
      "tenant_policy_overrides",
      "policy_evaluations",
      "approval_requests",
      "approval_decisions",
      "approval_assignments",
      "governance_events",
    ]) {
      const rows = await asUser(authPool, null, async (client) => {
        const res = await client.query(`select 1 from ${table}`);
        return res.rows;
      });
      expect(rows).toHaveLength(0);
    }
  });

  it("rejects a policy_evaluations row whose tenant_id does not match its workflow_run's tenant_id", async () => {
    const { workflowRunId } = await builder.materializeRunAndStep(
      fixtures.tenantA,
    );
    await expect(
      ownerPool.query(
        `insert into policy_evaluations
           (tenant_id, workflow_run_id, actor_type, action, risk_classification_version_id,
            effect, risk_level, action_hash, trace_id, correlation_id)
         values ($1, $2, 'system', 'data.export', $3, 'ALLOW', 'LOW', 'h', 't', 'c')`,
        [fixtures.tenantB, workflowRunId, riskClassificationVersionId], // workflowRunId belongs to tenant A
      ),
    ).rejects.toThrow();
  });
});
