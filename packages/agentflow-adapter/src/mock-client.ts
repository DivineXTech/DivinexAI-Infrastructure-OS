import { randomUUID } from "node:crypto";
import type {
  AgentFlowClient,
  DomainEventEnvelope,
  TriggerWorkflowInput,
  TriggerWorkflowResult,
} from "./types";

/** Records published events and triggered workflows in memory, for local dev and tests. */
export class MockAgentFlowClient implements AgentFlowClient {
  readonly publishedEvents: DomainEventEnvelope[] = [];
  readonly triggeredWorkflows: TriggerWorkflowInput[] = [];

  async publishEvent(event: DomainEventEnvelope): Promise<void> {
    this.publishedEvents.push(event);
  }

  async triggerWorkflow(input: TriggerWorkflowInput): Promise<TriggerWorkflowResult> {
    this.triggeredWorkflows.push(input);
    return { runId: `run_${randomUUID()}` };
  }
}
