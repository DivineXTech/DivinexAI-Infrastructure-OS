# Roadmap

See `docs/IMPLEMENTATION_PLAN.md` §6 for the authoritative phase table and
§4 for which database tables ship with which phase. Summary:

| Phase | Status | Deliverable |
|---|---|---|
| 0 | ✅ Complete | Repository audit, implementation plan |
| 1 | ✅ Complete (this build) | App shell, design system, auth, tenant/membership/role model + RLS, env validation, error/loading boundaries, payments + DivinexAI service interfaces (mock only) |
| 2 | ✅ Complete | Full public marketing website (16-section homepage, startup-kit/equipment/pricing/white-label pages) |
| 3 | ✅ Complete (this build) | Resumable onboarding wizard (11 routes), brand/audience/product/production/budget/storefront/fulfillment data model, deterministic startup-kit recommendation engine, transparent launch-readiness scoring, role-scoped review access, dashboard integration |
| 4 | ✅ Complete (this build) | Garment template library (platform + tenant-custom), interactive garment preview, Design Studio MVP editor (normalized state, undo/redo, versioning, mockup generation), product catalog with variants and a deterministic pricing/margin engine, design-to-product conversion |
| 5 | Not started | Storefront, cart, mock checkout, customers, orders, discounts |
| 6 | Not started | Production queue/Kanban, job assignment, QC, inventory movements |
| 7 | Not started | Equipment marketplace, startup-kit builder, suppliers, training academy |
| 8 | Not started | White-label tenant customization, plan entitlements, admin console, audit logging |
| 9 | Not started | Full test coverage, accessibility review, security review, performance review, deployment readiness |

## Immediate next recommended phase

**Phase 5 — Storefront, Cart, Mock Checkout, Customers, Orders,
Discounts.** Rationale: Phase 4 gives every tenant a working product
catalog with priced, variant-complete products and an approved design
pipeline, but there is still no way for anyone outside the tenant's own
staff to see or buy those products. Phase 5 is the first phase that turns
catalog data into a public-facing (or at least customer-facing) storefront
experience, per `docs/IMPLEMENTATION_PLAN.md` §6.

Do not begin Phase 5 until Phase 4 has been reviewed and approved.
