# File Change Plan — Phase 4: Governance, Policies, Risk Decisions, and Human Approvals

**Status: Planning gate. Nothing below has been implemented.** This
supersedes the Phase 3 content that previously occupied this file (Phase 3
itself is complete and committed; its file-change plan is now historical,
recorded at the commits referenced in `PHASE_3_WORKFLOW_RUNTIME.md`'s
completion summary). Full design rationale lives in
`PHASE_4_GOVERNANCE_APPROVALS.md`; this file is the file-change-plan
excerpt of that document.

## Model, in one sentence

A new `packages/governance` evaluates versioned, structured policy
documents deterministically against a governed action, producing one of
five effects; when the effect is `REQUIRE_APPROVAL`, it creates an
immutable approval request bound to the exact proposed action, collects
one or more authorized decisions under separation-of-duties and
distinct-approver rules, and — exactly once — tells `workflow-engine` to
resume, reject, expire, or cancel the waiting step, without
`workflow-engine` ever deciding whether approval was required or
`agent-runtime` ever re-running anything.

## New package: `packages/governance`

Package layout mirrors `workflow-engine`'s Phase 3 structure exactly (own
`package.json`/`tsconfig.json`/`eslint.config.js`/`vitest.config.ts`,
dependencies on `@repo/shared` and `@repo/platform-kernel`, no dependency
on `agent-runtime` or `workflow-engine` — those call _into_ `governance`,
not the reverse). See `PHASE_4_GOVERNANCE_APPROVALS.md` §13 for the full
file tree.

## New/revised table definitions

See `PHASE_4_GOVERNANCE_APPROVALS.md` §1 for full DDL. Summary:

**Platform-owned (no `tenant_id`):** `policy_definitions`, `policy_versions`
(same immutable-once-published pattern as `agent_versions`/
`workflow_versions`, plus `priority`/`mandatory`/`override_policy` columns
driving precedence), `risk_classifications` (a simple, non-versioned
platform default-risk-per-action catalog — service-role-writable only,
deliberately not versioned like `policy_versions`; see §16 blocker #1).

**Tenant-owned (`tenant_id NOT NULL` everywhere):** `tenant_policy_assignments`
(installation row, mirrors `tenant_agents`/`tenant_workflows`),
`tenant_policy_overrides` (tenant-authored tightening deltas only — the
schema has no field capable of loosening an effect or reducing a
requirement), `policy_evaluations` (append-only audit of every evaluation
performed), `approval_requests` (the durable gate, with a partial unique
index guaranteeing exactly one active request per workflow step),
`approval_decisions` (append-only, distinct-approver-enforced via a unique
constraint), `approval_assignments` (who may decide), `governance_events`
(append-only audit ledger, no sequence counter — see §1's rationale for
why this differs from `workflow_execution_events`).

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
): Promise<PolicyDecision>;

// packages/governance/src/createApprovalRequest.ts
export async function createApprovalRequest(
  db: Queryable,
  input: CreateApprovalRequestInput,
): Promise<{
  request: ApprovalRequest;
  created: boolean;
  superseded: string | null;
}>;

// packages/governance/src/recordApprovalDecision.ts
export async function recordApprovalDecision(
  db: Queryable,
  access: TenantAccessEvaluator,
  input: RecordApprovalDecisionInput,
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
export async function syncRunStatusWithSteps(
  db: Queryable,
  workflowRunId: string,
): Promise<void>;
```

None of `workflow-engine`'s functions above import or query anything from
`governance`'s schema — every parameter is a plain primitive, and
`governance`'s orchestration functions are the callers that gather
already-resolved data (§10 of the design doc).

## Governed action catalog and policy documents

`packages/governance/src/actionCatalog.ts` exports a closed
`GovernedActionSchema` Zod enum (the 19 named actions), with a documented
(unimplemented) extension contract for a future registry-backed validator
once vertical-namespaced actions are needed (Phase 11) — see design doc
§3a. `packages/governance/src/policyDocument.ts` exports the Zod schemas
for `policy_document`/`override_document` content, including a small,
pure, recursive condition language (`all`/`any`/comparison clauses) — no
`eval`, no model call, fully deterministic (§3b–c).

## Contract extensions (flagged for explicit sign-off)

- `packages/agent-runtime/src/executionResult.ts`: `AgentExecutionResult`
  gains `intendedAction`, `selfAssessedRiskLevel`, `requestedCapabilities`
  — all additive with defaults, a backward-compatible extension of a
  runtime (non-versioned) contract. See design doc §9 for why this is what
  makes exactly-once resumption possible without re-invoking the agent.
- `packages/workflow-engine/src/manifest.ts`: `WorkflowStepDefinitionSchema`
  gains an optional `governedAction` field (`GovernedAction | "*" | null`,
  default `null`). See design doc §12 for the implementation gotcha this
  introduces for reading pre-Phase-4 manifest rows.

## Migrations

- `supabase/migrations/<next-timestamp>_governance_policy_catalog.sql` —
  the three platform tables, RLS read-only for `authenticated` scoped to
  `published` policy versions (and unrestricted read for
  `risk_classifications`), no write policy (service-role/owner-only).
- `supabase/migrations/<next-timestamp+1>_tenant_governance_and_approvals.sql`
  — the seven tenant tables, all indexes, RLS reusing
  `is_tenant_member`/`tenant_has_permission`, insertion of the four new
  permission keys (`tenant.view_approvals`, `tenant.decide_approvals`,
  `tenant.manage_policies`, `tenant.view_governance_events`) into the
  existing `permissions` catalog. `approval_requests` gets **asymmetric**
  per-command RLS (no insert policy at all; update policy for
  deciders/cancellers) — the first table in this codebase needing that
  shape, flagged explicitly in the design doc §16 blocker #3.
- Matching rollback files under `supabase/migrations_rollback/`.

Apply order: platform catalog, then tenant governance/approvals (tenant
tables reference the platform tables, plus `approval_requests` references
Phase 3's already-existing `workflow_steps`). Roll back in reverse.

## Complete RLS policy outline

See `PHASE_4_GOVERNANCE_APPROVALS.md` §2 for the literal SQL for every
table. Summary: platform tables read-only for any authenticated user (draft
policy versions never visible); tenant tables use the standard
select-member/write-admin pair gated on `tenant.manage_policies` for
assignments/overrides/assignments, `tenant.view_approvals`/
`tenant.decide_approvals` for the approval request/decision pair (with
`approval_requests` split into separate select/update policies and no
insert policy), and `tenant.view_governance_events` for the two append-only
audit tables (`policy_evaluations`, `governance_events`), neither of which
has any write policy at all.

## Tenant governance/approval test cases

Against real local Postgres, restricted `authenticated` role, mirroring the
exact pattern proven in Phases 2 and 3 — see
`PHASE_4_GOVERNANCE_APPROVALS.md` §15 for the complete test matrix (this
file does not duplicate it). Highlights specific to this phase's new
concerns: separation-of-duties rejection, distinct-approver enforcement,
quorum with `requiredApprovalCount > 1`, supersession on payload-hash
change, exactly-once resume under concurrent recovery, and the full
reference-workflow approval integration through the new `deliver_external`
step.

## Superseded

The Phase 3 content previously in this file is superseded by this Phase 4
revision for the purpose of "what does this file currently describe" — it
remains accurate historical record in git history and
`PHASE_3_WORKFLOW_RUNTIME.md`'s completion summary, not restated here.
