# File Change Plan — Phase 4: Governance, Policies, Risk Decisions, and Human Approvals

**Status: Conditionally approved, revised, implementation proceeding.**
This supersedes the Phase 3 content that previously occupied this file.
Full design rationale lives in `PHASE_4_GOVERNANCE_APPROVALS.md`; this file
is the file-change-plan excerpt of that document, revised for the four
required refinements from review (versioned risk classifications,
confirmed-additive contract extensions with compatibility tests, no
client mutation of approval state at all, and run-level completion
resolved in this phase).

## Model, in one sentence

A new `packages/governance` evaluates versioned, structured policy
documents deterministically against a governed action and a versioned
risk classification, producing one of five effects
(`BLOCK > DENY > ESCALATE > REQUIRE_APPROVAL > ALLOW`); when the effect
requires approval, it creates an immutable approval request bound to the
exact proposed action, collects one or more authorized decisions under
separation-of-duties and distinct-approver rules — entirely through
governed application commands, never through a client-writable row — and
tells `workflow-engine` to resume, reject, expire, or cancel the waiting
step exactly once; `workflow-engine` then derives the run's own outcome
from its steps' persisted state, closing the run-completion gap Phase 3
left open.

## New package: `packages/governance`

Package layout mirrors `workflow-engine`'s Phase 3 structure exactly (own
`package.json`/`tsconfig.json`/`eslint.config.js`/`vitest.config.ts`,
dependencies on `@repo/shared` and `@repo/platform-kernel`, no dependency
on `agent-runtime` or `workflow-engine` — those call _into_ `governance`,
not the reverse). See `PHASE_4_GOVERNANCE_APPROVALS.md` §13 for the full
file tree.

## New/revised table definitions

See `PHASE_4_GOVERNANCE_APPROVALS.md` §1 for full DDL. Summary:

**Platform-owned (no `tenant_id`), four tables:** `policy_definitions`,
`policy_versions` (immutable once published, plus `priority`/`mandatory`/
`override_policy` columns driving precedence), and — **revised per
review** — `risk_classification_definitions` + `risk_classification_versions`
replacing the originally-proposed mutable `risk_classifications` lookup:
immutable once published, exactly mirroring `policy_versions`. Every
`policy_evaluations` row now records the exact
`risk_classification_version_id` consulted.

**Tenant-owned (`tenant_id NOT NULL` everywhere), seven tables:**
`tenant_policy_assignments` (installation row, mirrors `tenant_agents`/
`tenant_workflows`), `tenant_policy_overrides` (tenant-authored tightening
deltas only — the schema has no field capable of loosening an effect or
reducing a requirement, and can never lower a risk level below the
resolved classification floor), `policy_evaluations` (append-only audit,
no write policy at all), `approval_requests` (the durable gate, with a
partial unique index guaranteeing exactly one active request per workflow
step — **revised: read-only for every tenant role, no insert/update/delete
policy whatsoever**), `approval_decisions` (append-only, distinct-approver-
enforced via a unique constraint — **revised: also read-only, no write
policy of any kind**), `approval_assignments` (who may decide),
`governance_events` (append-only audit ledger, no sequence counter).

All child tables use the established composite-foreign-key pattern for
tenant consistency. `approval_requests` references `workflow_steps` the
same one-way direction `workflow_dead_letters` already established in
Phase 3 — **no migration touches `workflow_steps` itself.**

## Revised/new interfaces

