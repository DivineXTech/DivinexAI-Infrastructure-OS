# Security

Controls actually implemented in Phase 1, and where to find them.

## Authorization: server + database, not just UI

Every protected route has a layout-level guard (`getCurrentUser()` /
`requireUser()` / `requireAdmin()` in `modules/auth/session.ts`) that
redirects/404s before any child page runs, **and** every table has
Row-Level Security enabled (see DATABASE.md), so a request that somehow
bypassed the layout guard (a raw fetch to a Server Action, for instance)
still can't read or write another user's or creator's data — the database
enforces it independently of the application code.

Admin routes 404 (not 403) for a signed-in non-admin
(`app/admin/layout.tsx`), so the route's existence isn't disclosed.

## Authentication

Supabase Auth via `@supabase/ssr`. `src/proxy.ts` (Next 16's renamed
middleware) refreshes the session cookie on every request and does an
**optimistic** redirect-to-login for protected path prefixes before a page
even renders; the real authorization check happens again server-side per
DATABASE.md's RLS model — proxy-level checks are a UX optimization, not the
security boundary.

## Financial data integrity

- Prices are always computed server-side (PAYMENTS.md) — the checkout form
  submits a product ID, never an amount.
- `order_items` snapshots price/title at purchase time — editing a product
  later never rewrites history.
- `ledger_entries` is append-only in practice: application code only ever
  inserts, never updates or deletes a ledger row; corrections are meant to
  be new rows (no correction flow exists yet — Phase 2).
- Checkout/order/payment/entitlement/ledger tables have **no client-facing
  write policy** — only the service-role client (used exclusively inside
  `modules/checkout/service.ts`) can write them.

## Protected file delivery

`modules/files/service.ts#getSignedDownloadUrl` is the **only** code path
that can produce a URL for a `product-files` object:

1. Looks up the `entitlements` row by ID **and** `buyer_id = <caller>` —
   an entitlement ID for someone else's purchase simply doesn't match.
2. Rejects if the entitlement isn't `active`, is expired, or has hit its
   `download_limit`.
3. Mints a 5-minute signed URL via the storage provider.
4. Logs a `download_events` row and increments `downloads_used`.

There is no public read policy on the `product-files` storage bucket or on
the `product_files` table for `anon`/`authenticated` roles (verified by a
direct query attempt during RLS testing — 0 rows returned for a
non-owning, non-purchasing user) — a buyer cannot reach a file by guessing
or editing a storage path or route parameter, only through this function.

## Idempotency

`payment_events` has a unique constraint on `(provider, provider_event_id)`
so a duplicate webhook delivery can be detected before processing — wired
into the schema now; real provider webhook handlers land in Phase 2.

## Input validation

Every Server Action validates its `FormData`/input with Zod before touching
the database (see any file in `modules/*/actions.ts`). Route parameters
that become database lookups (product slugs, entitlement/file IDs) are
looked up by exact match, never interpolated into SQL — all data access
goes through the Supabase client's parameterized query builder.

## Secrets

`SUPABASE_SERVICE_ROLE_KEY` is only read from `lib/supabase/admin.ts`,
marked `import "server-only"` — importing it from a Client Component fails
the build. No secret is committed; `.env.example` contains placeholders
only, and `.gitignore` excludes `.env*.local`.

## What's deliberately not implemented in Phase 1

Listed here rather than silently absent, per the "no non-functional
buttons" rule — none of these have a UI entry point that claims to work:

- Rate limiting on auth endpoints, MFA, account lockout
- Malware scanning on uploaded files
- CSRF tokens (Server Actions get Next's built-in Origin-header check;
  no additional token scheme is layered on top yet)
- Suspicious-login / refund-abuse / coupon-abuse detection hooks
- Payout-change verification (no payouts exist yet)

See THREAT_MODEL.md for the fuller reasoning behind what's in and out of
scope for Phase 1.
