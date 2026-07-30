/**
 * Governance integration contract — Phase 3 ships only `StaticGovernanceGate`
 * (a trivial stub); the real policy engine is Phase 4. The interface shape
 * is fixed now specifically so that swap requires no change to
 * `workflow-engine`'s calling code, mirroring the `AgentResolver` inversion.
 */
export interface GovernanceEvaluationContext {
  tenantId: string;
  workflowRunId: string;
  stepKey: string;
  agentSlug: string;
}

export interface GovernanceEvaluationResult {
  approvalRequired: boolean;
  blocked: boolean;
  blockReason: string | null;
  escalationRequired: boolean;
}

export interface GovernanceGate {
  evaluateStep(
    context: GovernanceEvaluationContext,
  ): Promise<GovernanceEvaluationResult>;
}

/**
 * Returns the manifest-declared `approvalRequired` flag verbatim, never
 * blocks, never escalates. Phase 4 replaces this with a real evaluator built
 * on `packages/shared`'s `PgTenantAccessEvaluator`-style deterministic
 * pattern.
 */
export class StaticGovernanceGate implements GovernanceGate {
  constructor(
    private readonly manifestApprovalRequiredByStepKey: ReadonlyMap<
      string,
      boolean
    >,
  ) {}

  async evaluateStep(
    context: GovernanceEvaluationContext,
  ): Promise<GovernanceEvaluationResult> {
    return {
      approvalRequired:
        this.manifestApprovalRequiredByStepKey.get(context.stepKey) ?? false,
      blocked: false,
      blockReason: null,
      escalationRequired: false,
    };
  }
}
