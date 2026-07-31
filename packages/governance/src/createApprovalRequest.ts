import type { Queryable } from "@repo/shared";
import { computeActionPayloadHash } from "./contentHash.js";
import type { ApprovalRequestStatus } from "./approvalRequestLifecycle.js";

export interface ActionSnapshotActor {
  type: "user" | "agent" | "system" | "worker";
  id: string | null;
}

/**
 * Immutable action snapshot (§8) — captured once at approval-request
 * creation time and never mutated. `proposedOutput` is the agent's
 * already-produced result, replayed verbatim on approval so the agent is
 * never re-invoked (§9's "exactly once" guarantee).
 */
export interface ActionSnapshot {
  action: string;
  parameters: Record<string, unknown>;
  targetResource: string | null;
  requestingActor: ActionSnapshotActor;
  requestingTenantAgentId: string | null;
  workflowRunId: string;
  workflowStepId: string;
  policyDecisionId: string;
  riskClassificationVersionId: string;
  evidence: Record<string, unknown>;
  traceContext: { traceId: string; correlationId: string };
  proposedOutput: unknown;
}

export interface ApprovalRequest {
  id: string;
  tenantId: string;
  policyEvaluationId: string;
  workflowRunId: string;
  workflowStepId: string;
  actionSnapshot: ActionSnapshot;
  payloadHash: string;
  status: ApprovalRequestStatus;
  requiredApprovalCount: number;
  requiredApproverRoles: readonly string[];
  rejectOnFirstRejection: boolean;
  continuationCommitted: boolean;
  expiresAt: string | null;
  supersededByRequestId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  id: string;
  tenant_id: string;
  policy_evaluation_id: string;
  workflow_run_id: string;
  workflow_step_id: string;
  action_snapshot: ActionSnapshot;
  payload_hash: string;
  status: ApprovalRequestStatus;
  required_approval_count: number;
  required_approver_roles: string[];
  reject_on_first_rejection: boolean;
  continuation_committed: boolean;
  expires_at: string | null;
  superseded_by_request_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export function mapApprovalRequestRow(row: Row): ApprovalRequest {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    policyEvaluationId: row.policy_evaluation_id,
    workflowRunId: row.workflow_run_id,
    workflowStepId: row.workflow_step_id,
    actionSnapshot: row.action_snapshot,
    payloadHash: row.payload_hash,
    status: row.status,
    requiredApprovalCount: row.required_approval_count,
    requiredApproverRoles: row.required_approver_roles,
    rejectOnFirstRejection: row.reject_on_first_rejection,
    continuationCommitted: row.continuation_committed,
    expiresAt: row.expires_at,
    supersededByRequestId: row.superseded_by_request_id,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateApprovalRequestInput {
  tenantId: string;
  policyEvaluationId: string;
  workflowRunId: string;
  workflowStepId: string;
  actionSnapshot: ActionSnapshot;
  requiredApprovalCount: number;
  requiredApproverRoles: readonly string[];
  rejectOnFirstRejection: boolean;
  expiresAt: string | null;
}

const NON_TERMINAL_STATUSES: readonly ApprovalRequestStatus[] = [
  "PENDING",
  "ASSIGNED",
  "PARTIALLY_APPROVED",
];

/**
 * Governed command backing §8. Idempotent on an unchanged proposal (same
 * `payload_hash` returns the existing active request unchanged); a changed
 * proposal (different `payload_hash`) supersedes the prior active request
 * before inserting the new one, so the old request can never authorize the
 * new action — its `payload_hash` no longer matches anything anyone would
 * verify against.
 */
export async function createApprovalRequest(
  db: Queryable,
  input: CreateApprovalRequestInput,
): Promise<ApprovalRequest> {
  const payloadHash = computeActionPayloadHash({
    action: input.actionSnapshot.action,
    parameters: input.actionSnapshot.parameters,
    targetResource: input.actionSnapshot.targetResource,
  });

  const { rows: activeRows } = await db.query<Row>(
    `select * from approval_requests
     where workflow_step_id = $1
       and status = any($2::text[])`,
    [input.workflowStepId, NON_TERMINAL_STATUSES],
  );
  const active = activeRows[0];

  if (active && active.payload_hash === payloadHash) {
    return mapApprovalRequestRow(active);
  }

  if (active) {
    await db.query(
      `update approval_requests
       set status = 'SUPERSEDED', resolved_at = now(), updated_at = now()
       where id = $1`,
      [active.id],
    );
  }

  const { rows } = await db.query<Row>(
    `insert into approval_requests
       (tenant_id, policy_evaluation_id, workflow_run_id, workflow_step_id,
        action_snapshot, payload_hash, status, required_approval_count,
        required_approver_roles, reject_on_first_rejection, expires_at)
     values ($1, $2, $3, $4, $5::jsonb, $6, 'PENDING', $7, $8::jsonb, $9, $10)
     returning *`,
    [
      input.tenantId,
      input.policyEvaluationId,
      input.workflowRunId,
      input.workflowStepId,
      JSON.stringify(input.actionSnapshot),
      payloadHash,
      input.requiredApprovalCount,
      JSON.stringify(input.requiredApproverRoles),
      input.rejectOnFirstRejection,
      input.expiresAt,
    ],
  );
  const created = mapApprovalRequestRow(rows[0]!);

  if (active) {
    await db.query(
      "update approval_requests set superseded_by_request_id = $1 where id = $2",
      [created.id, active.id],
    );
  }

  return created;
}
