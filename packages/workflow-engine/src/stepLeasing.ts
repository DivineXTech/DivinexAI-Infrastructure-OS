import type { Queryable } from "@repo/shared";
import { classifyOutcome, type StepError } from "./retryPolicy.js";
import type { RetryPolicy } from "./manifest.js";

export interface ClaimStepResult {
  leaseToken: string;
}

/**
 * Database-backed leasing over `workflow_steps`. Every method that mutates
 * an already-leased row is gated by the current `lease_token` — a stale or
 * reclaimed token matches zero rows, which the caller must treat as its own
 * result being discarded, not a silent success (§6/§9 of the Phase 3
 * design).
 */
export interface StepLeasing {
  claimStep(
    stepId: string,
    leaseOwner: string,
    leaseMs: number,
  ): Promise<ClaimStepResult | null>;
  /** LEASED -> RUNNING, gated by the current lease token. */
  markStepRunning(stepId: string, leaseToken: string): Promise<boolean>;
  renewLease(
    stepId: string,
    leaseToken: string,
    leaseMs: number,
  ): Promise<boolean>;
  commitStepSuccess(
    stepId: string,
    leaseToken: string,
    output: unknown,
  ): Promise<boolean>;
  commitStepFailure(
    stepId: string,
    leaseToken: string,
    error: StepError,
    retryPolicy: RetryPolicy,
  ): Promise<boolean>;
}

export class PgStepLeasing implements StepLeasing {
  constructor(private readonly db: Queryable) {}

  /**
   * Single conditional UPDATE, no separate SELECT — race-free by
   * construction: if two workers race to claim the same step, only the
   * first UPDATE to commit still matches `status = 'READY'`.
   */
  async claimStep(
    stepId: string,
    leaseOwner: string,
    leaseMs: number,
  ): Promise<ClaimStepResult | null> {
    const { rows } = await this.db.query<{ lease_token: string }>(
      `update workflow_steps
       set status = 'LEASED',
           lease_owner = $2,
           lease_token = gen_random_uuid(),
           leased_at = now(),
           lease_expires_at = now() + ($3 || ' milliseconds')::interval,
           heartbeat_at = now(),
           updated_at = now()
       where id = $1 and status = 'READY'
       returning lease_token`,
      [stepId, leaseOwner, leaseMs],
    );
    const row = rows[0];
    return row ? { leaseToken: row.lease_token } : null;
  }

  async markStepRunning(stepId: string, leaseToken: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `update workflow_steps
       set status = 'RUNNING', started_at = now(), updated_at = now()
       where id = $1 and lease_token = $2 and status = 'LEASED'`,
      [stepId, leaseToken],
    );
    return (rowCount ?? 0) > 0;
  }

  async renewLease(
    stepId: string,
    leaseToken: string,
    leaseMs: number,
  ): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `update workflow_steps
       set heartbeat_at = now(),
           lease_expires_at = now() + ($3 || ' milliseconds')::interval
       where id = $1 and lease_token = $2 and status = 'RUNNING'`,
      [stepId, leaseToken, leaseMs],
    );
    return (rowCount ?? 0) > 0;
  }

  async commitStepSuccess(
    stepId: string,
    leaseToken: string,
    output: unknown,
  ): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `update workflow_steps
       set status = 'SUCCEEDED',
           output = $3::jsonb,
           completed_at = now(),
           lease_owner = null, lease_token = null, leased_at = null,
           lease_expires_at = null, heartbeat_at = null,
           updated_at = now()
       where id = $1 and lease_token = $2`,
      [stepId, leaseToken, JSON.stringify(output ?? null)],
    );
    return (rowCount ?? 0) > 0;
  }

  /**
   * Reads the current attempt count (still gated to the lease-token holder
   * via the WHERE clause), applies the deterministic retry/dead-letter
   * decision (retryPolicy.ts), and commits the outcome in a single
   * lease-token-gated UPDATE. A dead-lettered outcome also inserts the
   * `workflow_dead_letters` row.
   */
  async commitStepFailure(
    stepId: string,
    leaseToken: string,
    error: StepError,
    retryPolicy: RetryPolicy,
  ): Promise<boolean> {
    const { rows } = await this.db.query<{
      attempt: number;
      tenant_id: string;
      workflow_run_id: string;
    }>(
      "select attempt, tenant_id, workflow_run_id from workflow_steps where id = $1 and lease_token = $2",
      [stepId, leaseToken],
    );
    const current = rows[0];
    if (!current) return false;

    const nextAttempt = current.attempt + 1;
    const outcome = classifyOutcome(nextAttempt, retryPolicy, error);

    if (outcome.kind === "RETRY_SCHEDULED") {
      const { rowCount } = await this.db.query(
        `update workflow_steps
         set status = 'RETRY_SCHEDULED',
             attempt = $3,
             next_attempt_at = $4,
             error = $5::jsonb,
             lease_owner = null, lease_token = null, leased_at = null,
             lease_expires_at = null, heartbeat_at = null,
             updated_at = now()
         where id = $1 and lease_token = $2`,
        [
          stepId,
          leaseToken,
          nextAttempt,
          outcome.nextAttemptAt.toISOString(),
          JSON.stringify(error),
        ],
      );
      return (rowCount ?? 0) > 0;
    }

    if (outcome.kind === "DEAD_LETTERED") {
      const { rows: updated } = await this.db.query<{
        tenant_id: string;
        workflow_run_id: string;
      }>(
        `update workflow_steps
         set status = 'DEAD_LETTERED',
             attempt = $3,
             error = $4::jsonb,
             completed_at = now(),
             lease_owner = null, lease_token = null, leased_at = null,
             lease_expires_at = null, heartbeat_at = null,
             updated_at = now()
         where id = $1 and lease_token = $2
         returning tenant_id, workflow_run_id`,
        [stepId, leaseToken, nextAttempt, JSON.stringify(error)],
      );
      const row = updated[0];
      if (!row) return false;
      await this.db.query(
        `insert into workflow_dead_letters
           (tenant_id, workflow_run_id, workflow_step_id, reason, last_error, attempt_count)
         values ($1, $2, $3, $4, $5::jsonb, $6)`,
        [
          row.tenant_id,
          row.workflow_run_id,
          stepId,
          error.code,
          JSON.stringify(error),
          nextAttempt,
        ],
      );
      return true;
    }

    const { rowCount } = await this.db.query(
      `update workflow_steps
       set status = 'FAILED',
           attempt = $3,
           error = $4::jsonb,
           completed_at = now(),
           lease_owner = null, lease_token = null, leased_at = null,
           lease_expires_at = null, heartbeat_at = null,
           updated_at = now()
       where id = $1 and lease_token = $2`,
      [stepId, leaseToken, nextAttempt, JSON.stringify(error)],
    );
    return (rowCount ?? 0) > 0;
  }
}
