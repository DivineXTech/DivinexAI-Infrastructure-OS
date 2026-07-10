# Architecture

## Stack

Next.js 16 App Router (Turbopack, React 19, TypeScript strict) + Supabase
(Postgres, Auth, Storage, RLS) + Zod + React Hook Form. See README.md for
the full list and local setup.

Two Next.js 16 behaviors worth knowing if you haven't used a recent Next
version: middleware is renamed **Proxy** (`src/proxy.ts`, not
`middleware.ts` — same semantics), and `params` / `searchParams` /
`cookies()` are all `Promise`-based (`await params`, `await cookies()`).

## Directory layout

```
src/
  app/                     Routes (App Router). Grouped by audience:
    (marketing)/           Public marketplace: /, /discover, /product/[slug], ...
    (auth)/                /login, /signup, /forgot-password, /verify-email
    onboarding/             Multi-step, resumable seller/buyer onboarding
    dashboard/              Creator dashboard (products, orders, storefront, ...)
    admin/                  Platform admin console
    checkout/, library/, account/, download/
  components/
    ui/                    Design system primitives (Button, Card, Input, ...)
    marketplace/           Product/creator cards, product grid
    dashboard/, admin/, auth/, layout/
  modules/                 Business logic, organized by domain — NOT by route.
    auth/                  Session + role resolution
    creators/               Creator membership + permission helpers
    catalog/                Public marketplace queries (search, listing)
    products/                Product CRUD server actions
    storefronts/              Storefront server actions
    checkout/                  Checkout session + order fulfillment service
    payments/                    PaymentProvider interface + mock implementation
    storage/                      StorageProvider interface + Supabase implementation
    files/                         Signed-download-URL service (entitlement gate)
    money/                          Fee/discount/commission calculations (pure functions)
    coupons/, team/, admin/, plans/  Domain-specific server actions
    audit/                            Audit log writer
  lib/
    supabase/              client.ts (browser), server.ts (SSR/RLS-scoped),
                             admin.ts (service-role, bypasses RLS), types.ts
    env.ts                 Typed, lazily-validated environment access
    utils.ts                cn(), formatMinorUnits(), slugify(), formatDate()
supabase/
  migrations/*.sql          Schema, enums, RLS policies, seed reference data
scripts/
  local-dev-auth-shim.sql   Local-only auth/storage schema emulation (see DATABASE.md)
  db-migrate-local.sh        Applies shim + migrations to a plain Postgres instance
  seed.ts                     Demo data seeding against a real Supabase project
tests/e2e/                   Playwright specs
```

**Why `modules/` and not just component-local logic?** Business rules
(pricing, entitlements, permissions) are reused across dashboard pages,
checkout, admin moderation, and route handlers. Keeping them out of
components means they're independently testable and the UI layer stays thin.

## Supabase client boundaries

Three distinct clients, used deliberately:

- `createSupabaseBrowserClient()` (`lib/supabase/client.ts`) — Client
  Components only (`"use client"`). Used for sign-in/sign-up forms and
  direct-to-storage file uploads via signed URLs.
- `createSupabaseServerClient()` (`lib/supabase/server.ts`) — Server
  Components, Server Actions, Route Handlers. Runs **with the caller's
  session**, so RLS applies to every query. This is the default for
  anything a signed-in user reads or writes about themselves or their own
  creator account.
- `createSupabaseAdminClient()` (`lib/supabase/admin.ts`) — service-role,
  **bypasses RLS**. Reserved for: (a) public marketplace reads that must
  work for anonymous visitors regardless of RLS scoping (catalog queries),
  and (b) the checkout/entitlement/ledger write path, where the server is
  the sole source of truth for price and must write across tables a buyer's
  own session could never touch (orders, payments, entitlements, ledger).
  Both files are marked `import "server-only"` so accidentally importing
  them into client code fails the build rather than leaking the key.

## Provider interfaces

Per the brief's requirement to stay provider-agnostic:

- `modules/payments/provider.ts` — `PaymentProvider` interface
  (`createPaymentIntent`, `verifyWebhook`, `refund`). Only
  `MockPaymentProvider` is implemented; Stripe/Paystack/Flutterwave adapters
  are Phase 2 (see PAYMENTS.md).
- `modules/storage/provider.ts` — `StorageProvider` interface (signed
  download/upload URLs, object removal). Implemented against Supabase
  Storage; swappable for another object store without touching callers.

Email and AI providers are **not yet scaffolded** — Phase 3 work, deferred
rather than built as unused dead code (see ROADMAP.md).

## Route groups and layout-level guards

`(marketing)` and `(auth)` are route groups (no effect on the URL).
`/dashboard`, `/admin`, `/library`, `/onboarding` each have a `layout.tsx`
that resolves the session once and redirects/404s before any child page
runs — child pages don't need to repeat the check, though several do call
`requireUser()`/`requireAdmin()` again as defense-in-depth (see
SECURITY.md).

`/@username` storefronts: Next.js reserves a leading `@` in an `app/`
folder name for parallel routes, so the real route is
`app/(marketing)/creator/[username]/page.tsx`, and `next.config.ts` rewrites
`/@:username` → `/creator/:username` so the public URL is still `/@username`.

## Money

All amounts are integer minor units (cents, kobo, ...). `modules/money/calculations.ts`
is the single place price/discount/fee/commission math happens — see
PAYMENTS.md for the full checkout calculation flow.
