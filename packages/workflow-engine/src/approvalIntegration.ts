import type { Queryable } from "@repo/shared";
import type { StepError } from "./retryPolicy.js";

/**
 * Step-level transitions driven by `governance`'s orchestration (Phase 4,
 * §10 of the design doc). Every function here takes only plain primitives
 * and performs a single, already-legal `stepStatus.ts` transition (or a
 * short sequential chain of them) gated on the step's *current* status —
 * `workflow-engine` never determines whether approval is required or what a
 * resumed output should be; it only executes the transition it's told to
 * make. None of these query or import anything from `governance`'s schema.
 */

/** RUNNING -> WAITING_FOR_APPROVAL, releasing the step's lease like any other lease-releasing transition. */
export async function enterWaitingForApproval(
  db: Queryable,
  workflowStepId: string,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `update workflow_steps
     set status = 'WAITING_FOR_APPROVAL',
         lease_owner = null, lease_token = null, leased_at = null,
         lease_expires_at = null, heartbeat_at = null,
         updated_at = now()
     where id = $1 and status = 'RUNNING'`,
    [workflowStepId],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Resumes an approved step without re-invoking the agent, committing the
 * snapshotted `proposedOutput` as the step's output. Collapses the two
 * already-legal hops (`WAITING_FOR_APPROVAL -> RUNNING -> SUCCEEDED`) into
 * one function: the first UPDATE is exactly-once gate #2 (only one caller's
 * conditional UPDATE can flip `WAITING_FOR_APPROVAL -> RUNNING`; a
 * concurrent/duplicate caller matches zero rows and returns `false`
 * immediately, never reaching the second UPDATE).
 */
export async function resumeWorkflowStepAfterApproval(
  db: Queryable,
  workflowStepId: string,
  output: unknown,
): Promise<boolean> {
  const { rowCount: toRunning } = await db.query(
    `update workflow_steps
     set status = 'RUNNING', updated_at = now()
     where id = $1 and status = 'WAITING_FOR_APPROVAL'`,
    [workflowStepId],
  );
  if ((toRunning ?? 0) === 0) return false;

  const { rowCount: toSucceeded } = await db.query(
    `update workflow_steps
     set status = 'SUCCEEDED',
         output = $2::jsonb,
         completed_at = now(),
         updated_at = now()
     where id = $1 and status = 'RUNNING'`,
    [workflowStepId, JSON.stringify(output ?? null)],
  );
  return (toSucceeded ?? 0) > 0;
}

/**
 * WAITING_FOR_APPROVAL -> FAILED, a direct terminal transition (not routed
 * through `retryPolicy.ts`'s classifier — a human rejection is an
 * authoritative outcome, not a transient failure to retry). `reason` must
 * carry `{ code: "approval_rejected" }` so `reconcileWorkflowRunOutcome`
 * can distinguish a governance rejection from an ordinary execution
 * failure without a separate step-level status.
 */
export async function rejectWorkflowStepApproval(
  db: Queryable,
  workflowStepId: string,
  reason: StepError,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `update workflow_steps
     set status = 'FAILED',
         error = $2::jsonb,
         completed_at = now(),
         updated_at = now()
     where id = $1 and status = 'WAITING_FOR_APPROVAL'`,
    [workflowStepId, JSON.stringify(reason)],
  );
  return (rowCount ?? 0) > 0;
}

/** WAITING_FOR_APPROVAL -> EXPIRED, a direct terminal transition (unattended expiration, not a retryable failure). */
export async function expireWorkflowStepApproval(
  db: Queryable,
  workflowStepId: string,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `update workflow_steps
     set status = 'EXPIRED',
         completed_at = now(),
         updated_at = now()
     where id = $1 and status = 'WAITING_FOR_APPROVAL'`,
    [workflowStepId],
  );
  return (rowCount ?? 0) > 0;
}

/** WAITING_FOR_APPROVAL -> CANCELLED, a direct terminal transition. */
export async function cancelWorkflowStepApproval(
  db: Queryable,
  workflowStepId: string,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `update workflow_steps
     set status = 'CANCELLED',
         completed_at = now(),
         updated_at = now()
     where id = $1 and status = 'WAITING_FOR_APPROVAL'`,
    [workflowStepId],
  );
  return (rowCount ?? 0) > 0;
}
