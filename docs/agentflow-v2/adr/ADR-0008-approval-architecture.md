# ADR-0008: Approval Architecture

**Status:** Proposed — to be implemented in Phase 6

## Context

Sensitive actions (financial, destructive, permission-changing, external
publication) require human approval by default (§XI), and access/permission
decisions must be deterministic rather than AI-authored (rule #14).

## Decision

- Approval policy evaluation (`policy_evaluations`) is a deterministic rules
  engine over structured inputs (tenant, department, agent, tool, action
  type, financial threshold, data classification, risk score) — not an LLM
  call. AI may help *classify* risk (e.g., summarizing why an action looks
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

- Tenant policy overrides can only *tighten* the safe defaults unless
  explicitly marked as an authorized loosening, auditable via
  `policy_versions`.
- A single shared evaluator becomes a hot path that must be well-tested
  (`policy evaluation` unit tests, §XVIII) since every sensitive action in
  the system depends on it behaving correctly.
