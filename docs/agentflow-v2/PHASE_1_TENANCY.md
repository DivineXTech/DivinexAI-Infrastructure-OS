# Phase 1 — Shared Domain Foundation: Core Tenancy

**Status:** First increment complete and tested. Stopping here for review per
the approved working method — do not proceed to Phase 2 without sign-off.

## What was built

- `supabase/migrations/20260721000001_core_tenancy.sql` — the real migration:
  `tenants`, `roles`, `permissions`, `role_permissions`, `tenant_memberships`,
  `tenant_settings`, `tenant_feature_flags`, two `security definer` RLS helper
  functions (`is_tenant_member`, `tenant_has_permission`), and RLS enabled +
  explicit allow-policies on every tenant-owned table (deny by default).
- `packages/shared` — `@repo/shared`:
  - `src/types.ts` — TypeScript types mirroring the schema.
  - `src/env.ts` — Zod-validated environment access (`SUPABASE_URL`,
    `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), lazily parsed.
  - `src/supabase.ts` — `createServiceRoleClient()` (server-only, bypasses
    RLS) and `createUserScopedClient(accessToken)` (RLS-enforced).
  - `src/tenant.ts` — `assertTenantMembership` / `assertTenantPermission`,
    explicit server-side checks required for any service-role code path
    per `ADR-0003` rule #8 (never trust a client-supplied tenant ID alone).
- `packages/eslint-config`, `packages/typescript-config` — shared tooling,
  conventions adopted from MediaForgeOS per `HOUSE_CONVENTION_REVIEW.md`.
- `scripts/setup-local-test-db.sh` — reproducible local Postgres setup (a
  restricted `authenticated` role + an `agentflow_test` database) so the
  tenant-isolation tests exercise real RLS without the full Supabase stack.
- `supabase/migrations_rollback/20260721000001_core_tenancy_rollback.sql` —
  the down-migration (see Rollback below).
- Root `package.json` / `turbo.json` / `.gitignore` / `.env.example` — Bun +
  Turborepo monorepo wiring.

## What was deliberately not built yet

No `apps/web` — nothing in this increment's scope needed a UI. The
`packages/*`-per-module folder structure from `IMPLEMENTATION_PLAN.md` §2
still applies; the web app arrives when a phase actually needs one.

## Why real Postgres, not mocks

Neither MediaForgeOS nor afrogrow360-core offered a tenant/RLS or
test-framework convention (`HOUSE_CONVENTION_REVIEW.md`), so this phase
establishes both (`ADR-0003`, `ADR-0012`). RLS is a database-enforced
mechanism; a mocked Supabase client would test nothing security-relevant.
This sandbox has a local PostgreSQL 16 install (not the full Supabase stack —
no PostgREST/GoTrue), so:

- The migration's RLS policies are tested for real, against real Postgres,
  using a restricted `authenticated` Postgres role with no superuser/bypass-
  RLS privileges — the same privilege posture as Supabase's real
  `authenticated` role.
- A test-only shim (`packages/shared/test/sql/000_local_auth_shim.sql`)
  stands in for Supabase Auth's `auth.users`/`auth.uid()`, clearly labeled
  not to be applied to a real Supabase project.
- The TypeScript helpers in `src/tenant.ts` / `src/supabase.ts` are
  type-checked (`tsc --noEmit`) but **not** integration-tested against a live
  Supabase project (no PostgREST/GoTrue available here) — flagged as a
  residual risk below, not glossed over.

## How to run this locally

```sh
bash scripts/setup-local-test-db.sh   # one-time (or after a reset)
bun install
bun run check-types                   # tsc --noEmit across the monorepo
bun run lint                          # eslint, shared config
bun run build                         # tsc --noEmit (no bundler yet)
bun run test                          # vitest — applies migrations + shim,
                                       # seeds fixtures, exercises RLS
```

All four were actually executed against this change, not merely written:
`check-types` and `lint` are clean; `build` succeeds (with the same benign
"no output files" warning MediaForgeOS's own `tsc --noEmit`-only build task
produces); `test` passes 9/9.

## Test results (actually executed)

```
✓ test/tenant-isolation.test.ts (9 tests) 184ms
  ✓ an authenticated member sees only their own tenant in `tenants`
  ✓ a user with no JWT claim (unauthenticated) sees no tenants
  ✓ a member cannot see another tenant's membership rows
  ✓ a member sees only their own tenant's settings
  ✓ a plain member (no tenant.manage) cannot update their own tenant's settings
  ✓ an owner (has tenant.manage) can update their own tenant's settings
  ✓ an owner of tenant A cannot update tenant B's settings even with the right permission shape
  ✓ a member cannot insert a membership row for another tenant, even knowing its role id (privilege escalation attempt)
  ✓ feature flags: a member sees their tenant's flag but not another tenant's

Test Files  1 passed (1)
     Tests  9 passed (9)
```

## Migration instructions

**Against a real Supabase project:** `supabase db push` (or run
`supabase/migrations/20260721000001_core_tenancy.sql` directly via the SQL
editor / `psql`) — it only assumes `auth.users`/`auth.uid()` already exist,
which they do in any Supabase project.

**Locally, without Supabase:** `bash scripts/setup-local-test-db.sh`, then
`bun run test` (the test suite applies the shim + migration itself on every
run via `resetAndMigrate`).

## Rollback instructions

Run `supabase/migrations_rollback/20260721000001_core_tenancy_rollback.sql`
against the target database. **Destructive** — drops every core tenancy
table and all data in them; there is no soft-rollback for this increment
since nothing depends on this data yet. Verified locally: applying it against
`agentflow_test` leaves zero relations, and re-running
`scripts/setup-local-test-db.sh` + `bun run test` afterward restores a fully
working, green state — confirmed in this session, not assumed.

## Acceptance criteria

- [x] `tenants`, `tenant_memberships`, `roles`, `permissions`,
      `role_permissions`, `tenant_settings`, `tenant_feature_flags` exist
      with RLS enabled and deny-by-default policies.
- [x] A tenant member can read only their own tenant's rows across all seven
      tables (tested).
- [x] A member without an elevated permission cannot write to
      permission-gated tables/columns even within their own tenant (tested).
- [x] A member cannot read, write, or escalate into another tenant's rows,
      including a direct-insert privilege-escalation attempt using a known
      role id (tested).
- [x] An unauthenticated session (no JWT claim) sees zero tenant-owned rows
      (tested).
- [x] `check-types`, `lint`, `build`, `test` all pass at the repository root.
- [x] Migration and rollback both verified to actually run against a real
      Postgres instance.
- [ ] Verified against a **live Supabase project** (PostgREST + GoTrue) —
      not possible in this sandbox (no outbound Supabase project available);
      the SQL is written to Supabase's real conventions
      (`auth.uid()`/`auth.users`, `security definer` policy helpers) but
      should be smoke-tested against an actual project before Phase 2 relies
      on it in anger.
- [ ] `assertTenantMembership` / `assertTenantPermission` integration-tested
      against a live Supabase client — currently type-checked only; add
      once a real project is available (tracked as a residual risk below).

## Residual risks / next steps

1. **No live Supabase verification yet** — the SQL follows documented
   Supabase conventions and passes against a faithful local RLS simulation,
   but "faithful simulation" is not the same as "verified against the real
   product." Recommend a quick smoke test against an actual Supabase project
   before Phase 2 (agent runtime) starts writing data through this schema.
2. **`assertTenantMembership`/`assertTenantPermission` are untested at
   runtime** — logic was written carefully against the schema and is
   type-checked, but has no unit or integration test yet (no live Supabase
   client to test against, and a hand-rolled mock would just test the mock).
   Add integration tests once Phase 2 has a real Supabase project wired up
   and actually calls these helpers from a service-role code path.
3. **Platform-level roles** (`roles.tenant_id is null`) are modeled in the
   schema and RLS policies but have no seed data or consumer yet — expected;
   revisit when a platform-admin capability is actually needed.
