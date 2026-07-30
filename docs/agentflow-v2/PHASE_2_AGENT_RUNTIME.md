# Phase 2 — Agent Runtime Contracts and Registry

**Status:** Complete and tested. Stopping here for review per instruction —
do not proceed to Phase 3 (Workflow Runtime and Durable Execution) without
sign-off.

## What was built

Per the platform-definition/tenant-installation model in `ADR-0013`'s
addendum and `FILE_CHANGE_PLAN.md`:

- **`packages/agent-runtime/src/manifest.ts`** (modified) — removed the
  `status` field from `AgentManifestMetadataSchema`/`AgentManifest`
  entirely; publication state now lives on the database rows that wrap a
  manifest, not on the manifest object itself.
- **`agentVersionLifecycle.ts`** (new) — `AgentVersionStatus`
  (`draft/validated/published/deprecated/retired`), a deterministic
  transition table enforcing immutability once published.
- **`tenantAgentLifecycle.ts`** (new) — `TenantAgentLifecycleStatus`
  (`REGISTERED/MOCK_EXECUTABLE/EVALUATION_TESTED/TOOL_ENABLED/APPROVAL_GOVERNED/ACTIVE/SUSPENDED`),
  a deterministic transition table: `ACTIVE` reachable only via the full
  ordered sequence (or resuming from `SUSPENDED`), `SUSPENDED` reachable
  from any state past `REGISTERED`.
- **`manifestHash.ts`** (new) — deterministic, key-order-independent
  `sha256` hash of a manifest's metadata, used to detect an unversioned
  content change.
- **`src/agents/{sara,nova,forge,guardian,reven,pulse}.ts`** (new) — the six
  canonical manifests, each encoding its governance rules (prohibited
  actions, approval policy) from the brief directly into
  `prohibitedActions`/`approvalPolicy`.
- **`platformCatalog.ts`** (new) — `PlatformAgentCatalog` /
  `PgPlatformAgentCatalog`: read access to `agent_definitions`/
  `agent_versions`.
- **`tenantAgentRegistry.ts`** (new) — `TenantAgentRegistry` /
  `PgTenantAgentRegistry`: per-tenant installation get/list/lifecycle-
  transition/enable.
- **`seedPlatformCatalog.ts`** (new) — derives the platform catalog seed
  from the manifest objects in code (not a hand-written SQL literal), and
  throws rather than silently overwriting if a version's content changed
  without a version bump.
- **`provisionTenantAgents.ts`** (new) — idempotent, permission-checked,
  audit-logged tenant provisioning of all six canonical agents, defaulting
  every installation to `REGISTERED`/disabled.
- **Two migrations** (`20260721000004_agent_platform_catalog.sql`,
  `20260721000005_tenant_agent_installations.sql`) — platform tables with
  no `tenant_id`; tenant tables with `tenant_id NOT NULL` everywhere,
  tenant-consistency enforced via a composite foreign key
  (`(tenant_agent_id, tenant_id) references tenant_agents (id, tenant_id)`),
  not a trigger. New permission key `tenant.manage_agents`.
- Matching rollback files for both.
- **11 new/updated test files**, 68 new tests (84 total in the package, up
  from 17) — pure-logic lifecycle/manifest/hash tests plus real-Postgres
  tests for the catalog, registry, provisioning, and cross-tenant RLS
  (including the platform tables' read-only-for-tenants policy and the
  composite-FK tenant-consistency constraint).

## Test results (actually executed)

```
@repo/agent-runtime:test
  ✓ test/crossTenantIsolation.test.ts (12 tests)
  ✓ test/platformCatalogAndRegistry.test.ts (10 tests)
  ✓ test/provisionTenantAgents.test.ts (4 tests)
  ✓ test/agents.test.ts (14 tests)
  ✓ test/tenantAgentLifecycle.test.ts (10 tests)
  ✓ test/manifest.test.ts (7 tests)
  ✓ test/manifestHash.test.ts (5 tests)
  ✓ test/seedPlatformCatalog.test.ts (3 tests)
  ✓ test/executionResult.test.ts (6 tests)
  ✓ test/agentVersionLifecycle.test.ts (8 tests)
  ✓ test/executionContext.test.ts (5 tests)
  Test Files  11 passed (11)   Tests  84 passed (84)

@repo/shared:test    — 30 passed (30), unchanged
@repo/workflow-engine:test — 22 passed (22), unchanged

Total: 136 tests, 3 packages, all passing.
```

