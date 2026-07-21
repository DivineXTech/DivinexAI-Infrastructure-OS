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
8. **[PHASE_1_AUTHZ_AUDIT_FLAGS.md](./PHASE_1_AUTHZ_AUDIT_FLAGS.md)** —
   Phase 1's second increment: deterministic permission evaluator,
   audit/security event schema, feature-flag and tenant-settings services,
   and their contract tests (actually executed, results included).
9. **[PHASE_1_SUPABASE_VALIDATION.md](./PHASE_1_SUPABASE_VALIDATION.md)** —
   the live-Supabase validation runbook/gate. **Not yet executed** — this
   session has no live Supabase project. Blocks Phase 2, not the rest of
   Phase 1.
10. **[adr/](./adr/)** — architecture decision records. `ADR-0001` carries an
    addendum recording what was adopted/rejected from the house convention
    review; `ADR-0003` (multi-tenant isolation) and `ADR-0012` (testing
    framework) are implemented as of Phase 1; `ADR-0011` (deployment
    topology/worker hosting) remains partially decided, worker hosting
    deferred to before Phase 5.

## Status

Phase 0 complete (including house convention review). Phase 1, two
increments complete and passing:

1. Core tenancy schema, RLS policies, server-side authorization helpers
   (`PHASE_1_TENANCY.md`).
2. Deterministic permission evaluator, audit/security event schema,
   feature-flag and tenant-settings services, contract tests
   (`PHASE_1_AUTHZ_AUDIT_FLAGS.md`).

Branch: `agentflow-v2/phase-1-tenancy-foundation` (renamed from
`agentflow-v2/phase-0-audit` once Phase 1 work began). Not merged to `main`.

Before Phase 2 (agent runtime, provider adapters, Google ADK): the live
Supabase validation gate (`PHASE_1_SUPABASE_VALIDATION.md`) must be executed
and recorded — currently a runbook only, not yet run against a real project.
Low-risk Phase 1 interface work may continue in the meantime, but does not
extend into provider adapters, agent execution, business memory, tools, or
workflows without further sign-off.
