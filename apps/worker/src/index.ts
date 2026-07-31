import { Pool } from "pg";
import {
  reconcileWorkflowRuntime,
  reconcileWorkflowRunOutcome,
  computeReadySteps,
  enterWaitingForApproval,
  PgStepLeasing,
  TERMINAL_WORKFLOW_STATUSES,
  type RetryPolicy,
  type WorkflowManifestMetadata,
} from "@repo/workflow-engine";
import {
  PgPlatformAgentCatalog,
  PgTenantAgentRegistry,
  resolveTenantAgent,
  assertAgentEligible,
  DeterministicMockAgentAdapter,
} from "@repo/agent-runtime";
import {
  PgPlatformPolicyCatalog,
  PgPlatformRiskClassificationCatalog,
  PgTenantPolicyRegistry,
  evaluatePolicy,
  createApprovalRequest,
  type ActionSnapshot,
} from "@repo/governance";
import { loadWorkerConfig } from "./config.js";

/**
 * Thin polling driver for the workflow runtime. All decision logic
 * (leasing, retry/dead-letter classification, DAG scheduling, recovery,
 * policy evaluation, approval requests) lives in packages/workflow-engine,
 * packages/agent-runtime, and packages/governance and is tested
 * independently there — this file only composes those functions and drives
 * them on a timer. Mock agent execution only through Phase 4; Phase 5 swaps
 * in real provider adapters behind the same `AgentExecutionResult` contract
 * without any change to this file's control flow.
 */

const config = loadWorkerConfig();
const pool = new Pool({ connectionString: config.databaseUrl });
const agentCatalog = new PgPlatformAgentCatalog(pool);
const agentRegistry = new PgTenantAgentRegistry(pool);
const leasing = new PgStepLeasing(pool);
const mockAdapter = new DeterministicMockAgentAdapter();
const policyCatalog = new PgPlatformPolicyCatalog(pool);
const riskCatalog = new PgPlatformRiskClassificationCatalog(pool);
const policyRegistry = new PgTenantPolicyRegistry(pool);

/** Placeholder retry policy for failures raised by the driver loop itself (e.g. an unresolvable agent) — revisit once real providers exist in Phase 5. */
const DRIVER_FAILURE_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  backoff: "exponential",
  backoffMs: 1000,
  timeoutMs: 60000,
  deadLetterOnExhaustion: true,
};

async function advanceScheduling(): Promise<void> {
  const { rows: activeRuns } = await pool.query<{ id: string }>(
    `select id from workflow_runs where status not in (${TERMINAL_WORKFLOW_STATUSES.map((_, i) => `$${i + 1}`).join(", ")})`,
    [...TERMINAL_WORKFLOW_STATUSES],
  );
  for (const run of activeRuns) {
    await computeReadySteps(pool, run.id);
  }
}

