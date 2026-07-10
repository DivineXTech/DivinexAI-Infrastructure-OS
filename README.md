# FlowraMarket Africa

**Africa's AI-powered marketplace for creators, digital entrepreneurs, developers, educators, agencies, and local businesses.**

_Create it. Sell it. Scale it._

FlowraMarket Africa is a creator-commerce marketplace: storefronts, digital
product checkout, protected file delivery, marketplace discovery, and a
creator/admin operating system, built African-first and designed to scale
globally.

This repository is the **Phase 1 foundation** — see [ROADMAP.md](./ROADMAP.md)
for what's built versus planned.

## Product overview

- **Creators** onboard, build a storefront at `/@username`, publish products
  (downloadable files, courses, services, memberships, bundles, free/PWYW),
  and manage orders, customers, discount codes, and earnings from a dashboard.
- **Buyers** discover products in the public marketplace, check out, and get
  instant, entitlement-gated access to purchases from `/library`.
- **Admins** moderate new product submissions, review seller verification,
  and see a platform-wide audit log from `/admin`.

Payments run through a provider-agnostic `PaymentProvider` interface. Phase 1
ships only the **mock provider** (no real money moves) — see
[PAYMENTS.md](./PAYMENTS.md).

## Technology stack

- **Next.js 16** (App Router, Turbopack, React 19), TypeScript strict mode
- **Tailwind CSS v4** (CSS-first theme, see `src/app/globals.css`)
- **Supabase**: Postgres, Auth, Storage, Row-Level Security
- **Zod** for validation, **React Hook Form** for forms
- **Vitest** for unit tests, **Playwright** for end-to-end tests
- Business logic lives in `src/modules/<domain>`, not in components — see
  [ARCHITECTURE.md](./ARCHITECTURE.md)

## Local setup

```bash
npm install
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY from a Supabase project (see ENVIRONMENT.md)
```

The app **builds and runs without Supabase configured** — every
Supabase-backed page renders a clear "Supabase is not configured" notice
instead of crashing, and protected routes (`/dashboard`, `/admin`,
`/library`, `/account`, `/onboarding`, `/checkout`) redirect to `/login`.
Nothing works end-to-end (auth, checkout, dashboards) until a project is
connected.

### Database setup

Apply the migrations in `supabase/migrations/*.sql`, in order, to your
Supabase project — either via the Supabase SQL editor, the `supabase` CLI, or
`psql`:

```bash
# Against a Supabase project's connection string:
DATABASE_URL="postgres://postgres:<password>@<host>:5432/postgres" \
  bash -c 'for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done'
```

To sanity-check migrations locally against a plain PostgreSQL instance
(no Supabase project needed — this is how the migrations in this repo were
validated), see `scripts/local-dev-auth-shim.sql` and:

```bash
DATABASE_URL="postgres://postgres@localhost:5432/flowramarket_dev" npm run db:migrate:local
```

The shim script emulates `auth.uid()` and the `storage` schema well enough
to validate table/RLS syntax; it is never applied to a real Supabase project
(which already provides both).

### Seed data

```bash
npm run seed
```

Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to be
set. Creates five demo African creators (Nigeria, Kenya, Ghana, South
Africa) with published storefronts and products, one demo buyer account, and
grants `super_admin` to the first address in `ADMIN_EMAIL_ALLOWLIST` if set.
All seed data is clearly fictional — see `scripts/seed.ts`.

### Commands

```bash
npm run dev          # start the dev server
npm run build         # production build
npm run start          # run the production build
npm run lint            # ESLint
npm run typecheck        # tsc --noEmit
npm run test               # Vitest unit tests
npm run test:watch          # Vitest in watch mode
npm run test:e2e              # Playwright end-to-end tests
npm run db:migrate:local        # apply migrations to a local Postgres instance
npm run seed                     # seed demo data against a connected Supabase project
```

## Supported payment providers

Phase 1 ships **only the mock provider** (`PAYMENT_MODE=mock`, the default).
It simulates a successful or failed payment instantly with no external call
— a buyer email starting with `declined@` simulates a decline. Stripe,
Paystack, and Flutterwave adapters are architected for (see
`src/modules/payments/provider.ts`) but not implemented — see
[PAYMENTS.md](./PAYMENTS.md) and [ROADMAP.md](./ROADMAP.md).

## Current limitations

Phase 1 deliberately does not include: real payment providers, payouts,
courses/memberships delivery, affiliates, subscriber/email tools, reviews,
AI Creator Studio, or multilingual UI. These have database schema in place
(see [DATABASE.md](./DATABASE.md)) but no application logic yet. Anywhere
the UI shows a feature that isn't live, it's labeled "Coming soon" rather
than presented as working.

## Documentation index

- [ARCHITECTURE.md](./ARCHITECTURE.md) — module layout, provider interfaces
- [DATABASE.md](./DATABASE.md) — schema, RLS model, migration list
- [PAYMENTS.md](./PAYMENTS.md) — checkout flow, money model, provider plan
- [SECURITY.md](./SECURITY.md) — controls implemented and their rationale
- [THREAT_MODEL.md](./THREAT_MODEL.md) — threats considered and mitigations
- [DEPLOYMENT.md](./DEPLOYMENT.md) — deploying to Vercel + Supabase
- [ENVIRONMENT.md](./ENVIRONMENT.md) — every environment variable explained
- [TESTING.md](./TESTING.md) — test strategy and how to run each suite
- [ROADMAP.md](./ROADMAP.md) — phased plan and what's built so far
- [COMPLIANCE_NOTES.md](./COMPLIANCE_NOTES.md) — what still needs legal review
- [API_INTEGRATION_GUIDE.md](./API_INTEGRATION_GUIDE.md) — adding a payment/email/AI provider
- [ADMIN_OPERATIONS.md](./ADMIN_OPERATIONS.md) — running the admin console
