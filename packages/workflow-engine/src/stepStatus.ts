import { z } from "zod";

/**
 * Step-level lifecycle for a `workflow_steps` row — distinct from the
 * run-level `WorkflowStatus` (status.ts). A run tracks the workflow as a
 * whole; a step tracks one unit of work within it, including leasing
 * (`LEASED`/`RUNNING`), retry scheduling, and dead-lettering, none of which
 * apply at the run level.
 */
export const WorkflowStepStatusSchema = z.enum([
  "PENDING",
  "READY",
  "LEASED",
  "RUNNING",
  "WAITING_FOR_APPROVAL",
  "WAITING_FOR_INPUT",
  "RETRY_SCHEDULED",
  "SUCCEEDED",
  "FAILED",
  "BLOCKED",
  "CANCELLED",
  "SKIPPED",
  "EXPIRED",
  "DEAD_LETTERED",
]);
export type WorkflowStepStatus = z.infer<typeof WorkflowStepStatusSchema>;

export const TERMINAL_WORKFLOW_STEP_STATUSES: readonly WorkflowStepStatus[] = [
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "SKIPPED",
  "EXPIRED",
  "DEAD_LETTERED",
];

export function isTerminalWorkflowStepStatus(
  status: WorkflowStepStatus,
): boolean {
  return TERMINAL_WORKFLOW_STEP_STATUSES.includes(status);
}

/**
 * Deterministic transition table, same discipline as the run-level table in
 * status.ts. `FAILED` and `DEAD_LETTERED` are both reachable directly from
 * `RUNNING` (not through each other) — the choice between them is made once,
 * at the moment attempts are exhausted (retryPolicy.ts), based on the step's
 * `deadLetterOnExhaustion` policy flag, not via an intermediate transition.
 */
const ALLOWED_TRANSITIONS: Record<
  WorkflowStepStatus,
  readonly WorkflowStepStatus[]
> = {
  PENDING: ["READY", "CANCELLED", "SKIPPED"],
  READY: ["LEASED", "CANCELLED", "SKIPPED"],
  LEASED: ["RUNNING", "EXPIRED", "CANCELLED"],
  RUNNING: [
    "SUCCEEDED",
    "FAILED",
    "DEAD_LETTERED",
    "RETRY_SCHEDULED",
    "WAITING_FOR_APPROVAL",
    "WAITING_FOR_INPUT",
    "BLOCKED",
    "EXPIRED",
    "CANCELLED",
  ],
  WAITING_FOR_APPROVAL: ["RUNNING", "FAILED", "CANCELLED", "EXPIRED"],
  WAITING_FOR_INPUT: ["RUNNING", "CANCELLED", "EXPIRED"],
  RETRY_SCHEDULED: ["READY", "CANCELLED"],
  BLOCKED: ["READY", "FAILED", "CANCELLED"],
  SUCCEEDED: [],
  FAILED: [],
  CANCELLED: [],
  SKIPPED: [],
  EXPIRED: [],
  DEAD_LETTERED: [],
};

export function isValidWorkflowStepTransition(
  from: WorkflowStepStatus,
  to: WorkflowStepStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class InvalidWorkflowStepTransitionError extends Error {
  constructor(
    public readonly from: WorkflowStepStatus,
    public readonly to: WorkflowStepStatus,
  ) {
    super(`Invalid workflow step status transition: ${from} -> ${to}`);
    this.name = "InvalidWorkflowStepTransitionError";
  }
}

export function assertValidWorkflowStepTransition(
  from: WorkflowStepStatus,
  to: WorkflowStepStatus,
): void {
  if (!isValidWorkflowStepTransition(from, to)) {
    throw new InvalidWorkflowStepTransitionError(from, to);
  }
}
