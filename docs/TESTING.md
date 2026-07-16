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
- `tenant-selection.test.ts` — `resolveCurrentTenantMembership`
  (`lib/auth/tenant-selection.ts`), the pure tenant-resolution logic
  extracted from `lib/auth/session.ts` during the pre-Phase-3 review fix
  specifically so it could be unit-tested without pulling in the
  Supabase/env/cookies() chain (which requires a configured environment
  just to import — see the note below). Covers the empty-list case
  (deterministic `null`, never a crash), slug matching, stale-cookie
  fallback, and multi-tenant switching.
- `onboarding-progress.test.ts` (Phase 3) — `lib/onboarding/progress.ts`:
  completion percentage, current-step derivation, and step-locking
  (`isStepAccessible` allows current/completed steps, denies anything
  ahead, allows re-editing).
- `startup-kit-engine.test.ts` (Phase 3) — determinism, per-method kit
  matching, the custom-recommendation fallback when nothing scores well,
  the equipment-owned category shift, the unconditional risk disclosure,
  budget-band-derived estimates (null for `custom_undecided`), rule-version
  stamping, recalculation on input change, and `isKitOverridden`.
- `launch-readiness-engine.test.ts` (Phase 3) — full completion scores 100/
  Launch Ready, empty input scores 0 without throwing, category sum equals
  total, blocking issues for missing brand/production/budget, label-band
  mapping, strengths/gaps categorization, priority actions capped at 5.
- `onboarding-validation.test.ts` (Phase 3) — the onboarding Zod schemas
  (`lib/validation/onboarding.ts`): required fields, closed enums, the
  budget allocation-sum-vs-total refine, and the product price min ≤ max
  refine.
- `onboarding-review-access.test.ts` (Phase 3) — `computeReviewAccess`
  (`lib/onboarding/review-access.ts`), the pure role→section-visibility
  mapping extracted from `lib/onboarding/guard.ts` for the same reason
  `tenant-selection.test.ts` exists: covers every role (owner/admin/
  designer/production_manager/denied roles) and the platform-super-admin
  override, with a determinism check against the same class of bug
  `61b1b83` fixed (no hidden state affecting the result).
- `print-zone-validation.test.ts` (Phase 4) — `lib/catalog/print-zone-validation.ts`:
  safe-boundary centering, in-zone-but-outside-safe-area vs.
  outside-the-zone-entirely warnings, and production-method support
  checks (including the "no restriction configured" default).
- `artwork-quality.test.ts` (Phase 4) — `lib/catalog/artwork-quality.ts`:
  DPI estimation, missing-dimensions/low-DPI/enlarged/no-transparency/
  JPEG-for-screen-printing warnings, and the invariant that every warning
  string includes "manual production review recommended."
- `variant-matrix.test.ts` (Phase 4) — `lib/catalog/variant-matrix.ts`:
  cartesian-product generation (including the "one dimension only" and
  "no dimensions at all" edge cases), the null-safe combination key, and
  duplicate detection.
- `pricing-engine.test.ts` (Phase 4) — `lib/catalog/pricing-engine.ts`:
  cost summation, profit/margin math (including the divide-by-zero
  guard), all four pricing rules (`fixed_markup`/`target_margin`/
  `tiered_quantity_markup`/`manual`), determinism, and the break-even
  placeholder's guarded computation.
- `history-reducer.test.ts` (Phase 4) — `lib/design-studio/history-reducer.ts`:
  every `DesignAction` variant applied in isolation, undo/redo
  correctness, redo-stack invalidation on a fresh dispatch, the bounded
  `MAX_HISTORY_DEPTH`, and replay-determinism.
- `project-schema.test.ts` (Phase 4) — serialize/parse round-trips for
  the normalized design-project state, and rejection of malformed
  elements/views rather than silent coercion.
