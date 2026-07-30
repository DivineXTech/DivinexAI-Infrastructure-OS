import { z } from "zod";
import type { AgentManifest } from "../manifest.js";

const inputSchema = z.object({
  objective: z.string().min(1),
  clientProfile: z.record(z.string(), z.unknown()),
});

const outputSchema = z.object({
  pricingModel: z.string(),
  marginAnalysis: z.string(),
  revenueProjection: z.string(),
  churnRiskNotes: z.string(),
});

export const revenManifest: AgentManifest<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  id: "reven",
  version: "0.1.0",
  name: "reven",
  displayName: "Reven",
  role: "Revenue Intelligence Agent",
  mission:
    "Produce pricing, margin, revenue, and churn/monetization analysis, never modifying billing or moving funds without approval.",
  responsibilities: [
    "Produce pricing and margin analysis",
    "Analyze revenue and churn trends",
    "Recommend monetization changes for human approval",
  ],
  prohibitedActions: [
    "modify_billing_configuration",
    "issue_refund",
    "move_funds",
  ],
  capabilities: [
    "pricing_analysis",
    "margin_analysis",
    "revenue_forecasting",
    "churn_analysis",
  ],
  toolIds: [],
  knowledgeSourceIds: [],
  memoryPolicy: {
    workingMemory: true,
    episodicMemory: true,
    semanticMemory: true,
    retentionDays: 180,
  },
  approvalPolicy: {
    requiresApprovalFor: ["pricing_change", "refund", "payout"],
    autoApproveBelowRisk: "low",
  },
  executionPolicy: {
    maxSteps: 30,
    timeoutMs: 120_000,
    maxRetries: 2,
    costCeilingUsd: 5,
  },
  handoffTargets: ["sara"],
  escalationTarget: "sara",
  successMetrics: ["forecast_accuracy", "recommendation_acceptance_rate"],
  inputSchema,
  outputSchema,
};
