# ADR-0013: AgentFlow Pro Scope Reconciliation & Phase Roadmap

**Status:** Accepted (2026-07-21)

## Context

A later brief describing "AgentFlow Pro" specified an architecture
(organizations/workspaces tenancy, a 13-package taxonomy, a customer-facing
web app to "reuse," a restarted Phase 1, and an unrestricted six-agent
roster) that conflicted with decisions already built and tested in this
repository under `ADR-0001` (stack, package taxonomy) and `ADR-0003`
(tenants/RLS). Rather than let a newer brief silently override or duplicate
earlier, explicitly approved decisions, each conflict was raised as a
blocking question and resolved directly by the repository owner. This ADR
is the formal record of those five resolutions, referenced going forward
instead of re-litigating them per newer brief.

## Decisions

### 1. Tenancy

`tenants` and `tenant_memberships` remain canonical, exactly as built in
`ADR-0003` and `supabase/migrations/20260721000001_core_tenancy.sql`.
"Organization" is product/display terminology only — it does not name a
table, a foreign key, or a code-level type. No `organizations`,
`organization_members`, or `workspaces` table exists or is planned for the
current increment. `tenant_id` remains the ownership key for every
tenant-owned table added in any future phase, reusing the existing RLS
helper functions (`is_tenant_member`, `tenant_has_permission`) rather than a
parallel authorization model. Every new tenant-owned table must ship with a
cross-tenant isolation test, matching the pattern established in
`PHASE_1_TENANCY.md` and `PHASE_1_AUTHZ_AUDIT_FLAGS.md`. A workspace layer
may be proposed later, but only against a concrete requirement for multiple
isolated operational scopes inside one tenant — not speculatively.

### 2. Package taxonomy

