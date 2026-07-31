import { z } from "zod";
import { PolicyEffectSchema, RiskLevelSchema } from "./policyDocument.js";

export const PolicyDecisionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  evaluatedPolicyVersionIds: z.array(z.string().uuid()),
  riskClassificationVersionId: z.string().uuid(),
  effect: PolicyEffectSchema,
  riskLevel: RiskLevelSchema,
  reasons: z.array(
    z.object({
      policyVersionId: z.string().uuid().nullable(),
      code: z.string(),
      message: z.string(),
    }),
  ),
  requiredPermissions: z.array(z.string()),
  requiredApproverRoles: z.array(z.string()),
  requiredApprovalCount: z.number().int().nonnegative(),
  expiresAt: z.string().datetime().nullable(),
  actionHash: z.string(),
  evaluatedAt: z.string().datetime(),
  traceId: z.string(),
  workflowRunId: z.string().uuid().nullable(),
  workflowStepId: z.string().uuid().nullable(),
});
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;
