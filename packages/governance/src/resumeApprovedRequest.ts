import type { Queryable } from "@repo/shared";
import { resumeWorkflowStepAfterApproval, reconcileWorkflowRunOutcome } from "@repo/workflow-engine";
import { computeActionPayloadHash } from "./contentHash.js";
import { mapApprovalRequestRow } from "./createApprovalRequest.js";
import { appendGovernanceEvent } from "./governanceEvents.js";
import { PayloadIntegrityError } from "./errors.js";

type Row = Parameters<typeof mapApprovalRequestRow>[0];

export interface ResumeApprovedRequestResult {
  /** `false` means a concurrent/prior caller already resumed this request — a safe no-op, not an error. */
  resumed: boolean;
}

/**
 * Exactly-once resumption (§10). Gate #1: an atomic conditional UPDATE
 * flips `continuation_committed` false -> true only for the single caller
 * that wins the race; a concurrent/duplicate caller matches zero rows and
 * returns `{ resumed: false }` immediately. Gate #2 lives inside
 * `workflow-engine.resumeWorkflowStepAfterApproval`'s own conditional
 * UPDATE. Called both synchronously (from `recordApprovalDecision`) and
 * from recovery (`reconcileGovernanceRuntime`) — exactly one code path for
 * resumption regardless of whether it fires immediately or after a crash.
 */
export async function resumeApprovedRequest(
  db: Queryable,
  approvalRequestId: string,
): Promise<ResumeApprovedRequestResult> {
  const { rows } = await db.query<Row>(
    `update approval_requests
     set continuation_committed = true, updated_at = now()
     where id = $1 and status = 'APPROVED' and continuation_committed = false
     returning *`,
    [approvalRequestId],
  );
  const row = rows[0];
  if (!row) return { resumed: false };

  const request = mapApprovalRequestRow(row);
  const snapshot = request.actionSnapshot;

  const recomputedHash = computeActionPayloadHash({
    action: snapshot.action,
    parameters: snapshot.parameters,
    targetResource: snapshot.targetResource,
  });
  if (recomputedHash !== request.payloadHash) {
    await appendGovernanceEvent(db, {
      tenantId: request.tenantId,
      workflowRunId: request.workflowRunId,
      workflowStepId: request.workflowStepId,
      approvalRequestId: request.id,
      eventType: "approval.integrity_failure",
      actorType: "system",
      actorId: null,
      traceId: snapshot.traceContext.traceId,
      correlationId: snapshot.traceContext.correlationId,
      payload: { reason: "payload_hash_mismatch" },
    });
    throw new PayloadIntegrityError(request.id);
  }

  const applied = await resumeWorkflowStepAfterApproval(
    db,
    request.workflowStepId,
    snapshot.proposedOutput,
  );

  await appendGovernanceEvent(db, {
    tenantId: request.tenantId,
    workflowRunId: request.workflowRunId,
    workflowStepId: request.workflowStepId,
    approvalRequestId: request.id,
    eventType: "workflow.resumed",
    actorType: "system",
    actorId: null,
    traceId: snapshot.traceContext.traceId,
    correlationId: snapshot.traceContext.correlationId,
    payload: { applied },
  });

  await reconcileWorkflowRunOutcome(db, request.workflowRunId);

  return { resumed: applied };
}
