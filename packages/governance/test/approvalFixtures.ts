import type { Pool } from "pg";
import {
  seedPlatformWorkflowCatalog,
  clientSolutionAssessmentManifest,
  createWorkflowRun,
  materializeSteps,
  PgPlatformWorkflowCatalog,
} from "@repo/workflow-engine";
import { createStubAgentResolver } from "./stubAgentResolver.js";
import { computeActionPayloadHash } from "../src/contentHash.js";
import {
  createApprovalRequest,
  type ActionSnapshot,
  type ApprovalRequest,
} from "../src/createApprovalRequest.js";

/**
 * Shared fixture builder for approval-request-related DB tests: seeds the
 * reference workflow catalog once, then materializes a fresh
 * `workflow_run`/`workflow_step` pair and a `policy_evaluations` row per
 * call so every test gets isolated, real Phase 3 rows to attach an
 * `approval_requests` row to (mirrors the composite-FK pattern
 * `approval_requests` actually relies on).
 */
export class ApprovalFixtureBuilder {
  private workflowVersionId: string | null = null;

  constructor(private readonly pool: Pool) {}

  private async ensureWorkflowCatalogSeeded(): Promise<string> {
    if (this.workflowVersionId) return this.workflowVersionId;
    const resolver = createStubAgentResolver();
    await seedPlatformWorkflowCatalog(this.pool, resolver, [
      clientSolutionAssessmentManifest,
    ]);
    const catalog = new PgPlatformWorkflowCatalog(this.pool);
    const definition = await catalog.getDefinitionBySlug(
      "client_solution_assessment",
    );
    const [version] = await catalog.listPublishedVersions(definition!.id);
    this.workflowVersionId = version!.id;
    return this.workflowVersionId;
  }

  /** Materializes a fresh run + all 7 reference-workflow steps for the given tenant, returning the "sara_synthesize" step id. */
  async materializeRunAndStep(
    tenantId: string,
    stepKey = "sara_synthesize",
  ): Promise<{ workflowRunId: string; workflowStepId: string }> {
    const workflowVersionId = await this.ensureWorkflowCatalogSeeded();
    const { rows: definitionRows } = await this.pool.query<{
      workflow_definition_id: string;
    }>("select workflow_definition_id from workflow_versions where id = $1", [
      workflowVersionId,
    ]);
    const { rows: twRows } = await this.pool.query<{ id: string }>(
      `insert into tenant_workflows (tenant_id, workflow_definition_id, workflow_version_id)
       values ($1, $2, $3)
       on conflict (tenant_id, workflow_definition_id) do update set updated_at = now()
       returning id`,
      [tenantId, definitionRows[0]!.workflow_definition_id, workflowVersionId],
    );
    const tenantWorkflowId = twRows[0]!.id;

    const run = await createWorkflowRun(this.pool, {
      tenantId,
      tenantWorkflowId,
      workflowVersionId,
      requestedByUserId: null,
      input: {},
      traceId: `trace-${Date.now()}-${Math.random()}`,
    });
    await materializeSteps(
      this.pool,
      tenantId,
      run.id,
      clientSolutionAssessmentManifest.steps,
    );
    const { rows: stepRows } = await this.pool.query<{ id: string }>(
      "select id from workflow_steps where workflow_run_id = $1 and step_key = $2",
      [run.id, stepKey],
    );
    const workflowStepId = stepRows[0]!.id;

    // Approval-command tests exercise recordApprovalDecision/cancelApprovalRequest/
    // resumeApprovedRequest directly, not the RUNNING -> WAITING_FOR_APPROVAL
    // transition itself (covered by workflow-engine's own
    // approvalIntegration.test.ts) — park the step at WAITING_FOR_APPROVAL
    // directly so those commands' own gated UPDATEs have a real row to act on.
    await this.pool.query(
      "update workflow_steps set status = 'WAITING_FOR_APPROVAL' where id = $1",
      [workflowStepId],
    );

    return { workflowRunId: run.id, workflowStepId };
  }

