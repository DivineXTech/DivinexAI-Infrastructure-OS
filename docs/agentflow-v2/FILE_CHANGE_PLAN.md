# File Change Plan — Phase 2: Agent Runtime Contracts and Registry

**Status: Proposal only. No runtime code has been written from this plan.**
Stopping for review before implementation, per instruction.

## Sequencing within Phase 2

1. Reconcile `AgentStatusSchema` with the agreed 8-stage lifecycle — nothing
   else in this phase should be built against the old 5-state enum.
2. Agent registry (in-memory + Postgres-backed) and its migration.
3. Six agent manifests (`DEFINED`/`REGISTERED` only — none reach `ACTIVE`).
4. A minimal mock executor, just enough to reach `MOCK_EXECUTABLE` per agent
   — not the real model gateway (that's Phase 5); a stub that accepts an
   `AgentExecutionContext` and returns a canned, schema-valid
   `AgentExecutionResult`, proving the manifest/context/result wiring
   end-to-end without depending on any provider.
5. Tests for all of the above, including cross-tenant isolation on the new
   migration.

## 1. `packages/agent-runtime/src/manifest.ts` (modify, not rewrite)

Replace:

```ts
export const AgentStatusSchema = z.enum(["draft", "evaluating", "active", "deprecated", "disabled"]);
```

with:

```ts
export const AgentStatusSchema = z.enum([
  "DEFINED",
  "REGISTERED",
  "MOCK_EXECUTABLE",
  "EVALUATION_TESTED",
  "TOOL_ENABLED",
  "APPROVAL_GOVERNED",
  "ACTIVE",
  "SUSPENDED",
]);
```

Add a deterministic transition table analogous to
`packages/workflow-engine/src/status.ts`'s (`isValidAgentStatusTransition`,
`assertValidAgentStatusTransition`, `InvalidAgentStatusTransitionError`) —
`ACTIVE` reachable only via the full ordered sequence; `SUSPENDED` reachable
from any state after `REGISTERED`; no state skips backward except into
`SUSPENDED`. Existing tests in `test/manifest.test.ts` that reference the
old enum values (`"draft"`, `"unknown-status"` as a rejection case) need
updating to the new vocabulary — this is a breaking change to that file,
scoped and expected, not an accidental regression.

## 2. `packages/agent-runtime/src/registry.ts` (new)

```ts
export interface AgentRegistry {
  register(manifest: AgentManifest): Promise<void>;
  get(id: string): Promise<AgentManifest | null>;
  list(tenantId: string | null): Promise<AgentManifest[]>;
  transitionStatus(id: string, to: AgentStatus): Promise<void>; // uses assertValidAgentStatusTransition
}
```

A Postgres-backed implementation (`PgAgentRegistry`), built on the same
`Queryable` interface pattern as `packages/shared/src/db.ts` — proposed
re-export or duplication of `Queryable` needs a decision at implementation
time (likely: `packages/agent-runtime` takes a dependency on
`packages/shared` for `Queryable` only, per `CAPABILITY_PACKAGE_MAPPING.md`'s
"move only with clear ownership" rule — this is a narrow, justified new
inter-package dependency, not a broad refactor).

## 3. `packages/agent-runtime/src/agents/{sara,nova,forge,guardian,reven,pulse}.ts` (new)

Six manifest definitions, `status: "DEFINED"` initially. Governance rules
from the brief become `prohibitedActions` entries and `approvalPolicy`
content, e.g.:

- **Sara** — `prohibitedActions: ["deploy_code", "change_billing", "transfer_money", "alter_security_policy"]`
- **Nova** — `prohibitedActions: ["approve_restricted_business_action"]`
- **Forge** — `prohibitedActions: ["deploy_to_production_without_approval", "expose_or_rotate_secrets"]`
- **Guardian** — `capabilities` include a hard veto on critical-risk steps; `prohibitedActions: ["silently_rewrite_business_requirements"]`
- **Reven** — `prohibitedActions: ["modify_billing", "issue_refund", "move_funds"]`, all gated by `approvalPolicy`
- **Pulse** — `prohibitedActions: ["publish_external_claim_automatically"]`, output distinguishes verified/estimated/inferred (a shape decision for its `outputSchema`)

