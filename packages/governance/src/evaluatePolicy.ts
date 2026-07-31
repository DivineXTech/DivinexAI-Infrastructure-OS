import { randomUUID } from "node:crypto";
import type { Queryable } from "@repo/shared";
import { GovernedActionOrWildcardSchema } from "./actionCatalog.js";
import {
  effectPrecedenceIndex,
  maxRiskLevel,
  mostRestrictiveEffect,
  type ConditionNode,
  type PolicyEffect,
  type RiskLevel,
} from "./policyDocument.js";
import { evaluateCondition } from "./condition.js";
import type { PlatformPolicyCatalog } from "./platformPolicyCatalog.js";
import type { PlatformRiskClassificationCatalog } from "./platformRiskClassificationCatalog.js";
import type { TenantPolicyRegistry } from "./tenantPolicyRegistry.js";
import { computeActionPayloadHash } from "./contentHash.js";
import { PolicyDecisionSchema, type PolicyDecision } from "./policyDecision.js";

export interface EvaluatePolicyContext {
  tenantId: string;
  action: string;
  parameters: Record<string, unknown>;
  targetResource: string | null;
  actorType: "user" | "agent" | "system" | "worker";
  actorId: string | null;
  workflowRunId?: string | null;
  workflowStepId?: string | null;
  /** The workflow manifest step's own `approvalRequired` flag (§4b tier 5 floor). */
  workflowStepApprovalRequired?: boolean;
  /** Advisory only — never authoritative; feeds solely as one optional condition input, never copied into the decision's own `riskLevel` (RISK_REGISTER row 30). */
  selfAssessedRiskLevel?: RiskLevel | null;
  traceId: string;
  correlationId: string;
}

/**
 * The deterministic policy precedence + merge algorithm (§4 of the Phase 4
 * design). A pure function of (published policy version rows + tenant
 * assignment/override rows + workflow step config + context) — no
 * timestamp-dependent randomness, no model call. Persists one
 * `policy_evaluations` row per call (every evaluation is a meaningful audit
 * event, not a cache) and returns the decision.
 */
