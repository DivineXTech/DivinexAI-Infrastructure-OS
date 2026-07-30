import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import {
  seedPlatformAgentCatalog,
  CANONICAL_AGENT_MANIFESTS,
  PgPlatformAgentCatalog,
  PgTenantAgentRegistry,
  provisionTenantAgents,
  resolveTenantAgent,
  assertAgentEligible,
  DeterministicMockAgentAdapter,
  CatalogAgentResolver,
} from "@repo/agent-runtime";
import { PgTenantAccessEvaluator } from "@repo/shared";
import { resetAndMigrate } from "./setupTestDb.js";
import { seedCoreFixtures, type CoreFixtures } from "./seedFixtures.js";
import { seedPlatformWorkflowCatalog } from "../src/seedPlatformWorkflowCatalog.js";
import { clientSolutionAssessmentManifest } from "../src/reference/clientSolutionAssessment.js";
import { PgPlatformWorkflowCatalog } from "../src/platformWorkflowCatalog.js";
import { provisionTenantWorkflow } from "../src/provisionTenantWorkflow.js";
import {
  createWorkflowRun,
  materializeSteps,
  resumeWorkflowRunAfterApproval,
} from "../src/workflowRunService.js";
import { computeReadySteps } from "../src/stepScheduler.js";
import { PgStepLeasing } from "../src/stepLeasing.js";

/**
 * Full integration test for the reference workflow (§12 of the Phase 3
 * design): exercises workflow-engine's runtime against agent-runtime's real
 * (mock) agent execution — the one test file in workflow-engine's suite
 * that depends on @repo/agent-runtime (a devDependency only; no src/ file
 * in either package imports the other).
 */

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/agentflow_test_workflow_engine";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const agentCatalog = new PgPlatformAgentCatalog(pool);
const agentRegistry = new PgTenantAgentRegistry(pool);
const access = new PgTenantAccessEvaluator(pool);
const workflowCatalog = new PgPlatformWorkflowCatalog(pool);
const agentResolver = new CatalogAgentResolver(agentCatalog);
const leasing = new PgStepLeasing(pool);
const mockAdapter = new DeterministicMockAgentAdapter();

let fixtures: CoreFixtures;

beforeAll(async () => {
  await resetAndMigrate(pool);
  fixtures = await seedCoreFixtures(pool);

  await seedPlatformAgentCatalog(pool, CANONICAL_AGENT_MANIFESTS);

  const versionsBySlug = Object.fromEntries(
    await Promise.all(
      CANONICAL_AGENT_MANIFESTS.map(async (m) => {
        const definition = await agentCatalog.getDefinitionBySlug(m.id);
        const [version] = await agentCatalog.listPublishedVersions(
          definition!.id,
        );
        return [m.id, version!.id] as const;
      }),
    ),
  ) as Record<string, string>;

  const { created } = await provisionTenantAgents(pool, agentCatalog, access, {
    tenantId: fixtures.tenantA,
    actorUserId: fixtures.userAOwner,
    versionsBySlug: versionsBySlug as never,
  });

  // Make every installation eligible: enabled + at least MOCK_EXECUTABLE.
  for (const installation of created) {
    await agentRegistry.transitionLifecycle(installation.id, "MOCK_EXECUTABLE");
    await agentRegistry.setEnabled(installation.id, true);
  }

  await seedPlatformWorkflowCatalog(pool, agentResolver, [
    clientSolutionAssessmentManifest,
  ]);
});

afterAll(async () => {
  await pool.end();
});

