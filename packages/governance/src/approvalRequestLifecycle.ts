import { z } from "zod";

/**
 * Lifecycle for an `approval_requests` row (§6 of the Phase 4 design).
 * Eight states, five terminal. `PENDING` cannot jump directly to
 * `APPROVED`/`REJECTED` — a decision requires an `approval_assignments` row
 * first, so the request must already be at least `ASSIGNED` by the time any
 * decision lands (enforced procedurally by `recordApprovalDecision`, and
 * structurally here too, since this table has no such transition at all).
 */
export const ApprovalRequestStatusSchema = z.enum([
  "PENDING",
  "ASSIGNED",
  "PARTIALLY_APPROVED",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
  "SUPERSEDED",
]);
export type ApprovalRequestStatus = z.infer<typeof ApprovalRequestStatusSchema>;

export const TERMINAL_APPROVAL_REQUEST_STATUSES: readonly ApprovalRequestStatus[] =
  ["APPROVED", "REJECTED", "EXPIRED", "CANCELLED", "SUPERSEDED"];

export function isTerminalApprovalRequestStatus(
  status: ApprovalRequestStatus,
): boolean {
  return TERMINAL_APPROVAL_REQUEST_STATUSES.includes(status);
}

const ALLOWED_TRANSITIONS: Record<
  ApprovalRequestStatus,
  readonly ApprovalRequestStatus[]
> = {
  PENDING: ["ASSIGNED", "EXPIRED", "CANCELLED", "SUPERSEDED"],
  ASSIGNED: [
    "PARTIALLY_APPROVED",
    "APPROVED",
    "REJECTED",
    "EXPIRED",
    "CANCELLED",
    "SUPERSEDED",
  ],
  PARTIALLY_APPROVED: [
    "APPROVED",
    "REJECTED",
    "EXPIRED",
    "CANCELLED",
    "SUPERSEDED",
  ],
  APPROVED: [],
  REJECTED: [],
  EXPIRED: [],
  CANCELLED: [],
  SUPERSEDED: [],
};

export function isValidApprovalTransition(
  from: ApprovalRequestStatus,
  to: ApprovalRequestStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class InvalidApprovalTransitionError extends Error {
  constructor(
    public readonly from: ApprovalRequestStatus,
    public readonly to: ApprovalRequestStatus,
  ) {
    super(`Invalid approval request status transition: ${from} -> ${to}`);
    this.name = "InvalidApprovalTransitionError";
  }
}

/**
 * Recomputing to the same status (e.g. `PARTIALLY_APPROVED -> PARTIALLY_APPROVED`
 * while still below quorum) is a data update, not a lifecycle transition —
 * callers must check `from !== to` before calling this, mirroring how
 * `workflow_steps` only asserts a transition when the target actually
 * differs.
 */
export function assertValidApprovalTransition(
  from: ApprovalRequestStatus,
  to: ApprovalRequestStatus,
): void {
  if (!isValidApprovalTransition(from, to)) {
    throw new InvalidApprovalTransitionError(from, to);
  }
}