async function executeStep(step: {
  id: string;
  tenant_id: string;
  agent_slug: string;
  step_key: string;
  workflow_run_id: string;
}): Promise<void> {
  const claim = await leasing.claimStep(
    step.id,
    config.workerId,
    config.leaseMs,
  );
  if (!claim) return; // lost the race to another worker (or another worker's poll already claimed it)

  try {
    await leasing.markStepRunning(step.id, claim.leaseToken);

    const resolved = await resolveTenantAgent(
      agentRegistry,
      agentCatalog,
      step.tenant_id,
      step.agent_slug,
    );
    assertAgentEligible(resolved.installation);

    const { rows: runRows } = await pool.query<{
      trace_id: string;
      manifest: WorkflowManifestMetadata;
    }>(
      `select wr.trace_id, wv.manifest
       from workflow_runs wr
       join workflow_versions wv on wv.id = wr.workflow_version_id
       where wr.id = $1`,
      [step.workflow_run_id],
    );
    const traceId = runRows[0]?.trace_id ?? step.workflow_run_id;
    const stepDef = runRows[0]?.manifest.steps.find(
      (s) => s.stepKey === step.step_key,
    );
    const governedAction = stepDef?.governedAction ?? null;

    const result = await mockAdapter.execute(
      resolved,
      {
        tenantId: step.tenant_id,
        workspaceId: null,
        workflowRunId: step.workflow_run_id,
        workflowStepId: step.id,
        requestingActor: { type: "system", id: config.workerId },
        objective: `Execute workflow step ${step.id}`,
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
        traceId,
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
          tenantId: step.tenant_id,
          action: result.intendedAction.action,
          parameters: result.intendedAction.parameters,
          targetResource: result.intendedAction.targetResource,
          actorType: "agent",
          actorId: resolved.installation.id,
          workflowRunId: step.workflow_run_id,
          workflowStepId: step.id,
          workflowStepApprovalRequired: stepDef?.approvalRequired ?? false,
          traceId,
          correlationId: step.id,
        },
      );

      if (
        decision.effect === "REQUIRE_APPROVAL" ||
        decision.effect === "ESCALATE"
      ) {
        const snapshot: ActionSnapshot = {
          action: result.intendedAction.action,
          parameters: result.intendedAction.parameters,
          targetResource: result.intendedAction.targetResource,
          requestingActor: { type: "agent", id: resolved.installation.id },
          requestingTenantAgentId: resolved.installation.id,
          workflowRunId: step.workflow_run_id,
          workflowStepId: step.id,
          policyDecisionId: decision.id,
          riskClassificationVersionId: decision.riskClassificationVersionId,
          evidence: {},
          traceContext: { traceId, correlationId: step.id },
          proposedOutput: result.output,
        };
        await createApprovalRequest(pool, {
          tenantId: step.tenant_id,
          policyEvaluationId: decision.id,
          workflowRunId: step.workflow_run_id,
          workflowStepId: step.id,
          actionSnapshot: snapshot,
          requiredApprovalCount: decision.requiredApprovalCount,
          requiredApproverRoles: decision.requiredApproverRoles,
          rejectOnFirstRejection: true,
          expiresAt: decision.expiresAt,
        });
        await enterWaitingForApproval(pool, step.id);
        await reconcileWorkflowRunOutcome(pool, step.workflow_run_id);
        return; // durably waiting — not a success or failure yet
      }

      if (decision.effect === "BLOCK" || decision.effect === "DENY") {
        await leasing.commitStepFailure(
          step.id,
          claim.leaseToken,
          {
            retryable: false,
            code:
              decision.effect === "BLOCK"
                ? "governance_blocked"
                : "governance_denied",
            message: `Governed action "${result.intendedAction.action}" was ${decision.effect} by policy`,
          },
          DRIVER_FAILURE_RETRY_POLICY,
        );
        await reconcileWorkflowRunOutcome(pool, step.workflow_run_id);
        return;
      }
      // ALLOW falls through to the normal commit below.
    }

    await leasing.commitStepSuccess(step.id, claim.leaseToken, result.output);
    await reconcileWorkflowRunOutcome(pool, step.workflow_run_id);
  } catch (err) {
    await leasing.commitStepFailure(
      step.id,
      claim.leaseToken,
      {
        retryable: true,
        code: "worker_execution_error",
        message: err instanceof Error ? err.message : String(err),
      },
      DRIVER_FAILURE_RETRY_POLICY,
    );
    await reconcileWorkflowRunOutcome(pool, step.workflow_run_id);
  }
}

async function executeReadySteps(): Promise<void> {
  const { rows: readySteps } = await pool.query<{
    id: string;
    tenant_id: string;
    agent_slug: string;
    step_key: string;
    workflow_run_id: string;
  }>(
    "select id, tenant_id, agent_slug, step_key, workflow_run_id from workflow_steps where status = 'READY'",
  );
  for (const step of readySteps) {
    await executeStep(step);
  }
}

async function tick(): Promise<void> {
  await reconcileWorkflowRuntime(pool); // also reconciles run-level outcomes for every active run (§10a)
  await advanceScheduling();
  await executeReadySteps();
}

async function main(): Promise<void> {
  console.log(
    `[apps/worker] starting (worker id ${config.workerId}, poll interval ${config.pollIntervalMs}ms)`,
  );
  for (;;) {
    try {
      await tick();
    } catch (err) {
      console.error("[apps/worker] tick failed", err);
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

main().catch((err) => {
  console.error("[apps/worker] fatal error", err);
  process.exit(1);
});
