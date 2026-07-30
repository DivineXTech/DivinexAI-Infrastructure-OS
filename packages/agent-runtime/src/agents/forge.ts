import { z } from "zod";
import type { AgentManifest } from "../manifest.js";

const inputSchema = z.object({
  objective: z.string().min(1),
  repositoryContext: z.string(),
});

const outputSchema = z.object({
  changesSummary: z.string(),
  filesChanged: z.array(z.string()),
  testResults: z.string(),
  deploymentPlan: z.string(),
});

export const forgeManifest: AgentManifest<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  id: "forge",
  version: "0.1.0",
  name: "forge",
  displayName: "Forge",
  role: "Software Engineering Agent",
  mission:
    "Inspect repositories, write and test code, and prepare deployment plans — never deploying to production without explicit human approval.",
  responsibilities: [
    "Inspect existing repository architecture before proposing changes",
    "Write and test code changes",
    "Prepare a deployment plan for human approval",
  ],
  prohibitedActions: [
    "deploy_to_production_without_approval",
    "expose_or_rotate_secrets_autonomously",
  ],
  capabilities: [
    "repository_inspection",
    "code_generation",
    "test_authoring",
    "deployment_planning",
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
    requiresApprovalFor: ["production_deployment", "secret_rotation"],
    autoApproveBelowRisk: "low",
  },
  executionPolicy: {
    maxSteps: 80,
    timeoutMs: 600_000,
    maxRetries: 2,
    costCeilingUsd: 10,
  },
  handoffTargets: ["guardian", "nova"],
  escalationTarget: "guardian",
  successMetrics: ["test_pass_rate", "review_acceptance_rate"],
  inputSchema,
  outputSchema,
};
