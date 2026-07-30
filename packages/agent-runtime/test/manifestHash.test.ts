import { describe, expect, it } from "vitest";
import { z } from "zod";
import { computeManifestHash } from "../src/manifestHash.js";
import type { AgentManifest } from "../src/manifest.js";

function buildManifest(overrides: Partial<AgentManifest> = {}): AgentManifest {
  return {
    id: "sara",
    version: "0.1.0",
    name: "sara",
    displayName: "Sara",
    role: "Intelligence Director",
    mission: "Interpret objectives.",
    responsibilities: ["Interpret objectives"],
    prohibitedActions: [],
    capabilities: [],
    toolIds: [],
    knowledgeSourceIds: [],
    memoryPolicy: {
      workingMemory: true,
      episodicMemory: true,
      semanticMemory: true,
      retentionDays: 90,
    },
    approvalPolicy: { requiresApprovalFor: [], autoApproveBelowRisk: "low" },
    executionPolicy: {
      maxSteps: 10,
      timeoutMs: 1000,
      maxRetries: 1,
      costCeilingUsd: 1,
    },
    handoffTargets: [],
    escalationTarget: null,
    successMetrics: [],
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    ...overrides,
  };
}

describe("computeManifestHash", () => {
  it("is deterministic for the same content", () => {
    const a = computeManifestHash(buildManifest());
    const b = computeManifestHash(buildManifest());
    expect(a).toBe(b);
  });

  it("is independent of nested object key declaration order", () => {
    const a = computeManifestHash(
      buildManifest({
        memoryPolicy: {
          workingMemory: true,
          episodicMemory: true,
          semanticMemory: true,
          retentionDays: 90,
        },
      }),
    );
    const b = computeManifestHash(
      buildManifest({
        memoryPolicy: {
          retentionDays: 90,
          semanticMemory: true,
          episodicMemory: true,
          workingMemory: true,
        },
      }),
    );
    expect(a).toBe(b);
  });

  it("changes when a nested field's value changes", () => {
    const a = computeManifestHash(buildManifest());
    const b = computeManifestHash(
      buildManifest({
        executionPolicy: {
          maxSteps: 999,
          timeoutMs: 1000,
          maxRetries: 1,
          costCeilingUsd: 1,
        },
      }),
    );
    expect(a).not.toBe(b);
  });

  it("changes when the mission text changes", () => {
    const a = computeManifestHash(buildManifest());
    const b = computeManifestHash(
      buildManifest({ mission: "A different mission entirely." }),
    );
    expect(a).not.toBe(b);
  });

  it("does not change based on inputSchema/outputSchema identity (those are excluded from the hash)", () => {
    const a = computeManifestHash(
      buildManifest({ inputSchema: z.object({ a: z.string() }) }),
    );
    const b = computeManifestHash(
      buildManifest({ inputSchema: z.object({ b: z.number() }) }),
    );
    expect(a).toBe(b);
  });
});
