# Repository Assessment — DivinexAI-Infrastructure-OS

**As of:** end of Phase 1 (three increments) / brief-reconciliation checkpoint,
before Phase 2 (Agent Runtime Contracts and Registry).

This supersedes `REPOSITORY_AUDIT.md` as the current-state reference —
`REPOSITORY_AUDIT.md` remains as the historical Phase 0 snapshot (an empty
repository); this document describes what actually exists now, and is the
architectural source of truth going into Phase 2.

## Stack (confirmed, not proposed)

Bun 1.3.11 + Turborepo monorepo, TypeScript strict, Zod, Supabase Postgres
(RLS + planned pgvector). GitHub Actions is the intended CI platform; no
workflow file is committed yet. See `ADR-0001` and its addenda.

## Packages (5, all real code, all tested)

| Package                                                | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared`                                      | Tenancy types, Zod env validation, Supabase client factories, tenant-authorization helpers (`assertTenantMembership`/`assertTenantPermission`), a deterministic `PgTenantAccessEvaluator`, feature-flag and tenant-settings services, audit/security event recorders                                                                                                                                                                                           |
| `packages/agent-runtime`                               | `AgentManifest` + `validateAgentManifest`, `AgentExecutionContext` + `parseAgentExecutionContext`, `AgentExecutionResult` + `parseAgentExecutionResult`. **Note:** its `AgentStatusSchema` (`draft`/`evaluating`/`active`/`deprecated`/`disabled`) predates and does not yet match the newly-specified 8-stage agent lifecycle (`DEFINED` → ... → `ACTIVE`/`SUSPENDED`) — reconciling this is proposed as the first item of Phase 2, see `FILE_CHANGE_PLAN.md` |
| `packages/workflow-engine`                             | All 15 required `WorkflowStatus` values, a deterministic transition table, terminal-status helpers                                                                                                                                                                                                                                                                                                                                                             |
| `packages/eslint-config`, `packages/typescript-config` | Shared tooling, adopted from MediaForgeOS (`HOUSE_CONVENTION_REVIEW.md`)                                                                                                                                                                                                                                                                                                                                                                                       |

No `apps/*` directory exists. Per the current resolution, this is correct,
not a gap to fill immediately — the first application (`apps/admin`) is
scoped to a later phase, and no customer-facing web app exists or is assumed.

## Database

Three migrations, each with a verified rollback, applied in filename order:

1. `20260721000001_core_tenancy.sql` — `tenants`, `roles`, `permissions`,
   `role_permissions`, `tenant_memberships`, `tenant_settings`,
   `tenant_feature_flags`; RLS + `is_tenant_member`/`tenant_has_permission`
   (`security definer` helpers).
2. `20260721000002_audit_security_events.sql` — `audit_events`,
   `security_events`; RLS, read-only (no write policy for `authenticated` at
   all — service-role/owner-only inserts, by design).
3. `20260721000003_seed_core_permissions.sql` — idempotent seed of the five
   permission keys referenced so far.

**Tenancy invariant (reconfirmed):** `tenants`/`tenant_memberships` are
canonical. No `organizations`, `organization_members`, or `workspaces` table
exists or is planned for the current increment. Every tenant-owned table
added since has used `tenant_id`, the existing RLS pattern, and has shipped
with a cross-tenant isolation test — see `PHASE_1_TENANCY.md`,
`PHASE_1_AUTHZ_AUDIT_FLAGS.md`.

**Live validation status: still not executed.** Everything above is tested
against a local PostgreSQL 16 instance using a restricted `authenticated`
role that mirrors Supabase's real privilege posture (no bypass-RLS), not
against an actual Supabase project (no PostgREST/GoTrue available in this
environment). `PHASE_1_SUPABASE_VALIDATION.md` remains the explicit,
unexecuted gate. It blocks work that depends on real Supabase runtime
behavior (PostgREST-specific quirks, GoTrue JWT claims), not further
local-Postgres-testable schema/contract work — Phase 2's registry work, like
Phase 1's increments, can continue to be validated the same way.

## Tests

69 tests, 9 files, across `packages/shared` (30), `packages/agent-runtime`
(17), `packages/workflow-engine` (22) — all executed and passing as of the
last commit. `check-types`, `lint`, `build` pass for all 5 packages.

## Documentation and decisions on record

- `docs/agentflow-v2/README.md` — index, kept current every increment.
- 12 ADRs (`docs/agentflow-v2/adr/`), soon 13 with the reconciliation ADR
  this checkpoint adds.
- `HOUSE_CONVENTION_REVIEW.md`, `BRIEF_RECONCILIATION.md` — records of two
  separate conflicts between an incoming brief and already-built work, both
  resolved in favor of what already existed, with capability mappings rather
  than parallel systems.
- `GAP_ANALYSIS.md`, `CURRENT_ARCHITECTURE.md` — updated in place every
  increment; still current as of this checkpoint (to be updated again once
  Phase 2 lands).

## Git

Branch `agentflow-v2/phase-1-tenancy-foundation` (renamed from
`agentflow-v2/phase-0-audit`; the old name persists on the remote as an
un-deletable-from-this-session, harmless, identical-history pointer — see
prior checkpoint). Working tree clean before this checkpoint's doc commit.
Not merged to `main`.

## What this assessment confirms is settled (not open questions)

1. Tenancy: `tenants`/`tenant_memberships`, no rename, no new hierarchy.
2. Packages: the original eight (`agent-runtime`, `memory-engine`,
   `tool-registry`, `workflow-engine`, `governance`, `sara`,
   `vertical-os-sdk`, `observability`); `packages/shared` stays as-is,
   not refactored broadly.
3. Applications: no web app exists or is assumed; `apps/admin` is the first
   planned application, `apps/worker` the durable execution process;
   Next.js is not pinned/installed until the `apps/admin` increment is
   explicitly approved.
4. Phase sequence: Phase 0 (audit) and Phase 1 (tenancy, RLS, authorization,
   settings, feature flags, audit/security events — three increments) are
   complete; Phase 2 (Agent Runtime Contracts and Registry) is next.
5. Agent scope: Sara, Nova, Forge, Guardian, Reven, Pulse are approved as
   additive scope, gated by an 8-stage lifecycle
   (`DEFINED → REGISTERED → MOCK_EXECUTABLE → EVALUATION_TESTED → TOOL_ENABLED → APPROVAL_GOVERNED → ACTIVE/SUSPENDED`),
   not unrestricted autonomy from definition.

See `ADR-0013` for the formal record of these five points, and
`CAPABILITY_PACKAGE_MAPPING.md` for the full capability-to-package table.