  /** Inserts a minimal `policy_evaluations` row directly (this suite tests approval commands, not evaluatePolicy itself, so a hand-built row is sufficient and keeps these fixtures decoupled). */
  async insertPolicyEvaluation(input: {
    tenantId: string;
    workflowRunId: string;
    workflowStepId: string;
    riskClassificationVersionId: string;
    action?: string;
  }): Promise<string> {
    const { rows } = await this.pool.query<{ id: string }>(
      `insert into policy_evaluations
         (tenant_id, workflow_run_id, workflow_step_id, actor_type, action,
          risk_classification_version_id, effect, risk_level, action_hash,
          trace_id, correlation_id)
       values ($1, $2, $3, 'worker', $4, $5, 'REQUIRE_APPROVAL', 'MEDIUM', 'test-hash', 'trace-x', 'corr-x')
       returning id`,
      [
        input.tenantId,
        input.workflowRunId,
        input.workflowStepId,
        input.action ?? "communication.send.external",
        input.riskClassificationVersionId,
      ],
    );
    return rows[0]!.id;
  }

  buildSnapshot(input: {
    workflowRunId: string;
    workflowStepId: string;
    policyDecisionId: string;
    riskClassificationVersionId: string;
    requestingActor?: ActionSnapshot["requestingActor"];
    requestingTenantAgentId?: string | null;
    action?: string;
    parameters?: Record<string, unknown>;
    targetResource?: string | null;
    proposedOutput?: unknown;
  }): ActionSnapshot {
    return {
      action: input.action ?? "communication.send.external",
      parameters: input.parameters ?? { recipient: "client@example.com" },
      targetResource: input.targetResource ?? null,
      requestingActor: input.requestingActor ?? {
        type: "worker",
        id: "test-worker",
      },
      requestingTenantAgentId: input.requestingTenantAgentId ?? null,
      workflowRunId: input.workflowRunId,
      workflowStepId: input.workflowStepId,
      policyDecisionId: input.policyDecisionId,
      riskClassificationVersionId: input.riskClassificationVersionId,
      evidence: {},
      traceContext: { traceId: "trace-x", correlationId: "corr-x" },
      proposedOutput: input.proposedOutput ?? { summary: "done" },
    };
  }

  /** End-to-end: materializes a run/step, inserts a policy evaluation, and creates the approval request. */
  async createFullApprovalRequest(
    tenantId: string,
    riskClassificationVersionId: string,
    overrides: Partial<{
      requiredApprovalCount: number;
      requiredApproverRoles: readonly string[];
      rejectOnFirstRejection: boolean;
      expiresAt: string | null;
      requestingActor: ActionSnapshot["requestingActor"];
      requestingTenantAgentId: string | null;
      parameters: Record<string, unknown>;
    }> = {},
  ): Promise<
    ApprovalRequest & { workflowRunId: string; workflowStepId: string }
  > {
    const { workflowRunId, workflowStepId } =
      await this.materializeRunAndStep(tenantId);
    const policyEvaluationId = await this.insertPolicyEvaluation({
      tenantId,
      workflowRunId,
      workflowStepId,
      riskClassificationVersionId,
    });
    const snapshot = this.buildSnapshot({
      workflowRunId,
      workflowStepId,
      policyDecisionId: policyEvaluationId,
      riskClassificationVersionId,
      requestingActor: overrides.requestingActor,
      requestingTenantAgentId: overrides.requestingTenantAgentId,
      parameters: overrides.parameters,
    });
    const request = await createApprovalRequest(this.pool, {
      tenantId,
      policyEvaluationId,
      workflowRunId,
      workflowStepId,
      actionSnapshot: snapshot,
      requiredApprovalCount: overrides.requiredApprovalCount ?? 1,
      requiredApproverRoles: overrides.requiredApproverRoles ?? [],
      rejectOnFirstRejection: overrides.rejectOnFirstRejection ?? true,
      expiresAt: overrides.expiresAt ?? null,
    });
    return { ...request, workflowRunId, workflowStepId };
  }
}

export function computeSnapshotHash(snapshot: ActionSnapshot): string {
  return computeActionPayloadHash({
    action: snapshot.action,
    parameters: snapshot.parameters,
    targetResource: snapshot.targetResource,
  });
}
