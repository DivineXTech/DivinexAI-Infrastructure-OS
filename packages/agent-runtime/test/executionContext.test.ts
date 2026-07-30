import { describe, expect, it } from "vitest";
import { parseAgentExecutionContext } from "../src/executionContext.js";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function buildContext(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: VALID_UUID,
    workspaceId: null,
    workflowRunId: VALID_UUID,
    workflowStepId: VALID_UUID,
    requestingActor: { type: "user", id: "user-123" },
    objective: "Assess a prospective SMB client",
    approvedInputs: { clientName: "Acme Co" },
    availableCapabilities: ["market_analysis"],
    approvedTools: [],
    relevantMemory: [],
    knowledgeContext: [],
    riskContext: { riskLevel: "low", flags: [] },
    executionBudget: {
      maxTokens: 10_000,
      maxCostUsd: 1,
      maxDurationMs: 60_000,
      maxToolCalls: 5,
    },
    traceId: "trace-abc",
    ...overrides,
  };
}

describe("parseAgentExecutionContext", () => {
  it("accepts a well-formed context", () => {
    const context = parseAgentExecutionContext(buildContext());
    expect(context.tenantId).toBe(VALID_UUID);
    expect(context.workspaceId).toBeNull();
  });

  it("rejects a non-uuid tenantId", () => {
    expect(() => parseAgentExecutionContext(buildContext({ tenantId: "not-a-uuid" }))).toThrow();
  });

  it("rejects a missing traceId", () => {
    const context = buildContext();
    delete (context as Record<string, unknown>).traceId;
    expect(() => parseAgentExecutionContext(context)).toThrow();
  });

  it("rejects an invalid requestingActor.type", () => {
    expect(() =>
      parseAgentExecutionContext(
        buildContext({ requestingActor: { type: "robot", id: "x" } }),
      ),
    ).toThrow();
  });

  it("rejects an invalid riskContext.riskLevel", () => {
    expect(() =>
      parseAgentExecutionContext(
        buildContext({ riskContext: { riskLevel: "extreme", flags: [] } }),
      ),
    ).toThrow();
  });
});
