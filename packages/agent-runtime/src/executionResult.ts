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
});
export type AgentExecutionResult = z.infer<typeof AgentExecutionResultSchema>;

export function parseAgentExecutionResult(
  payload: unknown,
): AgentExecutionResult {
  return AgentExecutionResultSchema.parse(payload);
}
