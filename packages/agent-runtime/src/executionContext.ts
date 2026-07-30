import { z } from "zod";

/**
 * Who/what triggered this agent invocation — never trusted as an authority
 * claim on its own; the policy layer (governance package, later increment)
 * re-checks actual permissions independently.
 */
export const RequestingActorSchema = z.object({
  type: z.enum(["user", "agent", "system", "schedule"]),
  id: z.string().min(1),
});
export type RequestingActor = z.infer<typeof RequestingActorSchema>;

export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const RiskContextSchema = z.object({
  riskLevel: RiskLevelSchema,
  flags: z.array(z.string()),
});
export type RiskContext = z.infer<typeof RiskContextSchema>;

export const ExecutionBudgetSchema = z.object({
  maxTokens: z.number().int().positive().nullable(),
  maxCostUsd: z.number().nonnegative().nullable(),
  maxDurationMs: z.number().int().positive().nullable(),
  maxToolCalls: z.number().int().positive().nullable(),
});
export type ExecutionBudget = z.infer<typeof ExecutionBudgetSchema>;

/**
 * The structured context every agent invocation receives. Field naming
 * note: the field is `tenantId`, matching the real `tenant_id` column in
 * `supabase/migrations/20260721000001_core_tenancy.sql` — "organization" is
 * the tenant concept's external/display name only, per the Phase 1
 * reconciliation decision; there is no separate `organizations` table.
 * `workspaceId` is nullable/reserved: no `workspaces` table exists yet, so
 * nothing currently populates it with a real value.
 */
export const AgentExecutionContextSchema = z.object({
  tenantId: z.string().uuid(),
  workspaceId: z.string().uuid().nullable(),
  workflowRunId: z.string().uuid(),
  workflowStepId: z.string().uuid(),
  requestingActor: RequestingActorSchema,
  objective: z.string().min(1),
  approvedInputs: z.record(z.string(), z.unknown()),
  availableCapabilities: z.array(z.string()),
  approvedTools: z.array(z.string()),
  relevantMemory: z.array(z.unknown()),
  knowledgeContext: z.array(z.unknown()),
  riskContext: RiskContextSchema,
  executionBudget: ExecutionBudgetSchema,
  traceId: z.string().min(1),
});
export type AgentExecutionContext = z.infer<typeof AgentExecutionContextSchema>;

/**
 * The only sanctioned way to construct a context an agent will run with —
 * throws (via Zod) on a malformed context rather than letting a caller pass
 * an ad hoc object into agent code.
 */
export function parseAgentExecutionContext(
  payload: unknown,
): AgentExecutionContext {
  return AgentExecutionContextSchema.parse(payload);
}
