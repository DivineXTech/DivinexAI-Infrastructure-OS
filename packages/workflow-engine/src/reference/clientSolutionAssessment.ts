import { z } from "zod";
import type { WorkflowManifest } from "../manifest.js";

/**
 * Reference workflow for Phase 3 (§12 of the Phase 3 design):
 *
 *   sara_interpret (sara)
 *     -> nova_plan (nova)
 *          -> pulse_market (pulse)   -\
 *          -> reven_pricing (reven)  -+-> guardian_review (guardian) -> sara_synthesize (sara)
 *          -> forge_technical (forge)-/
 *
 * The durable approval-wait state before completion is modeled as the *run*
 * transitioning RUNNING -> WAITING_FOR_APPROVAL once sara_synthesize
 * succeeds (an existing, legal run-level transition) — not an eighth graph
 * step. Mock adapters only; every step uses `kind: "agentSlug"`.
 */

const DEFAULT_RETRY_POLICY = {
  maxAttempts: 3,
  backoff: "exponential" as const,
  backoffMs: 1000,
  timeoutMs: 60000,
  deadLetterOnExhaustion: true,
};

const inputSchema = z.object({
  clientName: z.string().min(1),
  clientBrief: z.string().min(1),
});
export type ClientSolutionAssessmentInput = z.infer<typeof inputSchema>;

const outputSchema = z.object({
  summary: z.string().min(1),
  recommendedNextSteps: z.array(z.string()),
});
export type ClientSolutionAssessmentOutput = z.infer<typeof outputSchema>;

export const clientSolutionAssessmentManifest: WorkflowManifest<
  ClientSolutionAssessmentInput,
  ClientSolutionAssessmentOutput
> = {
  id: "client_solution_assessment",
  version: "1.0.0",
  displayName: "Client Solution Assessment",
  description:
    "Interprets a client brief, plans a cross-functional assessment across market, pricing, and technical feasibility, reviews it for governance, and synthesizes a recommendation pending human approval.",
  inputSchema,
  outputSchema,
  steps: [
    {
      stepKey: "sara_interpret",
      assignment: { kind: "agentSlug", agentSlug: "sara" },
      dependsOn: [],
      approvalRequired: false,
      retryPolicy: DEFAULT_RETRY_POLICY,
      governedAction: null,
    },
    {
      stepKey: "nova_plan",
      assignment: { kind: "agentSlug", agentSlug: "nova" },
      dependsOn: ["sara_interpret"],
      approvalRequired: false,
      retryPolicy: DEFAULT_RETRY_POLICY,
      governedAction: null,
    },
    {
      stepKey: "pulse_market",
      assignment: { kind: "agentSlug", agentSlug: "pulse" },
      dependsOn: ["nova_plan"],
      approvalRequired: false,
      retryPolicy: DEFAULT_RETRY_POLICY,
      governedAction: null,
    },
    {
      stepKey: "reven_pricing",
      assignment: { kind: "agentSlug", agentSlug: "reven" },
      dependsOn: ["nova_plan"],
      approvalRequired: false,
      retryPolicy: DEFAULT_RETRY_POLICY,
      governedAction: null,
    },
    {
      stepKey: "forge_technical",
      assignment: { kind: "agentSlug", agentSlug: "forge" },
      dependsOn: ["nova_plan"],
      approvalRequired: false,
      retryPolicy: DEFAULT_RETRY_POLICY,
      governedAction: null,
    },
    {
      stepKey: "guardian_review",
      assignment: { kind: "agentSlug", agentSlug: "guardian" },
      dependsOn: ["pulse_market", "reven_pricing", "forge_technical"],
      approvalRequired: false,
      retryPolicy: DEFAULT_RETRY_POLICY,
      governedAction: null,
    },
    {
      stepKey: "sara_synthesize",
      assignment: { kind: "agentSlug", agentSlug: "sara" },
      dependsOn: ["guardian_review"],
      approvalRequired: true,
      retryPolicy: DEFAULT_RETRY_POLICY,
      governedAction: null,
    },
  ],
};

/**
 * Phase 4 (§12 of PHASE_4_GOVERNANCE_APPROVALS.md): a new workflow version,
 * not a mutation of the published `1.0.0` above. Adds `deliver_external`,
 * whose `governedAction: "communication.send.external"` is expected to
 * evaluate to `REQUIRE_APPROVAL` under the platform's mandatory default
 * policy set — the workflow durably parks at `WAITING_FOR_APPROVAL` on this
 * step until a governance decision resumes it exactly once. No real
 * external communication is sent; Phase 4 stays mock-only here.
 */
export const clientSolutionAssessmentManifestV1_1: WorkflowManifest<
  ClientSolutionAssessmentInput,
  ClientSolutionAssessmentOutput
> = {
  id: "client_solution_assessment",
  version: "1.1.0",
  displayName: "Client Solution Assessment",
  description:
    "Interprets a client brief, plans a cross-functional assessment across market, pricing, and technical feasibility, reviews it for governance, synthesizes a recommendation, and delivers it to the client pending governed approval.",
  inputSchema,
  outputSchema,
  steps: [
    ...clientSolutionAssessmentManifest.steps,
    {
      stepKey: "deliver_external",
      assignment: { kind: "agentSlug", agentSlug: "sara" },
      dependsOn: ["sara_synthesize"],
      approvalRequired: false,
      retryPolicy: DEFAULT_RETRY_POLICY,
      governedAction: "communication.send.external",
    },
  ],
};
