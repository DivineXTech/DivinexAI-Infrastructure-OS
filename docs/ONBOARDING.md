# Onboarding (Phase 3)

A resumable, server-authoritative wizard that walks a new tenant owner/admin
through brand identity, audience, product strategy, production method,
budget, a startup-kit recommendation, storefront and fulfillment
preferences, then a review page with a launch-readiness score. Scope is
deliberately bounded to *planning inputs* — no product catalog, storefront
builder, or commerce functionality ships in this phase (that's Phase 4+).

## Routes

All under `/app/onboarding/`, gated by `lib/onboarding/guard.ts`:

| Route | Step key | Purpose |
|---|---|---|
| `/app/onboarding` | — | Pre-existing Phase 1 tenant-creation entry point (unchanged). |
| `/app/onboarding/welcome` | `welcome` | What the wizard covers, how long it takes. |
| `/app/onboarding/brand` | `brand` | Name, tagline, description, logo, colors, typography, personality. |
| `/app/onboarding/audience` | `audience` | Customer types, age ranges, market type, style preferences. |
| `/app/onboarding/products` | `products` | Categories, launch quantity, design count, price range, sales model. |
| `/app/onboarding/production` | `production` | Method, experience level, workspace, volume, equipment owned. |
| `/app/onboarding/budget` | `budget` | Budget band, optional precise total + 8-line allocation. |
| `/app/onboarding/startup-kit` | `startup_kit` | Deterministic recommendation (see docs/STARTUP_KIT_ENGINE.md), with override. |
| `/app/onboarding/storefront` | `storefront` | Storefront name/theme, domain status, payment-method planning. |
| `/app/onboarding/fulfillment` | `fulfillment` | Fulfillment model, lead time, shipping regions, return policy, QC. |
| `/app/onboarding/review` | `review` | Section-by-section summary, launch-readiness score (see docs/LAUNCH_READINESS.md), completion. |
| `/app/onboarding/complete` | — | Confirmation screen after `review` completes the session. |

## Data model

One row per tenant for every preference table (`tenant_id uuid not null
unique references tenants(id)`), plus `onboarding_sessions` (one per
tenant) and `onboarding_step_progress` (one row per session per step).
Migration: `supabase/migrations/20260718000000_onboarding.sql`. Full table
list in docs/DATABASE.md.

One-row-per-tenant is what makes every save idempotent: every write is an
`upsert(..., { onConflict: "tenant_id" })` in `lib/onboarding/data-access.ts`
— a page refresh or duplicate form submission updates the same row instead
of creating a second one. There is no code path that inserts a second
`onboarding_sessions` row for a tenant; a concurrent double-start is caught
by the `tenant_id unique` constraint and falls back to resuming the
existing row (`lib/onboarding/session.ts`, `startOrResumeOnboardingSession`).

## Resumability

- `onboarding_step_progress` (one row per `(session_id, step_key)`) is the
  single source of truth for what's done. `lib/onboarding/progress.ts`
  (pure, no I/O) derives:
  - `computeCompletionPercentage` — `completed / total steps`, rounded.
  - `computeCurrentStep` — the first non-completed step in order (stays on
    the last step once everything is done).
  - `isStepAccessible` — a step is reachable if its index is `<=` the
    current step's index. Completed steps stay reachable forever, so
    founders can go back and edit anything.
- `lib/onboarding/guard.ts`'s `requireOnboardingStepAccess(step)` enforces
  this server-side on every wizard page: requesting a step ahead of the
  current one **redirects** to the current step rather than rendering —
  the lock is not just a disabled Next/Continue button in the UI.
- "Save and exit" (every step form) returns to `/app`; the dashboard
  (`app/app/page.tsx`) shows completion % and a "Resume onboarding" link to
  the current step, or a "Review setup"/readiness summary once complete.
- Editing a completed step re-runs `markStepCompleted` with `isEdit: true`
  (distinct audit action, `onboarding.step_edited` vs.
  `onboarding.step_completed`) but does not regress `current_step`.

## Authorization model (section 17)

- **`tenant_owner` / `tenant_admin`** — full edit access to every wizard
  step and the review page; the only roles that can complete onboarding.
- **`designer`** — read-only on the review page, scoped to brand + product
  sections only (mirrors the `brand_profiles`/`brand_product_preferences`
  designer-read RLS policies exactly).
- **`production_manager`** — read-only on the review page, scoped to the
  production section only (mirrors the `production_preferences`
  production-manager-read RLS policy).
- **Every other role** (`sales_rep`, `support_agent`, `fulfillment_operator`,
  `customer`, and no membership at all) — denied entirely; an attempt is
  logged as `privileged_action.denied`.
- **"Authorized manager"** from the spec is *not* implemented as a new,
  distinct role in this phase. The existing role model has no such tier,
  and adding one is a schema/seed change with a blast radius well beyond a
  bounded onboarding interface. `tenant_owner`/`tenant_admin` cover the
  "can edit everything" case the spec describes; true configurable
  per-user entitlements are deferred to the `permissions`/`role_permissions`
  tables already reserved for that purpose (currently unused anywhere in
  the codebase) — a natural Phase 8 (white-label/admin) concern.
- Authorization is **never** derived from a client-submitted role value.
  Every check resolves the caller's role from their own authenticated
  session via `requireCurrentTenantRole`/`getCurrentTenantMembership`
  (`lib/auth/session.ts`), and every onboarding query is scoped by an
  explicit `tenant_id` resolved the same way — the same pattern the
  membership row-scoping fix in `61b1b83` established, not repeated as a
  separate implementation. See `lib/onboarding/data-access.ts`'s top-of-file
  comment and `lib/onboarding/review-access.ts` (the pure, unit-tested
  role→section-visibility mapping used by the guard).

## Audit logging

`lib/audit/log.ts`'s `AuditAction` union gained: `onboarding.started`,
`onboarding.step_completed`, `onboarding.step_edited`,
`onboarding.brand_slug_changed` (reserved — no brand-slug-editing UI exists
in this phase, so this action key is currently unused; see docs/TECH_DEBT.md),
`onboarding.logo_uploaded`, `onboarding.logo_removed`,
`onboarding.startup_kit_recommended`, `onboarding.startup_kit_overridden`,
`onboarding.completed`, `onboarding.reopened`. Every write goes through the
service-role client and never includes precise budget figures — only safe
metadata (step keys, kit slugs, rule versions), per the spec's "never log
sensitive financial details beyond safe budget-band metadata" constraint.

## Logo upload

Real upload to the existing `logos` Storage bucket (provisioned in Phase
1.5, `supabase/migrations/20260716000000_storage.sql`), scoped to
`{tenantId}/logo/...` via `buildTenantObjectPath` — same path-safety and
RLS guarantees as every other bucket. PNG/JPEG/WebP only, 5 MB max,
enforced both client-side (`app/app/onboarding/wizard-actions.ts`) and by
the bucket's own `file_size_limit`/`allowed_mime_types`.

## Known limitations

- Live Supabase isolation (RLS on the 11 new tables, storage authorization
  for logo uploads, audit-log writes) is implemented and statically
  reviewed but **not empirically verified** in this sandbox — no Docker
  daemon, no Supabase credentials. See docs/TESTING.md.
- The startup-kit and launch-readiness engines are deterministic and unit
  tested in isolation; their *end-to-end* wiring (real form → real DB →
  real recommendation) is covered by integration/e2e tests that are
  written but skip without a live backend — see docs/TESTING.md for
  exactly what that means.
- `onboarding.brand_slug_changed` has no corresponding UI in this phase
  (brand identity doesn't expose a separate storefront-slug field yet);
  the action key exists for forward compatibility, not because it fires
  today.
