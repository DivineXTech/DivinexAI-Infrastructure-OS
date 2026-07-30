# Phase 1 — Increment: Agent & Workflow Contracts

**Status:** Complete and tested. Stopping here for review — see
`BRIEF_RECONCILIATION.md` for the open question on whether to proceed past
this into database-migration/runtime work under the still-standing Phase 2
Supabase-validation gate.

## Scope

The newer AgentFlow Pro brief's Increment 1: "contracts, agent manifest,
statuses, and validation." Pure TypeScript/Zod contracts — no database
tables, no persistence, no agent execution, no runtime coupling to
Supabase. Per the reconciliation, these live in the two canonical packages
that own them (`agent-runtime`, `workflow-engine`), not a new package tree.

## What was built

- **`packages/agent-runtime`** (new package, first code in it):
  - `src/manifest.ts` — `AgentManifest` (metadata + live `inputSchema`/
    `outputSchema` Zod schemas), `AgentManifestMetadataSchema`, and
    `validateAgentManifest`, which parses the metadata via Zod and
    separately asserts `inputSchema`/`outputSchema` are real `z.ZodType`
    instances (a schema-valued field can't itself be described by a data
    schema — see the file's own comment for why these are checked
    differently).
  - `src/executionContext.ts` — `AgentExecutionContext` (every field the
    brief specified: `tenantId` in place of `organizationId`,
    `workspaceId` nullable/reserved, `workflowRunId`, `workflowStepId`,
    `requestingActor`, `objective`, `approvedInputs`,
    `availableCapabilities`, `approvedTools`, `relevantMemory`,
    `knowledgeContext`, `riskContext`, `executionBudget`, `traceId`) and
    `parseAgentExecutionContext`.
  - `src/executionResult.ts` — `AgentExecutionResult` (`status`, `summary`,
    `output`, `evidence`, `assumptions`, `uncertainty`,
    `recommendedNextAction`, `requestedHandoff`, `approvalRequired`,
    `riskFlags`, `memoryCandidates`, `evaluationMetadata`) and
    `parseAgentExecutionResult` — the only sanctioned way to accept an
    agent's output; it throws on anything that doesn't validate, per the
    brief's "no agent may return an unvalidated runtime payload."
- **`packages/workflow-engine`** (new package, first code in it):
  - `src/status.ts` — `WorkflowStatusSchema` (all 15 required statuses),
    a deterministic transition table (`isValidWorkflowTransition`,
    `assertValidWorkflowTransition`, `InvalidWorkflowTransitionError`), and
    `isTerminalWorkflowStatus`/`TERMINAL_WORKFLOW_STATUSES`.

No six-agent manifests, no agent registry, no workflow persistence, no
model/tool gateway — those are later increments (3, 4, 5, 6 in the newer
brief's own sequence) and were deliberately not started.

## Test results (actually executed)

```
@repo/agent-runtime:test
  ✓ test/manifest.test.ts (6 tests)
  ✓ test/executionContext.test.ts (5 tests)
  ✓ test/executionResult.test.ts (6 tests)
  Test Files  3 passed (3)   Tests  17 passed (17)

@repo/workflow-engine:test
  ✓ test/status.test.ts (22 tests)
  Test Files  1 passed (1)   Tests  22 passed (22)

@repo/shared:test (unchanged, re-verified)
  Test Files  5 passed (5)   Tests  30 passed (30)
```

69 tests total across the monorepo, all passing. `bun run check-types`,
`bun run lint`, `bun run build` all pass for all five packages
(`agent-runtime`, `workflow-engine`, `shared`, `eslint-config`,
`typescript-config`).

**A real bug was caught and fixed by this increment's own tests**: the
initial transition table didn't allow `VALIDATING -> CANCELLED`, which a
test asserting "every non-terminal status can reach CANCELLED" caught
immediately (`expected false to be true`). Fixed by adding `CANCELLED` to
`VALIDATING`'s allowed transitions — a workflow in final validation should
still be cancellable. This is exactly the kind of design gap this test
suite exists to catch before it reaches persistence code.

## Why this didn't wait on the Phase 2 gate

Everything here is pure type/schema definition — no code path touches a
database, calls Supabase, or executes an agent. The Phase 2 gate
(`PHASE_1_SUPABASE_VALIDATION.md`) exists to validate runtime behavior
against real RLS/PostgREST before code depends on it; nothing in this
increment does. See `BRIEF_RECONCILIATION.md` for what comes next and why
it's flagged as an open question rather than assumed.

## Acceptance criteria

- [x] `AgentManifest` contract exists, Zod-validated via
      `validateAgentManifest` (metadata + explicit Zod-schema-instance
      check on input/output schemas).
- [x] `AgentExecutionContext` and `AgentExecutionResult` contracts exist
      with every field the brief specified, Zod-validated, parse-or-throw.
- [x] All 15 required workflow statuses exist; invalid transitions are
      rejected (`InvalidWorkflowTransitionError`); terminal statuses have
      zero outgoing transitions (tested exhaustively); every non-terminal
      status can reach `CANCELLED` (tested exhaustively, caught a real bug).
- [x] `check-types`, `lint`, `build`, `test` all pass at the repository
      root, including the four pre-existing packages.
- [ ] Six agent manifests, agent registry, workflow persistence, model/tool
      gateways — none started; later increments, contingent on the Phase 2
      gate question.
