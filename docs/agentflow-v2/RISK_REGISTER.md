# Risk Register — AgentFlow Pro v2

Status at Phase 0: no code exists, so no *realized* risk exists yet. This
register tracks risks that a greenfield build of this scope predictably runs
into, so Phase 1+ can be checked against it rather than discovering these the
hard way.

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Building all ~60 domain tables from §V up front before any module needs them, producing schema that's guessed rather than validated | High if not actively resisted | Medium — rework later | Ship tables per-phase, only when the module consuming them lands (documented in `IMPLEMENTATION_PLAN.md` §3) |
| 2 | Multi-tenant RLS implemented incorrectly or inconsistently across tables added over many phases | Medium | Critical — cross-tenant data leak | Single shared RLS policy template applied to every tenant-owned table from migration 0001; security tests (brief §XVIII) specifically exercise cross-tenant access on every new table before it ships |
| 3 | Google ADK creeping from "optional adapter" to implicit dependency as convenience pressure builds during Phase 2 | Medium | High — violates core product constraint (§II) | Folder-boundary enforcement (only `providers/google-adk/` imports the ADK SDK) plus a lint/CI rule blocking that import path elsewhere; ADR records the boundary explicitly |
| 4 | Sara implemented with broader implicit permissions than other agents ("just this once, let Sara skip the approval") | Medium | Critical — undermines governance model (§XII) | Sara runs through the same `AgentPolicyEvaluator` path as any other agent; no Sara-specific bypass branch anywhere in code |
| 5 | AI-generated memory facts or Sara recommendations presented to users as verified facts rather than machine-extracted/unverified | Medium | High — trust and compliance exposure | Trust-state field is mandatory and enforced at the retrieval-service boundary, not left to caller discipline (§VII) |
| 6 | Financial or destructive tool actions (refunds, payouts, deletions) shipped without an approval gate because a tool adapter was added quickly to unblock a demo | Medium | Critical — irreversible financial/data harm | Tool risk classification (§IX) is a required field on every tool definition; execution pipeline hard-blocks unapproved high-risk actions rather than defaulting to allow |
| 7 | Workflow engine built directly on a hosted orchestrator (Temporal/Inngest) before it's clear that's needed, adding an ops dependency this small a team doesn't yet need | Low–Medium | Medium — operational overhead, vendor lock-in | Start Postgres-native (§7); the ADR explicitly revisits this once volume data exists |
| 8 | Stack decision (§10.1 of the implementation plan) made implicitly by whoever writes the first line of Phase 1 code, rather than confirmed with the business owner | High if not gated now | Medium — costly to reverse after several phases | Explicit open question raised before Phase 1 starts (this session) |
| 9 | Vertical OS packages (RestaurantOS, BookOS, MediaForgeOS) drift into forking the runtime because it's faster short-term than building the extension contract properly | Medium | High — defeats the "shared runtime" architecture goal (§II, §XIII) | Folder-boundary rule: `verticals/*` may only contain manifests/templates, never a copy of `packages/*` |
| 10 | Observability/audit logging accidentally captures raw prompts, secrets, or protected data (PII/PHI/financial) | Medium | Critical — security/compliance violation | Structured logging helpers that redact known-sensitive fields by default; security review (§XV) checks this explicitly before Phase 9 sign-off |
| 11 | `-MediaForgeOS` (sibling repo, same org) already contains a real implementation that Phase 8's example manifest unknowingly duplicates | Low–Medium | Low–Medium — wasted effort, inconsistent patterns | Inspect that repo before writing the MediaForgeOS manifest (flagged in implementation plan §8) |

This register should gain rows, not just status updates, as each phase
uncovers concrete risks specific to what was actually built — a generic risk
list written before Phase 1 exists is necessarily incomplete.
