# AgentFlow Pro v2 — Phase 0 Documentation Index

This directory holds the Phase 0 audit and planning deliverables for
upgrading `divinexai-infrastructure-os` into AgentFlow Pro v2. Read in this
order:

1. **[REPOSITORY_AUDIT.md](./REPOSITORY_AUDIT.md)** — what actually exists in
   this repository today (a README, nothing else) and why that changes the
   shape of the assignment.
2. **[CURRENT_ARCHITECTURE.md](./CURRENT_ARCHITECTURE.md)** — explicitly N/A;
   placeholder for the real architecture doc once Phase 1 lands.
3. **[GAP_ANALYSIS.md](./GAP_ANALYSIS.md)** — every capability, domain table,
   and module the target spec requires, classified against the audit (all
   "Missing" today; this table gets updated in place as phases land).
4. **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** — proposed stack,
   folder structure, database strategy, provider abstraction, Google ADK
   boundary, memory engine and workflow architecture, phase sequencing, and
   the open questions that gated Phase 1.
5. **[RISK_REGISTER.md](./RISK_REGISTER.md)** — predictable risks for a build
   of this shape (RLS consistency, ADK boundary creep, premature vendor
   lock-in, etc.) and their mitigations.
6. **[HOUSE_CONVENTION_REVIEW.md](./HOUSE_CONVENTION_REVIEW.md)** — read-only
   inspection of sibling DivineXTech repos (MediaForgeOS, afrogrow360-core)
   for conventions to adopt, reject, or reconcile before Phase 1 code is
   written.
7. **[adr/](./adr/)** — architecture decision records for the major calls
   made in the implementation plan. `ADR-0001` carries an addendum recording
   what was adopted/rejected from the house convention review; `ADR-0011`
   (deployment topology/worker hosting) and `ADR-0012` (testing framework)
   were added directly as a result of it.

## Status

Phase 0 complete, including house convention review. Stack decision
(Next.js/TypeScript + Supabase Postgres with RLS + pgvector, Bun + Turborepo
monorepo tooling, Zod validation) approved. Deployment: Vercel + Supabase
accepted as the current working assumption; durable worker hosting
explicitly deferred to before Phase 5 (`ADR-0011`). Phase 1 (shared domain
foundation: tenancy tables, RLS, base service interfaces) is starting on
this branch.
