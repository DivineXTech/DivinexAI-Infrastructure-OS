import { describe, expect, test } from "bun:test";
import { MockAgentFlowClient } from "@divinexai/agentflow-adapter";
import { DomainEventEmitter } from "./index";

describe("DomainEventEmitter", () => {
  test("publishes an envelope AgentFlow Pro can consume", async () => {
    const client = new MockAgentFlowClient();
    const emitter = new DomainEventEmitter(client);
    await emitter.emit({
      organizationId: "org1",
      type: "asset.published",
      payload: { assetId: "asset1" },
    });
    expect(client.publishedEvents).toHaveLength(1);
    const envelope = client.publishedEvents[0]!;
    expect(envelope.organizationId).toBe("org1");
    expect(envelope.type).toBe("asset.published");
    expect(envelope.payload).toEqual({ assetId: "asset1" });
    expect(envelope.id).toBeTruthy();
    expect(envelope.occurredAt).toBeTruthy();
  });
});
