# ADR-0009: Observability Strategy

**Status:** Proposed — to be implemented incrementally from Phase 2 onward

## Context

Every agent run, tool execution, memory operation, workflow event, and
approval decision must be traceable and correlate across tenant/user/agent/
workflow/tool/provider IDs (§XIV), without ever leaking secrets, raw
prompts, or protected data into logs (rule #10).

## Decision

- A shared `packages/observability` module defines the event shapes (agent
  run/step, tool execution, memory retrieval/write, workflow event, policy
  evaluation, approval decision) and a single structured-logging helper that
  every other package calls — no package writes its own ad hoc log format.
- Every event carries the correlation IDs listed in §XIV (tenant, user,
  agent, agent version, workflow instance, tool execution, approval
  request, memory retrieval, provider, request/trace ID) as first-class
  fields, not embedded in a free-text message.
- The logging helper redacts known-sensitive field names (credentials,
  tokens, raw prompt content flagged as containing protected data) by
  default, consistent with ADR-0007 and `RISK_REGISTER.md` #10.
- Cost/latency/token-usage metrics are recorded per run/step, enabling the
  cost tracking required by the workflow and tool modules (§X, §IX) and the
  executive briefing's data-freshness/confidence reporting (§XII).

## Consequences

- Every new module (memory engine, tool registry, workflow engine, Sara)
  depends on `packages/observability` from its first commit rather than
  bolting on logging later — slightly more upfront wiring, avoided
  inconsistent ad hoc logging across modules.
- A dedicated APM/tracing backend (e.g. OpenTelemetry exporter target) is
  not chosen in this ADR — the event shape is decoupled from where it's
  shipped, so that choice can be made or changed later without touching
  business code.
