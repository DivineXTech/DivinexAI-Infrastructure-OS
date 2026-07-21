# Current Architecture — DivinexAI-Infrastructure-OS

**Status: Phase 1 first increment only.** Everything below is what actually
exists in the repository as of this writing — not the target architecture
(`IMPLEMENTATION_PLAN.md`), which remains a proposal for everything not yet
built.

## What exists

- **Monorepo:** Bun-managed Turborepo workspace (`apps/*` + `packages/*`,
  currently only `packages/*` — no `apps/*` yet, see `PHASE_1_TENANCY.md`).
- **`packages/shared`** (`@repo/shared`) — tenancy domain types, a
  Zod-validated env module, Supabase client factories
  (`createServiceRoleClient`, `createUserScopedClient`), and server-side
  tenant-authorization helpers (`assertTenantMembership`,
  `assertTenantPermission`).
- **`packages/eslint-config`, `packages/typescript-config`** — shared
  tooling, conventions adopted from MediaForgeOS.
- **`supabase/migrations/20260721000001_core_tenancy.sql`** — the only
  schema that exists: `tenants`, `roles`, `permissions`, `role_permissions`,
  `tenant_memberships`, `tenant_settings`, `tenant_feature_flags`, all with
  RLS enabled and deny-by-default policies enforced via two
  `security definer` helper functions.
- **No application code beyond this** — no agent runtime, memory engine,
  tool registry, workflow engine, governance layer, Sara, or any UI. All of
  §VI–XIV of the source brief remain unbuilt.

## What does not exist yet

Everything in `GAP_ANALYSIS.md` not explicitly marked "Implemented" there.
In particular: no `apps/web`, no live connection to an actual Supabase
project (tested against a local RLS-faithful simulation only — see
`PHASE_1_TENANCY.md` "Residual risks"), and none of Phases 2–9.

This document should be updated again at the end of each phase, in place,
rather than left to drift from what `IMPLEMENTATION_PLAN.md` merely proposed.
