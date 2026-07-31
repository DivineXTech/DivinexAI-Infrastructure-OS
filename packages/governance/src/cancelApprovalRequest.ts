import type { Queryable, TenantAccessEvaluator } from "@repo/shared";
import { TenantAuthorizationError } from "@repo/shared";
import {
  cancelWorkflowStepApproval,
  reconcileWorkflowRunOutcome,
} from "@repo/workflow-engine";
import {
  mapApprovalRequestRow,
  type ApprovalRequest,
} from "./createApprovalRequest.js";
import {
  assertValidApprovalTransition,
  isTerminalApprovalRequestStatus,
} from "./approvalRequestLifecycle.js";
import { appendGovernanceEvent } from "./governanceEvents.js";

type Row = Parameters<typeof mapApprovalRequestRow>[0];

/**
 * Governed command backing "authorized users may request cancellation"
 * (§7). Runs entirely over the trusted connection — there is still no
 * tenant `UPDATE` policy on `approval_requests` of any kind; "requesting
 * cancellation" means calling this function, not writing to the row
 * directly. No new permission key invented (reuses `tenant.decide_approvals`).
 */
export async function cancelApprovalRequest(
  db: Queryable,
  access: TenantAccessEvaluator,
  approvalRequestId: string,
  actorUserId: string,
): Promise<ApprovalRequest> {
  const { rows } = await db.query<Row>(
    "select * from approval_requests where id = $1",
    [approvalRequestId],
  );
  const row = rows[0];
  if (!row) {
    throw new Error(`Approval request "${approvalRequestId}" not found`);
  }
  const request = mapApprovalRequestRow(row);

  // 1. checkPermission(tenant.decide_approvals)
  const permission = await access.checkPermission({
    tenantId: request.tenantId,
    userId: actorUserId,
    permissionKey: "tenant.decide_approvals",
  });
  if (!permission.allowed) {
    throw new TenantAuthorizationError(permission.reason);
  }

  // 2. Already-terminal is a successful no-op, not an error.
  if (isTerminalApprovalRequestStatus(request.status)) {
    return request;
  }

  // 3. assertValidApprovalTransition + update
  assertValidApprovalTransition(request.status, "CANCELLED");
  const { rows: updatedRows } = await db.query<Row>(
    `update approval_requests
     set status = 'CANCELLED', resolved_at = now(), updated_at = now()
     where id = $1
     returning *`,
    [approvalRequestId],
  );
  const updated = mapApprovalRequestRow(updatedRows[0]!);

  // 4. workflow-engine.cancelWorkflowStepApproval then reconcileWorkflowRunOutcome
  await cancelWorkflowStepApproval(db, updated.workflowStepId);
  await reconcileWorkflowRunOutcome(db, updated.workflowRunId);

  // 5. append governance_events (+ workflow_execution_events via step 4)
  await appendGovernanceEvent(db, {
    tenantId: updated.tenantId,
    workflowRunId: updated.workflowRunId,
    workflowStepId: updated.workflowStepId,
    approvalRequestId: updated.id,
    eventType: "approval.cancelled",
    actorType: "user",
    actorId: actorUserId,
    traceId: updated.actionSnapshot.traceContext.traceId,
    correlationId: updated.actionSnapshot.traceContext.correlationId,
    payload: {},
  });

  return updated;
}
