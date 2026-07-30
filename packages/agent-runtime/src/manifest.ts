import { z } from "zod";

export const MemoryPolicySchema = z.object({
  workingMemory: z.boolean(),
  episodicMemory: z.boolean(),
  semanticMemory: z.boolean(),
  /** Null = no automatic expiry beyond the memory category's own default. */
  retentionDays: z.number().int().positive().nullable(),
});
export type MemoryPolicy = z.infer<typeof MemoryPolicySchema>;

export const ApprovalPolicySchema = z.object({
  /** Action categories (e.g. "production_deployment", "refund") that always require human approval for this agent, regardless of risk score. */
  requiresApprovalFor: z.array(z.string().min(1)),
  /** Highest risk level this agent may act on without an approval gate. "none" means every action listed in requiresApprovalFor (and nothing else) needs approval; it never means "no approvals ever". */
  autoApproveBelowRisk: z.enum(["none", "low", "medium"]),
});
export type ApprovalPolicy = z.infer<typeof ApprovalPolicySchema>;

export const ExecutionPolicySchema = z.object({
  maxSteps: z.number().int().positive(),
  timeoutMs: z.number().int().positive(),
  maxRetries: z.number().int().min(0),
  /** Null = no explicit cost ceiling enforced for this agent (platform-level ceilings may still apply). */
  costCeilingUsd: z.number().nonnegative().nullable(),
});
export type ExecutionPolicy = z.infer<typeof ExecutionPolicySchema>;

/**
 * Everything about an AgentManifest except its input/output schemas, which
 * are themselves Zod schemas (code, not data) — see `validateAgentManifest`
 * for why they're checked separately rather than folded into this object.
 *
 * Deliberately has no `status`/lifecycle field: a manifest is authored
 * *content* (what an agent does, what it may not do). Publication state
 * belongs to the `agent_versions` database row that wraps this content when
 * it's registered in the platform catalog (`AgentVersionStatus`,
 * `agentVersionLifecycle.ts`), and a tenant's own runtime state belongs to
 * its `tenant_agents` installation row (`TenantAgentLifecycleStatus`,
 * `tenantAgentLifecycle.ts`) — carrying a status on this object would create
 * a third, driftable source of truth for the same concept. See `ADR-0013`'s
 * addendum.
 */
export const AgentManifestMetadataSchema = z.object({
  id: z.string().min(1),
  version: z
    .string()
    .regex(
      /^\d+\.\d+\.\d+$/,
      "version must be semver in the form major.minor.patch",
    ),
  name: z.string().min(1),
  displayName: z.string().min(1),
  role: z.string().min(1),
  mission: z.string().min(1),
  responsibilities: z.array(z.string().min(1)).min(1),
  prohibitedActions: z.array(z.string().min(1)),
  capabilities: z.array(z.string().min(1)),
  toolIds: z.array(z.string().min(1)),
  knowledgeSourceIds: z.array(z.string().min(1)),
  memoryPolicy: MemoryPolicySchema,
  approvalPolicy: ApprovalPolicySchema,
  executionPolicy: ExecutionPolicySchema,
  handoffTargets: z.array(z.string().min(1)),
  escalationTarget: z.string().min(1).nullable(),
  successMetrics: z.array(z.string().min(1)),
});
export type AgentManifestMetadata = z.infer<typeof AgentManifestMetadataSchema>;

/**
 * Full agent manifest, including its input/output contract as live Zod
 * schemas. Manifests are authored in code (see the six initial agents,
 * Increment 3), not parsed from untrusted JSON, so `inputSchema`/
 * `outputSchema` are real `z.ZodType` instances rather than a serialized
 * JSON-schema representation — that conversion, if ever needed for
 * cross-process/storage use, is a concern for the (future) agent registry,
 * not this contract.
 */
export interface AgentManifest<
  TInput = unknown,
  TOutput = unknown,
> extends AgentManifestMetadata {
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
}

function isZodType(value: unknown): value is z.ZodTypeAny {
  return value instanceof z.ZodType;
}

/**
 * Validates a manifest: metadata via `AgentManifestMetadataSchema.parse`,
 * plus an explicit check that `inputSchema`/`outputSchema` are actual Zod
 * schemas. Satisfies the brief's "validate every manifest using Zod"
 * requirement without pretending a schema-valued field can be described by
 * a data schema. Throws (does not silently coerce) on an invalid manifest.
 */
export function validateAgentManifest<TInput, TOutput>(
  manifest: AgentManifest<TInput, TOutput>,
): AgentManifest<TInput, TOutput> {
  AgentManifestMetadataSchema.parse(manifest);
  if (!isZodType(manifest.inputSchema) || !isZodType(manifest.outputSchema)) {
    throw new Error(
      `Agent manifest "${manifest.id}" must define inputSchema and outputSchema as Zod schemas`,
    );
  }
  return manifest;
}