- `svg-sanitizer.test.ts` (Phase 4) — `lib/catalog/svg-sanitizer.ts`:
  rejects non-SVG input, strips `<script>`/`<foreignObject>`/`<iframe>`/
  event-handler attributes/`javascript:` URIs, and neutralizes external
  `href`/`xlink:href` references while preserving same-document fragment
  ones.
- `image-dimensions.test.ts` (Phase 4) — `lib/catalog/image-dimensions.ts`:
  hand-built minimal PNG/JPEG/WebP binary fixtures prove the header
  parsing (width/height/transparency) is actually correct, not just
  plausible-looking; SVG width/height and viewBox fallback parsing.
- `product-activation.test.ts` (Phase 4) — `lib/catalog/product-activation.ts`:
  every gating condition (name/production method/variants/priced
  variant) individually and combined, reporting every missing
  requirement at once.
- `mockup-compose.test.ts` (Phase 4) — `lib/design-studio/mockup-compose.ts`:
  view-filtering, hidden-element exclusion, XML-escaping of text content
  (injection safety), conditional watermark inclusion, and garment-markup
  embedding.

Note on testability: `lib/auth/session.ts` validates required env vars at
*import* time (via `lib/env.ts`), so importing it directly in a Vitest
unit test throws immediately unless `NEXT_PUBLIC_SUPABASE_URL`/
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are set — this is why pure logic that
needs to be unit-testable (like tenant resolution) is factored into its
own side-effect-free module rather than tested via the session module
directly.

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
- `membership-isolation.test.ts` — regression coverage for the
  pre-Phase-3 membership row-scoping fix (see docs/SECURITY.md): a
  designer and owner in the same tenant each resolve only their own role,
  and the `multi-tenant@demo.kushprintco.local` persona (added to
  `scripts/seed.ts` alongside this fix) gets exactly its own two
  memberships back with no duplicates.
- `onboarding-isolation.test.ts` (Phase 3) — session creation + idempotent
  re-creation (unique-constraint-backed), step-progress upsert (one row,
  not a duplicate), cross-tenant denial on `onboarding_sessions` (read and
  write), recommendation persistence, the owner/admin-only tables
  (`budget_profiles`, `startup_kit_recommendations`,
  `launch_readiness_assessments`) rejecting designer/production_manager
  reads, `brand_profiles` designer read-only (read succeeds, write is
  silently blocked by RLS), the completion status transition and its
  cross-tenant denial, an audit-log row actually being written via the
  service-role client, and (separate `describe` block) logo-upload
  authorization on the `logos` bucket — owner succeeds, designer and a
  cross-tenant owner are both denied.
- `catalog-isolation.test.ts` (Phase 4) — platform garment template
  read-everywhere/write-nowhere-but-super-admin; tenant-created custom
  template invisible and unwritable to another tenant; a
  production_manager denied a draft design project but allowed the same
  project once approved; cross-tenant denial on design projects; design
  version persistence round-trips its stored jsonb state; duplicate
  size/color variant combination rejected at the database level; price
  history persistence; cross-tenant denial on products/variants; a
  designer denied product read entirely (no products grant at all);
  artwork storage isolation on the `design-uploads` bucket (upload/
  download/overwrite denial across tenants) including an SVG upload
  succeeding (the one MIME-allowlist change this phase makes); and
  audit-log write/read-scoping for Phase 4 actions.

To actually run the integration suite against a real project:

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

