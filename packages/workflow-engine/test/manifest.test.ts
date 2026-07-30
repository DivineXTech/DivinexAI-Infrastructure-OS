import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  validateWorkflowManifest,
  WorkflowManifestMetadataSchema,
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
        governedAction: null,
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
          governedAction: null,
        },
        {
          stepKey: "b",
          assignment: { kind: "agentSlug", agentSlug: "sara" },
          dependsOn: ["a"],
          approvalRequired: false,
          retryPolicy: baseManifest().steps[0]!.retryPolicy,
          governedAction: null,
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
          governedAction: null,
        },
      ],
    });
    await expect(
      validateWorkflowManifest(manifest, resolver),
    ).resolves.toBeDefined();
    expect(resolverCalls).toBe(0);
  });

  it("Phase 4 compatibility: a step definition without a governedAction key at all still validates successfully", async () => {
    const resolver = createStubAgentResolver(["sara"]);
    // Simulates a manifest stored before this field existed — the raw JSON
    // genuinely lacks the key (not merely set to null), the same shape
    // client_solution_assessment v1.0.0 has on disk.
    const manifest = baseManifest();
    const rawStep = manifest.steps[0] as unknown as Record<string, unknown>;
    delete rawStep.governedAction;

    await expect(
      validateWorkflowManifest(manifest, resolver),
    ).resolves.toBeDefined();

    // validateWorkflowManifest returns the original manifest reference (not
    // a re-parsed copy), so the key is genuinely absent (`undefined`) here —
    // exactly the gotcha documented in PHASE_4_GOVERNANCE_APPROVALS.md §12:
    // the Zod default does not retroactively backfill already-stored data.
    // Every real consumer must read this field as `step.governedAction ?? null`.
    const returnedStep = manifest.steps[0] as unknown as Record<
      string,
      unknown
    >;
    expect(returnedStep.governedAction).toBeUndefined();
    expect(returnedStep.governedAction ?? null).toBeNull();
  });

  it("a freshly-parsed manifest (via the metadata schema directly) defaults an omitted governedAction to null", () => {
    const manifest = baseManifest();
    const rawStep = manifest.steps[0] as unknown as Record<string, unknown>;
    delete rawStep.governedAction;

    const parsed = WorkflowManifestMetadataSchema.parse(manifest);
    expect(parsed.steps[0]!.governedAction).toBeNull();
  });

  it("accepts a step definition with an explicit governedAction", async () => {
    const resolver = createStubAgentResolver(["sara"]);
    const manifest = baseManifest({
      steps: [
        {
          ...baseManifest().steps[0]!,
          governedAction: "communication.send.external",
        },
      ],
    });
    const validated = await validateWorkflowManifest(manifest, resolver);
    expect(validated.steps[0]!.governedAction).toBe(
      "communication.send.external",
    );
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
          governedAction: null,
        },
      ],
    };
    await expect(
      validateWorkflowManifest(manifest, resolver),
    ).rejects.toThrow();
  });
});