`bun run check-types`, `bun run lint`, `bun run build` all pass across all
five packages.

## Two real bugs this phase's own tests caught before they shipped

1. **`SUSPENDED → ACTIVE`** — my first draft of the exhaustive "no state
   skips to ACTIVE" test forgot that resuming from `SUSPENDED` is supposed
   to return to `ACTIVE` directly (a deliberate design choice, documented in
   the lifecycle file's own comment) — the test itself was wrong, not the
   code; fixed the test to account for the one intentional exception.
2. **Cross-package test-database race** — running `bun run test` at the
   repository root failed intermittently (`schema "auth" does not exist`)
   because Turborepo runs each package's `test` task concurrently by
   default, and `packages/shared` and `packages/agent-runtime` both
   defaulted to the _same_ local Postgres database, each independently
   calling `drop schema public cascade` / `create schema public` in
   `beforeAll`. Fixed by giving `agent-runtime` its own dedicated test
   database (`agentflow_test_agent_runtime`) — `scripts/setup-local-test-db.sh`
   now provisions one database per package needing RLS-backed tests, and
   `packages/agent-runtime/vitest.config.ts` also got the same
   `fileParallelism: false` `packages/shared` already had (needed _within_
   a package's own files, separately from the _cross-package_ race this
   fixes).

## Migration and rollback validation (actually executed)

Applied both new migrations (via `resetAndMigrate` in every test run,
confirmed passing above), then explicitly ran both rollbacks in reverse
order against `agentflow_test_agent_runtime`:

```
psql ... -f supabase/migrations_rollback/20260721000005_tenant_agent_installations_rollback.sql
psql ... -f supabase/migrations_rollback/20260721000004_agent_platform_catalog_rollback.sql
```

Confirmed via `\dt` that only the Phase 1 tables remained (`audit_events`,
`permissions`, `role_permissions`, `roles`, `security_events`,
`tenant_feature_flags`, `tenant_memberships`, `tenant_settings`, `tenants`)
— all seven Phase 2 tables and their policies cleanly removed. Re-ran
`scripts/setup-local-test-db.sh` to restore the schema and re-ran the full
suite: 84/84 green again, confirmed via a non-cached `vitest run`, not a
cached `turbo` result.

## Acceptance criteria

- [x] Platform-owned `agent_definitions`/`agent_versions`/
      `agent_capability_definitions` exist with no `tenant_id` column.
- [x] Tenant-owned `tenant_agents`/`tenant_agent_capabilities`/
      `agent_tool_permissions`/`agent_knowledge_sources` exist with
      `tenant_id NOT NULL` everywhere, reusing `is_tenant_member`/
      `tenant_has_permission`.
- [x] A composite foreign key (not a trigger) declaratively enforces that
      every child row's `tenant_id` matches its parent `tenant_agents`
      row's `tenant_id` (tested).
- [x] Two separate lifecycles exist (`AgentVersionStatus`,
      `TenantAgentLifecycleStatus`); `AgentManifest.status` removed.
- [x] All six canonical agents defined, each validated via
      `validateAgentManifest`, each encoding its brief-specified
      prohibited actions and approval policy.
- [x] `seedPlatformAgentCatalog` is idempotent and refuses to silently
      overwrite a changed-but-unversioned manifest (tested).
- [x] `provisionTenantAgents` is idempotent, permission-checked before any
      write, defaults every installation to `REGISTERED`/disabled, and
      records one audit event per installation actually created (tested).
- [x] Platform catalog tables are read-only for tenant users (no
      insert/update/delete policy at all); tenant tables enforce
      cross-tenant isolation on both reads and writes (tested).
- [x] `check-types`, `lint`, `build`, `test` all pass at the repository
      root.
- [x] Both new migrations' rollbacks verified to run cleanly and a full
      re-migrate + re-test cycle confirmed green afterward.

## Residual risks (carried forward, unchanged)

Same as every prior increment: everything here is verified against a
faithful local RLS simulation, not a live Supabase project — the
`PHASE_1_SUPABASE_VALIDATION.md` gate remains not executed and still blocks
Phase 3 by the same reasoning it blocked this phase's more runtime-coupled
alternative (this phase proceeded because it's equally testable locally,
not because the gate was waived).
