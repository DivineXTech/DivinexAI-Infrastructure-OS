import { z } from "zod";

export const WorkflowStatusSchema = z.enum([
  "DRAFT",
  "PLANNING",
  "WAITING_FOR_APPROVAL",
  "QUEUED",
  "RUNNING",
  "RETRYING",
  "BLOCKED",
  "PAUSED",
  "WAITING_FOR_INPUT",
  "VALIDATING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REJECTED",
  "EXPIRED",
]);
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

export const TERMINAL_WORKFLOW_STATUSES: readonly WorkflowStatus[] = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REJECTED",
  "EXPIRED",
];

export function isTerminalWorkflowStatus(status: WorkflowStatus): boolean {
  return TERMINAL_WORKFLOW_STATUSES.includes(status);
}

/**
 * Deterministic transition table (rule #13/#14: state transitions are a
 * deterministic engine's job, not an inference). Every non-terminal status
 * lists exactly the statuses it may move to; terminal statuses have none.
 * This is the sole source of truth for "is this transition legal" — the
 * (future) workflow state machine persists a step via this contract rather
 * than re-deriving its own rules.
 */
const ALLOWED_TRANSITIONS: Record<WorkflowStatus, readonly WorkflowStatus[]> = {
  DRAFT: ["PLANNING", "CANCELLED"],
  PLANNING: ["WAITING_FOR_APPROVAL", "QUEUED", "FAILED", "CANCELLED"],
  WAITING_FOR_APPROVAL: [
    "QUEUED",
    "RUNNING",
    "REJECTED",
    "EXPIRED",
    "CANCELLED",
  ],
  QUEUED: ["RUNNING", "CANCELLED"],
  RUNNING: [
    "RETRYING",
    "BLOCKED",
    "PAUSED",
    "WAITING_FOR_INPUT",
    "WAITING_FOR_APPROVAL",
    "VALIDATING",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
  ],
  RETRYING: ["RUNNING", "FAILED", "CANCELLED"],
  BLOCKED: ["WAITING_FOR_APPROVAL", "RUNNING", "FAILED", "CANCELLED"],
  PAUSED: ["RUNNING", "CANCELLED"],
  WAITING_FOR_INPUT: ["RUNNING", "EXPIRED", "CANCELLED"],
  VALIDATING: ["COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  REJECTED: [],
  EXPIRED: [],
};

export function isValidWorkflowTransition(
  from: WorkflowStatus,
  to: WorkflowStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class InvalidWorkflowTransitionError extends Error {
  constructor(
    public readonly from: WorkflowStatus,
    public readonly to: WorkflowStatus,
  ) {
    super(`Invalid workflow status transition: ${from} -> ${to}`);
    this.name = "InvalidWorkflowTransitionError";
  }
}

/** Throws `InvalidWorkflowTransitionError` rather than returning a boolean, for call sites that should abort rather than branch on validity. */
export function assertValidWorkflowTransition(
  from: WorkflowStatus,
  to: WorkflowStatus,
): void {
  if (!isValidWorkflowTransition(from, to)) {
    throw new InvalidWorkflowTransitionError(from, to);
  }
}
