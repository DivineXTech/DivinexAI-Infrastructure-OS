# Testing

## Commands

```bash
npm run typecheck   # tsc --noEmit
npm run lint         # eslint
npm test             # vitest run (unit + integration; integration auto-skips without a live backend)
npm run test:watch   # vitest, watch mode
npm run test:e2e     # playwright test (builds + starts the app first)
```

## Unit tests (`tests/unit/`)

- `navigation.test.ts` — role-based nav filtering (`filterNavByRole`).
- `utils.test.ts` — the `cn()` class-merging helper.
- `auth-validation.test.ts` — login/signup Zod schemas.
- `safe-redirect.test.ts` — the open-redirect guard (`getSafeRedirectPath`)
  found and fixed in Phase 1.5; covers absolute URLs, protocol-relative
  `//`, backslash tricks, and embedded control characters.
- `storage-paths.test.ts` — `buildTenantObjectPath`/`sanitizeFilename`
  path-traversal and filename-sanitization guarantees.
- `lead-validation.test.ts` — the lead-capture Zod schema (consent must be
  `true`, honeypot field doesn't block validity).
- `tenant-validation.test.ts` — tenant slug normalization and the
  reserved-word list.
- `pricing-content.test.ts` — guards against someone later hardcoding a
  fabricated price into `lib/content/pricing.ts` without updating this
  test intentionally.

Vitest is configured (`vitest.config.ts`) to alias `server-only` and
`client-only` to a no-op stub (`tests/mocks/no-op-module.ts`) — those
packages throw unconditionally outside a Next.js/webpack build, which
would otherwise break any unit test that imports a module transitively
using them.

## Integration tests (`tests/integration/`)

All skip via `describe.skipIf(!isLiveBackend)` (or `!hasServiceRole` for
the storage suite) — **skip, not pass**, when there's no real Supabase
project configured. `tests/integration/helpers.ts` centralizes the
skip-detection, seeded-persona sign-in, and service-role client used by
every file below.

- `tenant-isolation.test.ts` — a tenant owner cannot read another
  tenant's `tenants`/`tenant_memberships` rows.
- `rls-authorization.test.ts` — the broader Phase 1.5 list:
  cross-tenant insert/update/delete denial, the
  `is_platform_super_admin` self-escalation attempt (must error — see
  docs/SECURITY.md), a designer attempting an owner-only `tenants`
  update, a no-membership user reading zero rows everywhere, and a
  platform super admin's explicit (membership-independent) read access.
- `storage-isolation.test.ts` — a tenant member cannot download or
  overwrite another tenant's object in a private bucket; requires
  `SUPABASE_SERVICE_ROLE_KEY` (used only to seed/clean up the test
  object, never for the isolation assertions themselves).

To actually run all three:

```bash
supabase start          # or `supabase link` to a hosted dev project
supabase db push         # applies supabase/migrations/*.sql
supabase db reset        # clean-database run + supabase/seed/seed.sql
# in .env.local:
#   SEED_MODE_ENABLED=true
#   SUPABASE_SERVICE_ROLE_KEY=<from `supabase status`>
#   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY=<from `supabase status`>
npm run seed             # creates every persona in scripts/seed.ts
npm test
```

**This has not been executed in the sandbox this project was built in** —
no Docker daemon (`supabase start` needs one) and no Supabase credentials
of any kind are available here. Treat every claim in docs/SECURITY.md
about RLS/storage/auth behavior as "implemented and statically reviewed,"
not "verified," until these have actually run once. See
docs/MIGRATION_VALIDATION.md for the static review that was possible here.

## E2E tests (`tests/e2e/`, Playwright)

- `foundation.spec.ts` — homepage renders the primary CTA; unauthenticated
  visitors are redirected away from `/app` and `/admin`; the login page
  renders its form fields. Runs against the placeholder `.env.local`
  Supabase values — no live backend needed for these, since they only
  exercise routing/redirects, not real auth.
- `auth-flow.spec.ts` — registration → login → logout → protected-route
  access, written per the Phase 1.5 spec's auth-validation list.
  **Requires a live Supabase project** (real signup/login calls go over
  the network to the configured `NEXT_PUBLIC_SUPABASE_URL`) and is
  skipped via an environment check at the top of the file when pointed at
  the placeholder project — same reasoning as the integration tests
  above, just at the Playwright layer instead of Vitest's `describe.skipIf`.
- `marketing.spec.ts` (Phase 2) — desktop nav, mobile menu, every public
  route returns 200, sitemap/robots content, the interactive apparel
  demo's rotate/color/reset controls, the FAQ accordion, pricing's
  "Request pricing" honesty check, and lead-form validation. The final
  lead-form test branches on `isLiveBackend`: without a live project it
  asserts the honest "isn't connected yet" failure message (see
  `lib/leads/actions.ts`); with one, it would assert the success state
  instead — same pattern as the integration tests.

`playwright.config.ts` builds and starts the app automatically
(`npm run build && npm run start`) and pins
`launchOptions.executablePath` to `/opt/pw-browsers/chromium` — this
sandbox only has the full Chromium binary preinstalled, not the
headless-shell variant Playwright's default project tries to launch, and
downloads are disabled.

## What's proven vs. not, honestly

**Proven (ran in this environment):** typecheck, lint, all unit tests,
production build, a runtime smoke test, and — as of Phase 2 — the full
Playwright suite actually executed against a running build in a real
browser: `foundation.spec.ts` (4/4), `marketing.spec.ts` (10/10). That
covers real routing/redirects, real navigation and mobile-menu
interaction, the apparel demo's client-side state, the FAQ accordion,
honest pricing rendering, lead-form client validation, and — importantly
— that the lead form fails gracefully (not silently, not with a fake
success) when no Supabase service-role key is configured, which is
exactly this sandbox's actual state.

**Not proven here (needs a real Supabase project + Docker or a hosted
dev project):** RLS tenant isolation, storage isolation, the
privilege-escalation trigger, real signup → email confirmation → login
(`auth-flow.spec.ts` skips these), tenant creation via
`createTenantAction`, tenant switching, audit-log writes, and lead rows
actually persisting to a `leads` table. All of the above are implemented
and statically reviewed (see docs/MIGRATION_VALIDATION.md), not
empirically verified. Do not report otherwise.
