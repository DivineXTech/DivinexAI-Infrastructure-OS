# Roadmap

See `docs/IMPLEMENTATION_PLAN.md` §6 for the authoritative phase table and
§4 for which database tables ship with which phase. Summary:

| Phase | Status | Deliverable |
|---|---|---|
| 0 | ✅ Complete | Repository audit, implementation plan |
| 1 | ✅ Complete (this build) | App shell, design system, auth, tenant/membership/role model + RLS, env validation, error/loading boundaries, payments + DivinexAI service interfaces (mock only) |
| 2 | Not started | Full public marketing website (19-section homepage, startup-kit/equipment/pricing/white-label pages) |
| 3 | Not started | Resumable onboarding wizard, brand settings, launch-readiness scoring |
| 4 | Not started | Product CRUD, garment templates, design studio editor, margin calculator |
| 5 | Not started | Storefront, cart, mock checkout, customers, orders, discounts |
| 6 | Not started | Production queue/Kanban, job assignment, QC, inventory movements |
| 7 | Not started | Equipment marketplace, startup-kit builder, suppliers, training academy |
| 8 | Not started | White-label tenant customization, plan entitlements, admin console, audit logging |
| 9 | Not started | Full test coverage, accessibility review, security review, performance review, deployment readiness |

## Immediate next recommended phase

**Phase 2 — Public Website.** Rationale: Phase 1's `(marketing)` route
group currently has a deliberately minimal homepage and stub
terms/privacy/contact pages; Phase 2 replaces that with the full
19-section homepage and the remaining public routes (`/how-it-works`,
`/startup-kits`, `/equipment`, `/services`, `/design-studio`, `/academy`,
`/pricing`, `/marketplace`, `/about`) per the product spec §5.

Alternative: **Phase 3 — Onboarding**, if getting a signed-up user to a
real tenant (rather than the "not linked to a tenant yet" empty state in
`app/app/layout.tsx`) is the higher priority before public marketing copy.
