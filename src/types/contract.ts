/**
 * Execution contract for the Atlas AI Video Factory.
 *
 * This encodes the "non-negotiable production behavior" from the blueprint:
 *   - every run and step is idempotent
 *   - external jobs use webhooks where available and bounded polling otherwise
 *   - structured AI output is schema-validated
 *   - failed steps retry with exponential backoff, then dead-letter
 *   - publication requires explicit human approval unless tenant policy opts out
 *   - every state transition is appended to an audit log
 *
 * Engine implementations (src/workflow/*) must satisfy this contract; they
 * should not invent their own status/audit shapes.
 */

import type { StageId, StepKind } from "@/src/types/graph";

/** Every run is addressed by a stable, caller-supplied idempotency key so
 *  retried triggers (e.g. a redelivered webhook) never double-execute. */
export type IdempotencyKey = string & { readonly __brand: "IdempotencyKey" };

export function toIdempotencyKey(value: string): IdempotencyKey {
  if (!value || value.length < 8) {
    throw new Error(
      "Idempotency key must be a non-empty string of at least 8 characters",
    );
  }
  return value as IdempotencyKey;
}

export type RunStatus =
  | "pending"
  | "running"
  | "waiting_approval"
  | "succeeded"
  | "failed"
  | "dead_letter";

export type StepStatus =
  | "pending"
  | "running"
  | "retrying"
  | "succeeded"
  | "failed"
  | "dead_letter"
  | "skipped";

export interface WorkflowRun {
  readonly id: string;
  readonly graphId: string;
  readonly graphVersion: string;
  readonly tenantId: string;
  readonly idempotencyKey: IdempotencyKey;
  readonly status: RunStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StepExecution {
  readonly id: string;
  readonly runId: string;
  readonly nodeId: string;
  readonly stageId: StageId;
  readonly kind: StepKind;
  readonly status: StepStatus;
  readonly attempt: number;
  readonly idempotencyKey: IdempotencyKey;
  readonly startedAt?: string;
  readonly completedAt?: string;
  /** Present once status is "failed" or "dead_letter". */
  readonly error?: StepError;
}

export interface StepError {
  readonly message: string;
  readonly code?: string;
  readonly retryable: boolean;
}

/** Result of validating a structured AI (or external job) response against
 *  its Zod schema before it is allowed to advance the graph. */
export interface SchemaValidationResult<T> {
  readonly valid: boolean;
  readonly data?: T;
  readonly issues?: readonly string[];
}

/** Every state transition — run created, step started/retried/failed,
 *  approval granted, publish completed — is appended here and is immutable. */
export interface AuditLogEntry {
  readonly id: string;
  readonly runId: string;
  readonly nodeId?: string;
  readonly actor: "system" | "agent" | { readonly userId: string };
  readonly action: string;
  readonly fromStatus?: string;
  readonly toStatus?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

/** Tenant-level policy. Publication requires human approval unless a tenant
 *  explicitly opts out (e.g. a fully autonomous internal test tenant). */
export interface TenantPolicy {
  readonly tenantId: string;
  readonly requireApprovalBeforePublish: boolean;
  readonly retryPolicyOverride?: {
    readonly maxAttempts?: number;
    readonly maxDelayMs?: number;
  };
}

export const DEFAULT_TENANT_POLICY: Omit<TenantPolicy, "tenantId"> = {
  requireApprovalBeforePublish: true,
};

/** Contract every durable execution engine (Inngest, Trigger.dev, ...) must
 *  implement so the pipeline stays portable across execution backends. */
export interface WorkflowEngine {
  startRun(input: {
    graphId: string;
    graphVersion: string;
    tenantId: string;
    idempotencyKey: IdempotencyKey;
    payload: unknown;
  }): Promise<WorkflowRun>;

  recordStep(execution: StepExecution): Promise<void>;

  appendAuditLog(
    entry: Omit<AuditLogEntry, "id" | "createdAt">,
  ): Promise<AuditLogEntry>;

  getRun(runId: string): Promise<WorkflowRun | null>;
}
