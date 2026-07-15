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
   The same pattern applies to Storage (`storage.objects` — see "Storage
   security" below).
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

`tests/integration/tenant-isolation.test.ts`,
`tests/integration/rls-authorization.test.ts`, and
`tests/integration/membership-isolation.test.ts` sign in as each seeded
persona (see `scripts/seed.ts`) and assert, at minimum:

- a tenant owner's own tenant row is readable; the other seeded tenant is not,
- cross-tenant `select`/`insert`/`update`/`delete` on `tenant_memberships`
  all fail for a non-member,
- a user cannot insert a `tenant_memberships` row assigning themselves to
  a tenant they don't already administer (see "Tenant provisioning"),
- a tenant owner cannot flip their own `profiles.is_platform_super_admin`
  (see "Privilege-escalation fix" below),
- a designer cannot perform an owner-only `tenants` update,
- a user with no membership at all reads zero rows from every tenant-owned
  table,
- Storage: a tenant member cannot read/write another tenant's objects in
  any tenant-scoped bucket.
- a designer and a tenant owner in the same tenant each resolve only their
  own role, never each other's (see "Membership row-scoping fix" below),
  and a user in two tenants gets exactly those two memberships back.

**These tests are skipped, not passed, in this sandbox** — there is no
Docker daemon (`supabase start` needs one) and no Supabase project
credentials here. See docs/TESTING.md and docs/MIGRATION_VALIDATION.md for
exactly what "skip" vs. "pass" means and how to run them for real. Do not
treat a skip as a pass.

## Privilege-escalation fix (found during Phase 1.5 review)

`profiles_update_own`'s RLS policy (`using (id = auth.uid())`) is
row-level only — it has no way to protect one column differently from
another. As originally written, any authenticated user could run `update
profiles set is_platform_super_admin = true where id = auth.uid()` and
grant themselves platform super admin. Fixed in
`supabase/migrations/20260716010000_prevent_privilege_escalation.sql`: a
`before update` trigger rejects any change to `is_platform_super_admin`
unless the connection is the service-role connection. This is exactly the
kind of bug the Phase 1.5 tenant-isolation test suite exists to catch —
see `tests/integration/rls-authorization.test.ts`.

### Two narrower gaps, left open on purpose

- A `tenant_admin` can promote themselves to `tenant_owner` **within
  their own tenant** via `tenant_memberships_write_owner_admin` (that
  policy only checks "is the caller owner-or-admin of this tenant_id", not
  which role they're granting). Not a platform-level escalation, but
  narrower than "admin" vs. "owner" implies. Tightening this needs a
  policy (or trigger) that also inspects the target `role_id`.
- The same policy doesn't validate that an update only touches the
  caller's intended target row precisely — an admin could, in principle,
  repoint another member's `tenant_memberships` row in ways that are
  messier than intended, though never outside their own tenant (the
  `with check` on `tenant_id` already prevents that — see
  docs/MIGRATION_VALIDATION.md).

Both are documented rather than fixed in this pass — they don't cross the
platform-privilege boundary the rest of this document is about, and
fixing them well needs role-hierarchy logic (e.g. "only an owner can grant
owner") that doesn't exist as a concept anywhere else in the schema yet.

## Membership row-scoping fix (found during pre-Phase-3 review)

A second, distinct invariant beyond cross-tenant isolation: **within** a
tenant a user legitimately belongs to, they must only ever resolve to
*their own* membership row and role — never another member's. A
high-effort code review ahead of Phase 3 found that `lib/auth/session.ts`'s
`fetchMyActiveMembershipRows` (the query underlying `listMyTenantMemberships`
and `getCurrentTenantMembership`) filtered only by `status = 'active'`,
with no `profile_id` filter, relying entirely on RLS. But
`tenant_memberships_select_member` authorizes a row by "is the caller an
active member of this row's `tenant_id`" — deliberately, so tenant
owners/admins can list *other* members for team-management features — not
"is this the caller's own row." A function whose contract is "my
memberships" cannot assume table-level RLS narrows results to the
caller's own rows; here it didn't, so a lower-privileged member's session
could resolve a co-member's row (and role) as its own, e.g. a designer's
`getCurrentTenantMembership()` picking the tenant owner's row via `.find()
?? [0]` when the owner's row happened to sort first — granting
app-level access to owner/admin-only routes (`/app/billing`, `/app/team`,
`/app/settings`) and corrupting the tenant switcher with duplicate/foreign
entries.

Fixed by adding an explicit `.eq("profile_id", callerId)` filter in
`fetchMyActiveMembershipRows` (`lib/auth/session.ts`) — the caller's id is
resolved via `supabase.auth.getUser()`, never trusted from client input.
The underlying RLS policy was deliberately left unchanged: it's correctly
broad for future team-management reads, and the fix is that **session and
authorization code must not treat that breadth as a substitute for
caller-specific filtering** — the same principle applies to any future
function whose contract is "my X" over a table with membership-style RLS.

A related, smaller issue in the same area: `app/app/layout.tsx` was
calling `listMyTenantMemberships()` and then, separately,
`getCurrentTenantMembership()` (which internally re-fetches the same
list), non-null-asserting the second call's result. Beyond the redundant
Supabase round trip, this was a time-of-check/time-of-use gap — the
second fetch is not guaranteed to agree with the first if membership
changes mid-request. Fixed by extracting the pure selection logic into
`lib/auth/tenant-selection.ts` (`resolveCurrentTenantMembership`, which
has no I/O or side-effecting imports, so it can be unit-tested directly —
`tests/unit/tenant-selection.test.ts`) and having the layout resolve
"current tenant" from the single `memberships` array it already fetched,
with a deterministic redirect instead of an assertion if resolution
somehow still fails.

Regression coverage: `tests/integration/membership-isolation.test.ts`
(skips without a live project, same as the rest of this file's tests)
proves a designer and owner in the same tenant each resolve their own
distinct role, and that a user belonging to two tenants gets exactly
those two memberships with no duplicates.

### Audit of other session/authorization queries for the same pattern

Every other query in `lib/auth/session.ts` and `lib/audit/log.ts` was
re-checked for "does this rely on tenant-wide RLS where it should filter
by caller identity instead":

- `getCurrentProfile()` — queries `profiles` `.eq("id", user.id)`, already
  caller-scoped by primary key, not by RLS breadth. Fine.
- `getTenantMembership(tenantSlug)` — now goes through the fixed
  `fetchMyActiveMembershipRows`, inheriting the `profile_id` filter. Fine.
- `requireTenantRole` / `requireCurrentTenantRole` /
  `requirePlatformSuperAdmin` — all resolve identity via
  `getCurrentProfile()`/`getCurrentTenantMembership()`, both now correctly
  scoped; they don't run their own unscoped queries. Fine.
- `writeAuditLog` (`lib/audit/log.ts`) — uses the service-role client for
  inserts, which bypasses RLS entirely by design (see "Audit logging"
  below); it never reads `audit_logs` on the caller's behalf, so there's
  no analogous "my rows" contract to violate.
- `createTenantAction` (`app/app/onboarding/actions.ts`) — its uniqueness
  and role-lookup queries use the service-role client and query by
  `slug`/`key` (not by caller identity), so caller-scoping doesn't apply
  the same way; the actual trust boundary there is "the granted role is
  hardcoded and the profile id comes from the session," already covered
  under "Tenant provisioning" below.

No other instance of the same class of bug (a "my X" contract satisfied
by assuming RLS narrows to the caller instead of an explicit filter) was
found.

## Tenant provisioning

A signed-up user does **not** get unrestricted platform access, and there
is exactly one way to become a `tenant_owner`: `createTenantAction`
(`app/app/onboarding/actions.ts`).

- The only client-supplied values are `tenantName` and `tenantSlug` (Zod
  validated: `lib/validation/tenant.ts`), normalized and checked against a
  reserved-word list (`app`, `admin`, `api`, `login`, `store`, etc.) so a
  tenant can never claim a URL segment that shadows a real route.
- The actor's identity comes from the authenticated session
  (`getCurrentProfile()`), **never** from a client-supplied field.
- The granted role is hardcoded to `tenant_owner` in application code —
  there is no parameter, form field, or code path here that could request
  `platform_super_admin` or any other role.
- RLS deliberately blocks ordinary authenticated users from inserting into
  `tenants` or `tenant_memberships` directly (a brand-new tenant has no
  owner yet, so no one could satisfy `has_tenant_role()` to bootstrap it).
  `createTenantAction` uses the service-role client to perform the insert
  — the security boundary is this function's own logic (fixed role, no
  client-controlled tenant_id, identity from the server session), not a
  database policy, and that trust boundary is exactly why the function's
  docstring spells out what is and isn't trusted from the caller.
- Every tenant/membership creation writes an audit log entry (see
  "Audit logging" below) — this is not optional or best-effort for this
  specific action; both writes happen before the action returns success.

## Storage security

Buckets and RLS policies: `supabase/migrations/20260716000000_storage.sql`.
Path-safety helpers every future upload code path must use:
`lib/storage/paths.ts` (`buildTenantObjectPath`, `sanitizeFilename`).

| Bucket | Public read? | Write access | Max size | Allowed types |
|---|---|---|---|---|
| `logos` | Yes | `tenant_owner`/`tenant_admin` of the path's tenant | 5 MB | png, jpeg, webp |
| `brand-assets` | Yes | `tenant_owner`/`tenant_admin` of the path's tenant | 5 MB | png, jpeg, webp |
| `product-images` | Yes | Any active member of the path's tenant | 10 MB | png, jpeg, webp |
| `design-uploads` | No | Any active member of the path's tenant | 25 MB | png, jpeg, pdf |
| `artwork` | No | Any active member of the path's tenant | 25 MB | png, jpeg, pdf |
| `support-attachments` | No | Any active member of the path's tenant | 10 MB | png, jpeg, pdf |
| `course-files` | No (authenticated-read) | Platform super admin only | 200 MB | mp4, pdf, png, jpeg |

Notes:

- **Path convention**: every tenant-scoped bucket expects the object
  name's first path segment to be the tenant's `id` (not slug) —
  `{tenant_id}/...`. RLS policies read that segment with
  `storage.foldername(name)[1]` and check it against
  `is_tenant_member()`/`has_tenant_role()` — the same helper functions the
  app-schema RLS uses, so there is exactly one definition of "is this
  caller a member of this tenant" anywhere in the system.
- **No SVG uploads, anywhere.** `image/svg+xml` is deliberately excluded
  from every bucket's `allowed_mime_types`. A raw user-uploaded SVG served
  back to a browser is a well-known stored-XSS vector (SVG can embed
  `<script>`); only rasterized formats are accepted unless a sanitization
  step is added first.
- **File-size limits and MIME allowlists are enforced by Supabase Storage
  itself** (`file_size_limit`/`allowed_mime_types` on the bucket), not
  just client-side — an upload violating either is rejected server-side
  regardless of what the client claims about the file.
- **Signed URLs**: no upload UI exists yet (Phase 4), so nothing generates
  signed URLs today. When it does: private buckets must only ever be
  accessed through `createSignedUrl` (time-limited), never by trying to
  make them public — that's what `public: true`/`false` on the bucket
  already encodes, and the RLS policies above are the enforcement, not the
  signed-URL step itself.
- **Path traversal / cross-tenant overwrite**: `buildTenantObjectPath`
  strips `..`, path separators, and non-conservative characters from every
  segment *before* the tenant id is prepended, so a crafted filename can't
  escape the tenant folder it's placed in — and even if it somehow did,
  the RLS policy re-derives the tenant id from the actual stored path, not
  from anything the client asserts separately.
- **Not yet built**: real upload endpoints (Phase 4 design studio, Phase 4
  product images). This migration is groundwork so that when those ship,
  they have tenant-safe buckets and policies to write into rather than
  retrofitting isolation after the fact.

## Audit logging

`lib/audit/log.ts` (`writeAuditLog`) — every call uses the service-role
client, matching the "no authenticated insert policy on `audit_logs`"
design in the foundation migration. Currently wired into:

- `tenant.created` / `tenant_membership.created` — `createTenantAction`.
- `tenant.switched` — `setCurrentTenantAction` (also logs
  `privileged_action.denied` if someone tries to switch to a tenant
  they're not a member of).
- `admin.accessed` — every successful `requirePlatformSuperAdmin()` call
  (i.e., every `/admin/*` page load).
- `privileged_action.denied` — every `requireTenantRole` /
  `requireCurrentTenantRole` / `requirePlatformSuperAdmin` rejection.

**Fails soft by design**: if `SUPABASE_SERVICE_ROLE_KEY` is unset (e.g.
this sandbox's placeholder `.env.local`), every audit write logs a console
warning instead of throwing — a broken audit trail must never take down
the privileged operation it's describing. This means audit logging is
currently **unverified in this sandbox** (nothing to write to), and in any
real deployment, an unset service-role key silently degrades the audit
trail to nothing — that's a real operational risk to catch in the Phase
1.5 live-validation pass, not something to assume works because the code
compiles.

Never log passwords, tokens, API keys, or payment details — `metadata` on
every call site here is small, structured, and non-sensitive (role keys,
slugs, table/target ids) by construction; keep it that way as new call
sites are added.

## Secrets

- `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `DIVINEXAI_API_KEY` are
  validated only in `lib/env.ts`, which imports `server-only` — importing
  it from a Client Component is a **build error**, not a lint warning.
- `lib/env.client.ts` (imports `client-only`) exposes exactly three
  values: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_APP_URL`. Nothing else should ever be added to that file.
- `createSupabaseServiceRoleClient()` (`lib/supabase/server.ts`) bypasses
  RLS entirely and throws if `SUPABASE_SERVICE_ROLE_KEY` is unset. It is
  used by `scripts/seed.ts` and by `createTenantAction`/`writeAuditLog`
  (both server-only, never reachable from a Client Component).
- `SEED_MODE_ENABLED` is a second, independent gate on `scripts/seed.ts`
  beyond the `NODE_ENV !== "production"` check — `lib/env.ts` refuses to
  even consider the process validly configured if `SEED_MODE_ENABLED=true`
  while `NODE_ENV=production`.

## Open redirects

`app/(auth)/login/page.tsx` reads a `?next=` query param (set by
`proxy.ts` when redirecting a signed-out visitor) and used it directly as
a client-side navigation target — found and fixed in this Phase 1.5 pass.
`lib/auth/safe-redirect.ts` (`getSafeRedirectPath`) now rejects anything
that isn't a same-origin, path-relative string: absolute URLs, `//`
protocol-relative URLs, backslash tricks browsers normalize into `//`, and
embedded control characters. Covered by
`tests/unit/safe-redirect.test.ts`. Any future "return to this page"
parameter anywhere in the app must go through this helper — never
`router.push(rawQueryParamValue)`.

## Public lead capture (Phase 2)

`leads` (`supabase/migrations/20260717000000_leads.sql`) is the one table
that intentionally allows anonymous inserts — public marketing-site forms
(contact, consultation, startup-kit/equipment/white-label interest,
early-access) submit before any account exists. RLS still applies:
`leads_insert_public` allows `insert` to `anon`/`authenticated` with no
read-back, and `leads_select_super_admin` restricts all reads to platform
super admins — a submitter cannot read their own or anyone else's lead
row after submitting. `lib/leads/actions.ts` (`submitLeadAction`)
re-validates every field server-side via `lib/validation/lead.ts`
regardless of client-side validation, and runs a honeypot spam check
(`lib/leads/spam-prevention.ts`) before writing — a tripped honeypot
returns a fake success rather than revealing which check it failed.

## Onboarding wizard authorization (Phase 3)

`supabase/migrations/20260718000000_onboarding.sql` adds 11 tenant-owned
tables (see docs/DATABASE.md). Every one enables and forces RLS,
default-deny, with the same `has_tenant_role()`/`is_platform_super_admin()`
helper functions the foundation migration defined — no parallel
authorization implementation was added. Full role matrix and rationale in
docs/ONBOARDING.md "Authorization model"; summary:

- `tenant_owner`/`tenant_admin`: full read+write on every table.
- `designer`: read-only on `brand_profiles`/`brand_product_preferences`
  only (matches the review page's `visibleSections` for that role exactly).
- `production_manager`: read-only on `production_preferences` only.
- `budget_profiles`, `startup_kit_recommendations`,
  `launch_readiness_assessments`: owner/admin only, no broader read —
  these carry the most sensitive planning detail (financials, the
  readiness score derived in part from budget data).
- Every other role: denied everywhere.

Application-layer enforcement mirrors this rather than substituting for
it: `lib/onboarding/guard.ts`'s `requireOnboardingStepAccess` (edit wizard,
owner/admin only) and `requireOnboardingReviewAccess` (review page,
broader read-scoped roles) both resolve the caller's role from their own
authenticated session — never from client input — the same contract
`61b1b83` established for tenant membership resolution. The role→section
mapping itself is factored into a pure, unit-tested module
(`lib/onboarding/review-access.ts`, `tests/unit/onboarding-review-access.test.ts`)
precisely so a future change to that mapping can't silently drift from
what's tested, the same class of bug the membership row-scoping fix
addressed. A denied access attempt on the review page writes a
`privileged_action.denied` audit log entry.

Logo uploads go through the existing `logos` Storage bucket (Phase 1.5),
scoped via `buildTenantObjectPath` — same path-safety and RLS guarantees
as every other bucket, no new upload code path bypassing them.

## Input validation

All forms (login, signup, create-tenant) validate with Zod schemas
(`lib/validation/auth.ts`, `lib/validation/tenant.ts`) shared between the
client form and the Server Action that actually performs the mutation —
`createTenantAction` re-validates server-side regardless of what the
client-side form already checked, since a client can always bypass
client-side checks.

## Known gaps at the end of Phase 1.5 (still open through Phase 3)

- **Live verification is still outstanding.** Everything above describing
  RLS, storage, and authorization behavior is a description of the code as
  written and statically reviewed — none of it has run against a live
  Supabase project in this environment (no Docker daemon, no credentials).
  Do not treat any of it as empirically verified until
  `tests/integration/*` have actually run and passed against a real
  project — see docs/TESTING.md and docs/MIGRATION_VALIDATION.md. This
  applies equally to the Phase 3 onboarding tables/RLS/logo-storage
  authorization: `tests/integration/onboarding-isolation.test.ts` and
  `tests/e2e/onboarding-flow.spec.ts` are written and skip cleanly without
  a live backend, exactly like the tests above — not yet executed.
- Rate limiting is not implemented (no abstraction yet either). Needed
  before auth endpoints or any public form goes to production.
- Audit logging fails soft when the service-role key is missing (see
  above) — this needs a real alerting/monitoring story before production,
  not just a console warning.
- The two `tenant_memberships` role-hierarchy gaps above (tenant_admin
  self-promotion; loose reassignment) remain open.
- No rollback (`down`) migrations exist yet — see
  docs/MIGRATION_VALIDATION.md "Recovery procedure".
