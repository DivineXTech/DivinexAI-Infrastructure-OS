# Current Architecture — DivinexAI-Infrastructure-OS

**Status: Phase 2 (Agent Runtime Contracts and Registry) complete.**
Everything below is what actually exists in the repository as of this
writing — not the target architecture (`IMPLEMENTATION_PLAN.md`), which
remains a proposal for everything not yet built.

## What exists

- **Monorepo:** Bun-managed Turborepo workspace (`apps/*` + `packages/*`,
  currently only `packages/*` — no `apps/*` yet; the first one will be
  `apps/admin`, `ADR-0013` addendum, not before its own approved phase).
- **`packages/shared`** (`@repo/shared`):
  - Tenancy domain types (`types.ts`), a Zod-validated env module (`env.ts`).
  - Supabase client factories and server-side tenant-authorization helpers
    (`assertTenantMembership`, `assertTenantPermission`) —
    `@supabase/supabase-js`-based, for Next.js route-handler contexts.
  - A `Queryable` interface (`db.ts`) and, built on it: a deterministic
    `PgTenantAccessEvaluator` (`policy.ts`), `PgFeatureFlagService`,
    `PgTenantSettingsService`, and `recordAuditEvent`/`recordSecurityEvent`
    (`events.ts`) — direct-Postgres-based, for service-role-equivalent code
    paths.
- **`packages/agent-runtime`** (`@repo/agent-runtime`):
  - Contracts: `AgentManifest` (no `status` field — see below),
    `AgentExecutionContext`, `AgentExecutionResult`, all Zod-validated.
  - Two separate lifecycles: `AgentVersionStatus` (platform,
    `draft/validated/published/deprecated/retired`) and
    `TenantAgentLifecycleStatus` (tenant,
    `REGISTERED/MOCK_EXECUTABLE/EVALUATION_TESTED/TOOL_ENABLED/APPROVAL_GOVERNED/ACTIVE/SUSPENDED`),
    each with a deterministic transition table.
  - The six canonical agent manifests (Sara, Nova, Forge, Guardian, Reven,
    Pulse), each Zod-validated.
  - `PlatformAgentCatalog`/`PgPlatformAgentCatalog` (platform catalog
    reads), `TenantAgentRegistry`/`PgTenantAgentRegistry` (per-tenant
    installations), `seedPlatformAgentCatalog` (derives the platform seed
    from code, not a hand-written SQL literal), `provisionTenantAgents`
    (idempotent, permission-checked, audit-logged installation of all six
    agents for a tenant). See `PHASE_2_AGENT_RUNTIME.md`.
- **`packages/workflow-engine`** (`@repo/workflow-engine`) — all 15 required
  `WorkflowStatus` values, a deterministic transition table. Pure contract,
  no persistence/state-machine engine yet (Phase 3).
- **`packages/eslint-config`, `packages/typescript-config`** — shared
  tooling, conventions adopted from MediaForgeOS.
- **Database schema** (`supabase/migrations/`, applied in filename order):
  - `20260721000001_core_tenancy.sql` — `tenants`, `roles`, `permissions`,
    `role_permissions`, `tenant_memberships`, `tenant_settings`,
    `tenant_feature_flags`.
  - `20260721000002_audit_security_events.sql` — `audit_events`,
    `security_events` (read-only for tenant users).
  - `20260721000003_seed_core_permissions.sql` — permission catalog seed.
  - `20260721000004_agent_platform_catalog.sql` — `agent_definitions`,
    `agent_versions`, `agent_capability_definitions` — **no `tenant_id`
    column, anywhere** (platform-owned).
  - `20260721000005_tenant_agent_installations.sql` — `tenant_agents`,
    `tenant_agent_capabilities`, `agent_tool_permissions`,
    `agent_knowledge_sources` — **`tenant_id NOT NULL` on every row, no
    exceptions**; tenant-consistency across the four tables enforced by a
    composite foreign key, not a trigger.
  - Every migration has a corresponding, verified rollback under
    `supabase/migrations_rollback/`.
- **No application code beyond this** — no memory engine, tool registry,
  workflow persistence/execution, governance/approval engine, Sara, or any
  UI. The policy/audit primitives in `packages/shared` are foundational
  building blocks for the future governance layer (`ADR-0008`), not that
  layer itself.

## What does not exist yet

Everything in `GAP_ANALYSIS.md` not explicitly marked "Implemented" there.
In particular: no `apps/*`, no live connection to an actual Supabase project
(tested against a local RLS-faithful simulation only — see
`PHASE_1_SUPABASE_VALIDATION.md`, the still-open gate), and none of Phases
3–11 (workflow persistence, governance/approvals, model/tool gateways,
memory engine, Sara, the rest of the executive agent team, observability
expansion, the admin app, vertical agent pods).

This document should be updated again at the end of each phase, in place,
rather than left to drift from what `IMPLEMENTATION_PLAN.md` merely proposed.
