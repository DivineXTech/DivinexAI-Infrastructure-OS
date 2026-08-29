import { randomUUID } from "node:crypto";
import type { AgentFlowClient, DomainEventEnvelope } from "@divinexai/agentflow-adapter";

export const DOMAIN_EVENT_TYPES = [
  "creator.signed_up",
  "creator.onboarding_completed",
  "ai_job.completed",
  "asset.rights_declared",
  "asset.published",
  "fan.registered",
  "order.completed",
  "ledger.entries_recorded",
  "payout.requested",
  "payout.settled",
] as const;
export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

export interface DomainEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  organizationId: string;
  type: DomainEventType;
  payload: TPayload;
}

/**
 * Emits DMTV domain events for consumption by AgentFlow Pro. This is the
 * only path by which DMTV state changes reach automation — no DMTV code
 * should call AgentFlowClient.publishEvent directly, so every emitted event
 * type is enumerable here in one place.
 */
export class DomainEventEmitter {
  constructor(private readonly agentFlowClient: AgentFlowClient) {}

  async emit(event: DomainEvent): Promise<void> {
    const envelope: DomainEventEnvelope = {
      id: randomUUID(),
      organizationId: event.organizationId,
      type: event.type,
      occurredAt: new Date().toISOString(),
      payload: event.payload,
    };
    await this.agentFlowClient.publishEvent(envelope);
  }
}
