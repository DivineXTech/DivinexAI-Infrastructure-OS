# ADR-0008: Approval Architecture

**Status:** Direction accepted at Phase 0; concrete design finalized at the
Phase 4 planning gate (addendum below, unimplemented pending review — see
`../PHASE_4_GOVERNANCE_APPROVALS.md` for the full design this addendum
summarizes).

## Context

Sensitive actions (financial, destructive, permission-changing, external
publication) require human approval by default (§XI), and access/permission
decisions must be deterministic rather than AI-authored (rule #14).

## Decision

- Approval policy evaluation (`policy_evaluations`) is a deterministic rules
  engine over structured inputs (tenant, department, agent, tool, action
  type, financial threshold, data classification, risk score) — not an LLM
  call. AI may help _classify_ risk (e.g., summarizing why an action looks
  risky) but the pass/fail gate itself is code, not a model response.
- Tool risk classification (read-only, low-risk write, financial action,
  destructive action, permission change, external publication, irreversible
  action — §IX) drives a safe-default policy table that requires approval
  for every category the brief lists as requiring it by default, before any
  tenant-specific override can loosen that.
- `AgentPolicyEvaluator` (ADR referenced from `../IMPLEMENTATION_PLAN.md`
  §4) is the single code path both the workflow engine and the tool
  execution pipeline call — there is exactly one place approval logic
  lives, not one per module.
- Sara is subject to the identical evaluator — no Sara-specific bypass
  (`RISK_REGISTER.md` #4).

## Consequences

- Tenant policy overrides can only _tighten_ the safe defaults unless
  explicitly marked as an authorized loosening, auditable via
  `policy_versions`.
- A single shared evaluator becomes a hot path that must be well-tested
  (`policy evaluation` unit tests, §XVIII) since every sensitive action in
  the system depends on it behaving correctly.

## Addendum (Phase 4 planning gate): concrete package, contracts, and integration

The direction above is now a concrete design. Recorded here rather than a
new ADR, since it's the same decision ("deterministic rules engine, not an
LLM, is the approval authority") reaching its detailed form.

- **New package `packages/governance`** owns policy definitions/versions,
  evaluation, risk classification, approval requests/decisions/assignments,
  separation of duties, escalation, and governance events — the full list
  in `PHASE_4_GOVERNANCE_APPROVALS.md` §0. `packages/shared/src/policy.ts`'s
  `PgTenantAccessEvaluator` is **reused, not replaced** — it answers "does
  this actor hold permission key X in this tenant" (unchanged since Phase
  1), which `governance`'s functions call before doing anything else,
  exactly as `agent-runtime`/`workflow-engine` already do. `governance`
  adds a materially richer capability on top: evaluating versioned,
  structured policy documents against runtime context to produce one of
  five effects, and running the resulting approval workflow — a different
  concern from "is this a member with this permission key," not a
  duplicate of it.
- **Deterministic policy evaluation** is a pure function of (published
  policy version rows applicable to the tenant/action + tenant overrides +
  the workflow step's own `approvalRequired` floor + runtime context) →
  `PolicyDecision`. No model call anywhere in this path — an agent's own
  `selfAssessedRiskLevel` (new, advisory-only field on
  `AgentExecutionResult`) can inform which conditions match, but never
  substitutes for the evaluator's own classification, and can never itself
  produce `ALLOW`.
- **Immutable action snapshots** bind an approval request to the exact
  proposed action, so a changed proposal cannot be authorized by a
  stale approval — enforced by a content hash (`platform-kernel`'s
  `computeContentHash`) and automatic supersession.
- **Exactly-once resumption** reuses the same atomic-conditional-UPDATE
  pattern Phase 3 built for step leasing (`ADR-0004`'s addendum): a
  `continuation_committed` flag flips exactly once via a status-and-flag-
  gated `UPDATE`, and `workflow-engine`'s own step-status transition
  (`WAITING_FOR_APPROVAL → RUNNING → SUCCEEDED`, both already-legal
  transitions from Phase 3 — no change to `stepStatus.ts` was needed) is
  itself gated on the step's current status, giving two independent
  idempotency gates at each layer.
- **No new authorization mechanism.** `tenant.decide_approvals`,
  `tenant.manage_policies`, `tenant.view_approvals`,
  `tenant.view_governance_events` are ordinary permission keys checked via
  the existing `is_tenant_member`/`tenant_has_permission` RLS helpers and
  `PgTenantAccessEvaluator` — identical to every prior phase.

## Related

- `ADR-0004` (and its Phase 3 addendum) — the leasing/exactly-once pattern
  this design reuses for approval resumption.
- `ADR-0013` — package taxonomy; `governance` was already a named canonical
  package, first populated here.
- `../PHASE_4_GOVERNANCE_APPROVALS.md` — full design.