**This has not been executed against a real Supabase project in the
sandbox this project was built in** — no Docker daemon (`supabase start`
needs one) and no Supabase credentials of any kind are available here.
Treat every claim in docs/SECURITY.md about RLS/storage/auth behavior as
"implemented and statically reviewed," not "verified," until these have
actually run once — with one partial exception: a plain local Postgres
instance (no `auth`/`storage` extensions, no real authenticated sessions)
was available, so the Phase 4 migration and seed data were actually
applied and re-applied against it to prove idempotency and catch a real
bug — see docs/MIGRATION_VALIDATION.md. That is not equivalent to the
RLS-authenticated-session testing above, which still needs a real
Supabase project.

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
- `onboarding-flow.spec.ts` (Phase 3) — start → save-and-continue through
  welcome/brand, save-and-exit → dashboard reflects % complete → resume at
  the correct step, editing a previously-completed step, a locked
  not-yet-reached step redirecting instead of rendering, the startup-kit
  step showing a generated recommendation with its risk disclosure, a
  designer being denied the edit wizard while retaining scoped read-only
  review access, and completing onboarding reaching `/complete` with the
  dashboard showing "Review setup" afterward. Same `isLiveBackend` skip
  guard as `auth-flow.spec.ts` — real seeded-persona logins throughout.
- `design-studio-flow.spec.ts` (Phase 4) — opening the studio and
  creating a design; selecting a garment template and color; adding text
  and moving it via the accessible numeric position inputs (not drag);
  switching between front/back views; uploading artwork (using a
  minimal real PNG fixture at `tests/e2e/fixtures/test-artwork.png`);
  saving a draft and resuming with the same content after navigating
  away; submitting for review and confirming a designer has no approve
  button rendered at all; an owner approving the same design; converting
  the approved design into a product draft, generating a variant matrix,
  and editing pricing; and viewing a generated mockup labeled as a
  digital preview, not a production proof. Same `isLiveBackend` skip
  guard as the other flow specs.

`playwright.config.ts` builds and starts the app automatically
(`npm run build && npm run start`) and pins
`launchOptions.executablePath` to `/opt/pw-browsers/chromium` — this
sandbox only has the full Chromium binary preinstalled, not the
headless-shell variant Playwright's default project tries to launch, and
downloads are disabled.

## What's proven vs. not, honestly

**Proven (ran in this environment):** typecheck, lint, all unit tests
(including the Phase 3 and Phase 4 engine/validation/access-mapping tests
above — 200+ unit tests total), production build, a runtime smoke test,
and — as of Phase 2 — the full Playwright suite actually executed against
a running build in a real browser: `foundation.spec.ts` (4/4),
`marketing.spec.ts` (10/10). That covers real routing/redirects, real
navigation and mobile-menu interaction, the apparel demo's client-side
state, the FAQ accordion, honest pricing rendering, lead-form client
validation, and — importantly — that the lead form fails gracefully (not
silently, not with a fake success) when no Supabase service-role key is
configured, which is exactly this sandbox's actual state. Every Phase 3
and Phase 4 route also compiles and renders under `next build`'s route
listing (all 11 onboarding routes + all 14 Phase 4 catalog/design-studio
routes present, server-rendered on demand). Phase 4's migration and seed
data were additionally proven to apply cleanly and idempotently against
a real local Postgres instance (see docs/MIGRATION_VALIDATION.md) — a
level of verification the earlier migrations did not get, since a
Postgres binary happened to be available in this sandbox even though a
full Supabase stack (Auth, Storage, RLS-authenticated sessions) is not.

**Not proven here (needs a real Supabase project + Docker or a hosted
dev project):** RLS tenant isolation, storage isolation, the
privilege-escalation trigger, real signup → email confirmation → login
(`auth-flow.spec.ts` skips these), tenant creation via
`createTenantAction`, tenant switching, audit-log writes, and lead rows
actually persisting to a `leads` table — plus every onboarding (Phase 3)
and catalog/design-studio (Phase 4) integration/e2e test
(`onboarding-isolation.test.ts`, `onboarding-flow.spec.ts`,
`catalog-isolation.test.ts`, `design-studio-flow.spec.ts`): session/step
persistence, cross-tenant onboarding and catalog denial, the designer/
production-manager/sales-rep read scoping, logo and design-artwork
upload authorization, the full wizard and design-studio UI flows, design
approval authorization, and the dashboard reflecting real completion/
catalog state. All of the above are implemented and statically reviewed
(see docs/MIGRATION_VALIDATION.md), not empirically verified. Do
not report otherwise.
