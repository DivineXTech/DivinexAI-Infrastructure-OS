# Testing

## Unit tests (Vitest)

```bash
npm run test        # single run
npm run test:watch  # watch mode
```

Covers pure business logic that doesn't need a database:

- `src/modules/money/calculations.test.ts` — fee/discount/PWYW/commission
  math (15 cases): percentage vs fixed discount rounding, fee-caps-at-zero
  behavior, coupon-before-fee ordering, tax addition, negative-subtotal
  rejection.
- `src/lib/utils.test.ts` — `slugify()` and `formatMinorUnits()`.

Currently 19 tests, all passing, ~230ms.

## End-to-end tests (Playwright)

```bash
npm run test:e2e
```

`playwright.config.ts` builds and starts the production server automatically
(`webServer`). Set `PLAYWRIGHT_CHROMIUM_PATH` if you need a specific
Chromium binary (e.g. a pre-installed one in a sandboxed environment — do
not run `playwright install`, see the repo's environment notes).

- `tests/e2e/public-marketplace.spec.ts` — homepage, `/discover`, `/sell`,
  `/legal/[document]` (including a real 404 for an unknown document) render
  correctly without any Supabase configuration.
- `tests/e2e/auth-guards.spec.ts` — every protected route prefix
  (`/dashboard`, `/admin`, `/library`, `/account`, `/onboarding`) redirects
  a signed-out visitor to `/login?redirect_to=<path>`; `/login` and
  `/signup` render their forms.
- `tests/e2e/commerce-flow.spec.ts` — Flow C from the product brief
  (sign in → buy the free demo product → land in `/library/purchases`).
  **Skips itself** unless `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, since it needs a real,
  migrated, seeded Supabase project (`npm run db:migrate:local` or apply to
  a project, then `npm run seed`) to sign in against.

12 of 13 specs run and pass in this repo's sandbox (no Supabase project
available here); the 13th (`commerce-flow.spec.ts`) is the self-skip case
described above — verify it locally once you have a connected project.

### Two real bugs this suite caught

Worth noting because they demonstrate why the e2e layer exists rather than
trusting `next build` alone:

1. Protected routes **crashed** (raw 500, not a redirect) when Supabase
   wasn't configured, because `getCurrentUser()` threw instead of returning
   `null`. Fixed in `modules/auth/session.ts` — `isSupabaseConfigured()` is
   now checked first.
2. `proxy.ts` skipped the auth redirect entirely when Supabase wasn't
   configured ("routes needing auth render their own prompt"), which was
   inconsistent with fix #1. Since there's no way *any* session could exist
   without Supabase configured, `proxy.ts` now redirects protected routes to
   `/login?redirect_to=...` in that case too — the correct behavior, not a
   workaround.

## What full flow coverage (Flows A–J) would require

The product brief's ten end-to-end flows (creator onboarding → product
publish → admin approval → purchase → download → analytics → coupon →
affiliate → refund → AI generation → course enrollment → team permissions)
span features across all four phases. Phase 1 implements Flows A, B, C, D,
E, and J in the application; `commerce-flow.spec.ts` exercises C end-to-end
as the representative core-commerce path. F (affiliates), H (AI Studio), and
I (courses) have no application logic yet (ROADMAP.md) — nothing to test.
G (refunds) has schema and an admin data model but no refund-processing UI
yet — flagged as a Phase 2 gap rather than tested against a non-existent
button.

## Manual verification performed this session

Beyond the automated suites: `npm run build` succeeds cleanly; `npm run dev`
was started and every top-level public route was fetched and visually
inspected via HTML output; RLS was exercised directly against a local
Postgres instance with simulated `authenticated` sessions for two different
creator users plus a buyer, confirming cross-tenant reads/writes are
blocked and same-tenant reads/writes succeed (see DATABASE.md).