describe("client_solution_assessment reference workflow (mock agents, end-to-end)", () => {
  it("runs every step to SUCCEEDED and reaches WAITING_FOR_APPROVAL, then resumes to RUNNING on approval", async () => {
    const definition = await workflowCatalog.getDefinitionBySlug(
      "client_solution_assessment",
    );
    const [version] = await workflowCatalog.listPublishedVersions(
      definition!.id,
    );

    const { installation: tenantWorkflow } = await provisionTenantWorkflow(
      pool,
      workflowCatalog,
      access,
      {
        tenantId: fixtures.tenantA,
        actorUserId: fixtures.userAOwner,
        workflowDefinitionSlug: "client_solution_assessment",
        workflowVersionId: version!.id,
      },
    );

    const run = await createWorkflowRun(pool, {
      tenantId: fixtures.tenantA,
      tenantWorkflowId: tenantWorkflow.id,
      workflowVersionId: version!.id,
      requestedByUserId: fixtures.userAOwner,
      input: {
        clientName: "Acme Corp",
        clientBrief: "Expand into new markets",
      },
      traceId: "trace-reference-workflow",
    });

    await materializeSteps(
      pool,
      fixtures.tenantA,
      run.id,
      clientSolutionAssessmentManifest.steps,
    );
    await pool.query(
      "update workflow_runs set status = 'RUNNING' where id = $1",
      [run.id],
    );

    // Drive the run to completion: repeatedly ready dependency-satisfied
    // steps, then claim + execute (mock) + commit every currently-READY step.
    let safetyCounter = 0;
    while (safetyCounter < 20) {
      safetyCounter += 1;
      await computeReadySteps(pool, run.id);

      const { rows: readySteps } = await pool.query<{
        id: string;
        step_key: string;
        agent_slug: string;
      }>(
        "select id, step_key, agent_slug from workflow_steps where workflow_run_id = $1 and status = 'READY'",
        [run.id],
      );
      if (readySteps.length === 0) break;

      for (const step of readySteps) {
        const claim = await leasing.claimStep(step.id, "test-worker", 30000);
        expect(claim).not.toBeNull();
        const started = await leasing.markStepRunning(
          step.id,
          claim!.leaseToken,
        );
        expect(started).toBe(true);

        const resolved = await resolveTenantAgent(
          agentRegistry,
          agentCatalog,
          fixtures.tenantA,
          step.agent_slug,
        );
        assertAgentEligible(resolved.installation);

        const result = await mockAdapter.execute(resolved, {
          tenantId: fixtures.tenantA,
          workspaceId: null,
          workflowRunId: run.id,
          workflowStepId: step.id,
          requestingActor: { type: "system", id: "test-worker" },
          objective: `Execute step ${step.step_key}`,
          approvedInputs: {},
          availableCapabilities: [],
          approvedTools: [],
          relevantMemory: [],
          knowledgeContext: [],
          riskContext: { riskLevel: "low", flags: [] },
          executionBudget: {
            maxTokens: null,
            maxCostUsd: null,
            maxDurationMs: null,
            maxToolCalls: null,
          },
          traceId: "trace-reference-workflow",
        });
        expect(result.status).toBe("completed");

        const committed = await leasing.commitStepSuccess(
          step.id,
          claim!.leaseToken,
          result.output,
        );
        expect(committed).toBe(true);
      }
    }
    expect(safetyCounter).toBeLessThan(20); // did not hit the safety cap (i.e. actually converged)

    const { rows: allSteps } = await pool.query(
      "select step_key, status from workflow_steps where workflow_run_id = $1",
      [run.id],
    );
    expect(allSteps).toHaveLength(7);
    expect(allSteps.every((s) => s.status === "SUCCEEDED")).toBe(true);

    // sara_synthesize is approvalRequired: true in the manifest — the
    // durable approval wait is modeled as a run-level transition, not an
    // eighth graph step (§12 of the design).
    await pool.query(
      "update workflow_runs set status = 'WAITING_FOR_APPROVAL' where id = $1",
      [run.id],
    );

    await resumeWorkflowRunAfterApproval(pool, run.id, "approved");

    const { rows: runRows } = await pool.query(
      "select status from workflow_runs where id = $1",
      [run.id],
    );
    expect(runRows[0]!.status).toBe("RUNNING");
  });
});
