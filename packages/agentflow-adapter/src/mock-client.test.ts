import { describe, expect, test } from "bun:test";
import { MockAgentFlowClient } from "./mock-client";

describe("MockAgentFlowClient", () => {
  test("records published events", async () => {
    const client = new MockAgentFlowClient();
    await client.publishEvent({
      id: "evt1",
      organizationId: "org1",
      type: "asset.published",
      occurredAt: new Date().toISOString(),
      payload: { assetId: "asset1" },
    });
    expect(client.publishedEvents).toHaveLength(1);
  });

  test("records triggered workflows and returns a run id", async () => {
    const client = new MockAgentFlowClient();
    const { runId } = await client.triggerWorkflow({
      organizationId: "org1",
      workflowKey: "creator.onboarding",
      payload: {},
    });
    expect(runId).toBeTruthy();
    expect(client.triggeredWorkflows).toHaveLength(1);
  });
});
