/** The targeted `approval_requests` row is already in a terminal state (§7 step 2). */
export class AlreadyResolvedError extends Error {
  constructor(approvalRequestId: string) {
    super(
      `Approval request "${approvalRequestId}" is already resolved (terminal status)`,
    );
    this.name = "AlreadyResolvedError";
  }
}

/** The decider has no `approval_assignments` row for this request (§7 step 2). */
export class NotAssignedApproverError extends Error {
  constructor(approvalRequestId: string, deciderId: string) {
    super(
      `User "${deciderId}" is not an assigned approver for approval request "${approvalRequestId}"`,
    );
    this.name = "NotAssignedApproverError";
  }
}

/**
 * The action snapshot's recomputed payload hash no longer matches the
 * stored `payload_hash` (§7 step 4, §10's resumption re-check). Should be
 * unreachable given §8's supersession-on-create guarantee; a real, explicit
 * check (defense in depth), not an assumption.
 */
export class PayloadIntegrityError extends Error {
  constructor(approvalRequestId: string) {
    super(
      `Approval request "${approvalRequestId}"'s action snapshot failed payload-hash verification`,
    );
    this.name = "PayloadIntegrityError";
  }
}
