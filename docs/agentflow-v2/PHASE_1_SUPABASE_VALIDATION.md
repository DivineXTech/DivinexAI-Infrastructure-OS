# Phase 1 — Live Supabase Validation Gate

**Status: NOT YET EXECUTED.** This is a runbook and checklist, not a report
of completed testing. This session has no live Supabase project or
credentials available — everything verified so far (`PHASE_1_TENANCY.md`)
ran against a local PostgreSQL instance with a restricted role simulating
Supabase's `authenticated` role, not against real PostgREST/GoTrue. Per the
brief's own rule ("do not claim a test passed unless it was actually
executed"), nothing below is marked done until someone with access to a real
Supabase project runs it and records the actual output.

**This gate blocks Phase 2 (agent runtime), not the rest of Phase 1.** Low-
risk Phase 1 interface work may continue in parallel per the approval that
introduced this document.

## Prerequisites

- A non-production Supabase project (new or an existing staging project) —
  someone with a Supabase account needs to create/provide one; this session
  cannot provision one itself.
- The Supabase CLI, or dashboard SQL editor access, to apply
  `supabase/migrations/20260721000001_core_tenancy.sql` (and any later
  migrations from this phase) via the real migration workflow rather than a
  one-off `psql` run.
- Two real test users created via Supabase Auth (email/password or magic
  link is fine) so real JWTs exist to test with.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` for that
  project, kept out of any committed file (`.env`, never `.env.example`).

## Steps and evidence to record

For each step, record: the exact command/request used, the actual response
(status code / row count / error message), and a pass/fail verdict. Do not
summarize as "worked" without the underlying evidence.

1. **Apply migrations through the Supabase migration workflow.**
   `supabase link --project-ref <ref>` then `supabase db push`, or apply via
   the dashboard's migration history — not a raw `psql` connection, so this
   exercises the same path a real deployment would use. Record the CLI
   output / dashboard confirmation.

2. **Verify anonymous users are denied.**
   Using the anon key with no `Authorization` bearer token (or a request
   with an invalid/expired token), query `tenants`, `tenant_memberships`,
   `tenant_settings`, `tenant_feature_flags` via the Supabase JS client or a
   direct PostgREST request. Expect zero rows for every table (RLS deny by
   default), not a 401/403 — Supabase's anon role is allowed to _ask_, RLS
   just returns nothing.

3. **Verify a valid tenant member can access only their tenant.**
   Sign in as test user A (member of tenant A only), call
   `createUserScopedClient(accessToken)` from `packages/shared`, and confirm
   `tenants`, `tenant_memberships`, `tenant_settings`, `tenant_feature_flags`
   each return only tenant A's rows — mirrors the local test suite in
   `packages/shared/test/tenant-isolation.test.ts`, this time through the
   real PostgREST layer and a real JWT rather than the `request.jwt.claim.sub`
   session-setting shim.

4. **Verify cross-tenant reads and writes fail.**
   As user A, attempt to `select`/`update` a row scoped to tenant B (known
   row id). Expect zero rows returned/affected, no data leakage, no error
   that reveals whether the row exists.

5. **Verify membership and permission helper behavior under real JWT
   claims.** Call `assertTenantMembership` and `assertTenantPermission` from
   `packages/shared/src/tenant.ts` using a `createUserScopedClient` built
   from a real Supabase session's access token — this is the first time
   these two functions run against a real Supabase backend rather than being
   type-checked only (flagged as an untested residual risk in
   `PHASE_1_TENANCY.md`). Confirm: they resolve normally for an authorized
   membership/permission, and throw `TenantAuthorizationError` for an
   unauthorized one.

6. **Verify service-role access is restricted to server-only paths.**
   Confirm `SUPABASE_SERVICE_ROLE_KEY` is not present in any client-side
   bundle (grep the built `apps/web` output once it exists; not applicable
   yet since no frontend has been built). Confirm `createServiceRoleClient`
   is only imported from server-side modules (route handlers, workers) —
   there is no client-side code yet to violate this, but the check should
   become a standing lint/review rule once `apps/web` exists.

## Evidence log

_(Empty. Fill in with command, output, and pass/fail per step above once run
against a real Supabase project.)_

| Step                                 | Run by | Date | Result  | Notes |
| ------------------------------------ | ------ | ---- | ------- | ----- |
| 1. Migration via Supabase workflow   | —      | —    | Not run |       |
| 2. Anonymous denied                  | —      | —    | Not run |       |
| 3. Member sees only own tenant       | —      | —    | Not run |       |
| 4. Cross-tenant blocked              | —      | —    | Not run |       |
| 5. Helpers under real JWT            | —      | —    | Not run |       |
| 6. Service-role restricted to server | —      | —    | Not run |       |

## Sign-off

Phase 2 (agent runtime, provider adapters, Google ADK) must not begin until
every row above is filled in with a real pass, or an explicit accepted-risk
note if a step is deferred with justification.
