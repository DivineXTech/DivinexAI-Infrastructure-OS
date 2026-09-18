# Architecture

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript strict · React 19 ·
Tailwind CSS v4 · hand-built shadcn/ui-style primitives (see below) ·
Supabase (Postgres, Auth, Storage, RLS) · Zod · React Hook Form ·
TanStack Query · Server Actions · Vitest · Playwright.

> **Next.js 16 note:** this project uses Next 16, which renamed Middleware
> to **Proxy** (`proxy.ts`, same behavior, new name) and introduces optional
> **Cache Components** (`cacheComponents` config flag, off by default here).
> If you're used to Next 13-15 conventions, skim
> `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` before
> assuming `middleware.ts` semantics.

### Why hand-built UI primitives instead of the shadcn CLI

This sandbox's network policy blocks `ui.shadcn.com` (used by `npx shadcn
init`/`add`). `components/ui/*` is therefore hand-written to the same
conventions (Radix primitives + `class-variance-authority` + `cn()`), and
`components.json` documents the intended config so the real CLI can be used
going forward once run somewhere with access to that host.

## Request-time boundaries

There are three distinct execution contexts in this app, and code must not
cross them carelessly:

1. **Server** (Server Components, Server Actions, Route Handlers) — reads
   `lib/env.ts` (`server-only`), uses `lib/supabase/server.ts`.
2. **Client** (Client Components running in the browser) — reads
   `lib/env.client.ts` (`client-only`), uses `lib/supabase/client.ts`.
3. **Edge/Proxy** (`proxy.ts`) — neither of the above; it reads
   `NEXT_PUBLIC_*` values directly from `process.env` because importing
   either `lib/env.ts` or `lib/env.client.ts` from Proxy trips their
   `server-only`/`client-only` guards (this tripped up the initial build —
   see the git history on this file if you hit it again).

## Layouts vs. pages vs. "current tenant"

App Router layouts do **not** receive `searchParams`, so "which tenant is
the user currently acting as" is resolved via a cookie
(`kpc_tenant_slug`, see `lib/auth/session.ts`), not a query string. The
tenant switcher (`components/app-shell/tenant-switcher.tsx`) calls the
`setCurrentTenantAction` Server Action (`app/app/actions.ts`), which
re-validates membership before setting the cookie, then the page/layout
re-reads it via `getCurrentTenantMembership()` / `requireCurrentTenantRole()`.

## Directory layout

See `docs/IMPLEMENTATION_PLAN.md` §2 for the full intended layout. As of
Phase 1:

```
app/
  (marketing)/          public site — homepage + terms/privacy/contact stubs
  (auth)/login, signup  real Supabase auth forms
  app/                  authenticated tenant app shell + 20 routes (mostly
                        "Coming Soon" placeholders gated by real role checks)
  admin/                platform admin shell + 14 routes (placeholders,
                        gated by requirePlatformSuperAdmin)
components/
  ui/                   hand-built shadcn-style primitives
  app-shell/            sidebar, topbar, breadcrumbs, command palette,
                        tenant switcher, notifications, mobile nav
lib/
  auth/                 role constants + server-side session/authorization
  supabase/             browser/server/service-role clients + hand-written
                        Database types
  payments/             provider-neutral interface + mock provider
  divinexai/            service interfaces + mock assistant
  validation/           zod schemas
  env.ts / env.client.ts
supabase/
  migrations/            foundation schema (this phase)
  seed/                  dev-only SQL seed (roles + 2 tenants)
scripts/seed.ts          dev-only auth user + membership seeding
tests/
  unit/, integration/, e2e/
```

## Authorization model

Two independent layers, both required (see docs/SECURITY.md for the full
rationale):

1. **Database RLS** — the ground truth. Every tenant-owned table is
   default-deny with narrow allow policies keyed off `auth.uid()`.
2. **Application-layer checks** — `lib/auth/session.ts` functions
   (`requireTenantRole`, `requireCurrentTenantRole`,
   `requirePlatformSuperAdmin`) that **redirect**, not just hide UI, when a
   route's role requirement isn't met. `proxy.ts` only does an optimistic
   signed-in/signed-out redirect; it is explicitly not the authorization
   boundary.

## What's stubbed vs. real in Phase 1

Real: Supabase auth (signup/login/logout), tenant/membership/role schema +
RLS, the app/admin shells (nav, breadcrumbs, command palette, mobile nav,
notifications stub, tenant switcher), server-side route gating.

Stubbed (clearly labeled in UI, not represented as working): every `/app/*`
and `/admin/*` feature route beyond the dashboard/overview shells; payments
(mock provider only); DivinexAI services (mock assistant only); dashboard
metrics (empty states, no fabricated numbers).
