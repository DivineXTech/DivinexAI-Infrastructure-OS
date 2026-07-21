# ADR-0002: Google ADK Integration Boundary

**Status:** Proposed — to be implemented in Phase 2

## Context

AgentFlow Pro must remain a model-neutral orchestration layer. Google Agent
Development Kit (ADK) may be integrated where it accelerates development or
improves orchestration/observability, but the source brief is explicit that
it must never become a hard dependency, global source of truth, or the only
way agents run.

## Decision

ADK is implemented as exactly one more `AgentProvider` under
`packages/agent-runtime/providers/google-adk/`:

- No package outside `providers/google-adk/` may import the ADK SDK. Enforced
  by a lint rule restricting that import path, not just documentation.
- Activated per-tenant or platform-wide via `tenant_feature_flags`, off by
  default.
- The adapter translates ADK's run/event model into AgentFlow Pro's own
  `agent_runs` / `agent_run_steps` / observability events at the boundary —
  ADK's internal state is never queried directly by business code, and ADK
  never stores the canonical copy of a run, memory record, tool permission,
  approval, or audit entry.
- Tool calls and memory access from an ADK-run agent still pass through
  `AgentToolResolver`, `AgentMemoryResolver`, and `AgentPolicyEvaluator` —
  identical enforcement to any other provider.
- On ADK unavailability or misconfiguration, the adapter fails the run
  explicitly (a normal `agent_runs` failure state) so the workflow engine can
  route to a fallback provider or human escalation — never a silent hang or
  an unguarded exception that bypasses approval/audit recording.

## Consequences

- Replacing or removing ADK later means deleting one adapter directory and
  disabling a feature flag — no business workflow references ADK by name.
- Slightly more translation code at the boundary than a direct integration
  would need; accepted deliberately as the cost of model neutrality.
