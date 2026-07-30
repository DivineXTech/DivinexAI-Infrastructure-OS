# Current Architecture — DivinexAI-Infrastructure-OS

**Status: Phase 1, three increments in.** Everything below is what actually
exists in the repository as of this writing — not the target architecture
(`IMPLEMENTATION_PLAN.md`), which remains a proposal for everything not yet
built.

## What exists

- **Monorepo:** Bun-managed Turborepo workspace (`apps/*` + `packages/*`,
  currently only `packages/*` — no `apps/*` yet).
- **`packages/shared`** (`@repo/shared`):
  - Tenancy domain types (`types.ts`), a Zod-validated env module (`env.ts`).
  - Supabase client factories (`createServiceRoleClient`,
    `createUserScopedClient`) and server-side tenant-authorization helpers
    (`assertTenantMembership`, `assertTenantPermission`) — `@supabase/supabase-js`-based, for Next.js route-handler contexts (Phase 1 increment 1).
  - A `Queryable` interface (`db.ts`) and, built on it: a deterministic
    `PgTenantAccessEvaluator` (`policy.ts`), `PgFeatureFlagService`
    (`featureFlags.ts`), `PgTenantSettingsService` (`tenantSettings.ts`),
    and `recordAuditEvent`/`recordSecurityEvent` (`events.ts`) — direct-
    Postgres-based, for service-role-equivalent code paths (Phase 1
    increment 2; see `PHASE_1_AUTHZ_AUDIT_FLAGS.md` for why two transports
    coexist).
- **`packages/agent-runtime`** (`@repo/agent-runtime`) — `AgentManifest`
  contract + `validateAgentManifest`, `AgentExecutionContext` +
  `parseAgentExecutionContext`, `AgentExecutionResult` +
  `parseAgentExecutionResult`. Pure Zod contracts, no runtime/database
  coupling yet — no agent registry, no six agent manifests, no execution
  engine. See `PHASE_1_AGENT_WORKFLOW_CONTRACTS.md`.
- **`packages/workflow-engine`** (`@repo/workflow-engine`) — all 15 required
  `WorkflowStatus` values, a deterministic transition table
  (`isValidWorkflowTransition`/`assertValidWorkflowTransition`), terminal-
  status helpers. Pure contract, no persistence/state-machine engine yet.
- **`packages/eslint-config`, `packages/typescript-config`** — shared
  tooling, conventions adopted from MediaForgeOS.
- **Database schema** (`supabase/migrations/`, applied in filename order):
  - `20260721000001_core_tenancy.sql` — `tenants`, `roles`, `permissions`,
    `role_permissions`, `tenant_memberships`, `tenant_settings`,
    `tenant_feature_flags`, RLS + two `security definer` helper functions.
  - `20260721000002_audit_security_events.sql` — `audit_events`,
    `security_events`, RLS with read-only policies (no write path for the
    `authenticated` role at all — service-role-only inserts, by design).
  - `20260721000003_seed_core_permissions.sql` — idempotent seed of the five
    permission keys referenced so far.
  - Each has a corresponding file under `supabase/migrations_rollback/`,
    verified to actually run cleanly (see the two `PHASE_1_*.md` docs).
- **No application code beyond this** — no agent runtime, memory engine,
  tool registry, workflow engine, governance/approval layer, Sara, or any
  UI. All of §VI–XIV of the source brief remain unbuilt. The policy/audit
  primitives here are foundational building blocks for the future
  governance layer (`ADR-0008`), not that layer itself.

## What does not exist yet

Everything in `GAP_ANALYSIS.md` not explicitly marked "Implemented" there.
In particular: no `apps/web`, no live connection to an actual Supabase
project (tested against a local RLS-faithful simulation only — see
`PHASE_1_SUPABASE_VALIDATION.md`, the explicit gate before Phase 2), and
none of Phases 2–9 (provider adapters, Google ADK, agent execution,
business memory, tools, workflows).

This document should be updated again at the end of each phase, in place,
rather than left to drift from what `IMPLEMENTATION_PLAN.md` merely proposed.