```ts
// packages/governance/src/evaluatePolicy.ts
export async function evaluatePolicy(
  db: Queryable,
  context: PolicyEvaluationContext,
): Promise<PolicyDecision>; // records risk_classification_version_id used

// packages/governance/src/createApprovalRequest.ts
export async function createApprovalRequest(
  db: Queryable,
  input: CreateApprovalRequestInput,
): Promise<{
  request: ApprovalRequest;
  created: boolean;
  superseded: string | null;
}>;

// packages/governance/src/recordApprovalDecision.ts — the 9-step governed command (§7)
export async function recordApprovalDecision(
  db: Queryable,
  access: TenantAccessEvaluator,
  input: RecordApprovalDecisionInput,
): Promise<ApprovalRequest>;

// packages/governance/src/cancelApprovalRequest.ts — new: the governed cancellation command
export async function cancelApprovalRequest(
  db: Queryable,
  access: TenantAccessEvaluator,
  input: CancelApprovalRequestInput,
): Promise<ApprovalRequest>;

// packages/governance/src/resumeApprovedRequest.ts
export async function resumeApprovedRequest(
  db: Queryable,
  approvalRequestId: string,
): Promise<boolean>; // false = already resumed by someone else (exactly-once gate)

// packages/governance/src/recovery.ts
export async function reconcileGovernanceRuntime(
  db: Queryable,
): Promise<ReconcileGovernanceResult>;
```

```ts
// packages/workflow-engine/src/approvalIntegration.ts (new — workflow-engine owns these)
export async function enterWaitingForApproval(
  db: Queryable,
  workflowStepId: string,
): Promise<boolean>;
export async function resumeWorkflowStepAfterApproval(
  db: Queryable,
  workflowStepId: string,
  output: unknown,
): Promise<boolean>;
export async function rejectWorkflowStepApproval(
  db: Queryable,
  workflowStepId: string,
  reason: StepError,
): Promise<boolean>;
export async function expireWorkflowStepApproval(
  db: Queryable,
  workflowStepId: string,
): Promise<boolean>;
export async function cancelWorkflowStepApproval(
  db: Queryable,
  workflowStepId: string,
): Promise<boolean>;

// packages/workflow-engine/src/reconcileWorkflowRunOutcome.ts (new — §10a, resolves the Phase 3 gap)
export async function reconcileWorkflowRunOutcome(
  db: Queryable,
  workflowRunId: string,
): Promise<{ changed: boolean; outcome: WorkflowStatus | null }>;
```

None of `workflow-engine`'s functions above import or query anything from
`governance`'s schema — every parameter is a plain primitive, and
`governance`'s orchestration functions are the callers that gather
already-resolved data (§10 of the design doc). `reconcileWorkflowRunOutcome`
derives run state purely from `workflow_steps`/`workflow_runs` — no
governance-specific logic lives in `workflow-engine`, and no workflow-state
derivation logic lives in `governance`.

## Governed action catalog and policy documents

`packages/governance/src/actionCatalog.ts` exports a closed
`GovernedActionSchema` Zod enum (the 19 named actions), with a documented
(unimplemented) extension contract for a future registry-backed validator
once vertical-namespaced actions are needed (Phase 11) — see design doc
§3a. `packages/governance/src/policyDocument.ts` exports the Zod schemas
for `policy_document`/`override_document` content, including a small,
pure, recursive condition language (`all`/`any`/comparison clauses) — no
`eval`, no model call, fully deterministic (§3b–c) — and the corrected
`EFFECT_PRECEDENCE = ["BLOCK", "DENY", "ESCALATE", "REQUIRE_APPROVAL", "ALLOW"]`
ranking (§4a).

## Contract extensions (confirmed additive; compatibility tests required)

- `packages/agent-runtime/src/executionResult.ts`: `AgentExecutionResult`
  gains `intendedAction`, `selfAssessedRiskLevel`, `requestedCapabilities`
  — all additive with defaults, structured and typed (no unbounded
  metadata bag), a backward-compatible extension of a runtime
  (non-versioned) contract. A compatibility test parses a pre-Phase-4-shaped
  payload and confirms the defaults fill in correctly (§9, §15).
