import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  validateWorkflowManifest,
  UnknownWorkflowAgentError,
  UnpublishableWorkflowAgentError,
  type WorkflowManifest,
} from "../src/manifest.js";
import {
  DuplicateStepKeyError,
  CyclicWorkflowDependencyError,
} from "../src/dag.js";
import { createStubAgentResolver } from "./stubAgentResolver.js";

function baseManifest(
  overrides: Partial<WorkflowManifest> = {},
): WorkflowManifest {
  return {
    id: "test_workflow",
    version: "1.0.0",
    displayName: "Test Workflow",
    description: "A workflow used only in tests.",
    inputSchema: z.object({ brief: z.string() }),
    outputSchema: z.object({ summary: z.string() }),
    steps: [
      {
        stepKey: "step_one",
        assignment: { kind: "agentSlug", agentSlug: "sara" },
        dependsOn: [],
        approvalRequired: false,
        retryPolicy: {
          maxAttempts: 3,
          backoff: "exponential",
          backoffMs: 1000,
          timeoutMs: 60000,
          deadLetterOnExhaustion: true,
        },
      },
    ],
    ...overrides,
  };
}

describe("validateWorkflowManifest", () => {
  it("accepts a valid manifest with a known, publishable agent", async () => {
    const resolver = createStubAgentResolver(["sara"]);
    await expect(
      validateWorkflowManifest(baseManifest(), resolver),
    ).resolves.toBeDefined();
  });

  it("rejects a manifest missing required metadata fields", async () => {
    const resolver = createStubAgentResolver(["sara"]);
    const invalid = { ...baseManifest(), displayName: "" };
    await expect(validateWorkflowManifest(invalid, resolver)).rejects.toThrow();
  });

  it("rejects a manifest whose inputSchema is not a Zod schema", async () => {
    const resolver = createStubAgentResolver(["sara"]);
    const invalid = {
      ...baseManifest(),
      inputSchema: {} as unknown as z.ZodType,
    };
    await expect(validateWorkflowManifest(invalid, resolver)).rejects.toThrow(
      /must define inputSchema and outputSchema as Zod schemas/,
    );
  });

  it("rejects a duplicate step key (delegates to dag.ts)", async () => {
    const resolver = createStubAgentResolver(["sara"]);
    const manifest = baseManifest({
      steps: [...baseManifest().steps, { ...baseManifest().steps[0]! }],
    });
    await expect(validateWorkflowManifest(manifest, resolver)).rejects.toThrow(
      DuplicateStepKeyError,
    );
  });

  it("rejects a cyclic dependency graph (delegates to dag.ts)", async () => {
    const resolver = createStubAgentResolver(["sara"]);
    const manifest = baseManifest({
      steps: [
        {
          stepKey: "a",
          assignment: { kind: "agentSlug", agentSlug: "sara" },
          dependsOn: ["b"],
          approvalRequired: false,
          retryPolicy: baseManifest().steps[0]!.retryPolicy,
        },
        {
          stepKey: "b",
          assignment: { kind: "agentSlug", agentSlug: "sara" },
          dependsOn: ["a"],
          approvalRequired: false,
          retryPolicy: baseManifest().steps[0]!.retryPolicy,
        },
      ],
    });
    await expect(validateWorkflowManifest(manifest, resolver)).rejects.toThrow(
      CyclicWorkflowDependencyError,
    );
  });

  it("rejects a step assigned to an unknown agent slug", async () => {
    const resolver = createStubAgentResolver([]);
    await expect(
      validateWorkflowManifest(baseManifest(), resolver),
    ).rejects.toThrow(UnknownWorkflowAgentError);
  });

  it("rejects a step assigned to an agent that exists but has no published version", async () => {
    const resolver = createStubAgentResolver([], ["sara"]);
    await expect(
      validateWorkflowManifest(baseManifest(), resolver),
    ).rejects.toThrow(UnpublishableWorkflowAgentError);
  });

  it("accepts a kind: capability step structurally, without calling the resolver for it", async () => {
    let resolverCalls = 0;
    const resolver = {
      async resolveAgentSlug() {
        resolverCalls += 1;
        return { exists: true, publishable: true };
      },
    };
    const manifest = baseManifest({
      steps: [
        {
          stepKey: "step_one",
          assignment: { kind: "capability", capability: "pricing-analysis" },
          dependsOn: [],
          approvalRequired: false,
          retryPolicy: baseManifest().steps[0]!.retryPolicy,
        },
      ],
    });
    await expect(
      validateWorkflowManifest(manifest, resolver),
    ).resolves.toBeDefined();
    expect(resolverCalls).toBe(0);
  });

  it("rejects a kind: capability step with an empty capability string", async () => {
    const resolver = createStubAgentResolver(["sara"]);
    const manifest = {
      ...baseManifest(),
      steps: [
        {
          stepKey: "step_one",
          assignment: { kind: "capability" as const, capability: "" },
          dependsOn: [],
          approvalRequired: false,
          retryPolicy: baseManifest().steps[0]!.retryPolicy,
        },
      ],
    };
    await expect(
      validateWorkflowManifest(manifest, resolver),
    ).rejects.toThrow();
  });
});
