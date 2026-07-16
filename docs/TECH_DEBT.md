# Technical Debt — Pre-Phase-3 Code Review Batch

A high-effort code review of the full branch (Phase 0–2) ahead of Phase 3
surfaced 10 findings. The top 2 were confirmed security/reliability bugs
and were fixed immediately — see docs/SECURITY.md "Membership row-scoping
fix." The remaining 8 are real but lower-severity (efficiency, reuse,
simplification, altitude) and are recorded here as a bounded batch rather
than fixed ad hoc mid-phase. None of them block Phase 3. Pick these up as
a dedicated pass, or opportunistically when touching the same files.

1. **No request-level caching in `lib/auth/session.ts`.**
   `getCurrentProfile()`, `listMyTenantMemberships()`, and
   `getCurrentTenantMembership()` aren't wrapped in React's `cache()`, so a
   single `/app/*` page load re-runs the same `profiles`/
   `tenant_memberships`/`tenants`/`roles` queries multiple times (once in
   the layout, again in the page's own `requireCurrentTenantRole` call).
   Fix: wrap the exported fetch functions in `cache()` from `"react"`.

2. **`isLiveBackend` detection was drifted, now consolidated** —
   already fixed as part of this same pass (see
   `tests/shared/backend-env.ts`); listed here only for completeness since
   it was one of the 10 findings.

3. **Duplicated "service-role client unavailable" error handling.**
   `lib/leads/actions.ts` (`submitLeadAction`) and
   `app/app/onboarding/actions.ts` (`createTenantAction`) each repeat an
   identical try/catch around `createSupabaseServiceRoleClient()` with a
   near-duplicate error message. Fix: a shared
   `getServiceRoleClientOrError(featureName)` helper in
   `lib/supabase/server.ts`.

4. **Per-route role checks duplicated instead of centralized.**
   `lib/navigation.ts`'s `NavItem.roles` (for nav visibility) and the
   `requireCurrentTenantRole(ROLES)` call copy-pasted at the top of each
   `app/app/*/page.tsx` stub (for enforcement) are two independent sources
   of truth that can silently drift. Fix: a route → allowed-roles table
   consulted once, ideally in `app/app/layout.tsx`, instead of ~20+
   per-page copies — worth doing before Phase 4 multiplies the pattern.

5. **`create-tenant-form.tsx`'s redundant controlled/uncontrolled slug
   state.** `tenantSlug` is tracked via react-hook-form's uncontrolled
   `register()`, a `watch()` subscription, and an explicit `value=` prop
   simultaneously. Fix: drop `watch()`/the controlled `value` prop;
   `setValue()` alone keeps the field in sync.

6. **Duplicated demo-tenant/password constants.** `scripts/seed.ts` and
   `tests/integration/helpers.ts` each hardcode
   `KUSHPRINTCO_TENANT_ID`/`ISOLATION_TENANT_ID`/the demo password
   independently. Fix: one shared fixtures module both import from.

7. **Inconsistent `aria-describedby` wiring across forms.** The
   Label+Input+error-message pattern is copy-pasted across
   `lead-form.tsx`, `login/page.tsx`, `signup/page.tsx`, and
   `create-tenant-form.tsx`; `login/page.tsx` wires `aria-describedby` to
   the error message, the other three don't. Fix: a shared form-field
   wrapper component, and fix the missing `aria-describedby` while at it
   (this one is an accessibility regression worth prioritizing within the
   batch).

8. **`createTenantAction`'s independent reads/writes aren't
   parallelized.** The slug-uniqueness check and the `tenant_owner`
   role-id lookup are independent reads awaited sequentially; the two
   trailing `writeAuditLog` calls are also sequential. Fix: wrap each pair
   in `Promise.all`.

Not included above (reviewed and found to be non-issues): the FAQ/JSON-LD
structure, the apparel demo's SVG rendering, migration idempotency, and
CLAUDE.md/AGENTS.md convention compliance — all clean per the same review
pass.

## Phase 3 — known limitations, recorded rather than deferred silently

9. **`onboarding.brand_slug_changed` audit action is unused.** The action
   key exists in `lib/audit/log.ts`'s `AuditAction` union per the spec's
   required audit-event list, but no UI in this phase edits a separate
   storefront/brand slug (brand identity in this phase covers name,
   colors, typography, personality — not a URL slug). Fix when a
   brand-slug-editing surface actually ships (likely Phase 4/5 storefront
   work); don't wire a fake trigger just to exercise the key.
10. **Startup-kit and launch-readiness engines are not `cache()`-wrapped.**
    Both are pure and cheap (no I/O), so this isn't a correctness issue,
    but the review page recomputes `calculateLaunchReadiness` from four
    parallel data-access reads on every load rather than memoizing within
    a request. Same shape as tech-debt item 1 above; worth doing together.
11. **Age ranges, style preferences, shipping regions, and payment-method
    keys are UI-local constants, not database-checked enums.** Unlike
    `PRODUCT_CATEGORIES`/`CUSTOMER_TYPES` (validated via Zod enum against
    the migration's own check constraints), these four are plain
    `text[]`/`jsonb` columns with the allowed-values list only living in
    the form components (`components/onboarding/audience-form.tsx`,
    `fulfillment-form.tsx`, `storefront-form.tsx`). Acceptable for a
    bounded planning phase where these are descriptive tags, not
    values other tables join against — worth tightening if Phase 4+ ever
    needs to query by them.
12. **Dollar-to-cents conversion lives in each form component
    individually** (`products-form.tsx`, `budget-form.tsx`) rather than a
    shared currency-input helper. Three near-identical `Math.round(x * 100)`
    call sites; low risk (all covered by the same Zod schemas
    server-side) but worth consolidating if a fourth money field shows up.

## Phase 4 — known limitations, recorded rather than deferred silently

13. **Mockup image elements render as a placeholder outline, not the
    actual artwork pixels.** See docs/DESIGN_STUDIO.md "Mockup
    limitations" — embedding a private, signed-URL cross-origin image
    into an SVG that's then rasterized via `<canvas>` risks a tainted
    canvas (the browser refuses `toDataURL()`). Text elements render
    correctly. Fix options: proxy the image bytes through a same-origin
    Server Action before embedding, or add a real server-side rendering
    service (headless Chromium, or a `sharp`-based compositor) — either
    is a meaningfully larger change than this MVP phase's scope.
14. **SVG sanitization is denylist-based regex, not an allowlist DOM
    parser.** No `dompurify`-equivalent dependency exists in this project
    yet. Documented in detail, including the honest limitation, in
    docs/ARTWORK_SECURITY.md. Upgrade path: add a real sanitization
    library once one is approved as a dependency.
15. **`sales_rep` "draft descriptions if entitled" is not implemented.**
    Same deferral rationale as Phase 3's "Authorized manager" tier — true
    per-user entitlements need the `permissions`/`role_permissions` tables,
    which remain reserved-but-unused. `sales_rep` in this phase is
    strictly read-only on active products.
16. **Image-dimension/transparency reading is a from-scratch binary
    parser** (`lib/catalog/image-dimensions.ts`), not a battle-tested
    library like `image-size` or `sharp` (neither is a project
    dependency). Covers PNG/JPEG/WebP(VP8/VP8L/VP8X)/SVG correctly for the
    common cases exercised by its unit tests, but is not as exhaustively
    correct as a maintained library would be for unusual/malformed files
    (e.g. progressive JPEGs with multiple SOF-like markers, animated
    WebP). Low risk — a parse failure returns `null` (treated as "unknown,
    manual review recommended" by `artwork-quality.ts`), never a wrong
    answer presented as certain.
17. **`getCatalogDashboardMetrics` computes "missing pricing/variants"
    with an N+1 query** (one `listProductVariants` call per product).
    Fine at demo/small-tenant scale; would need a single aggregate query
    (or a materialized view) before a tenant has hundreds of products.
18. **No bulk variant update UI.** Section 12 asks for "support bulk
    updates" for variants; this phase ships single-variant pricing edits
    and matrix generation, but no multi-select bulk-edit UI (e.g. "set
    all M/L variants' retail price to $X at once"). Worth adding once
    real usage shows it's needed rather than speculatively.
