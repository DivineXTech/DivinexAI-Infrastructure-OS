import { z } from "zod";
import { validateDag, type DagStep } from "./dag.js";
import type { AgentResolver } from "./agentResolver.js";

export const RetryPolicySchema = z.object({
  maxAttempts: z.number().int().positive(),
  backoff: z.enum(["fixed", "exponential"]),
  backoffMs: z.number().int().positive(),
  timeoutMs: z.number().int().positive(),
  deadLetterOnExhaustion: z.boolean().default(true),
});
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

/**
 * A step is assigned to a target by exactly one method, expressed as a
 * discriminated union from the start — not a single `agentSlug: string`
 * field — so a future assignment kind (capability-based routing) can be
 * added without an incompatible schema change to workflows already
 * published under this shape. Phase 3 implements and exercises only the
 * `agentSlug` branch (the reference workflow); the `capability` branch is
 * schema- and DAG-validation-complete but has no runtime resolver behind it
 * yet (capabilityResolver.ts).
 */
export const WorkflowStepAssignmentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("agentSlug"), agentSlug: z.string().min(1) }),
  z.object({ kind: z.literal("capability"), capability: z.string().min(1) }),
]);
export type WorkflowStepAssignment = z.infer<
  typeof WorkflowStepAssignmentSchema
>;

export const WorkflowStepDefinitionSchema = z.object({
  stepKey: z.string().min(1),
  assignment: WorkflowStepAssignmentSchema,
  dependsOn: z.array(z.string().min(1)),
  approvalRequired: z.boolean().default(false),
  retryPolicy: RetryPolicySchema,
});
export type WorkflowStepDefinition = z.infer<
  typeof WorkflowStepDefinitionSchema
>;

export const WorkflowManifestMetadataSchema = z.object({
  id: z.string().min(1),
  version: z
    .string()
    .regex(
      /^\d+\.\d+\.\d+$/,
      "version must be semver in the form major.minor.patch",
    ),
  displayName: z.string().min(1),
  description: z.string().min(1),
  steps: z.array(WorkflowStepDefinitionSchema).min(1),
});
export type WorkflowManifestMetadata = z.infer<
  typeof WorkflowManifestMetadataSchema
>;

/**
 * Full workflow manifest, including its input/output contract as live Zod
 * schemas — same pattern as `AgentManifest` in agent-runtime: authored in
 * code, not parsed from untrusted JSON, so `inputSchema`/`outputSchema` are
 * real `z.ZodType` instances rather than a serialized representation.
 */
export interface WorkflowManifest<
  TInput = unknown,
  TOutput = unknown,
> extends WorkflowManifestMetadata {
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
}

function isZodType(value: unknown): value is z.ZodTypeAny {
  return value instanceof z.ZodType;
}

export class UnknownWorkflowAgentError extends Error {
  constructor(
    public readonly stepKey: string,
    public readonly agentSlug: string,
  ) {
    super(`Step "${stepKey}" is assigned to unknown agent "${agentSlug}"`);
    this.name = "UnknownWorkflowAgentError";
  }
}

export class UnpublishableWorkflowAgentError extends Error {
  constructor(
    public readonly stepKey: string,
    public readonly agentSlug: string,
  ) {
    super(
      `Step "${stepKey}" is assigned to agent "${agentSlug}", which has no published version`,
    );
    this.name = "UnpublishableWorkflowAgentError";
  }
}

function toDagSteps(manifest: WorkflowManifestMetadata): DagStep[] {
  return manifest.steps.map((s) => ({
    stepKey: s.stepKey,
    dependsOn: s.dependsOn,
  }));
}

/**
 * Runs the full 9-step DAG validation algorithm at publish time. Checks 1-2
 * (metadata schema, Zod-schema-instance check) and 9 (agent-slug resolution)
 * happen here; checks 3-8 (graph structure) are delegated to `validateDag`.
 * `agentResolver` is injected — never a compile-time import of
 * `agent-runtime`'s `CANONICAL_AGENT_SLUGS` — so this function is `async`
 * even though the pure graph checks it delegates to are synchronous.
 * `kind: "capability"` steps are validated structurally only (the Zod
 * schema already requires a non-empty `capability` string); no
 * `CapabilityResolver` call happens in Phase 3.
 */
export async function validateWorkflowManifest<TInput, TOutput>(
  manifest: WorkflowManifest<TInput, TOutput>,
  agentResolver: AgentResolver,
): Promise<WorkflowManifest<TInput, TOutput>> {
  const metadata = WorkflowManifestMetadataSchema.parse(manifest);

  if (!isZodType(manifest.inputSchema) || !isZodType(manifest.outputSchema)) {
    throw new Error(
      `Workflow manifest "${manifest.id}" must define inputSchema and outputSchema as Zod schemas`,
    );
  }

  validateDag(toDagSteps(metadata));

  for (const step of metadata.steps) {
    if (step.assignment.kind !== "agentSlug") continue;
    const { agentSlug } = step.assignment;
    const resolution = await agentResolver.resolveAgentSlug(agentSlug);
    if (!resolution.exists) {
      throw new UnknownWorkflowAgentError(step.stepKey, agentSlug);
    }
    if (!resolution.publishable) {
      throw new UnpublishableWorkflowAgentError(step.stepKey, agentSlug);
    }
  }

  return manifest;
}