The eight packages in `ADR-0001` remain canonical and are not superseded:
`agent-runtime`, `memory-engine`, `tool-registry`, `workflow-engine`,
`governance`, `sara`, `vertical-os-sdk`, `observability`. Newer briefs'
capability names (contracts, agents, model-gateway, orchestration,
workflows, tool-gateway, memory, policies, approvals, security,
evaluations, observability, database) describe capability areas mapped
onto these eight packages, not new top-level packages — see
`CAPABILITY_PACKAGE_MAPPING.md` for the full table. `packages/shared` is not
broadly refactored; existing tested code there stays unless a specific move
has clear ownership and preserves or improves test coverage (see that
document's "On packages/shared" section).

### 3. Applications

No customer-facing web application exists in this repository, and none is
assumed to exist for reuse. None is built during the agent-runtime/registry
increment. The first application, when its own phase is reached, is
`apps/admin` (not `apps/web`); the durable execution process is
`apps/worker`. `ADR-0001`'s Next.js recommendation is not reversed, but its
installation/pinning is deferred until the `apps/admin` increment is
explicitly approved — nothing before that point depends on a frontend
framework being chosen.

### 4. Phase sequence

Phase 0 (repository and architecture foundation) and Phase 1 (tenancy, RLS,
authorization, settings, feature flags, audit events, security events —
three increments, `PHASE_1_TENANCY.md`, `PHASE_1_AUTHZ_AUDIT_FLAGS.md`,
`PHASE_1_AGENT_WORKFLOW_CONTRACTS.md`) are complete and are not restarted or
renumbered. The sequence continues:

- Phase 2 — Agent Runtime Contracts and Registry
- Phase 3 — Workflow Runtime and Durable Execution
- Phase 4 — Governance, Policies, and Approvals
- Phase 5 — Model and Tool Gateways
- Phase 6 — Memory Engine
- Phase 7 — Sara Executive Intelligence
- Phase 8 — Executive Agent Team
- Phase 9 — Evaluation and Observability Expansion
- Phase 10 — Admin Command Center
- Phase 11 — Vertical Agent Pods

`IMPLEMENTATION_PLAN.md` is updated in place to reflect this sequence
rather than maintaining a second, competing master plan.

### 5. Initial agent scope

Sara (Intelligence Director), Nova (Operations Director), Forge (Software
Engineering Agent), Guardian (Security and Compliance Agent), Reven (Revenue
Intelligence Agent), and Pulse (Market Intelligence Agent) are approved as
additive scope — new agents, not a change to any decision above. None may be
activated with unrestricted autonomy. Every agent instance progresses
through a fixed lifecycle:

`DEFINED → REGISTERED → MOCK_EXECUTABLE → EVALUATION_TESTED → TOOL_ENABLED → APPROVAL_GOVERNED → ACTIVE` (or `SUSPENDED` from any post-registration state)

Phase 2 defines and registers all six agents; none reach `ACTIVE` in Phase 2
— executable behavior in that phase uses mock adapters only, consistent
with `MOCK_EXECUTABLE` being reachable well before `ACTIVE`. This lifecycle
supersedes `packages/agent-runtime/src/manifest.ts`'s current
`AgentStatusSchema` (`draft`/`evaluating`/`active`/`deprecated`/`disabled`),
which predates this decision and does not yet implement it — reconciling
the two is the first proposed item of Phase 2 (`FILE_CHANGE_PLAN.md`), not
yet done as of this ADR.

## Consequences

- Every future brief or instruction that touches tenancy, package
  boundaries, applications, phase numbering, or agent activation should be
  checked against this ADR before being implemented as written; a conflict
  is a reason to ask, not to silently pick one side.
- `packages/agent-runtime`'s `AgentStatusSchema` is now known-stale against
  the agreed agent lifecycle and must be updated before any registry code
  references agent status, to avoid two incompatible status vocabularies
  existing simultaneously. (Superseded by the addendum below — the single
  status enum this bullet describes was itself replaced by two separate
  lifecycles before implementation.)
- No new top-level packages, tables, or applications should be created
  under a differently-named brief's vocabulary without first checking
  `CAPABILITY_PACKAGE_MAPPING.md`.

## Addendum: platform-definition / tenant-installation data model (2026-07-21)

§5's single 8-stage `AgentStatusSchema` and a nullable-`tenant_id` `agents`
table (as drafted in the first version of `FILE_CHANGE_PLAN.md`) are
withdrawn before implementation, replaced by an explicit decision:

- **No nullable-`tenant_id` rows represent global/platform agents,
  anywhere.** Platform-owned data (`agent_definitions`, `agent_versions`,
  `agent_capability_definitions`) simply has no `tenant_id` column at all —
  it isn't tenant-owned data with a null tenant, it's a different kind of
  row entirely. Every tenant-owned table (`tenant_agents`,
  `tenant_agent_capabilities`, `agent_tool_permissions`,
  `agent_knowledge_sources`) has `tenant_id NOT NULL`, full stop — no
  exceptions, no nullable-tenant special case.
- Sara, Nova, Forge, Guardian, Reven, and Pulse are each defined **once**,
  platform-owned, versioned immutably (`agent_versions`, `draft →
validated → published → deprecated → retired`). A tenant that wants one
  gets a **`tenant_agents` installation row** referencing one explicit,
  published `agent_version_id` — never an implicit "latest version," never
  a shared row multiple tenants read directly.
- **Lifecycle is two separate enums, not one:** `AgentVersionStatus`
  (platform, on `agent_versions`) is distinct from
  `TenantAgentLifecycleStatus` (tenant, on `tenant_agents`:
  `REGISTERED → MOCK_EXECUTABLE → EVALUATION_TESTED → TOOL_ENABLED →
APPROVAL_GOVERNED → ACTIVE`, `SUSPENDED` reachable from any
  post-`REGISTERED` state). `DEFINED` is not a tenant runtime state — it
  described creation of the platform definition, now `draft` in the version
  lifecycle instead. Consequently, `AgentManifest`'s `status` field
  (`packages/agent-runtime/src/manifest.ts`) is removed entirely: a
  manifest is authored content, and publication state belongs to the
  `agent_versions` row wrapping that content, not to the content object
  itself.
- New tenant installations default to `lifecycle_status = 'REGISTERED'`,
  `enabled = false`. No tenant agent begins `ACTIVE`.
- Tenant provisioning is an explicit, idempotent TypeScript service
  (`provisionTenantAgents`), not a database trigger — it creates missing
  installations only, references explicit published versions, defaults to
  disabled, and records an audit event per installation actually created,
  operating through the existing `TenantAccessEvaluator`
  (`packages/shared/src/policy.ts`).
- Full revised table definitions, registry interfaces, RLS policy outline,
  and test cases are in `FILE_CHANGE_PLAN.md`, which supersedes its own
  first draft.
