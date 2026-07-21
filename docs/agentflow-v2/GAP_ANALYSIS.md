# Gap Analysis — AgentFlow Pro v2 Capabilities

Classification legend (per brief §IV): **Already implemented** · **Partially
implemented** · **Missing** · **Duplicated** · **Unsafe** · **Deprecated** ·
**Suitable for reuse**

At Phase 0 the repository had no code (`REPOSITORY_AUDIT.md`), so every
capability was **Missing** by definition. Rows below are updated in place as
each phase lands (Phase 1's two increments so far), so nothing in the
original brief gets silently dropped or re-derived from scratch.

## Core capabilities (brief, top-level list)

| # | Capability | Status |
|---|---|---|
| 1 | Model-neutral agent runtime | Missing |
| 2 | Secure Business Memory Engine | Missing |
| 3 | Centralized Tool Registry | Missing |
| 4 | Durable Workflow Engine | Missing |
| 5 | Sara Executive Intelligence | Missing |
| 6 | Human approval controls | Missing — deterministic permission evaluator exists (Phase 1) as a prerequisite building block; approval request/decision workflow itself is Phase 6 |
| 7 | Multi-tenant security | **Partially implemented** — core schema + RLS, audit/security event logging (Phase 1); no agent/tool/workflow layer to secure yet |
| 8 | Enterprise observability | Missing — `audit_events`/`security_events` base schema exists (Phase 1) as a prerequisite; full observability layer (traces, cost/latency, evaluation harness) is Phase 9 (`ADR-0009`) |
| 9 | Reusable vertical OS integration | Missing |
| 10 | Provider portability | Missing |

## Domain model groups (§V)

| Group | Tables specified | Status |
|---|---|---|
| Core tenancy | tenants, tenant_memberships, roles, permissions, role_permissions, tenant_settings, tenant_feature_flags | **Implemented** (Phase 1, `PHASE_1_TENANCY.md`) — schema + RLS live and tested against real Postgres; not yet verified against a live Supabase project (residual risk) |
| Agent runtime | agent_definitions, agent_versions, agent_instances, agent_sessions, agent_messages, agent_runs, agent_run_steps, agent_assignments, agent_capabilities, agent_policies, provider_configs, provider_routing_rules | Missing |
| Business memory | memory_sources, memory_documents, memory_chunks, memory_facts, memory_entities, memory_relationships, memory_events, memory_summaries, memory_access_policies, memory_retention_policies, memory_ingestion_jobs, memory_retrieval_logs, memory_feedback, memory_versions | Missing |
| Tool registry | tool_definitions, tool_versions, tool_connections, tool_credentials, tool_permissions, tool_execution_policies, tool_executions, tool_execution_attempts, tool_webhooks, tool_rate_limits | Missing |
| Workflow engine | workflow_definitions, workflow_versions, workflow_instances, workflow_steps, workflow_step_runs, workflow_triggers, workflow_schedules, workflow_conditions, workflow_variables, workflow_events, workflow_failures, workflow_compensations | Missing |
| Governance | approval_requests, approval_decisions, policy_definitions, policy_versions, policy_evaluations, audit_events, security_events, data_access_events | **Partially implemented** (Phase 1 increment 2, `PHASE_1_AUTHZ_AUDIT_FLAGS.md`) — `audit_events`, `security_events` exist with read-only RLS; a deterministic permission evaluator (`PgTenantAccessEvaluator`) exists as a building block. `approval_requests`, `approval_decisions`, `policy_definitions`, `policy_versions`, `policy_evaluations`, `data_access_events` remain Missing — full governance/approval workflow is Phase 6 (`ADR-0008`) |
| Sara Executive Intelligence | executive_briefings, executive_signals, executive_recommendations, executive_risks, executive_opportunities, executive_metrics, executive_decisions, executive_action_items | Missing |

## Modules (§VI–XIV)

| Module | Status | Note |
|---|---|---|
| Model-neutral agent runtime + interfaces | Missing | Stack decided (`ADR-0001`); not started — Phase 2 |
| Google ADK adapter | Missing | Must land behind a feature flag; cannot be built before the base `AgentProvider` interface exists |
| Multi-agent coordination patterns | Missing | Depends on agent runtime |
| Structured output validation | Missing | Validation library decided (Zod, `ADR-0001` addendum); not yet applied to agent/tool outputs — Phase 2+ |
| Business Memory Engine (all 6 memory classes) | Missing | Depends on database + vector store decision |
| Memory trust states / lifecycle | Missing | — |
| Memory Intelligence Layer (summaries, risk/opportunity detection) | Missing | Depends on Memory Engine + deterministic metrics layer |
| Centralized Tool Registry | Missing | Initial adapters (Gmail, Stripe, etc.) need credentials or explicit mock-adapter scope |
| Durable Workflow Engine | Missing | Needs a durable backend decision (queue/orchestrator) — see ADR in `IMPLEMENTATION_PLAN.md` |
| Approval & Governance Layer | Missing | — |
| Sara Executive Intelligence + command center | Missing | Must be built as a normal agent under the same permission system, not a superuser |
| Vertical OS extension contract | Missing | `-MediaForgeOS` repo (same org) may carry relevant prior art — not yet inspected |
| Observability layer | Missing | Needs tracing/logging stack decision |
| Security controls (§XV) | Missing | None violated yet since no code exists; all must be built in from the first commit, not retrofitted |

## Conclusion

Nothing here is duplicated or contradicts the brief, because nothing exists.
The practical implication for Phase 1 is that the *sequencing* in §XX is safe
to follow as written — there's no legacy system whose migration order would
override it. The one real prerequisite is the stack decision flagged in
`IMPLEMENTATION_PLAN.md`, since agent runtime, memory engine, and workflow
engine interfaces all need a concrete language/framework to be written in
actual code rather than pseudocode.
