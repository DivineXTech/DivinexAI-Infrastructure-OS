import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import {
  seedPlatformAgentCatalog,
  CANONICAL_AGENT_MANIFESTS,
  PgPlatformAgentCatalog,
  PgTenantAgentRegistry,
  provisionTenantAgents,
  resolveTenantAgent,
  assertAgentEligible,
  DeterministicMockAgentAdapter,
  CatalogAgentResolver,
} from "@repo/agent-runtime";
import { PgTenantAccessEvaluator } from "@repo/shared";
import {
  PgPlatformWorkflowCatalog,
  seedPlatformWorkflowCatalog,
  provisionTenantWorkflow,
  createWorkflowRun,
  materializeSteps,
  computeReadySteps,
  PgStepLeasing,
  enterWaitingForApproval,
  reconcileWorkflowRunOutcome,
  clientSolutionAssessmentManifestV1_1,
} from "@repo/workflow-engine";
import { resetAndMigrate } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { seedPlatformPolicyCatalog } from "../src/seedPlatformPolicyCatalog.js";
import { seedPlatformRiskClassificationCatalog } from "../src/seedPlatformRiskClassificationCatalog.js";
import { PgPlatformPolicyCatalog } from "../src/platformPolicyCatalog.js";
import { PgPlatformRiskClassificationCatalog } from "../src/platformRiskClassificationCatalog.js";
import { PgTenantPolicyRegistry } from "../src/tenantPolicyRegistry.js";
import { evaluatePolicy } from "../src/evaluatePolicy.js";
import {
  createApprovalRequest,
  type ActionSnapshot,
} from "../src/createApprovalRequest.js";
import { recordApprovalDecision } from "../src/recordApprovalDecision.js";

/**
 * Full integration test for the Phase 4 reference workflow (§12 of the
 * design): `client_solution_assessment` v1.1.0 end-to-end through
 * `deliver_external`'s governed approval gate to `COMPLETED`, mock agents
 * only. Lives in `packages/governance` (not `workflow-engine`) since it's
 * the only package that legitimately depends on both `@repo/workflow-engine`
 * and (as a devDependency) `@repo/agent-runtime`.
 */

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_governance";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const agentCatalog = new PgPlatformAgentCatalog(pool);
const agentRegistry = new PgTenantAgentRegistry(pool);
const access = new PgTenantAccessEvaluator(pool);
const workflowCatalog = new PgPlatformWorkflowCatalog(pool);
const agentResolver = new CatalogAgentResolver(agentCatalog);
const leasing = new PgStepLeasing(pool);
const mockAdapter = new DeterministicMockAgentAdapter();
const policyCatalog = new PgPlatformPolicyCatalog(pool);
const riskCatalog = new PgPlatformRiskClassificationCatalog(pool);
const policyRegistry = new PgTenantPolicyRegistry(pool);

let fixtures: CoreFixtures;

const GOVERNED_ACTIONS_BY_STEP = new Map(
  clientSolutionAssessmentManifestV1_1.steps.map((s) => [
    s.stepKey,
    s.governedAction,
  ]),
);

