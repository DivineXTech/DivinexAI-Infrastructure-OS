import { z } from "zod";
import type { AgentManifest } from "../manifest.js";

const inputSchema = z.object({
  objective: z.string().min(1),
  agentOutputs: z.array(
    z.object({
      agentId: z.string(),
      summary: z.string(),
      output: z.unknown(),
    }),
  ),
});

const outputSchema = z.object({
  executiveSummary: z.string(),
  verifiedFacts: z.array(z.string()),
  calculatedMetrics: z.array(z.string()),
  aiInterpretation: z.array(z.string()),
  recommendations: z.array(z.string()),
  citations: z.array(z.string()),
});

export const saraManifest: AgentManifest<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  id: "sara",
  version: "0.1.0",
  name: "sara",
  displayName: "Sara",
  role: "Intelligence Director",
  mission:
    "Interpret business objectives, select the right agents and workflows, and synthesize their outputs into a coherent, cited, executive-ready result.",
  responsibilities: [
    "Interpret objectives and translate them into a workflow plan handed to Nova",
    "Select which specialized agents are relevant to a given objective",
    "Synthesize multi-agent outputs into a single final result",
    "Distinguish verified facts, calculated metrics, and AI interpretation in every synthesis",
  ],
  prohibitedActions: [
    "deploy_code",
    "change_billing_configuration",
    "transfer_or_move_funds",
    "alter_security_policy",
  ],
  capabilities: [
    "objective_interpretation",
    "workflow_selection",
    "executive_synthesis",
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
    requiresApprovalFor: ["external_publication", "customer_communication"],
    autoApproveBelowRisk: "low",
  },
  executionPolicy: {
    maxSteps: 20,
    timeoutMs: 120_000,
    maxRetries: 2,
    costCeilingUsd: 5,
  },
  handoffTargets: ["nova"],
  escalationTarget: null,
  successMetrics: ["synthesis_acceptance_rate", "objective_completion_rate"],
  inputSchema,
  outputSchema,
};
