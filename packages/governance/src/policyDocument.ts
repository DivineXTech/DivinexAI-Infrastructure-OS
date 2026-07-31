import { z } from "zod";
import { GovernedActionOrWildcardSchema } from "./actionCatalog.js";

export const ConditionClauseSchema = z.object({
  /** Dot-path into the evaluation context, e.g. "parameters.amountUsd", "riskLevel". */
  field: z.string().min(1),
  operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in"]),
  value: z.unknown(),
});
export type ConditionClause = z.infer<typeof ConditionClauseSchema>;

export type ConditionNode =
  | ConditionClause
  | { all: ConditionNode[] }
  | { any: ConditionNode[] };

export const ConditionNodeSchema: z.ZodType<ConditionNode> = z.lazy(() =>
  z.union([
    ConditionClauseSchema,
    z.object({ all: z.array(ConditionNodeSchema) }),
    z.object({ any: z.array(ConditionNodeSchema) }),
  ]),
);

/**
 * `BLOCK > DENY > ESCALATE > REQUIRE_APPROVAL > ALLOW` (§4a, corrected
 * during review from this document's original, incorrect ranking). Index 0
 * is the most restrictive — the single source of truth both for the merge
 * algorithm (`evaluatePolicy.ts`) and for validating a tenant override
 * never moves an effect to a higher index.
 *
 *   BLOCK            absolute prohibition; no code path resumes past it
 *   DENY              contextual denial, not absolute
 *   ESCALATE          elevated review required (routed as an approval request)
 *   REQUIRE_APPROVAL  ordinary authorized approval may permit continuation
 *   ALLOW             execution may continue; the safe default when nothing matches
 */
export const EFFECT_PRECEDENCE = [
  "BLOCK",
  "DENY",
  "ESCALATE",
  "REQUIRE_APPROVAL",
  "ALLOW",
] as const;
export const PolicyEffectSchema = z.enum(EFFECT_PRECEDENCE);
export type PolicyEffect = z.infer<typeof PolicyEffectSchema>;

export function effectPrecedenceIndex(effect: PolicyEffect): number {
  return EFFECT_PRECEDENCE.indexOf(effect);
}

/** The more restrictive (lower-index) of the two effects. */
export function mostRestrictiveEffect(
  a: PolicyEffect,
  b: PolicyEffect,
): PolicyEffect {
  return effectPrecedenceIndex(a) <= effectPrecedenceIndex(b) ? a : b;
}

export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const RiskLevelSchema = z.enum(RISK_LEVELS);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export function riskLevelRank(level: RiskLevel): number {
  return RISK_LEVELS.indexOf(level);
}

/** The higher-severity (higher-rank) of the two risk levels. */
export function maxRiskLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return riskLevelRank(a) >= riskLevelRank(b) ? a : b;
}

export const PolicyDocumentSchema = z.object({
  appliesToActions: z.array(GovernedActionOrWildcardSchema).min(1),
  conditions: ConditionNodeSchema,
  effect: PolicyEffectSchema,
  riskLevel: RiskLevelSchema.nullable(),
  requiredPermissions: z.array(z.string().min(1)),
  requiredApproverRoles: z.array(z.string().min(1)),
  requiredApprovalCount: z.number().int().positive(),
  rejectOnFirstRejection: z.boolean().default(true),
  approvalExpirationMs: z.number().int().positive().nullable(),
});
export type PolicyDocument = z.infer<typeof PolicyDocumentSchema>;

/**
 * Deltas that can only tighten (§3c) — no field exists that could loosen
 * `effect`, lower `requiredApprovalCount`, or remove a required
 * role/permission. Enforced by this shape (not merely a runtime check):
 * there is no "replace effect" or "remove requirement" field to begin with.
 */
export const PolicyOverrideDocumentSchema = z.object({
  additionalRequiredApprovalCount: z.number().int().nonnegative().default(0),
  additionalRequiredApproverRoles: z.array(z.string().min(1)).default([]),
  additionalRequiredPermissions: z.array(z.string().min(1)).default([]),
  tightenedConditions: ConditionNodeSchema.nullable().default(null),
});
export type PolicyOverrideDocument = z.infer<
  typeof PolicyOverrideDocumentSchema
>;
