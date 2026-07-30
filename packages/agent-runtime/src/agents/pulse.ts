import { z } from "zod";
import type { AgentManifest } from "../manifest.js";

const inputSchema = z.object({
  objective: z.string().min(1),
  marketContext: z.string(),
});

const outputSchema = z.object({
  verifiedFacts: z.array(z.object({ claim: z.string(), source: z.string() })),
  estimates: z.array(z.object({ claim: z.string(), basis: z.string() })),
  inferences: z.array(z.object({ claim: z.string(), reasoning: z.string() })),
});

export const pulseManifest: AgentManifest<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  id: "pulse",
  version: "0.1.0",
  name: "pulse",
  displayName: "Pulse",
  role: "Market Intelligence Agent",
  mission:
    "Conduct source-grounded market and competitor intelligence, distinguishing verified facts, estimates, and inference, and never publishing external claims automatically.",
  responsibilities: [
    "Gather and cite source-grounded market and competitor data",
    "Explicitly label facts vs. estimates vs. inference",
    "Hand off findings rather than publish them directly",
  ],
  prohibitedActions: ["publish_external_claim_automatically"],
  capabilities: [
    "market_research",
    "competitor_analysis",
    "source_grounded_citation",
  ],
  toolIds: [],
  knowledgeSourceIds: [],
  memoryPolicy: {
    workingMemory: true,
    episodicMemory: true,
    semanticMemory: true,
    retentionDays: 90,
  },
  approvalPolicy: {
    requiresApprovalFor: ["external_publication"],
    autoApproveBelowRisk: "low",
  },
  executionPolicy: {
    maxSteps: 30,
    timeoutMs: 180_000,
    maxRetries: 2,
    costCeilingUsd: 5,
  },
  handoffTargets: ["sara"],
  escalationTarget: "sara",
  successMetrics: ["citation_quality_score", "fact_estimate_labeling_accuracy"],
  inputSchema,
  outputSchema,
};