- `packages/workflow-engine/src/manifest.ts`: `WorkflowStepDefinitionSchema`
  gains an optional `governedAction` field (`GovernedAction | "*" | null`,
  default `null`). A compatibility test confirms a manifest without this
  field still parses, and that the already-published `client_solution_assessment`
  v1.0.0 row is read back unchanged (§12, §15) — the new, governed step
  (`deliver_external`) ships only in a **new** v1.1.0 version, never as a
  mutation of the published v1.0.0 row.
- `packages/workflow-engine/src/status.ts`: **one additive transition**,
  `WAITING_FOR_APPROVAL -> BLOCKED`, added to the existing run-level
  transition table (§12a) — required to make Decision 4's "expire to
  EXPIRED or BLOCKED per policy" reachable at all. No status added or
  removed; every existing transition unchanged. Phase 4 only ever produces
  `EXPIRED` in practice; `BLOCKED` is schema-supported for a future policy
  field, documented rather than silently narrowed.

## Migrations

- `supabase/migrations/<next-timestamp>_governance_policy_catalog.sql` —
  the **four** platform tables (revised: adds
  `risk_classification_definitions`/`risk_classification_versions` in
  place of the single mutable `risk_classifications` table), RLS
  read-only for `authenticated` scoped to `published` versions, no write
  policy (service-role/owner-only).
- `supabase/migrations/<next-timestamp+1>_tenant_governance_and_approvals.sql`
  — the seven tenant tables, all indexes, RLS reusing
  `is_tenant_member`/`tenant_has_permission`, insertion of the four new
  permission keys (`tenant.view_approvals`, `tenant.decide_approvals`,
  `tenant.manage_policies`, `tenant.view_governance_events`) into the
  existing `permissions` catalog. **Revised per review:** `approval_requests`
  and `approval_decisions` get **select-only** RLS — no insert, update, or
  delete policy for either table, under any permission. All mutation
  (creation, decisions, resumption, cancellation) happens exclusively
  through `governance`'s application commands over the trusted
  service-role/owner connection.
- Matching rollback files under `supabase/migrations_rollback/`.

Apply order: platform catalog, then tenant governance/approvals (tenant
tables reference the platform tables, plus `approval_requests` references
Phase 3's already-existing `workflow_steps`). Roll back in reverse. The
`status.ts` transition-table addition is a code change, not a migration.

## Complete RLS policy outline

See `PHASE_4_GOVERNANCE_APPROVALS.md` §2 for the literal SQL for every
table. Summary: platform tables read-only for any authenticated user (draft
versions never visible); tenant configuration tables
(`tenant_policy_assignments`, `tenant_policy_overrides`,
`approval_assignments`) use the standard select-member/write-admin pair
gated on `tenant.manage_policies`; **`approval_requests` and
`approval_decisions` are select-only for holders of `tenant.view_approvals`
or `tenant.decide_approvals` — no write policy of any kind**; the two
append-only audit tables (`policy_evaluations`, `governance_events`) are
select-only for `tenant.view_governance_events` holders, also with no
write policy at all.

## Tenant governance/approval test cases

Against real local Postgres, restricted `authenticated` role, mirroring the
exact pattern proven in Phases 2 and 3 — see
`PHASE_4_GOVERNANCE_APPROVALS.md` §15 for the complete test matrix (this
file does not duplicate it). Highlights specific to this phase's new
concerns: separation-of-duties rejection, distinct-approver enforcement,
quorum with `requiredApprovalCount > 1`, supersession on payload-hash
change, exactly-once resume under concurrent recovery, **direct client
mutation attempts against `approval_requests`/`approval_decisions`
explicitly rejected**, **run auto-completion for every baseline behavior**
(all-succeeded, hard failure, rejection, expiration, cancellation,
concurrency safety, idempotent no-op), and the full reference-workflow
approval integration through the new `deliver_external` step to
`COMPLETED`.

## Superseded

The Phase 3 content previously in this file is superseded by this Phase 4
revision for the purpose of "what does this file currently describe" — it
remains accurate historical record in git history and
`PHASE_3_WORKFLOW_RUNTIME.md`'s completion summary, not restated here.