export async function evaluatePolicy(
  db: Queryable,
  policyCatalog: PlatformPolicyCatalog,
  riskCatalog: PlatformRiskClassificationCatalog,
  registry: TenantPolicyRegistry,
  context: EvaluatePolicyContext,
): Promise<PolicyDecision> {
  GovernedActionOrWildcardSchema.parse(context.action);

  const riskClassificationVersion =
    (await riskCatalog.getPublishedVersionForAction(context.action)) ??
    (await riskCatalog.getPublishedVersionForAction("*"));
  if (!riskClassificationVersion) {
    throw new Error(
      `No published risk classification found for action "${context.action}" or the platform default "*" — seed the platform risk classification catalog first.`,
    );
  }

  const candidates = await policyCatalog.listPublishedVersionsForAction(
    context.action,
  );

  const evaluationContext: Record<string, unknown> = {
    action: context.action,
    parameters: context.parameters,
    targetResource: context.targetResource,
    actorType: context.actorType,
    actorId: context.actorId,
    riskLevel: riskClassificationVersion.riskLevel,
    selfAssessedRiskLevel: context.selfAssessedRiskLevel ?? null,
  };

  type Match = {
    versionId: string;
    policyDefinitionId: string;
    priority: number;
    effect: PolicyEffect;
    riskLevel: RiskLevel | null;
    requiredApprovalCount: number;
    requiredApproverRoles: readonly string[];
    requiredPermissions: readonly string[];
    approvalExpirationMs: number | null;
  };
  const matches: Match[] = [];

  for (const version of candidates) {
    // Tier 2/3 opt-out: a non-mandatory version can be disabled by an
    // explicit tenant assignment; absence of a row means default-on (§4b).
    if (!version.mandatory) {
      const assignment = await registry.getAssignment(
        context.tenantId,
        version.policyDefinitionId,
      );
      if (assignment && !assignment.enabled) continue;
    }

    let conditions: ConditionNode = version.policyDocument.conditions;
    let requiredApprovalCount = version.policyDocument.requiredApprovalCount;
    let requiredApproverRoles = version.policyDocument.requiredApproverRoles;
    let requiredPermissions = version.policyDocument.requiredPermissions;

    // Tier 4: tenant override — additive/tightening only. There is no
    // schema field capable of changing `effect` via an override (§3c) — the
    // override can only narrow this match's own conditions and add to its
    // requirements, never loosen or replace its effect.
    if (version.overridePolicy === "overridable") {
      const override = await registry.getOverride(
        context.tenantId,
        version.policyDefinitionId,
      );
      if (override && override.enabled) {
        if (override.overrideDocument.tightenedConditions) {
          conditions = {
            all: [conditions, override.overrideDocument.tightenedConditions],
          };
        }
        requiredApprovalCount =
          requiredApprovalCount +
          override.overrideDocument.additionalRequiredApprovalCount;
        requiredApproverRoles = [
          ...new Set([
            ...requiredApproverRoles,
            ...override.overrideDocument.additionalRequiredApproverRoles,
          ]),
        ];
        requiredPermissions = [
          ...new Set([
            ...requiredPermissions,
            ...override.overrideDocument.additionalRequiredPermissions,
          ]),
        ];
      }
    }

    if (!evaluateCondition(conditions, evaluationContext)) continue;

    matches.push({
      versionId: version.id,
      policyDefinitionId: version.policyDefinitionId,
      priority: version.priority,
      effect: version.policyDocument.effect,
      riskLevel: version.policyDocument.riskLevel,
      requiredApprovalCount,
      requiredApproverRoles,
      requiredPermissions,
      approvalExpirationMs: version.policyDocument.approvalExpirationMs,
    });
  }

  // Deterministic reason ordering — does not affect precedence itself.
  matches.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.policyDefinitionId.localeCompare(b.policyDefinitionId);
  });

  let effect: PolicyEffect = "ALLOW";
  let requiredApprovalCount = 0;
  const requiredApproverRoles = new Set<string>();
  const requiredPermissions = new Set<string>();
  let riskLevel: RiskLevel = riskClassificationVersion.riskLevel;
  let expiresAtMs: number | null = null;
  const reasons: Array<{
    policyVersionId: string | null;
    code: string;
    message: string;
  }> = [];
  const evaluatedPolicyVersionIds: string[] = [];

  for (const match of matches) {
    evaluatedPolicyVersionIds.push(match.versionId);
    effect = mostRestrictiveEffect(effect, match.effect);
    if (match.effect !== "ALLOW") {
      requiredApprovalCount = Math.max(
        requiredApprovalCount,
        match.requiredApprovalCount,
      );
    }
    for (const role of match.requiredApproverRoles) requiredApproverRoles.add(role);
    for (const perm of match.requiredPermissions) requiredPermissions.add(perm);
    if (match.riskLevel) riskLevel = maxRiskLevel(riskLevel, match.riskLevel);
    if (match.approvalExpirationMs !== null) {
      expiresAtMs =
        expiresAtMs === null
          ? match.approvalExpirationMs
          : Math.min(expiresAtMs, match.approvalExpirationMs);
    }
    reasons.push({
      policyVersionId: match.versionId,
      code: `policy_matched:${match.effect}`,
      message: `Policy version ${match.versionId} matched with effect ${match.effect}`,
    });
  }

  // Tier 5: the workflow step's own approvalRequired floor — only raises
  // an otherwise-ALLOW result, never downgrades anything stricter.
  if (
    context.workflowStepApprovalRequired &&
    effectPrecedenceIndex(effect) === effectPrecedenceIndex("ALLOW")
  ) {
    effect = "REQUIRE_APPROVAL";
    requiredApprovalCount = Math.max(requiredApprovalCount, 1);
    reasons.push({
      policyVersionId: null,
      code: "workflow_step_approval_required",
      message:
        "Workflow manifest step declares approvalRequired: true (§4b tier 5)",
    });
  }

  const now = new Date();
  const decision = PolicyDecisionSchema.parse({
    id: randomUUID(),
    tenantId: context.tenantId,
    evaluatedPolicyVersionIds,
    riskClassificationVersionId: riskClassificationVersion.id,
    effect,
    riskLevel,
    reasons,
    requiredPermissions: [...requiredPermissions],
    requiredApproverRoles: [...requiredApproverRoles],
    requiredApprovalCount,
    expiresAt:
      expiresAtMs !== null
        ? new Date(now.getTime() + expiresAtMs).toISOString()
        : null,
    actionHash: computeActionPayloadHash({
      action: context.action,
      parameters: context.parameters,
      targetResource: context.targetResource,
    }),
    evaluatedAt: now.toISOString(),
    traceId: context.traceId,
    workflowRunId: context.workflowRunId ?? null,
    workflowStepId: context.workflowStepId ?? null,
  } satisfies PolicyDecision);

  await db.query(
    `insert into policy_evaluations
       (id, tenant_id, workflow_run_id, workflow_step_id, actor_type, actor_id,
        action, evaluated_policy_version_ids, risk_classification_version_id,
        effect, risk_level, reasons, required_permissions, required_approver_roles,
        required_approval_count, expires_at, action_hash, trace_id, correlation_id, evaluated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$17,$18,$19,$20)`,
    [
      decision.id,
      decision.tenantId,
      decision.workflowRunId,
      decision.workflowStepId,
      context.actorType,
      context.actorId,
      context.action,
      JSON.stringify(decision.evaluatedPolicyVersionIds),
      decision.riskClassificationVersionId,
      decision.effect,
      decision.riskLevel,
      JSON.stringify(decision.reasons),
      JSON.stringify(decision.requiredPermissions),
      JSON.stringify(decision.requiredApproverRoles),
      decision.requiredApprovalCount,
      decision.expiresAt,
      decision.actionHash,
      decision.traceId,
      context.correlationId,
      decision.evaluatedAt,
    ],
  );

  return decision;
}
