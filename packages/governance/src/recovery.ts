import type { Queryable } from "@repo/shared";
import {
  expireWorkflowStepApproval,
  reconcileWorkflowRunOutcome,
} from "@repo/workflow-engine";
import { mapApprovalRequestRow } from "./createApprovalRequest.js";
import { appendGovernanceEvent } from "./governanceEvents.js";
import { resumeApprovedRequest } from "./resumeApprovedRequest.js";

type Row = Parameters<typeof mapApprovalRequestRow>[0];

export interface ReconcileGovernanceRuntimeResult {
  requestsExpired: number;
  requestsResumed: number;
  stepsReconciled: number;
  assignmentsAbandoned: number;
  requestsSupersededByRecovery: number;
}

const TERMINAL_NON_APPROVED_STATUSES = [
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
  "SUPERSEDED",
];

/**
 * Stateless, idempotent, safe-to-re-run governance recovery tick (§11),
 * following the exact discipline of `workflow-engine`'s
 * `reconcileWorkflowRuntime`. Queries the database fresh every call and
 * holds no in-memory state.
 */
export async function reconcileGovernanceRuntime(
  db: Queryable,
): Promise<ReconcileGovernanceRuntimeResult> {
  // 1. Expire due requests.
  const { rows: expiredRows } = await db.query<Row>(
    `update approval_requests
     set status = 'EXPIRED', resolved_at = now(), updated_at = now()
     where status in ('PENDING', 'ASSIGNED', 'PARTIALLY_APPROVED')
       and expires_at is not null and expires_at < now()
     returning *`,
  );
  for (const row of expiredRows) {
    const request = mapApprovalRequestRow(row);
    await expireWorkflowStepApproval(db, request.workflowStepId);
    await reconcileWorkflowRunOutcome(db, request.workflowRunId);
    await appendGovernanceEvent(db, {
      tenantId: request.tenantId,
      workflowRunId: request.workflowRunId,
      workflowStepId: request.workflowStepId,
      approvalRequestId: request.id,
      eventType: "approval.expired",
      actorType: "system",
      actorId: null,
      traceId: request.actionSnapshot.traceContext.traceId,
      correlationId: request.actionSnapshot.traceContext.correlationId,
      payload: {},
    });
  }

  // 2. Reached quorum but not yet resumed — the partial index in §1 makes
  // this cheap. Calls the exact same function recordApprovalDecision calls
  // synchronously, so there is exactly one code path for resumption.
  const { rows: pendingContinuationRows } = await db.query<{ id: string }>(
    "select id from approval_requests where status = 'APPROVED' and continuation_committed = false",
  );
  let requestsResumed = 0;
  for (const row of pendingContinuationRows) {
    const result = await resumeApprovedRequest(db, row.id);
    if (result.resumed) requestsResumed += 1;
  }

  // 3. Steps waiting on an already-resolved terminal request (e.g. a crash
  // between updating the request and calling the workflow-engine transition).
  const { rows: orphanedRows } = await db.query<{
    step_id: string;
    workflow_run_id: string;
    request_status: string;
  }>(
    `select distinct on (ws.id) ws.id as step_id, ws.workflow_run_id, ar.status as request_status
     from workflow_steps ws
     join approval_requests ar on ar.workflow_step_id = ws.id
     where ws.status = 'WAITING_FOR_APPROVAL'
     order by ws.id, ar.created_at desc`,
  );
  let stepsReconciled = 0;
  for (const row of orphanedRows) {
    if (!TERMINAL_NON_APPROVED_STATUSES.includes(row.request_status)) continue;
    await expireWorkflowStepApproval(db, row.step_id);
    await reconcileWorkflowRunOutcome(db, row.workflow_run_id);
    stepsReconciled += 1;
  }

  // 4. Duplicate decision attempts — prevented structurally by
  // `unique(approval_request_id, decided_by_user_id)`; nothing to do here.

  // 5. Abandoned approval assignments — cosmetic/audit accuracy only; no
  // step-state depends on assignment status.
  const { rowCount: assignmentsAbandoned } = await db.query(
    `update approval_assignments aa
     set status = 'EXPIRED', updated_at = now()
     from approval_requests ar
     where aa.approval_request_id = ar.id
       and aa.status = 'ASSIGNED'
       and ar.status in ('APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED')`,
  );

  // 6. Superseded action snapshots — safety net only; createApprovalRequest
  // already supersedes at creation time (§8).
  const { rows: supersededRows } = await db.query<{ id: string }>(
    `update approval_requests ar1
     set status = 'SUPERSEDED', superseded_by_request_id = ar2.id,
         resolved_at = now(), updated_at = now()
     from approval_requests ar2
     where ar2.workflow_step_id = ar1.workflow_step_id
       and ar2.id != ar1.id
       and ar2.created_at > ar1.created_at
       and ar1.status not in ('APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED')
     returning ar1.id`,
  );

  return {
    requestsExpired: expiredRows.length,
    requestsResumed,
    stepsReconciled,
    assignmentsAbandoned: assignmentsAbandoned ?? 0,
    requestsSupersededByRecovery: supersededRows.length,
  };
}
