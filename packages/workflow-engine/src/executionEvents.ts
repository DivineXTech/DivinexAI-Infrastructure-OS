import type { Queryable } from "@repo/shared";

export type WorkflowExecutionEventActorType =
  "user" | "agent" | "system" | "worker";

export interface AppendWorkflowExecutionEventInput {
  tenantId: string;
  workflowRunId: string;
  workflowStepId: string | null;
  eventType: string;
  actorType: WorkflowExecutionEventActorType;
  actorId: string | null;
  traceId: string;
  correlationId: string;
  causationId: string | null;
  payload?: Record<string, unknown>;
}

export interface WorkflowExecutionEvent {
  id: string;
  tenantId: string;
  workflowRunId: string;
  workflowStepId: string | null;
  eventType: string;
  actorType: WorkflowExecutionEventActorType;
  actorId: string | null;
  traceId: string;
  correlationId: string;
  causationId: string | null;
  sequenceNumber: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

type EventRow = {
  id: string;
  tenant_id: string;
  workflow_run_id: string;
  workflow_step_id: string | null;
  event_type: string;
  actor_type: WorkflowExecutionEventActorType;
  actor_id: string | null;
  trace_id: string;
  correlation_id: string;
  causation_id: string | null;
  sequence_number: string;
  payload: Record<string, unknown>;
  created_at: string;
};

function mapRow(row: EventRow): WorkflowExecutionEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    workflowRunId: row.workflow_run_id,
    workflowStepId: row.workflow_step_id,
    eventType: row.event_type,
    actorType: row.actor_type,
    actorId: row.actor_id,
    traceId: row.trace_id,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    sequenceNumber: row.sequence_number,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

/**
 * Appends one event to a run's append-only execution ledger. The sequence
 * number is assigned by incrementing `workflow_runs.next_event_sequence` and
 * inserting the event in the *same* SQL statement (a single CTE) — this is
 * one atomic round trip, so two concurrent appends for the same run cannot
 * be assigned the same sequence number regardless of which connection in a
 * pool issues them. The `unique (workflow_run_id, sequence_number)`
 * constraint on `workflow_execution_events` makes any theoretical race fail
 * loudly rather than silently double-assign.
 */
export async function appendWorkflowExecutionEvent(
  db: Queryable,
  input: AppendWorkflowExecutionEventInput,
): Promise<WorkflowExecutionEvent> {
  const { rows } = await db.query<EventRow>(
    `with next_seq as (
       update workflow_runs
       set next_event_sequence = next_event_sequence + 1
       where id = $1
       returning next_event_sequence - 1 as sequence_number
     )
     insert into workflow_execution_events
       (tenant_id, workflow_run_id, workflow_step_id, event_type, actor_type,
        actor_id, trace_id, correlation_id, causation_id, sequence_number, payload)
     select $2, $1, $3, $4, $5, $6, $7, $8, $9, next_seq.sequence_number, $10::jsonb
     from next_seq
     returning *`,
    [
      input.workflowRunId,
      input.tenantId,
      input.workflowStepId,
      input.eventType,
      input.actorType,
      input.actorId,
      input.traceId,
      input.correlationId,
      input.causationId,
      JSON.stringify(input.payload ?? {}),
    ],
  );
  const row = rows[0];
  if (!row) {
    throw new Error(
      `Cannot append execution event: workflow_runs row "${input.workflowRunId}" not found`,
    );
  }
  return mapRow(row);
}
