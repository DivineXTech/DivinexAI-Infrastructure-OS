import type { Queryable, TenantAccessEvaluator } from "@repo/shared";
import { TenantAuthorizationError } from "@repo/shared";
import {
  rejectWorkflowStepApproval,
  reconcileWorkflowRunOutcome,
} from "@repo/workflow-engine";
import {
  mapApprovalRequestRow,
  type ApprovalRequest,
} from "./createApprovalRequest.js";
import {
  assertValidApprovalTransition,
  isTerminalApprovalRequestStatus,
  type ApprovalRequestStatus,
} from "./approvalRequestLifecycle.js";
import { assertSeparationOfDuties } from "./separationOfDuties.js";
import { computeActionPayloadHash } from "./contentHash.js";
import { appendGovernanceEvent } from "./governanceEvents.js";
import { resumeApprovedRequest } from "./resumeApprovedRequest.js";
import {
  AlreadyResolvedError,
  NotAssignedApproverError,
  PayloadIntegrityError,
} from "./errors.js";

type Row = Parameters<typeof mapApprovalRequestRow>[0];

export interface RecordApprovalDecisionInput {
  approvalRequestId: string;
  deciderUserId: string;
  decision: "APPROVED" | "REJECTED";
  comment?: string | null;
}

/**
 * The exact 9-step sequence required by §7 of the Phase 4 design. Runs
 * entirely over the trusted service-role/owner connection — there is no
 * RLS path that performs any part of this; every check is application
 * code, reusing the existing `tenant_memberships`/`role_permissions`
 * tables via `TenantAccessEvaluator` — no second authorization mechanism.
 */
