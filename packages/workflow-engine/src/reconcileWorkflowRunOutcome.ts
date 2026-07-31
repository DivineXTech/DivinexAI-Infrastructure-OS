import type { Queryable } from "@repo/shared";
import {
  isTerminalWorkflowStatus,
  isValidWorkflowTransition,
  type WorkflowStatus,
} from "./status.js";
import { appendWorkflowExecutionEvent } from "./executionEvents.js";
import type { StepError } from "./retryPolicy.js";

export interface ReconcileWorkflowRunOutcomeResult {
  changed: boolean;
  outcome: WorkflowStatus | null;
}

type RunRow = {
  id: string;
  tenant_id: string;
  status: WorkflowStatus;
  trace_id: string;
};

type StepRow = {
  id: string;
  status: string;
  error: StepError | null;
};

const ACTIVE_STEP_STATUSES = ["READY", "LEASED", "RUNNING", "RETRY_SCHEDULED"];

/**
 * Onset chain: nothing else in the codebase currently moves a run out of
 * `DRAFT` (§12a scope note — Phase 3 never built this). Once a run has
 * materialized steps, it is genuinely underway, so this walks it through
 * the already-legal `DRAFT -> PLANNING -> QUEUED -> RUNNING` chain in one
 * call rather than leaving every run parked at `DRAFT` forever. Each hop is
 * its own conditional UPDATE gated on the current status, same discipline
 * as every other transition in this file.
 */
const ONSET_CHAIN: readonly [WorkflowStatus, WorkflowStatus][] = [
  ["DRAFT", "PLANNING"],
  ["PLANNING", "QUEUED"],
  ["QUEUED", "RUNNING"],
];

async function advanceRunToRunning(
  db: Queryable,
  run: RunRow,
): Promise<WorkflowStatus> {
  let status = run.status;
  for (const [from, to] of ONSET_CHAIN) {
    if (status !== from) continue;
    const { rowCount } = await db.query(
      `update workflow_runs
       set status = $2, started_at = coalesce(started_at, now()), updated_at = now()
       where id = $1 and status = $3`,
      [run.id, to, from],
    );
    if ((rowCount ?? 0) > 0) status = to;
  }
  if (status !== run.status) {
    await appendWorkflowExecutionEvent(db, {
      tenantId: run.tenant_id,
      workflowRunId: run.id,
      workflowStepId: null,
      eventType: "run.started",
      actorType: "system",
      actorId: null,
      traceId: run.trace_id,
      correlationId: run.id,
      causationId: null,
    });
  }
  return status;
}

async function transitionRun(
  db: Queryable,
  run: RunRow,
  currentStatus: WorkflowStatus,
  to: WorkflowStatus,
  eventType: string,
  markCompleted: boolean,
): Promise<ReconcileWorkflowRunOutcomeResult> {
  if (!isValidWorkflowTransition(currentStatus, to)) {
    return { changed: false, outcome: null };
  }
  const { rowCount } = await db.query(
    `update workflow_runs
     set status = $2,
         completed_at = case when $3 then now() else completed_at end,
         updated_at = now()
     where id = $1 and status = $4`,
    [run.id, to, markCompleted, currentStatus],
  );
  if ((rowCount ?? 0) === 0) {
    return { changed: false, outcome: null };
  }
  await appendWorkflowExecutionEvent(db, {
    tenantId: run.tenant_id,
    workflowRunId: run.id,
    workflowStepId: null,
    eventType,
    actorType: "system",
    actorId: null,
    traceId: run.trace_id,
    correlationId: run.id,
    causationId: null,
  });
  return { changed: true, outcome: to };
}

/**
 * Derives a workflow run's status from its persisted step outcomes
 * (§10a of the Phase 4 design). A single, pure-of-side-effects-beyond-
 * its-own-tables function, re-derivable from scratch every call —
 * idempotent, concurrency-safe (every UPDATE gated on the current status),
 * event-producing, and structurally unable to bypass a legal transition
 * (every write goes through `isValidWorkflowTransition` first). Owned
 * entirely by `workflow-engine`; callers (governance's orchestration,
 * this package's own recovery tick, `apps/worker`) pass only a
 * `workflowRunId` and never derive run/step state themselves.
 *
 * Scope note: handles one gating step blocking a run at a time (the
 * reference workflow's shape). A run with multiple simultaneous
 * `WAITING_FOR_APPROVAL` steps across independent parallel branches is not
 * built here — documented in `RISK_REGISTER.md` row 32.
 */
