# Phase 1 — Second Increment: Authorization Primitives, Audit/Security Events, Feature Flags, Tenant Settings

**Status:** Complete and tested. Stopping here for review per the approved
working method — do not proceed to provider adapters, Google ADK, agent
execution, business memory, tools, or workflows without sign-off.

## Scope

Per the approved next-increment list: centralized authorization policy
types, an audit-event base schema, a security-event base schema, a
tenant-aware feature-flag service, a tenant settings service, a deterministic
permission evaluator, and contract tests for all of the above. Nothing
outside this list was touched (no provider adapters, no agent runtime, no
memory/tool/workflow code).

## What was built

- **`supabase/migrations/20260721000002_audit_security_events.sql`** —
  `audit_events` and `security_events`. RLS enabled on both; each has a
  single SELECT policy gated by a permission (`tenant.view_audit_log` /
  `tenant.view_security_log`) and **no INSERT/UPDATE/DELETE policy at
  all** — deny-by-default means the `authenticated` role can never write to
  these tables via the API, regardless of what permissions a tenant member
  holds. Only a direct owner/service-role connection (which bypasses RLS)
  can insert. This is deliberate: it protects audit-log integrity against
  tampering by an authenticated-but-malicious or compromised end-user
  session.
- **`supabase/migrations/20260721000003_seed_core_permissions.sql`** — an
  idempotent seed of the five permission keys referenced by RLS policies and
  services so far (`tenant.manage`, `tenant.manage_members`,
  `tenant.manage_roles`, `tenant.view_audit_log`,
  `tenant.view_security_log`).
- **`packages/shared/src/policy.ts`** — `PolicyDecision`,
  `TenantAccessEvaluator` (contract), and `PgTenantAccessEvaluator` (a
  deterministic, SQL-only implementation — no AI involvement, per rule #14).
  Exists specifically for service-role-equivalent code paths that bypass
  RLS and must re-check tenant membership/permission explicitly (rule #8).
- **`packages/shared/src/featureFlags.ts`** — `FeatureFlagService` /
  `PgFeatureFlagService`: tenant-specific override wins, falling back to the
  platform-wide default (`tenant_id is null`), defaulting to `false` if
  neither exists.
- **`packages/shared/src/tenantSettings.ts`** — `TenantSettingsService` /
  `PgTenantSettingsService`: `get` reads the tenant's settings (empty object
  if none yet); `update` explicitly re-checks `tenant.manage` via the
  injected `TenantAccessEvaluator` before writing (defense in depth, not
  reliance on RLS alone), then merges the patch into the existing `jsonb`.
- **`packages/shared/src/events.ts`** — `recordAuditEvent` /
  `recordSecurityEvent`, thin inserts documented as service-role-only.
- **`packages/shared/src/db.ts`** — the `Queryable` structural interface
  (`{ query(text, values) }`) all four services above depend on, satisfied
  by both `pg.Pool` and `pg.PoolClient` with no wrapper needed. See "Design
  note" below for why this increment uses direct Postgres rather than
  `@supabase/supabase-js` for these particular services.
- **`packages/shared/test/seedFixtures.ts`** — the tenant/role/permission
  fixture seed factored out of `tenant-isolation.test.ts` and reused by
  every new contract test file, so the fixture shape can't silently drift
  per file.
- New rollback files:
  `supabase/migrations_rollback/20260721000002_audit_security_events_rollback.sql`,
  `supabase/migrations_rollback/20260721000003_seed_core_permissions_rollback.sql`.

## Design note: why `Queryable`/direct Postgres for these services

`tenant.ts`'s `assertTenantMembership`/`assertTenantPermission` (first
increment) are built on `@supabase/supabase-js`, for Next.js route-handler
contexts using a user-scoped client. This increment's services
(`PgTenantAccessEvaluator`, `PgFeatureFlagService`, `PgTenantSettingsService`)
are built on a plain Postgres connection instead, because:

