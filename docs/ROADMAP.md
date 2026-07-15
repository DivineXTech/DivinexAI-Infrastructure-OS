# Roadmap

See `docs/IMPLEMENTATION_PLAN.md` §6 for the authoritative phase table and
§4 for which database tables ship with which phase. Summary:

| Phase | Status | Deliverable |
|---|---|---|
| 0 | ✅ Complete | Repository audit, implementation plan |
| 1 | ✅ Complete (this build) | App shell, design system, auth, tenant/membership/role model + RLS, env validation, error/loading boundaries, payments + DivinexAI service interfaces (mock only) |
| 2 | ✅ Complete | Full public marketing website (16-section homepage, startup-kit/equipment/pricing/white-label pages) |
| 3 | ✅ Complete (this build) | Resumable onboarding wizard (11 routes), brand/audience/product/production/budget/storefront/fulfillment data model, deterministic startup-kit recommendation engine, transparent launch-readiness scoring, role-scoped review access, dashboard integration |
| 4 | Not started | Product CRUD, garment templates, design studio editor, margin calculator |
| 5 | Not started | Storefront, cart, mock checkout, customers, orders, discounts |
| 6 | Not started | Production queue/Kanban, job assignment, QC, inventory movements |
| 7 | Not started | Equipment marketplace, startup-kit builder, suppliers, training academy |
| 8 | Not started | White-label tenant customization, plan entitlements, admin console, audit logging |
| 9 | Not started | Full test coverage, accessibility review, security review, performance review, deployment readiness |

## Immediate next recommended phase

**Phase 4 — Product Catalog, Garment Templates, 360° Product Preview, and
Design Studio MVP.** Rationale: Phase 3 gives every tenant a completed
brand/audience/product/production/budget/storefront/fulfillment planning
record and a startup-kit selection, but there is still nothing to actually
sell — no product records, no garment templates, no design surface. Phase
4 is the first phase that turns onboarding's planning inputs (selected
categories, sales model, chosen startup kit) into real catalog data,
per `docs/IMPLEMENTATION_PLAN.md` §6.

Do not begin Phase 4 until Phase 3 has been reviewed and approved.
