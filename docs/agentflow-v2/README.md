# AgentFlow Pro v2 — Documentation Index

This directory holds the audit, planning, and phase deliverables for
upgrading `divinexai-infrastructure-os` into AgentFlow Pro v2.

1. **[REPOSITORY_AUDIT.md](./REPOSITORY_AUDIT.md)** — what existed in this
   repository at Phase 0 (a README, nothing else) and why that changed the
   shape of the assignment.
2. **[CURRENT_ARCHITECTURE.md](./CURRENT_ARCHITECTURE.md)** — what actually
   exists today, updated in place as each phase lands.
3. **[GAP_ANALYSIS.md](./GAP_ANALYSIS.md)** — every capability, domain table,
   and module the target spec requires, classified against reality; updated
   in place as phases land.
4. **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** — proposed stack,
   folder structure, database strategy, provider abstraction, Google ADK
   boundary, memory engine and workflow architecture, phase sequencing.
5. **[RISK_REGISTER.md](./RISK_REGISTER.md)** — predictable risks for a build
   of this shape and their mitigations.
6. **[HOUSE_CONVENTION_REVIEW.md](./HOUSE_CONVENTION_REVIEW.md)** — read-only
   inspection of sibling DivineXTech repos (MediaForgeOS, afrogrow360-core)
   for conventions adopted, rejected, or reconciled before Phase 1 code was
   written.
7. **[PHASE_1_TENANCY.md](./PHASE_1_TENANCY.md)** — Phase 1's first
   increment: core tenancy schema, RLS, server-side authorization helpers,
   and tenant-isolation tests (actually executed, results included).
8. **[adr/](./adr/)** — architecture decision records. `ADR-0001` carries an
   addendum recording what was adopted/rejected from the house convention
   review; `ADR-0003` (multi-tenant isolation) and `ADR-0012` (testing
   framework) are implemented as of Phase 1; `ADR-0011` (deployment topology/
   worker hosting) remains partially decided, worker hosting deferred to
   before Phase 5.

## Status

Phase 0 complete (including house convention review). Phase 1's first
increment — core tenancy schema, RLS policies, server-side authorization
helpers in `packages/shared`, and tenant-isolation tests — is complete and
passing (`PHASE_1_TENANCY.md`). Stopped here for review per the approved
working method; Phase 1's remaining scope and Phase 2 (agent runtime) have
not started.
