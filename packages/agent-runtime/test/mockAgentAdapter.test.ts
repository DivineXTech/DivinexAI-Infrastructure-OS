import { describe, expect, it } from "vitest";
import { DeterministicMockAgentAdapter } from "../src/mockAgentAdapter.js";
import { AgentExecutionResultSchema } from "../src/executionResult.js";
import type { ResolvedTenantAgent } from "../src/tenantAgentRegistry.js";
import type { AgentExecutionContext } from "../src/executionContext.js";

const resolved: ResolvedTenantAgent = {
  installation: {
    id: "installation-1",
    tenantId: "tenant-1",
    agentDefinitionId: "def-1",
    agentVersionId: "version-1",
    displayNameOverride: null,
    lifecycleStatus: "MOCK_EXECUTABLE",
    enabled: true,
    configuration: {},
    executionPolicy: {},
    approvalPolicy: {},
    installedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  definition: {
    id: "def-1",
    slug: "sara",
    displayName: "Sara",
    role: "Intelligence Director",
    description: "x",
    ownershipType: "platform",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  version: {
    id: "version-1",
    agentDefinitionId: "def-1",
    version: "0.1.0",
    manifest: {} as never,
    manifestHash: "hash",
    status: "published",
    publishedAt: new Date().toISOString(),
    deprecatedAt: null,
    createdAt: new Date().toISOString(),
  },
};

const context: AgentExecutionContext = {
  tenantId: "00000000-0000-0000-0000-000000000001",
  workspaceId: null,
  workflowRunId: "00000000-0000-0000-0000-000000000002",
  workflowStepId: "00000000-0000-0000-0000-000000000003",
  requestingActor: { type: "system", id: "test" },
  objective: "Interpret the client brief",
  approvedInputs: {},
  availableCapabilities: [],
  approvedTools: [],
  relevantMemory: [],
  knowledgeContext: [],
  riskContext: { riskLevel: "low", flags: [] },
  executionBudget: {
    maxTokens: null,
    maxCostUsd: null,
    maxDurationMs: null,
    maxToolCalls: null,
  },
  traceId: "trace-1",
};

describe("DeterministicMockAgentAdapter", () => {
  it("returns a schema-valid AgentExecutionResult", async () => {
    const adapter = new DeterministicMockAgentAdapter();
    const result = await adapter.execute(resolved, context);
    expect(() => AgentExecutionResultSchema.parse(result)).not.toThrow();
    expect(result.status).toBe("completed");
  });

  it("references the agent's slug and the objective in the summary, without a real provider call", async () => {
    const adapter = new DeterministicMockAgentAdapter();
    const result = await adapter.execute(resolved, context);
    expect(result.summary).toContain("sara");
    expect(result.summary).toContain(context.objective);
  });

  it("is deterministic — the same inputs produce the same output shape twice", async () => {
    const adapter = new DeterministicMockAgentAdapter();
    const first = await adapter.execute(resolved, context);
    const second = await adapter.execute(resolved, context);
    expect(first.output).toEqual(second.output);
  });
});
