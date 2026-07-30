import type { Queryable } from "@repo/shared";
import { isTerminalWorkflowStatus, type WorkflowStatus } from "./status.js";
import type { WorkflowStepDefinition } from "./manifest.js";

export interface CreateWorkflowRunInput {
  tenantId: string;
  tenantWorkflowId: string;
  workflowVersionId: string;
  requestedByUserId: string | null;
  input: Record<string, unknown>;
  /** Omit for a run with no idempotency guarantee (each call creates a new run). */
  idempotencyKey?: string | null;
  traceId: string;
}

export interface WorkflowRun {
  id: string;
  tenantId: string;
  tenantWorkflowId: string;
  workflowVersionId: string;
  status: WorkflowStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  idempotencyKey: string | null;
  requestedByUserId: string | null;
  traceId: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

type WorkflowRunRow = {
  id: string;
  tenant_id: string;
  tenant_workflow_id: string;
  workflow_version_id: string;
  status: WorkflowStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  idempotency_key: string | null;
  requested_by_user_id: string | null;
  trace_id: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
};

function mapRun(row: WorkflowRunRow): WorkflowRun {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    tenantWorkflowId: row.tenant_workflow_id,
    workflowVersionId: row.workflow_version_id,
    status: row.status,
    input: row.input,
    output: row.output,
    idempotencyKey: row.idempotency_key,
    requestedByUserId: row.requested_by_user_id,
    traceId: row.trace_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

/**
 * Creates a workflow run. When `idempotencyKey` is provided, a second call
 * with the same `(tenantId, idempotencyKey)` returns the existing run
 * instead of erroring or creating a duplicate (Postgres allows multiple
 * NULLs through the same unique constraint, so omitting the key means no
 * idempotency guarantee — each call creates a new run, by design).
 */
export async function createWorkflowRun(
  db: Queryable,
  input: CreateWorkflowRunInput,
): Promise<WorkflowRun> {
  const { rows } = await db.query<WorkflowRunRow>(
    `insert into workflow_runs
       (tenant_id, tenant_workflow_id, workflow_version_id, status, input,
        idempotency_key, requested_by_user_id, trace_id)
     values ($1, $2, $3, 'DRAFT', $4::jsonb, $5, $6, $7)
     on conflict (tenant_id, idempotency_key) do nothing
     returning *`,
    [
      input.tenantId,
      input.tenantWorkflowId,
      input.workflowVersionId,
      JSON.stringify(input.input),
      input.idempotencyKey ?? null,
      input.requestedByUserId,
      input.traceId,
    ],
  );

  const inserted = rows[0];
  if (inserted) return mapRun(inserted);

  const { rows: existingRows } = await db.query<WorkflowRunRow>(
    "select * from workflow_runs where tenant_id = $1 and idempotency_key = $2",
    [input.tenantId, input.idempotencyKey ?? null],
  );
  const existing = existingRows[0];
  if (!existing) {
    throw new Error(
      `createWorkflowRun: insert conflicted but no existing row found for idempotency key "${input.idempotencyKey}"`,
    );
  }
  return mapRun(existing);
}

/**
 * Materializes a run's steps and dependency edges from its manifest.
 * Idempotent: re-materializing an already-materialized run inserts nothing
 * new, via the `unique (workflow_run_id, step_key)` and
 * `primary key (step_id, depends_on_step_id)` constraints. Phase 3 only
 * supports `kind: "agentSlug"` steps end-to-end — a `kind: "capability"`
 * step reaching materialization throws, since there is no resolver yet to
 * populate a concrete `agent_slug` for it.
 */
export async function materializeSteps(
  db: Queryable,
  tenantId: string,
  workflowRunId: string,
  steps: readonly WorkflowStepDefinition[],
): Promise<void> {
  const stepIdByKey = new Map<string, string>();

  for (const step of steps) {
    if (step.assignment.kind !== "agentSlug") {
      throw new Error(
        `Step "${step.stepKey}": capability-based assignment is not yet supported for execution (Phase 3 ships agentSlug assignment only)`,
      );
    }

    const { rows } = await db.query<{ id: string }>(
      `insert into workflow_steps
         (tenant_id, workflow_run_id, step_key, agent_slug, status, max_attempts, timeout_ms)
       values ($1, $2, $3, $4, 'PENDING', $5, $6)
       on conflict (workflow_run_id, step_key) do nothing
       returning id`,
      [
        tenantId,
        workflowRunId,
        step.stepKey,
        step.assignment.agentSlug,
        step.retryPolicy.maxAttempts,
        step.retryPolicy.timeoutMs,
      ],
    );

    let stepId = rows[0]?.id;
    if (!stepId) {
      const { rows: existingRows } = await db.query<{ id: string }>(
        "select id from workflow_steps where workflow_run_id = $1 and step_key = $2",
        [workflowRunId, step.stepKey],
      );
      stepId = existingRows[0]!.id;
    }
    stepIdByKey.set(step.stepKey, stepId);
  }

  for (const step of steps) {
    const stepId = stepIdByKey.get(step.stepKey)!;
    for (const dependsOnKey of step.dependsOn) {
      const dependsOnId = stepIdByKey.get(dependsOnKey)!;
      await db.query(
        `insert into workflow_step_dependencies
           (tenant_id, workflow_run_id, step_id, depends_on_step_id)
         values ($1, $2, $3, $4)
         on conflict (step_id, depends_on_step_id) do nothing`,
        [tenantId, workflowRunId, stepId, dependsOnId],
      );
    }
  }
}

/**
 * Cancels a run (if not already terminal — an already-terminal run is a
 * successful no-op, not a thrown error) and cancels its `PENDING`/`READY`/
 * `LEASED` steps, leaving already-`SUCCEEDED` (or otherwise terminal) steps
 * untouched.
 */
export async function cancelWorkflowRun(
  db: Queryable,
  workflowRunId: string,
): Promise<void> {
  const { rows } = await db.query<{ status: WorkflowStatus }>(
    "select status from workflow_runs where id = $1",
    [workflowRunId],
  );
  const current = rows[0];
  if (!current) {
    throw new Error(`workflow_runs row "${workflowRunId}" not found`);
  }

  if (!isTerminalWorkflowStatus(current.status)) {
    await db.query(
      `update workflow_runs
       set status = 'CANCELLED', completed_at = now(), updated_at = now()
       where id = $1`,
      [workflowRunId],
    );
  }

  await db.query(
    `update workflow_steps
     set status = 'CANCELLED', completed_at = now(), updated_at = now()
     where workflow_run_id = $1 and status in ('PENDING', 'READY', 'LEASED')`,
    [workflowRunId],
  );
}

/**
 * Resumes a run out of `WAITING_FOR_APPROVAL` — a stub standing in for
 * Phase 4's real approval lifecycle (`GovernanceGate` owns the real
 * decision then; this only applies it). A no-op if the run is no longer
 * `WAITING_FOR_APPROVAL` (already resumed), per the idempotency model.
 */
export async function resumeWorkflowRunAfterApproval(
  db: Queryable,
  workflowRunId: string,
  decision: "approved" | "rejected",
): Promise<void> {
  const target: WorkflowStatus =
    decision === "approved" ? "RUNNING" : "REJECTED";
  await db.query(
    `update workflow_runs
     set status = $2,
         completed_at = case when $2 = 'REJECTED' then now() else completed_at end,
         updated_at = now()
     where id = $1 and status = 'WAITING_FOR_APPROVAL'`,
    [workflowRunId, target],
  );
}
