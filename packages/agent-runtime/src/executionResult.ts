import { z } from "zod";

export const AgentResultStatusSchema = z.enum([
  "completed",
  "partial",
  "failed",
  "blocked",
  "escalated",
  "needs_approval",
  "needs_input",
]);
export type AgentResultStatus = z.infer<typeof AgentResultStatusSchema>;

export const RequestedHandoffSchema = z
  .object({
    targetAgentId: z.string().min(1),
    reason: z.string().min(1),
  })
  .nullable();
export type RequestedHandoff = z.infer<typeof RequestedHandoffSchema>;

export const MemoryCandidateSchema = z.object({
  category: z.enum(["working", "episodic", "semantic"]),
  content: z.unknown(),
  /** Where this candidate came from — required per the memory design's provenance rule; promotion to trusted memory is a separate, later step, not implied by an agent merely proposing it. */
  provenance: z.string().min(1),
  confidence: z.number().min(0).max(1).nullable(),
});
export type MemoryCandidate = z.infer<typeof MemoryCandidateSchema>;

export const EvaluationMetadataSchema = z.object({
  modelUsed: z.string().nullable(),
  tokensUsed: z.number().int().nonnegative().nullable(),
  latencyMs: z.number().int().nonnegative().nullable(),
  toolCallCount: z.number().int().nonnegative(),
});
export type EvaluationMetadata = z.infer<typeof EvaluationMetadataSchema>;

/**
 * The action this invocation proposes to take, if any — declared by the
 * agent, never self-authorized by it (`governance`, Phase 4, is the sole
 * authority on whether it may proceed). `action` is a plain string here
 * rather than a typed import of `governance`'s closed action-catalog
 * enum — `agent-runtime` has no dependency on `governance` at all;
 * `governance` validates the string against its own catalog only when it
 * actually receives one, the same "no compile-time dependency where a
 * plain value suffices" discipline already used for `workflow-engine`'s
 * `AgentResolver` (Phase 3).
 */
export const IntendedActionSchema = z.object({
  action: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()),
  targetResource: z.string().nullable(),
});
export type IntendedAction = z.infer<typeof IntendedActionSchema>;

/**
 * The structured result every agent invocation must return. Per the brief's
 * rule, "no agent may return an unvalidated runtime payload" — the only
 * sanctioned way to accept one is `parseAgentExecutionResult`, which throws
 * (via Zod) rather than letting a malformed or model-hallucinated shape
 * flow into orchestration, memory, or approvals.
 */
export const AgentExecutionResultSchema = z.object({
  status: AgentResultStatusSchema,
  summary: z.string().min(1),
  output: z.unknown(),
  evidence: z.array(z.unknown()),
  assumptions: z.array(z.string()),
  uncertainty: z.enum(["low", "medium", "high"]).nullable(),
  recommendedNextAction: z.string().nullable(),
  requestedHandoff: RequestedHandoffSchema,
  approvalRequired: z.boolean(),
  riskFlags: z.array(z.string()),
  memoryCandidates: z.array(MemoryCandidateSchema),
  evaluationMetadata: EvaluationMetadataSchema,
  /**
   * Phase 4 additions — all additive with defaults, a backward-compatible
   * extension of this runtime (non-versioned) contract; structured and
   * typed rather than an unbounded metadata bag.
   */
  intendedAction: IntendedActionSchema.nullable().default(null),
  /** Advisory only — never authoritative. `governance`'s own risk-classification
   * evaluation is independently derived and can never be replaced by this. */
  selfAssessedRiskLevel: z
    .enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
    .nullable()
    .default(null),
  requestedCapabilities: z.array(z.string()).default([]),
});
export type AgentExecutionResult = z.infer<typeof AgentExecutionResultSchema>;

export function parseAgentExecutionResult(
  payload: unknown,
): AgentExecutionResult {
  return AgentExecutionResultSchema.parse(payload);
}
