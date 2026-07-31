import type { Queryable } from "@repo/shared";

export type GovernanceEventActorType = "user" | "agent" | "system" | "worker";

export interface AppendGovernanceEventInput {
  tenantId: string;
  workflowRunId?: string | null;
  workflowStepId?: string | null;
  approvalRequestId?: string | null;
  policyEvaluationId?: string | null;
  eventType: string;
  actorType: GovernanceEventActorType;
  actorId: string | null;
  traceId: string;
  correlationId: string;
  causationId?: string | null;
  payload?: Record<string, unknown>;
}

export interface GovernanceEvent {
  id: string;
  tenantId: string;
  workflowRunId: string | null;
  workflowStepId: string | null;
  approvalRequestId: string | null;
  policyEvaluationId: string | null;
  eventType: string;
  actorType: GovernanceEventActorType;
  actorId: string | null;
  traceId: string;
  correlationId: string;
  causationId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

type EventRow = {
  id: string;
  tenant_id: string;
  workflow_run_id: string | null;
  workflow_step_id: string | null;
  approval_request_id: string | null;
  policy_evaluation_id: string | null;
  event_type: string;
  actor_type: GovernanceEventActorType;
  actor_id: string | null;
  trace_id: string;
  correlation_id: string;
  causation_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

function mapRow(row: EventRow): GovernanceEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    workflowRunId: row.workflow_run_id,
    workflowStepId: row.workflow_step_id,
    approvalRequestId: row.approval_request_id,
    policyEvaluationId: row.policy_evaluation_id,
    eventType: row.event_type,
    actorType: row.actor_type,
    actorId: row.actor_id,
    traceId: row.trace_id,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

/**
 * Appends one row to the append-only `governance_events` audit trail.
 * Unlike `workflow_execution_events`, there is no per-aggregate sequence
 * counter here (§1 of the design doc) — a deliberate simplification, not an
 * oversight: nothing in recovery depends on detecting a gap in this
 * table's numbering, `created_at` + `id` ordering plus `causation_id`
 * links are sufficient for this audit/compliance trail's purposes.
 */
export async function appendGovernanceEvent(
  db: Queryable,
  input: AppendGovernanceEventInput,
): Promise<GovernanceEvent> {
  const { rows } = await db.query<EventRow>(
    `insert into governance_events
       (tenant_id, workflow_run_id, workflow_step_id, approval_request_id,
        policy_evaluation_id, event_type, actor_type, actor_id, trace_id,
        correlation_id, causation_id, payload)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
     returning *`,
    [
      input.tenantId,
      input.workflowRunId ?? null,
      input.workflowStepId ?? null,
      input.approvalRequestId ?? null,
      input.policyEvaluationId ?? null,
      input.eventType,
      input.actorType,
      input.actorId,
      input.traceId,
      input.correlationId,
      input.causationId ?? null,
      JSON.stringify(input.payload ?? {}),
    ],
  );
  return mapRow(rows[0]!);
}
