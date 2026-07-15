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