Each validated via `validateAgentManifest` in its own test file.

## 4. `packages/agent-runtime/src/mockExecutor.ts` (new)

A minimal `MockAgentExecutor` — accepts a manifest + `AgentExecutionContext`,
returns a schema-valid `AgentExecutionResult` with `status: "completed"` and
a canned summary referencing the manifest's `id`. Exists only to prove an
agent can reach `MOCK_EXECUTABLE` and that the context/result contracts
wire together end-to-end — explicitly not a model gateway, no provider
call, no real reasoning.

## 5. Migration: `supabase/migrations/<next-timestamp>_agents.sql` (new)

Per Resolution 1: reuses the existing tenancy model exactly.

```sql
create table agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants (id) on delete cascade, -- null = platform-provided agent, available to every tenant
  key text not null,               -- stable id, e.g. "sara"
  display_name text not null,
  status text not null,            -- mirrors AgentStatusSchema; check constraint enumerates the 8 values
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table agent_versions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents (id) on delete cascade,
  version text not null,
  manifest jsonb not null,          -- serialized metadata (NOT inputSchema/outputSchema — those stay code-side)
  created_at timestamptz not null default now(),
  unique (agent_id, version)
);

create table agent_capabilities (
  agent_version_id uuid not null references agent_versions (id) on delete cascade,
  capability text not null,
  primary key (agent_version_id, capability)
);

create table agent_tool_permissions (
  agent_version_id uuid not null references agent_versions (id) on delete cascade,
  tool_id text not null,            -- references tool_definitions once Phase 5 exists; text for now, FK added then
  primary key (agent_version_id, tool_id)
);

create table agent_knowledge_sources (
  agent_version_id uuid not null references agent_versions (id) on delete cascade,
  knowledge_source_id text not null, -- references knowledge_sources once Phase 6 exists
  primary key (agent_version_id, knowledge_source_id)
);
```

RLS: enabled on all five tables, reusing `is_tenant_member`/
`tenant_has_permission` exactly as `ADR-0013` §1 requires — no new
authorization mechanism. `agents.tenant_id is null` (platform-provided
agents like the six initial ones, if registered platform-wide rather than
per-tenant — **open question for implementation time**: are Sara/Nova/etc.
platform-wide (`tenant_id null`) or must each tenant register its own copy?
The brief's phrasing ("the first active agents are...") reads as
platform-wide, but this needs an explicit decision before the migration is
finalized, not an assumption).

## 6. Rollback: `supabase/migrations_rollback/<next-timestamp>_agents_rollback.sql` (new)

Drops the five tables and their policies, in FK-safe order, mirroring the
existing rollback files' structure.

## 7. Tests (new)

- `packages/agent-runtime/test/agentStatus.test.ts` — transition table
  (valid/invalid transitions, `ACTIVE` unreachable except via full sequence).
- `packages/agent-runtime/test/registry.test.ts` — register/get/list,
  `transitionStatus` rejects invalid transitions.
- `packages/agent-runtime/test/agents/*.test.ts` — one per initial agent,
  validates its manifest.
- `packages/agent-runtime/test/mockExecutor.test.ts` — returns a schema-valid
  result for a valid context.
- A new cross-tenant isolation test file (pattern from
  `packages/shared/test/tenant-isolation.test.ts`) proving a tenant sees only
  its own tenant-scoped agent rows (and every tenant sees platform-wide ones,
  once the open question above is resolved).

## Open question surfaced by this plan

Whether the six initial agents are platform-wide (`tenant_id null`,
available to every tenant) or per-tenant instances each tenant must
register — this changes both the migration's data shape and the registry's
`list`/`get` semantics, and should be resolved before Phase 2 implementation
starts, not defaulted silently.