beforeAll(async () => {
  await resetAndMigrate(pool);
  fixtures = await seedCoreFixtures(pool);

  await seedPlatformAgentCatalog(pool, CANONICAL_AGENT_MANIFESTS);
  const versionsBySlug = Object.fromEntries(
    await Promise.all(
      CANONICAL_AGENT_MANIFESTS.map(async (m) => {
        const definition = await agentCatalog.getDefinitionBySlug(m.id);
        const [version] = await agentCatalog.listPublishedVersions(
          definition!.id,
        );
        return [m.id, version!.id] as const;
      }),
    ),
  ) as Record<string, string>;
  const { created } = await provisionTenantAgents(pool, agentCatalog, access, {
    tenantId: fixtures.tenantA,
    actorUserId: fixtures.userAOwner,
    versionsBySlug: versionsBySlug as never,
  });
  for (const installation of created) {
    await agentRegistry.transitionLifecycle(installation.id, "MOCK_EXECUTABLE");
    await agentRegistry.setEnabled(installation.id, true);
  }

  await seedPlatformWorkflowCatalog(pool, agentResolver, [
    clientSolutionAssessmentManifestV1_1,
  ]);

  await seedPlatformRiskClassificationCatalog(pool, [
    {
      action: "*",
      version: "1.0.0",
      riskLevel: "LOW",
      rationale: "platform default floor",
    },
  ]);

  // Platform-mandatory: any external communication requires approval by
  // default (mirrors ADR-0008's original direction, per §12 of the design).
  await seedPlatformPolicyCatalog(pool, [
    {
      slug: "external-communication-requires-approval",
      displayName: "External Communication Requires Approval",
      description:
        "Any communication.send.external action requires human approval.",
      version: "1.0.0",
      document: {
        appliesToActions: ["communication.send.external"],
        conditions: {
          field: "action",
          operator: "eq",
          value: "communication.send.external",
        },
        effect: "REQUIRE_APPROVAL",
        riskLevel: "MEDIUM",
        requiredPermissions: [],
        requiredApproverRoles: [],
        requiredApprovalCount: 1,
        rejectOnFirstRejection: true,
        approvalExpirationMs: null,
      },
      priority: 100,
      mandatory: true,
      overridePolicy: "immutable",
    },
  ]);
});

afterAll(async () => {
  await pool.end();
});

