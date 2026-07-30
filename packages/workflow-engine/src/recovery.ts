import type { Queryable } from "@repo/shared";
import { TERMINAL_WORKFLOW_STATUSES } from "./status.js";
import { classifyOutcome } from "./retryPolicy.js";
import type { WorkflowManifestMetadata } from "./manifest.js";
import { appendWorkflowExecutionEvent } from "./executionEvents.js";
import { computeReadySteps } from "./stepScheduler.js";

export interface ReconcileWorkflowRuntimeResult {
  leasesReclaimed: number;
  retriesRequeued: number;
  stepsReadied: string[];
}

/**
 * Stateless, idempotent worker-recovery function (§9 of the Phase 3
 * design). Safe to run on worker startup and on a recurring timer —
 * queries the database fresh every time and holds no in-memory workflow
 * state. Never touches terminal rows: every query below filters to
 * non-terminal statuses explicitly, so a step that already committed a
 * terminal outcome is never revisited, and a step that never committed is
 * always eventually reclaimed once its lease expires — there is no third
 * state where a step is both "done" and "reclaimable."
 */
export async function reconcileWorkflowRuntime(
  db: Queryable,
): Promise<ReconcileWorkflowRuntimeResult> {
  // 1. Reclaim expired leases — apply the same retry/dead-letter decision a
  // live failure would (§8), treating the expiry itself as a failed attempt.
  const { rows: expiredSteps } = await db.query<{
    id: string;
    tenant_id: string;
    workflow_run_id: string;
    step_key: string;
    attempt: number;
    trace_id: string;
    manifest: WorkflowManifestMetadata;
  }>(
    `select ws.id, ws.tenant_id, ws.workflow_run_id, ws.step_key, ws.attempt,
            wr.trace_id, wv.manifest
     from workflow_steps ws
     join workflow_runs wr on wr.id = ws.workflow_run_id
     join workflow_versions wv on wv.id = wr.workflow_version_id
     where ws.status in ('LEASED', 'RUNNING') and ws.lease_expires_at < now()`,
  );

  for (const step of expiredSteps) {
    const stepDef = step.manifest.steps.find(
      (s) => s.stepKey === step.step_key,
    );
    if (!stepDef) {
      throw new Error(
        `Recovery: step "${step.step_key}" not found in workflow version manifest for run "${step.workflow_run_id}"`,
      );
    }

    const nextAttempt = step.attempt + 1;
    const error = {
      retryable: true,
      code: "lease_expired",
      message: `Lease expired before step "${step.step_key}" completed`,
    };
    const outcome = classifyOutcome(nextAttempt, stepDef.retryPolicy, error);

    if (outcome.kind === "RETRY_SCHEDULED") {
      await db.query(
        `update workflow_steps
         set status = 'RETRY_SCHEDULED', attempt = $2, next_attempt_at = $3,
             error = $4::jsonb,
             lease_owner = null, lease_token = null, leased_at = null,
             lease_expires_at = null, heartbeat_at = null, updated_at = now()
         where id = $1`,
        [
          step.id,
          nextAttempt,
          outcome.nextAttemptAt.toISOString(),
          JSON.stringify(error),
        ],
      );
    } else if (outcome.kind === "DEAD_LETTERED") {
      await db.query(
        `update workflow_steps
         set status = 'DEAD_LETTERED', attempt = $2, error = $3::jsonb, completed_at = now(),
             lease_owner = null, lease_token = null, leased_at = null,
             lease_expires_at = null, heartbeat_at = null, updated_at = now()
         where id = $1`,
        [step.id, nextAttempt, JSON.stringify(error)],
      );
      await db.query(
        `insert into workflow_dead_letters
           (tenant_id, workflow_run_id, workflow_step_id, reason, last_error, attempt_count)
         values ($1, $2, $3, $4, $5::jsonb, $6)`,
        [
          step.tenant_id,
          step.workflow_run_id,
          step.id,
          error.code,
          JSON.stringify(error),
          nextAttempt,
        ],
      );
    } else {
      await db.query(
        `update workflow_steps
         set status = 'FAILED', attempt = $2, error = $3::jsonb, completed_at = now(),
             lease_owner = null, lease_token = null, leased_at = null,
             lease_expires_at = null, heartbeat_at = null, updated_at = now()
         where id = $1`,
        [step.id, nextAttempt, JSON.stringify(error)],
      );
    }

    await appendWorkflowExecutionEvent(db, {
      tenantId: step.tenant_id,
      workflowRunId: step.workflow_run_id,
      workflowStepId: step.id,
      eventType: "step.lease_reclaimed",
      actorType: "worker",
      actorId: null,
      traceId: step.trace_id,
      correlationId: step.id,
      causationId: null,
      payload: { stepKey: step.step_key, outcome: outcome.kind },
    });
  }

  // 2. Requeue due retries.
  const { rows: requeued } = await db.query<{ id: string }>(
    `update workflow_steps
     set status = 'READY', updated_at = now()
     where status = 'RETRY_SCHEDULED' and next_attempt_at <= now()
     returning id`,
  );

  // 3. Advance dependency-satisfied steps for every non-terminal run.
  const { rows: activeRuns } = await db.query<{ id: string }>(
    `select id from workflow_runs where status not in (${TERMINAL_WORKFLOW_STATUSES.map((_, i) => `$${i + 1}`).join(", ")})`,
    [...TERMINAL_WORKFLOW_STATUSES],
  );

  const stepsReadied: string[] = [];
  for (const run of activeRuns) {
    stepsReadied.push(...(await computeReadySteps(db, run.id)));
  }

  return {
    leasesReclaimed: expiredSteps.length,
    retriesRequeued: requeued.length,
    stepsReadied,
  };
}
