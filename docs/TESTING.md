# Testing

## Commands

```bash
npm run typecheck   # tsc --noEmit
npm run lint         # eslint
npm test             # vitest run (unit + integration, integration auto-skips without a live backend)
npm run test:watch   # vitest, watch mode
npm run test:e2e     # playwright test (builds + starts the app first)
```

## Unit tests (`tests/unit/`)

- `navigation.test.ts` — role-based nav filtering (`filterNavByRole`).
- `utils.test.ts` — the `cn()` class-merging helper.
- `auth-validation.test.ts` — login/signup Zod schemas.

Vitest is configured (`vitest.config.ts`) to alias `server-only` and
`client-only` to a no-op stub (`tests/mocks/no-op-module.ts`) — those
packages throw unconditionally outside a Next.js/webpack build, which
would otherwise break any unit test that imports a module transitively
using them.

## Integration tests (`tests/integration/`)

- `tenant-isolation.test.ts` — proves a tenant owner cannot read another
  tenant's `tenants`/`tenant_memberships` rows via RLS. **Skips
  automatically** unless `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the environment point at a real
  (non-placeholder) Supabase project.

To actually run it:

```bash
supabase start
supabase db reset       # applies migrations + supabase/seed/seed.sql
npm run seed            # creates the demo auth users (scripts/seed.ts)
# set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY to the local
# Supabase instance's values (`supabase status` prints them), then:
npm test
```

This has **not** been executed in the sandbox this project was built in
(no live Supabase instance was available) — treat tenant isolation as
structurally implemented but not yet empirically verified until this has
been run once. See docs/SECURITY.md.

## E2E tests (`tests/e2e/`, Playwright)

`foundation.spec.ts` covers what Phase 1 actually ships:
- homepage renders the primary CTA,
- unauthenticated visitors are redirected away from `/app` and `/admin`,
- the login page renders its form fields.

`playwright.config.ts` builds and starts the app automatically
(`npm run build && npm run start`) against the placeholder `.env.local`
Supabase values, so it can validate routing/redirects without a live
backend. Full user-registration and cross-tenant-denial e2e flows (listed
in the product spec §25) need a live Supabase project and are not written
yet — add them once Phase 3 (onboarding, which creates the first real
tenant per signup) exists.

## What's proven vs. not, honestly

Proven (ran in this environment): typecheck, lint, unit tests, production
build, and a runtime smoke test (`curl` against `npm run start` — homepage
200s and renders its heading, `/login`/`/signup` 200, unauthenticated
`/app` 307s to `/login?next=%2Fapp`).

Not proven here (needs a real Supabase project): RLS tenant isolation,
signup → email confirmation → login flow, tenant switching.