describe("client_solution_assessment v1.1.0: full governed approval integration", () => {
  it("runs to deliver_external's approval gate, parks at WAITING_FOR_APPROVAL, and completes on approval", async () => {
    const definition = await workflowCatalog.getDefinitionBySlug(
      "client_solution_assessment",
    );
    const [version] = await workflowCatalog.listPublishedVersions(
      definition!.id,
    );
    expect(version!.version).toBe("1.1.0");

    const { installation: tenantWorkflow } = await provisionTenantWorkflow(
      pool,
      workflowCatalog,
      access,
      {
        tenantId: fixtures.tenantA,
        actorUserId: fixtures.userAOwner,
        workflowDefinitionSlug: "client_solution_assessment",
        workflowVersionId: version!.id,
      },
    );

    const run = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId: tenantWorkflow.id,
      workflowVersionId: version!.id,
      requestedByUserId: fixtures.userAOwner,
      input: {
        clientName: "Acme Corp",
        clientBrief: "Expand into new markets",
      },
      traceId: "trace-governed-reference-workflow",
    });
    await materializeSteps(
      pool,
      fixtures.tenantA,
      run.id,
      clientSolutionAssessmentManifestV1_1.steps,
    );

    let parkedApprovalRequestId: string | null = null;
    let safetyCounter = 0;

    while (safetyCounter < 30) {
      safetyCounter += 1;
      await computeReadySteps(pool, run.id);

      const { rows: readySteps } = await pool.query<{
        id: string;
        step_key: string;
        agent_slug: string;
      }>(
        "select id, step_key, agent_slug from workflow_steps where workflow_run_id = $1 and status = 'READY'",
        [run.id],
      );
      if (readySteps.length === 0) break;

      for (const step of readySteps) {
        const claim = await leasing.claimStep(step.id, "test-worker", 30000);
        expect(claim).not.toBeNull();
        await leasing.markStepRunning(step.id, claim!.leaseToken);

        const resolved = await resolveTenantAgent(
          agentRegistry,
          agentCatalog,
          fixtures.tenantA,
          step.agent_slug,
        );
        assertAgentEligible(resolved.installation);

        const governedAction =
          GOVERNED_ACTIONS_BY_STEP.get(step.step_key) ?? null;
        const result = await mockAdapter.execute(
          resolved,
          {
            tenantId: fixtures.tenantA,
            workspaceId: null,
            workflowRunId: run.id,
            workflowStepId: step.id,
            requestingActor: { type: "system", id: "test-worker" },
            objective: `Execute workflow step ${step.step_key}`,
            approvedInputs: {},
            availableCapabilities: [],
            approvedTools: [],
            relevantMemory: [],
            knowledgeContext: [],
            riskContext: { riskLevel: "low", flags: [] },
            executionBudget: {
              maxTokens: null,
              maxCostUsd: null,
              maxDurationMs: null,
              maxToolCalls: null,
            },
            traceId: "trace-governed-reference-workflow",
          },
          governedAction,
        );

        if (result.intendedAction) {
          const decision = await evaluatePolicy(
            pool,
            policyCatalog,
            riskCatalog,
            policyRegistry,
            {
              tenantId: fixtures.tenantA,
              action: result.intendedAction.action,
              parameters: result.intendedAction.parameters,
              targetResource: result.intendedAction.targetResource,
              actorType: "worker",
              actorId: "test-worker",
              workflowRunId: run.id,
              workflowStepId: step.id,
              traceId: "trace-governed-reference-workflow",
              correlationId: step.id,
            },
          );
          expect(decision.effect).toBe("REQUIRE_APPROVAL");

          const snapshot: ActionSnapshot = {
            action: result.intendedAction.action,
            parameters: result.intendedAction.parameters,
            targetResource: result.intendedAction.targetResource,
            requestingActor: { type: "system", id: "test-worker" },
            requestingTenantAgentId: null,
            workflowRunId: run.id,
            workflowStepId: step.id,
            policyDecisionId: decision.id,
            riskClassificationVersionId: decision.riskClassificationVersionId,
            evidence: {},
            traceContext: {
              traceId: "trace-governed-reference-workflow",
              correlationId: step.id,
            },
            proposedOutput: result.output,
          };
          const approvalRequest = await createApprovalRequest(pool, {
            tenantId: fixtures.tenantA,
            policyEvaluationId: decision.id,
            workflowRunId: run.id,
            workflowStepId: step.id,
            actionSnapshot: snapshot,
            requiredApprovalCount: decision.requiredApprovalCount,
            requiredApproverRoles: decision.requiredApproverRoles,
            rejectOnFirstRejection: true,
            expiresAt: decision.expiresAt,
          });
          parkedApprovalRequestId = approvalRequest.id;

          await enterWaitingForApproval(pool, step.id);
          await reconcileWorkflowRunOutcome(pool, run.id);
        } else {
          const committed = await leasing.commitStepSuccess(
            step.id,
            claim!.leaseToken,
            result.output,
          );
          expect(committed).toBe(true);
          await reconcileWorkflowRunOutcome(pool, run.id);
        }
      }
    }

    expect(parkedApprovalRequestId).not.toBeNull();

    const { rows: runRowsBeforeApproval } = await pool.query<{
      status: string;
    }>("select status from workflow_runs where id = $1", [run.id]);
    expect(runRowsBeforeApproval[0]!.status).toBe("WAITING_FOR_APPROVAL");

    const { rows: stepRowsBeforeApproval } = await pool.query<{
      status: string;
    }>(
      "select status from workflow_steps where workflow_run_id = $1 and step_key = 'deliver_external'",
      [run.id],
    );
    expect(stepRowsBeforeApproval[0]!.status).toBe("WAITING_FOR_APPROVAL");

    // A human approves — resumes exactly once, replaying the snapshotted
    // proposedOutput, and the run auto-completes.
    await pool.query(
      "insert into approval_assignments (tenant_id, approval_request_id, assignee_user_id) values ($1, $2, $3)",
      [fixtures.tenantA, parkedApprovalRequestId, fixtures.userADecider],
    );
    const decided = await recordApprovalDecision(pool, access, {
      approvalRequestId: parkedApprovalRequestId!,
      deciderUserId: fixtures.userADecider,
      decision: "APPROVED",
    });
    expect(decided.status).toBe("APPROVED");

    const { rows: finalStepRows } = await pool.query<{ status: string }>(
      "select status from workflow_steps where workflow_run_id = $1 and step_key = 'deliver_external'",
      [run.id],
    );
    expect(finalStepRows[0]!.status).toBe("SUCCEEDED");

    const { rows: finalRunRows } = await pool.query<{ status: string }>(
      "select status from workflow_runs where id = $1",
      [run.id],
    );
    expect(finalRunRows[0]!.status).toBe("COMPLETED");

    const { rows: allSteps } = await pool.query(
      "select status from workflow_steps where workflow_run_id = $1",
      [run.id],
    );
    expect(allSteps).toHaveLength(8);
    expect(allSteps.every((s) => s.status === "SUCCEEDED")).toBe(true);
  });
});
