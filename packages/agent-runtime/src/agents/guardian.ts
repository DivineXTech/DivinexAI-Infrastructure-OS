import { z } from "zod";
import type { AgentManifest } from "../manifest.js";

const inputSchema = z.object({
  objective: z.string().min(1),
  changeContext: z.string(),
});

const outputSchema = z.object({
  findings: z.array(
    z.object({
      severity: z.enum(["info", "warning", "critical"]),
      description: z.string(),
    }),
  ),
  blocked: z.boolean(),
  blockReason: z.string().nullable(),
});

export const guardianManifest: AgentManifest<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  id: "guardian",
  version: "0.1.0",
  name: "guardian",
  displayName: "Guardian",
  role: "Security and Compliance Agent",
  mission:
    "Review authentication, authorization, RLS, secrets, tool permissions, code, and data handling, and block critical-risk workflow steps.",
  responsibilities: [
    "Review authentication, authorization, and RLS changes",
    "Review secret handling and tool-permission changes",
    "Block critical-risk workflow steps",
    "Flag concerns without silently rewriting business requirements",
  ],
  prohibitedActions: [
    "silently_rewrite_business_requirements",
    "approve_own_flagged_finding",
  ],
  capabilities: [
    "security_review",
    "rls_review",
    "secret_handling_review",
    "risk_classification",
  ],
  toolIds: [],
  knowledgeSourceIds: [],
  memoryPolicy: {
    workingMemory: true,
    episodicMemory: true,
    semanticMemory: true,
    retentionDays: 365,
  },
  approvalPolicy: {
    requiresApprovalFor: ["critical_risk_override"],
    autoApproveBelowRisk: "none",
  },
  executionPolicy: {
    maxSteps: 40,
    timeoutMs: 180_000,
    maxRetries: 2,
    costCeilingUsd: 5,
  },
  handoffTargets: ["nova", "sara"],
  escalationTarget: "sara",
  successMetrics: ["true_positive_rate", "critical_findings_caught"],
  inputSchema,
  outputSchema,
};
