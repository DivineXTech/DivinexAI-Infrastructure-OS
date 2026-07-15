# Security

## Tenant isolation

The core invariant: a user who is a member of tenant A must never be able
to read or write tenant B's data, regardless of what the client sends.

Two enforced layers:

1. **Row-Level Security (default-deny).** Every table in
   `supabase/migrations/20260715000000_foundation.sql` has
   `enable row level security` **and** `force row level security`, then
   narrow `create policy` statements. There is no table left readable by
   default. Cross-tenant reads are blocked by Postgres itself, not by
   application code remembering to add a `WHERE tenant_id = ...` clause.
2. **Server-side application checks.** `lib/auth/session.ts` —
   `requireTenantRole`, `requireCurrentTenantRole`,
   `requirePlatformSuperAdmin` — redirect when a role requirement isn't
   met. These exist for UX (redirecting to a sensible page) and
   defense-in-depth, not as the actual security boundary; RLS is.

`proxy.ts` (Next 16's renamed Middleware) does **one** optimistic check —
redirect signed-out visitors away from `/app/*` and `/admin/*` — and
explicitly does not attempt full authorization, per Next.js's own guidance
that Proxy must not be the sole auth mechanism.

**Hiding a nav item is never a security control.** `lib/navigation.ts`'s
per-item `roles` field is a UX nicety; every route it points at re-checks
the role server-side independently.

### Proving isolation

`tests/integration/tenant-isolation.test.ts` signs in as the seeded
KushPrintCo tenant owner and asserts:
- their own tenant row is readable,
- the second seeded tenant (`demo-isolation-tenant`) is **not** readable,
- that tenant's `tenant_memberships` rows are **not** readable.

This test is skipped automatically when `.env.local` still points at the
placeholder Supabase project (the sandbox this was built in has no live
Supabase instance) — see docs/TESTING.md for how to run it against a real
one. This is the single most important test in the repo to run before any
Phase 1 code reaches a real environment.

## Secrets

- `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `DIVINEXAI_API_KEY` are
  validated only in `lib/env.ts`, which imports `server-only` — importing
  it from a Client Component is a **build error**, not a lint warning.
- `lib/env.client.ts` (imports `client-only`) exposes exactly two values:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Nothing else
  should ever be added to that file.
- `createSupabaseServiceRoleClient()` (`lib/supabase/server.ts`) bypasses
  RLS entirely and throws if `SUPABASE_SERVICE_ROLE_KEY` is unset. It is
  used today only by `scripts/seed.ts` (a standalone Node script, not part
  of the Next.js request path). Do not call it from anything reachable by
  a Client Component.

## Input validation

All Phase 1 forms (login, signup) validate with Zod schemas
(`lib/validation/auth.ts`) shared between the client form and — in later
phases, once Server Actions accept form submissions directly — server-side
re-validation. Client-side validation is a UX convenience; every Server
Action/Route Handler added in later phases must re-validate independently,
since a client can always bypass client-side checks.

## Uploads (later phases)

Not built yet (design studio / product images are Phase 4). When added:
MIME-type allowlist, file-size limits, and Supabase Storage bucket
policies must all be enforced server-side before any upload path ships —
do not rely on client-side `accept=` attributes alone.

## Known gaps at the end of Phase 1

- Rate limiting is not implemented (no abstraction yet either). Needed
  before auth endpoints or any public form goes to production.
- `audit_logs` has no application code writing to it yet — the table,
  RLS, and read policy exist, but nothing inserts audit rows. Wire this up
  alongside the first privileged admin action in Phase 8.
- The tenant-isolation integration test has not been run against a live
  Supabase instance in this environment (see above) — treat that as
  unverified until it has been.
