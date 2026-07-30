import { Pool } from "pg";
import {
  reconcileWorkflowRuntime,
  computeReadySteps,
  PgStepLeasing,
  TERMINAL_WORKFLOW_STATUSES,
  type RetryPolicy,
} from "@repo/workflow-engine";
import {
  PgPlatformAgentCatalog,
  PgTenantAgentRegistry,
  resolveTenantAgent,
  assertAgentEligible,
  DeterministicMockAgentAdapter,
} from "@repo/agent-runtime";
import { loadWorkerConfig } from "./config.js";

/**
 * Thin polling driver for the Phase 3 workflow runtime. All decision logic
 * (leasing, retry/dead-letter classification, DAG scheduling, recovery)
 * lives in packages/workflow-engine and packages/agent-runtime and is
 * tested independently there (docs/agentflow-v2/PHASE_3_WORKFLOW_RUNTIME.md
 * §13) — this file only composes those functions and drives them on a
 * timer. Mock agent execution only in Phase 3; Phase 5 swaps in real
 * provider adapters behind the same `AgentExecutionResult` contract without
 * any change to this file's control flow.
 */

const config = loadWorkerConfig();
const pool = new Pool({ connectionString: config.databaseUrl });
const agentCatalog = new PgPlatformAgentCatalog(pool);
const agentRegistry = new PgTenantAgentRegistry(pool);
const leasing = new PgStepLeasing(pool);
const mockAdapter = new DeterministicMockAgentAdapter();

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

    const { rows: runRows } = await pool.query<{ trace_id: string }>(
      "select trace_id from workflow_runs where id = $1",
      [step.workflow_run_id],
    );
    const traceId = runRows[0]?.trace_id ?? step.workflow_run_id;

    const result = await mockAdapter.execute(resolved, {
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
    });

    await leasing.commitStepSuccess(step.id, claim.leaseToken, result.output);
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
  }
}

async function executeReadySteps(): Promise<void> {
  const { rows: readySteps } = await pool.query<{
    id: string;
    tenant_id: string;
    agent_slug: string;
    workflow_run_id: string;
  }>(
    "select id, tenant_id, agent_slug, workflow_run_id from workflow_steps where status = 'READY'",
  );
  for (const step of readySteps) {
    await executeStep(step);
  }
}

async function tick(): Promise<void> {
  await reconcileWorkflowRuntime(pool);
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