export async function recordApprovalDecision(
  db: Queryable,
  access: TenantAccessEvaluator,
  input: RecordApprovalDecisionInput,
): Promise<ApprovalRequest> {
  const { rows } = await db.query<Row>(
    "select * from approval_requests where id = $1",
    [input.approvalRequestId],
  );
  const row = rows[0];
  if (!row) {
    throw new Error(`Approval request "${input.approvalRequestId}" not found`);
  }
  const request = mapApprovalRequestRow(row);

  // 1. TENANT PERMISSION CHECK
  const permission = await access.checkPermission({
    tenantId: request.tenantId,
    userId: input.deciderUserId,
    permissionKey: "tenant.decide_approvals",
  });
  if (!permission.allowed) {
    throw new TenantAuthorizationError(permission.reason);
  }

  // 2. APPROVAL ASSIGNMENT CHECK
  if (isTerminalApprovalRequestStatus(request.status)) {
    throw new AlreadyResolvedError(request.id);
  }
  const { rows: assignmentRows } = await db.query<{ found: boolean }>(
    `select exists (
       select 1 from approval_assignments aa
       where aa.approval_request_id = $1
         and aa.status = 'ASSIGNED'
         and (
           aa.assignee_user_id = $2
           or aa.assignee_role_key in (
             select r.key
             from tenant_memberships m
             join roles r on r.id = m.role_id
             where m.tenant_id = $3 and m.user_id = $2 and m.status = 'active'
           )
         )
     ) as found`,
    [request.id, input.deciderUserId, request.tenantId],
  );
  if (!assignmentRows[0]!.found) {
    throw new NotAssignedApproverError(request.id, input.deciderUserId);
  }

  // 3. SEPARATION-OF-DUTIES CHECK
  assertSeparationOfDuties(request.actionSnapshot, {
    type: "user",
    id: input.deciderUserId,
  });

  // 4. ACTION SNAPSHOT AND PAYLOAD-HASH VERIFICATION
  const recomputedHash = computeActionPayloadHash({
    action: request.actionSnapshot.action,
    parameters: request.actionSnapshot.parameters,
    targetResource: request.actionSnapshot.targetResource,
  });
  if (recomputedHash !== request.payloadHash) {
    throw new PayloadIntegrityError(request.id);
  }

  // 5. IMMUTABLE DECISION INSERTION — a duplicate submission from the same
  // decider is absorbed (distinct-approver enforced at the DB level too).
  const { rows: decisionRows } = await db.query<{ id: string }>(
    `insert into approval_decisions
       (tenant_id, approval_request_id, decision, decided_by_user_id, comment)
     values ($1, $2, $3, $4, $5)
     on conflict (approval_request_id, decided_by_user_id) do nothing
     returning id`,
    [
      request.tenantId,
      request.id,
      input.decision,
      input.deciderUserId,
      input.comment ?? null,
    ],
  );
  const isNewDecision = decisionRows.length > 0;

  // Requires the request to be at least ASSIGNED before a decision can be
  // recorded against it — applied here as a real, separately-validated hop
  // (never collapsed into a PENDING -> APPROVED/REJECTED shortcut, which
  // the transition table itself refuses, §6).
  let currentStatus: ApprovalRequestStatus = request.status;
  if (currentStatus === "PENDING") {
    assertValidApprovalTransition(currentStatus, "ASSIGNED");
    await db.query(
      "update approval_requests set status = 'ASSIGNED', updated_at = now() where id = $1",
      [request.id],
    );
    currentStatus = "ASSIGNED";
  }

  // 6. QUORUM RECOMPUTATION
  const { rows: countRows } = await db.query<{
    approved_count: string;
    rejected_count: string;
  }>(
    `select
       count(*) filter (where decision = 'APPROVED') as approved_count,
       count(*) filter (where decision = 'REJECTED') as rejected_count
     from approval_decisions
     where approval_request_id = $1`,
    [request.id],
  );
  const approvedCount = Number(countRows[0]!.approved_count);
  const rejectedCount = Number(countRows[0]!.rejected_count);

  let nextStatus: ApprovalRequestStatus = currentStatus;
  if (
    input.decision === "REJECTED" &&
    request.rejectOnFirstRejection &&
    rejectedCount > 0
  ) {
    nextStatus = "REJECTED";
  } else if (approvedCount >= request.requiredApprovalCount) {
    nextStatus = "APPROVED";
  } else if (approvedCount > 0) {
    nextStatus = "PARTIALLY_APPROVED";
  }

  // 7. APPROVAL-REQUEST STATUS TRANSITION — recomputing to the same status
  // (still below quorum) is a data update, not a lifecycle transition (§6).
  let updated: ApprovalRequest = { ...request, status: currentStatus };
  if (nextStatus !== currentStatus) {
    assertValidApprovalTransition(currentStatus, nextStatus);
    const terminal = isTerminalApprovalRequestStatus(nextStatus);
    const { rows: updatedRows } = await db.query<Row>(
      `update approval_requests
       set status = $2,
           resolved_at = case when $3 then now() else resolved_at end,
           updated_at = now()
       where id = $1
       returning *`,
      [request.id, nextStatus, terminal],
    );
    updated = mapApprovalRequestRow(updatedRows[0]!);
  }

  // 8. WORKFLOW CONTINUATION OR TERMINAL HANDLING
  if (updated.status === "APPROVED" && request.status !== "APPROVED") {
    await resumeApprovedRequest(db, updated.id);
  } else if (updated.status === "REJECTED" && request.status !== "REJECTED") {
    await rejectWorkflowStepApproval(db, updated.workflowStepId, {
      retryable: false,
      code: "approval_rejected",
      message: input.comment ?? "Approval request rejected",
    });
    await reconcileWorkflowRunOutcome(db, updated.workflowRunId);
  }

  // 9. GOVERNANCE AND WORKFLOW EVENT RECORDING
  await appendGovernanceEvent(db, {
    tenantId: updated.tenantId,
    workflowRunId: updated.workflowRunId,
    workflowStepId: updated.workflowStepId,
    approvalRequestId: updated.id,
    eventType: "approval.decision_recorded",
    actorType: "user",
    actorId: input.deciderUserId,
    traceId: updated.actionSnapshot.traceContext.traceId,
    correlationId: updated.actionSnapshot.traceContext.correlationId,
    payload: { decision: input.decision, isNewDecision, status: updated.status },
  });
  if (updated.status !== request.status && isTerminalApprovalRequestStatus(updated.status)) {
    await appendGovernanceEvent(db, {
      tenantId: updated.tenantId,
      workflowRunId: updated.workflowRunId,
      workflowStepId: updated.workflowStepId,
      approvalRequestId: updated.id,
      eventType: `approval.${updated.status.toLowerCase()}`,
      actorType: "user",
      actorId: input.deciderUserId,
      traceId: updated.actionSnapshot.traceContext.traceId,
      correlationId: updated.actionSnapshot.traceContext.correlationId,
      payload: {},
    });
  }

  return updated;
}
