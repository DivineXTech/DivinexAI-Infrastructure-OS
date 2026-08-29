export interface DomainEventEnvelope {
  id: string;
  organizationId: string;
  type: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface TriggerWorkflowInput {
  organizationId: string;
  workflowKey: string;
  payload: Record<string, unknown>;
}

export interface TriggerWorkflowResult {
  runId: string;
}

/**
 * The seam between DMTV and AgentFlow Pro. DMTV never re-implements
 * orchestration, scheduling, or automation runners itself — it publishes
 * domain events and requests workflow runs through this interface, and
 * AgentFlow Pro owns everything downstream of that call.
 */
export interface AgentFlowClient {
  publishEvent(event: DomainEventEnvelope): Promise<void>;
  triggerWorkflow(input: TriggerWorkflowInput): Promise<TriggerWorkflowResult>;
}
