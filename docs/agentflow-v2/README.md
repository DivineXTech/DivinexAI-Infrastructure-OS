# AgentFlow Pro v2 — Documentation Index

This directory holds the audit, planning, and phase deliverables for
upgrading `divinexai-infrastructure-os` into AgentFlow Pro v2.

**Start here for current state:** `REPOSITORY_ASSESSMENT.md` (current,
supersedes the Phase 0 snapshot below) and `ADR-0013` (the settled record of
tenancy, packages, applications, phase sequence, and agent scope).

1. **[REPOSITORY_AUDIT.md](./REPOSITORY_AUDIT.md)** — historical Phase 0
   snapshot: an empty repository, and why that changed the shape of the
   assignment. Superseded by `REPOSITORY_ASSESSMENT.md` for current state.
2. **[REPOSITORY_ASSESSMENT.md](./REPOSITORY_ASSESSMENT.md)** — current-state
   assessment as of the Phase 1 → Phase 2 checkpoint: stack, packages,
   database, tests, and the five settled resolutions (`ADR-0013`).
3. **[CURRENT_ARCHITECTURE.md](./CURRENT_ARCHITECTURE.md)** — what actually
   exists today, updated in place as each phase lands.
4. **[GAP_ANALYSIS.md](./GAP_ANALYSIS.md)** — every capability, domain table,
   and module the target spec requires, classified against reality; updated
   in place as phases land.
5. **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** — stack (confirmed),
   folder structure, database strategy, provider abstraction, Google ADK
   boundary, memory engine and workflow architecture, and the current phase
   sequence (§9, updated per `ADR-0013`).
6. **[CAPABILITY_PACKAGE_MAPPING.md](./CAPABILITY_PACKAGE_MAPPING.md)** —
   canonical table mapping every capability area (contracts, agents,
   model-gateway, orchestration, workflows, tool-gateway, memory, policies,
   approvals, security, evaluations, observability, database) onto the
   eight approved packages. No new top-level packages.
7. **[FILE_CHANGE_PLAN.md](./FILE_CHANGE_PLAN.md)** — Phase 2 proposal
   (Agent Runtime Contracts and Registry): exact files, migration, and open
   question (platform-wide vs per-tenant agents), not yet implemented.
8. **[RISK_REGISTER.md](./RISK_REGISTER.md)** — predictable risks for a build
   of this shape and their mitigations; append-only as phases land.
9. **[HOUSE_CONVENTION_REVIEW.md](./HOUSE_CONVENTION_REVIEW.md)** — read-only
   inspection of sibling DivineXTech repos (MediaForgeOS, afrogrow360-core)
   for conventions adopted, rejected, or reconciled before Phase 1 code was
   written.
10. **[BRIEF_RECONCILIATION.md](./BRIEF_RECONCILIATION.md)** — how a first
    conflicting "AgentFlow Pro" brief (organizations/workspaces tenancy, a
    13-package taxonomy) was reconciled; superseded/formalized by `ADR-0013`
    after a second, more detailed brief covered the same ground plus
    applications, phase sequence, and agent scope.
11. **[PHASE_1_TENANCY.md](./PHASE_1_TENANCY.md)**,
    **[PHASE_1_AUTHZ_AUDIT_FLAGS.md](./PHASE_1_AUTHZ_AUDIT_FLAGS.md)**,
    **[PHASE_1_AGENT_WORKFLOW_CONTRACTS.md](./PHASE_1_AGENT_WORKFLOW_CONTRACTS.md)**
    — Phase 1's three increments, each with real, executed test results.
12. **[PHASE_1_SUPABASE_VALIDATION.md](./PHASE_1_SUPABASE_VALIDATION.md)** —
    the live-Supabase validation runbook/gate. **Not yet executed** — no live
    Supabase project in this environment. Blocks runtime-coupled work, not
    further local-Postgres-testable contract/schema work.
13. **[adr/](./adr/)** — architecture decision records, `ADR-0001` through
    `ADR-0013`. `ADR-0013` is the formal record of the second brief
    reconciliation (tenancy, packages, applications, phase sequence, agent
    scope); `ADR-0001` carries two addenda (house-convention adoption, and
    the `apps/admin`/Next.js-deferral note).

## Status

Phase 0 complete. Phase 1 complete, three increments
(`PHASE_1_TENANCY.md`, `PHASE_1_AUTHZ_AUDIT_FLAGS.md`,
`PHASE_1_AGENT_WORKFLOW_CONTRACTS.md`). A second brief proposing a
conflicting architecture was reconciled in full via `ADR-0013` — see that
ADR for the five settled points (tenancy, packages, applications, phase
sequence, agent scope) and `FILE_CHANGE_PLAN.md` for the resulting Phase 2
proposal, not yet implemented.

Branch: `agentflow-v2/phase-1-tenancy-foundation` (renamed from
`agentflow-v2/phase-0-audit`; the old name remains on the remote as an
obsolete, un-deleted pointer — a git-proxy policy denial blocks deleting it
from this session, tracked as non-blocking housekeeping). Not merged to
`main`.

Before Phase 2 implementation: the live Supabase validation gate
(`PHASE_1_SUPABASE_VALIDATION.md`) remains not executed, and
`FILE_CHANGE_PLAN.md`'s open question (platform-wide vs per-tenant initial
agents) needs an answer. Neither blocks further documentation or
local-Postgres-testable contract work.
