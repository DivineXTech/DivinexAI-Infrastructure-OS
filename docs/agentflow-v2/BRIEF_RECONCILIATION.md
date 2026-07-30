# AgentFlow Pro Brief Reconciliation

A later brief ("Principal Platform Architect... implementing AgentFlow Pro")
described an architecture that conflicted with decisions already made and
built in this repository. This document records how the two were
reconciled, per explicit direction, so neither the original ADRs nor this
newer brief's requirements get silently dropped or duplicated.

## Decision 1: Tenancy model

**Kept as-is.** The live schema (`tenants`, `tenant_memberships`, `ADR-0003`)
is not renamed or restructured. "Organization" is the external/display term
for the existing tenant concept — there is no separate `organizations` or
`workspaces` table. Application-level contracts use `tenantId` (matching the
real `tenant_id` column), not `organizationId`, to keep one consistent
vocabulary between the schema and the code that reads it. Fields the newer
brief specified as `workspaceId` are modeled as nullable/reserved (e.g. in
`AgentExecutionContext`) rather than fabricated against a table that doesn't
exist.

## Decision 2: Package taxonomy

**Kept as-is.** `ADR-0001`'s eight packages remain canonical:
`agent-runtime`, `memory-engine`, `tool-registry`, `workflow-engine`,
`governance`, `sara`, `vertical-os-sdk`, `observability`. No new ADR was
needed since the package decision itself didn't change — only how newer
capability names map onto it. Canonical mapping:

| Newer brief's capability area | Lives in |
|---|---|
| Contracts (agent manifest, execution context/result) | `agent-runtime` |
| Agents (registry, manifests) | `agent-runtime` |
| Model gateway (provider adapters) | `agent-runtime` |
| Orchestration | `workflow-engine` |
| Workflows (registry, state machine, execution ledger) | `workflow-engine` |
| Tool gateway | `tool-registry` |
| Memory (working/episodic/semantic) | `memory-engine` |
| Policies (deterministic evaluation) | `governance` |
| Approvals | `governance` |
| Security controls | `governance`, with shared security utilities where a clear cross-cutting need exists |
| Evaluations | `observability` |
| Observability (traces, cost, usage) | `observability` |
| Database | schema lives in `supabase/migrations/`; each package owns the query code for its own tables rather than a monolithic `packages/database` |

`packages/shared` is **not** being turned into a dumping ground for new
work: existing code there (tenancy types, Supabase clients, tenant
authorization helpers, the deterministic `PgTenantAccessEvaluator`, feature
flags, tenant settings, audit/security event recording) stays put — moving
it is deferred until a concrete package (e.g. `governance`) actually needs to
own a piece of it, per explicit instruction to avoid a broad refactor this
phase. New code for the newer brief's agent/workflow/tool/memory/governance
concerns goes directly into the eight canonical packages from the start.

## Naming note carried into code

`packages/agent-runtime/src/executionContext.ts` documents the `tenantId`/
`workspaceId` decision inline, so a future reader of just that file (without
this document) still understands why the field names don't match the
brief's literal `organizationId`/`workspaceId` prose.

## Still open: the Phase 2 gate

Before this reconciliation, Phase 2 (agent-runtime implementation) was
explicitly gated behind live Supabase validation
(`PHASE_1_SUPABASE_VALIDATION.md`), which remains **not executed** — no live
Supabase project is available in this environment. The newer brief's own
Increment 1 ("contracts, agent manifest, statuses, and validation") is pure
TypeScript/Zod work with zero database or Supabase runtime dependency, so it
was implemented now without waiting on that gate — see
`PHASE_1_AGENT_WORKFLOW_CONTRACTS.md`.

Everything from Increment 2 onward (database migrations for
`agents`/`agent_versions`/`workflow_runs`/etc., an actual agent registry,
workflow persistence, a model gateway calling even a mock provider, a tool
gateway, a durable worker) is exactly the kind of runtime-coupled work the
Phase 2 gate was written for. This is flagged as an open question rather
than decided unilaterally — see the accompanying chat response.
