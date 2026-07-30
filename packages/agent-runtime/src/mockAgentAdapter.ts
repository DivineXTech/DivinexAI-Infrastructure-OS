import type { ResolvedTenantAgent } from "./tenantAgentRegistry.js";
import type { AgentExecutionContext } from "./executionContext.js";
import {
  AgentExecutionResultSchema,
  type AgentExecutionResult,
  type IntendedAction,
} from "./executionResult.js";

export interface MockAgentAdapter {
  execute(
    resolved: ResolvedTenantAgent,
    context: AgentExecutionContext,
    /** The governed action this step declares, if any (Phase 4) — when
     * present, the mock result's `intendedAction` is populated so
     * `governance` has something to evaluate. `null`/omitted for a step
     * with no governance gate. */
    governedAction?: string | null,
  ): Promise<AgentExecutionResult>;
}

/**
 * Deterministic, schema-valid `AgentExecutionResult` with no real
 * model/provider call — matching the original intent for
 * `MOCK_EXECUTABLE` installations (Phase 2 registered agents but never
 * built this executor itself; Phase 3 adds it since the workflow runtime
 * has nothing to invoke without it).
 */
export class DeterministicMockAgentAdapter implements MockAgentAdapter {
  async execute(
    resolved: ResolvedTenantAgent,
    context: AgentExecutionContext,
    governedAction?: string | null,
  ): Promise<AgentExecutionResult> {
    const intendedAction: IntendedAction | null = governedAction
      ? {
          action: governedAction,
          parameters: { objective: context.objective },
          targetResource: null,
        }
      : null;

    const result: AgentExecutionResult = {
      status: "completed",
      summary: `Mock execution of agent "${resolved.definition.slug}" for objective: ${context.objective}`,
      output: {
        agentSlug: resolved.definition.slug,
        agentVersion: resolved.version.version,
        objective: context.objective,
      },
      evidence: [],
      assumptions: [
        "This is a deterministic mock result; no real model/provider call was made.",
      ],
      uncertainty: null,
      recommendedNextAction: null,
      requestedHandoff: null,
      approvalRequired: false,
      riskFlags: [],
      memoryCandidates: [],
      evaluationMetadata: {
        modelUsed: null,
        tokensUsed: null,
        latencyMs: 0,
        toolCallCount: 0,
      },
      intendedAction,
      selfAssessedRiskLevel: null,
      requestedCapabilities: [],
    };
    return AgentExecutionResultSchema.parse(result);
  }
}