1. Supabase natively supports direct Postgres connections alongside its
   PostgREST data API — this is not a workaround, it's one of Supabase's two
   supported access patterns.
2. This sandbox has no live Supabase project (no PostgREST/GoTrue), so
   `@supabase/supabase-js`-based code cannot be genuinely tested here — only
   type-checked (see `PHASE_1_TENANCY.md`'s residual risk and
   `PHASE_1_SUPABASE_VALIDATION.md`). Building these services against direct
   Postgres via the `Queryable` interface means they can be integration-
   tested for real, right now, against actual RLS-enforced Postgres.
3. Both access patterns ultimately hit the identical tables and RLS
   policies, so there is no behavioral inconsistency — just two supported
   transports for the same schema.

`tenant.ts` was not rewritten to match — it works and is unrelated to this
increment's scope; changing it without a concrete reason would violate the
brief's "preserve existing working functionality" rule.

## Test results (actually executed)

```
✓ test/tenant-isolation.test.ts (9 tests) 182ms   [unchanged from first increment, still passing]
✓ test/events.test.ts (7 tests) 192ms
✓ test/policy.test.ts (6 tests) 174ms
✓ test/tenantSettings.test.ts (5 tests) 238ms
✓ test/featureFlags.test.ts (3 tests) 184ms

Test Files  5 passed (5)
     Tests  30 passed (30)
```

`bun run check-types`, `bun run lint`, and `bun run build` all pass at the
repository root (re-verified after this increment, not carried over from
memory of the first).

## Migration instructions

Same mechanism as the first increment: `supabase db push` against a real
project, or `bash scripts/setup-local-test-db.sh && bun run test` locally —
`resetAndMigrate` now discovers and applies every `.sql` file under
`supabase/migrations/` in filename order automatically (refactored from a
hardcoded single-file reference), so no test-harness change is needed when a
future migration is added.

## Rollback instructions and verification

Run, **in this order** (reverse of application):
`20260721000003_seed_core_permissions_rollback.sql`,
`20260721000002_audit_security_events_rollback.sql`,
`20260721000001_core_tenancy_rollback.sql` (the last one, unchanged from the
first increment). Verified in this session: applied all three against
`agentflow_test`, confirmed zero relations remained, then re-ran
`scripts/setup-local-test-db.sh` + the full test suite — 30/30 green again.

## Acceptance criteria

- [x] `audit_events`, `security_events` exist with RLS enabled, a
      permission-gated SELECT policy, and no write path for the
      `authenticated` role (verified: two tests assert a direct insert
      attempt as an authenticated tenant owner throws).
- [x] Cross-tenant and no-permission reads of audit/security events are
      denied (tested).
- [x] `PgTenantAccessEvaluator` correctly allows/denies membership and
      permission checks, including a user who holds the right permission but
      in the wrong tenant (tested — this is the specific bug class a naive
      "does this user have permission X anywhere" check would miss).
- [x] `PgFeatureFlagService` resolves tenant override → platform default →
      `false`, in that precedence order (tested, all three branches).
- [x] `PgTenantSettingsService.update` is blocked for a member without
      `tenant.manage` and for a non-member of the target tenant, and merges
      correctly (not overwrites) when permitted (tested); a permitted write
      is also independently visible/correct when read back through the
      RLS-restricted `authenticated` role, not just through the owner
      connection.
- [x] `check-types`, `lint`, `build`, `test` all pass at the repository
      root.
- [x] Both new migrations' rollbacks verified to actually run cleanly and
      restore a green state afterward.
- [ ] None of this increment's Supabase-JS-facing surface changed, so the
      live-Supabase validation gate (`PHASE_1_SUPABASE_VALIDATION.md`)
      status is unchanged — still not executed, still tracked as the
      explicit blocker before Phase 2.

## Residual risks

Same category as the first increment's: everything here is verified against
a faithful local RLS simulation, not a live Supabase project. Nothing new
introduced beyond that already-tracked risk.