export async function reconcileWorkflowRunOutcome(
  db: Queryable,
  workflowRunId: string,
): Promise<ReconcileWorkflowRunOutcomeResult> {
  const { rows: runRows } = await db.query<RunRow>(
    "select id, tenant_id, status, trace_id from workflow_runs where id = $1",
    [workflowRunId],
  );
  const run = runRows[0];
  if (!run) {
    throw new Error(`workflow_runs row "${workflowRunId}" not found`);
  }
  if (isTerminalWorkflowStatus(run.status)) {
    return { changed: false, outcome: null };
  }

  const { rows: steps } = await db.query<StepRow>(
    "select id, status, error from workflow_steps where workflow_run_id = $1",
    [workflowRunId],
  );
  if (steps.length === 0) {
    return { changed: false, outcome: null };
  }

  const currentStatus = await advanceRunToRunning(db, run);

  const rejectedStep = steps.find(
    (s) => s.status === "FAILED" && s.error?.code === "approval_rejected",
  );
  if (rejectedStep && currentStatus === "WAITING_FOR_APPROVAL") {
    return transitionRun(
      db,
      run,
      currentStatus,
      "REJECTED",
      "run.rejected",
      true,
    );
  }

  const expiredStep = steps.find((s) => s.status === "EXPIRED");
  if (expiredStep && currentStatus === "WAITING_FOR_APPROVAL") {
    // Baseline behavior (Phase 4): terminate. WAITING_FOR_APPROVAL's
    // transition table also legally allows -> BLOCKED (§12a) for a future
    // manifest-level policy field — not selectable by anything built yet.
    return transitionRun(
      db,
      run,
      currentStatus,
      "EXPIRED",
      "run.expired",
      true,
    );
  }

  const cancelledStep = steps.find((s) => s.status === "CANCELLED");
  if (cancelledStep && currentStatus === "WAITING_FOR_APPROVAL") {
    const result = await transitionRun(
      db,
      run,
      currentStatus,
      "CANCELLED",
      "run.cancelled",
      true,
    );
    if (result.changed) {
      await db.query(
        `update workflow_steps
         set status = 'CANCELLED', completed_at = now(), updated_at = now()
         where workflow_run_id = $1 and status in ('PENDING', 'READY', 'LEASED')`,
        [workflowRunId],
      );
    }
    return result;
  }

  const anyHardFailure = steps.some(
    (s) => s.status === "FAILED" || s.status === "DEAD_LETTERED",
  );
  if (anyHardFailure && isValidWorkflowTransition(currentStatus, "FAILED")) {
    return transitionRun(db, run, currentStatus, "FAILED", "run.failed", true);
  }

  const allTerminalSuccess = steps.every(
    (s) => s.status === "SUCCEEDED" || s.status === "SKIPPED",
  );
  if (
    allTerminalSuccess &&
    isValidWorkflowTransition(currentStatus, "VALIDATING")
  ) {
    const toValidating = await transitionRun(
      db,
      run,
      currentStatus,
      "VALIDATING",
      "run.validating",
      false,
    );
    if (!toValidating.changed) return toValidating;

    const { rowCount } = await db.query(
      `update workflow_runs
       set status = 'COMPLETED', completed_at = now(), updated_at = now()
       where id = $1 and status = 'VALIDATING'`,
      [workflowRunId],
    );
    if ((rowCount ?? 0) === 0) {
      return { changed: true, outcome: "VALIDATING" };
    }
    await appendWorkflowExecutionEvent(db, {
      tenantId: run.tenant_id,
      workflowRunId: run.id,
      workflowStepId: null,
      eventType: "run.completed",
      actorType: "system",
      actorId: null,
      traceId: run.trace_id,
      correlationId: run.id,
      causationId: null,
    });
    return { changed: true, outcome: "COMPLETED" };
  }

  const activeCount = steps.filter((s) =>
    ACTIVE_STEP_STATUSES.includes(s.status),
  ).length;
  const waitingCount = steps.filter(
    (s) => s.status === "WAITING_FOR_APPROVAL",
  ).length;

  if (activeCount === 0 && waitingCount > 0 && currentStatus === "RUNNING") {
    return transitionRun(
      db,
      run,
      currentStatus,
      "WAITING_FOR_APPROVAL",
      "run.waiting_for_approval",
      false,
    );
  }
  if (activeCount > 0 && currentStatus === "WAITING_FOR_APPROVAL") {
    return transitionRun(
      db,
      run,
      currentStatus,
      "RUNNING",
      "run.resumed",
      false,
    );
  }

  if (currentStatus !== run.status) {
    return { changed: true, outcome: currentStatus };
  }
  return { changed: false, outcome: null };
}
