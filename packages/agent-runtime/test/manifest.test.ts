import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateAgentManifest, type AgentManifest } from "../src/manifest.js";

function buildManifest(overrides: Partial<AgentManifest> = {}): AgentManifest {
  return {
    id: "sara",
    version: "0.1.0",
    name: "sara",
    displayName: "Sara",
    role: "Intelligence Director",
    mission: "Interpret objectives and synthesize final outputs.",
    responsibilities: ["Interpret objectives", "Select workflows and agents"],
    prohibitedActions: ["deploy_code", "change_billing", "transfer_money", "alter_security_policy"],
    capabilities: ["synthesis", "planning"],
    toolIds: [],
    knowledgeSourceIds: [],
    memoryPolicy: {
      workingMemory: true,
      episodicMemory: true,
      semanticMemory: true,
      retentionDays: 90,
    },
    approvalPolicy: {
      requiresApprovalFor: ["external_publication"],
      autoApproveBelowRisk: "low",
    },
    executionPolicy: {
      maxSteps: 20,
      timeoutMs: 60_000,
      maxRetries: 2,
      costCeilingUsd: 5,
    },
    handoffTargets: ["nova"],
    escalationTarget: null,
    successMetrics: ["task_completion_rate"],
    status: "draft",
    inputSchema: z.object({ objective: z.string() }),
    outputSchema: z.object({ summary: z.string() }),
    ...overrides,
  };
}

describe("validateAgentManifest", () => {
  it("accepts a well-formed manifest and returns it unchanged", () => {
    const manifest = buildManifest();
    expect(validateAgentManifest(manifest)).toBe(manifest);
  });

  it("rejects a manifest with an empty responsibilities list", () => {
    const manifest = buildManifest({ responsibilities: [] });
    expect(() => validateAgentManifest(manifest)).toThrow();
  });

  it("rejects a non-semver version string", () => {
    const manifest = buildManifest({ version: "v1" });
    expect(() => validateAgentManifest(manifest)).toThrow();
  });

  it("rejects an invalid status value", () => {
    const manifest = buildManifest({ status: "unknown-status" as never });
    expect(() => validateAgentManifest(manifest)).toThrow();
  });

  it("rejects a manifest whose inputSchema is not a Zod schema", () => {
    const manifest = buildManifest({ inputSchema: { fake: true } as never });
    expect(() => validateAgentManifest(manifest)).toThrow(/inputSchema and outputSchema/);
  });

  it("rejects a manifest whose outputSchema is not a Zod schema", () => {
    const manifest = buildManifest({ outputSchema: undefined as never });
    expect(() => validateAgentManifest(manifest)).toThrow(/inputSchema and outputSchema/);
  });
});
