import { z } from "zod";
import type { AgentManifest } from "../manifest.js";

const inputSchema = z.object({
  objective: z.string().min(1),
  availableAgentIds: z.array(z.string()),
});

const outputSchema = z.object({
  taskGraph: z.array(
    z.object({
      stepId: z.string(),
      assignedAgentId: z.string(),
      dependsOn: z.array(z.string()),
    }),
  ),
  notes: z.string(),
});

export const novaManifest: AgentManifest<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  id: "nova",
  version: "0.1.0",
  name: "nova",
  displayName: "Nova",
  role: "Operations Director",
  mission:
    "Turn Sara's interpreted objective into an executable, dependency-ordered task graph, and supervise its sequencing, retries, and agent assignment.",
  responsibilities: [
    "Create dependency-ordered workflow task graphs from an objective",
    "Assign each step to the correct specialized agent",
    "Control step sequencing, retries, and dependencies",
    "Escalate blocked or high-risk steps rather than force them through",
  ],
  prohibitedActions: [
    "approve_restricted_business_action",
    "bypass_approval_gate",
  ],
  capabilities: [
    "workflow_planning",
    "dependency_graph_construction",
    "retry_and_timeout_supervision",
  ],
  toolIds: [],
  knowledgeSourceIds: [],
  memoryPolicy: {
    workingMemory: true,
    episodicMemory: true,
    semanticMemory: false,
    retentionDays: 30,
  },
  approvalPolicy: {
    requiresApprovalFor: ["restricted_business_action"],
    autoApproveBelowRisk: "low",
  },
  executionPolicy: {
    maxSteps: 50,
    timeoutMs: 300_000,
    maxRetries: 3,
    costCeilingUsd: 2,
  },
  handoffTargets: ["pulse", "reven", "forge", "guardian", "sara"],
  escalationTarget: "sara",
  successMetrics: ["workflow_completion_rate", "step_retry_efficiency"],
  inputSchema,
  outputSchema,
};
