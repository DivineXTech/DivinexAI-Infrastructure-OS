# Implementation Plan — AgentFlow Pro v2

Status: **Confirmed and partially built.** §1's stack recommendation was
approved; §10's original open questions are resolved (see the note at the
end of §10). Phase 0 and Phase 1 (three increments) are complete — see
`REPOSITORY_ASSESSMENT.md` for current state, `ADR-0013` for how a later,
conflicting brief was reconciled against this plan, and §9 below for the
phase sequence now in effect. Sections 3–8 (database strategy, provider
abstraction, ADK boundary, memory architecture, workflow architecture,
vertical OS contract) remain accurate _designs_ for phases not yet
built — read them as the plan for Phase 3 onward, not as already-implemented.

## 1. Recommended stack

No stack is established in this repo or inferable from its history. The brief
itself leaves several strong hints rather than an explicit choice:

- It requires "row-level security **or equivalent**" for tenant isolation —
  RLS is a Postgres-specific mechanism, and the phrasing plus the presence of
  `Supabase` in the initial tool-adapter candidate list (§IX) both point at
  **Postgres, most plausibly via Supabase** (managed Postgres + auth + RLS +
  storage in one place, common across small DivineXTech-style teams).
- The workflow domain model (§V) already assumes durable _tables_
  (`workflow_step_runs`, `workflow_events`, `workflow_failures`,
  `workflow_compensations`) recording every state transition — this reads as
  a **Postgres-native durable execution model** (the database is the source
  of truth for workflow state; a worker process drives transitions), not a
  delegation to an external orchestrator like Temporal.
- A business-facing dashboard with department activation, approval queues,
  and an executive command center (§XVI) implies a full-stack TypeScript web
  app is a natural fit for both the admin/developer views and the
  business-user views described in §I.

**Proposed default, pending confirmation:**

- **Language:** TypeScript throughout (frontend, backend, workers) — keeps
  agent runtime, tool registry, and workflow engine types shareable across
  API and UI without duplication.
- **Framework:** Next.js (App Router) for both the business-user UI and
  admin/developer views, with route groups separating the two (§I: business
  outcomes in front, technical concepts in an admin view).
- **Database:** Supabase Postgres — native RLS for tenant isolation, built-in
  auth, storage for memory-source file uploads, and a realistic path to
  `pgvector` for semantic memory retrieval without adding a second database.
- **Workflow durability:** Postgres-native state machine (workflow_* tables
  as system of record) driven by a worker — either a Supabase Edge Function
  on a schedule, or a small dedicated worker process, decided in Phase 5's
  ADR once concurrency/volume requirements are clearer. This avoids adding a
  new vendor dependency (Temporal/Inngest) before it's proven necessary —
  "least disruptive option," per §X.
- **Vector store:** `pgvector` inside the same Postgres instance rather than
  a separate vector database, for the same reason — one fewer moving part
  until scale demands otherwise.

This is a recommendation, not a decision — see §10 for what needs
confirmation before Phase 1 starts.

## 2. Target folder structure (updated per `ADR-0013`)

```
/
├── apps/
│   ├── admin/                       # First application, later phase (Phase 10). NOT a customer-facing web app.
│   │                                 # Framework (Next.js) not installed/pinned until this increment is approved.
│   └── worker/                      # Durable execution process (Phase 3)
├── packages/
│   ├── agent-runtime/               # BUILT: manifest.ts, executionContext.ts, executionResult.ts (Phase 1)
│   │   ├── providers/                # Phase 5 — ModelProvider adapters
│   │   │   ├── anthropic/
│   │   │   ├── openai/
│   │   │   ├── google-gemini/
│   │   │   └── google-adk/          # Isolated adapter, feature-flagged, never imported outside this package
│   │   └── routing/                  # Phase 5 — provider routing
│   ├── memory-engine/                # Phase 6 — ingestion, trust states, retrieval, provenance
│   ├── tool-registry/                # Phase 5 — tool definitions, tenant connections, execution pipeline
│   │   └── adapters/                 # gmail/, stripe/, whatsapp/, flutterwave/, paystack/, ... (mock-first)
│   ├── workflow-engine/              # BUILT: status.ts (Phase 1); persistence/engine is Phase 3
│   ├── governance/                   # Phase 4 — policy engine + approvals
│   ├── sara/                         # Phase 7 — executive intelligence, a consumer of the above, not a superuser
│   ├── vertical-os-sdk/              # Phase 11 — VerticalOSManifest + template contracts
│   ├── observability/                # Phase 9 (narrow start already in packages/shared/src/events.ts)
│   ├── shared/                       # BUILT, Phase 1 — cross-cutting tenancy types, auth helpers, policy evaluator,
│   │                                  # feature flags, tenant settings, audit/security events. Not refactored into
│   │                                  # the packages above except with clear ownership — see CAPABILITY_PACKAGE_MAPPING.md
│   ├── platform-kernel/              # Phase 3 (ADR-0014) — ninth canonical package. Versioned-artifact
│   │                                  # primitives only: content hashing/canonicalization (computeContentHash),
│   │                                  # future serialization/deterministic-ID helpers. No domain logic.
│   ├── eslint-config/                # BUILT, Phase 1
│   └── typescript-config/            # BUILT, Phase 1
├── supabase/
│   ├── migrations/                   # BUILT — 3 migrations so far (Phase 1)
│   └── migrations_rollback/          # BUILT — verified rollback per migration
├── verticals/                        # Phase 11
│   ├── restaurant-os/                # Manifest + templates only — installs into shared runtime, does not fork it
│   ├── book-os/
│   └── mediaforge-os/
└── docs/agentflow-v2/                # This documentation set
```

Rationale unchanged: every capability maps to exactly one `packages/*`
directory (`CAPABILITY_PACKAGE_MAPPING.md`) so "no business-domain module may
directly depend on a provider-specific SDK" is enforced by the folder
boundary itself — only `agent-runtime/providers/*` may import a provider
SDK, and only `google-adk/` may import Google's ADK package. No
`packages/database`, `packages/contracts`, `packages/policies`, etc. — see
`ADR-0013` for why.

## 3. Database strategy

Adopt the domain model in §V close to verbatim — it's already normalized and
maps cleanly to the modules above. Two structural rules apply from the first
migration:

1. Every tenant-owned table gets a `tenant_id uuid not null references
tenants(id)`, and RLS is enabled with a policy that reads the tenant from
   the authenticated session — never from a client-supplied header or body
   field (brief rule #8).
2. Migrations are additive and reversible: each migration file ships with
   its down-migration, and no migration silently drops a column or table
   without a documented reason (there's nothing to drop yet, but this
   convention should hold from migration 0001 onward).

Given the volume of tables in §V (~60 across seven groups), Phase 1 will ship
only the **core tenancy** group plus the minimal `agent_definitions` /
`tool_definitions` / `workflow_definitions` tables needed to prove the
pattern end-to-end. The remaining tables land with the phase that needs them
(Phase 3 for memory__, Phase 4 for tool__, etc.) rather than all at once —
shipping ~60 empty tables in Phase 1 would be schema speculation, which cuts
against "smallest coherent increment" (§XXII.6).

## 4. Provider abstraction

Core interfaces (name and folder placement final in `packages/agent-runtime/`):

- `ModelProvider` — raw completion/chat interface per provider SDK.
- `AgentProvider` — wraps a `ModelProvider` with AgentFlow Pro's own
  execution semantics (tool resolution, memory resolution, policy checks) so
  business code never touches a `ModelProvider` directly.
- `AgentExecutor` / `AgentPlanner` — run a single agent definition to
  completion, including retries/timeouts from its versioned policy.
- `AgentToolResolver` / `AgentMemoryResolver` — resolve _only_ the tools and
  memory scopes an agent's definition and tenant policy allow — this is
  where prompt-injection defenses live (retrieved content can never grant
  tool access, per §XV).
- `AgentPolicyEvaluator` — deterministic (non-AI) approval/permission checks,
  consistent with rule #14 (AI interprets and generates; it does not decide
  access, money, or irreversible actions).
- `AgentRunObserver` / `AgentStateStore` — emit the observability events in
  §XIV and persist run state so a run survives a process restart.

Provider routing (§VI.3) is implemented as a deterministic rules table
(`provider_routing_rules`) evaluated by `AgentPolicyEvaluator`-adjacent code
— not an LLM decision — so routing stays auditable and testable.

## 5. Google ADK integration boundary

ADK is one more entry under `packages/agent-runtime/providers/google-adk/`,
nothing more:

- It implements `AgentProvider` like every other provider; no other package
  imports `@google/adk` (or equivalent) directly.
- Enabled via a tenant- or platform-level feature flag
  (`tenant_feature_flags`), off by default until validated.
- ADK's own run/event model is translated into AgentFlow Pro's
  `agent_runs` / `agent_run_steps` / observability events at the adapter
  boundary — ADK never becomes the system of record for runs, memory, tools,
  approvals, or audit history (brief's explicit constraint).
- Tool and memory access for an ADK-run agent still passes through
  `AgentToolResolver` / `AgentMemoryResolver` / `AgentPolicyEvaluator` — ADK
  cannot call a tool AgentFlow Pro hasn't authorized.
- If ADK is unreachable or misconfigured, the adapter fails the run in a way
  the workflow engine can catch and route to a fallback provider or human
  escalation — never a silent hang.
- An ADR (`ADR-0002-google-adk-boundary.md`, Phase 2) records this contract
  so a future contributor can't accidentally deepen the dependency.

## 6. Business Memory Engine architecture

Three layers, matching §VII–VIII:

1. **Ingestion** — sources (`memory_sources`) → jobs
   (`memory_ingestion_jobs`) → documents/chunks
   (`memory_documents`/`memory_chunks`) → optional extracted facts
   (`memory_facts`) marked `unverified` or `machine-extracted` until a human
   or a deterministic system check promotes them (trust-state machine, §VII).
2. **Retrieval** — a single retrieval service combining keyword + semantic
   (`pgvector`) search, filtered server-side by tenant, department, agent
   permission, trust state, and recency before ranking — never returning
   unfiltered raw memory to a caller. Every result carries provenance
   (`memory_retrieval_logs`) sufficient to cite a source.
3. **Intelligence** — a separate scheduled layer (§VIII) that computes
   deterministic metrics (revenue movement, churn indicators) directly from
   operational/financial memory, and uses AI only to _explain_ those already-
   computed numbers — never to invent them. Every recommendation it emits
   carries the evidence/confidence/citation fields required in §VIII.

## 7. Workflow architecture

Workflow state lives in Postgres (`workflow_instances`, `workflow_step_runs`,
`workflow_events`) as the durable source of truth; a worker process advances
instances by claiming due steps, executing them (agent step, tool step,
approval wait, etc.), and writing the result — resumable by construction
since nothing is held in application memory between steps. This needs its
own ADR (`ADR-0004-workflow-runtime.md`, Phase 5) once step-volume and
concurrency expectations are known, to decide between (a) a bespoke
polling worker directly on the tables above, or (b) adopting an existing
durable-execution product (Temporal/Inngest) fronting the same schema. Given
no existing queue infrastructure in this org (per audit), start with (a) —
it's reversible: the schema doesn't change if (b) is adopted later, only the
thing that drives it.

## 8. Vertical OS extension contract

`packages/vertical-os-sdk` defines `VerticalOSManifest` and friends (§XIII);
each of `verticals/restaurant-os`, `verticals/book-os`,
`verticals/mediaforge-os` is _configuration_ (templates, policy packs,
metric definitions) that installs into the shared runtime — none of them may
contain their own copy of the agent runtime, memory engine, or workflow
engine. This is enforced at the folder-boundary level the same way provider
isolation is (§2).

Before writing the MediaForgeOS example manifest, `DivineXTech/-MediaForgeOS`
(same org, not yet added to this session) should be inspected — if it already
contains a working implementation, the manifest should describe how that
gets _wrapped_, not duplicate it from scratch.

## 9. Phase plan (current, per `ADR-0013`)

The original brief's own §XX sequence has been superseded by the phase
sequence below, agreed after a later brief proposed a competing numbering.
Phase 0 and Phase 1 are complete and are not restarted or renumbered:

- **Phase 0 — Repository and architecture foundation.** Complete
  (`REPOSITORY_AUDIT.md`, this plan, `RISK_REGISTER.md`, `ADR-0001`–`ADR-0012`).
- **Phase 1 — Tenancy, RLS, authorization, settings, feature flags, audit
  events, security events.** Complete, three increments
  (`PHASE_1_TENANCY.md`, `PHASE_1_AUTHZ_AUDIT_FLAGS.md`,
  `PHASE_1_AGENT_WORKFLOW_CONTRACTS.md`).
- **Phase 2 — Agent Runtime Contracts and Registry.** Platform-owned
  `agent_definitions`/`agent_versions` (immutable once published) +
  tenant-owned `tenant_agents` installations, each referencing an explicit
  published version — no nullable-`tenant_id` rows anywhere
  (`ADR-0013` addendum). Two separate lifecycles, not one: `AgentVersionStatus`
  (platform) and `TenantAgentLifecycleStatus` (tenant); define and register
  all six initial agents (Sara, Nova, Forge, Guardian, Reven, Pulse) — mock
  executable only, none reach `ACTIVE`. See `FILE_CHANGE_PLAN.md`.
- **Phase 3 — Workflow Runtime and Durable Execution.** Complete, tested
  (299 repo-wide tests) — see `PHASE_3_WORKFLOW_RUNTIME.md` for the full
  design and completion summary (supersedes this
  section's original `workflow_instances`/`workflow_step_runs`/
  `workflow_events` sketch). Platform-owned `workflow_definitions`/
  `workflow_versions` (immutable once published, same pattern as Phase 2's
  agents) + tenant-owned `tenant_workflows`/`workflow_runs`/`workflow_steps`/
  `workflow_step_dependencies`/`workflow_execution_events`/
  `workflow_dead_letters`. Reuses the existing 15-state run-level
  `WorkflowStatusSchema` (Phase 1, unchanged) and adds a new 14-state
  step-level state machine. Database-backed atomic-`UPDATE` leasing (no
  external queue), append-only sequence-numbered execution-event ledger,
  deterministic retry/dead-letter model, stateless `reconcileWorkflowRuntime`
  worker-recovery function, `GovernanceGate` stub (real policy engine is
  Phase 4), and mock agent execution added to `packages/agent-runtime`
  (`MockAgentAdapter`, `resolveTenantAgent`, `assertAgentEligible` —
  Phase 2 registered agents but never built the executor). Reference
  workflow: `client_solution_assessment` v1.0.0. See
  `FILE_CHANGE_PLAN.md` for tables/migrations/RLS/services.
- **Phase 4 — Governance, Policies, Risk Decisions, and Human Approvals.**
  Conditionally approved and revised; implementation proceeding — see
  `PHASE_4_GOVERNANCE_APPROVALS.md` for the full design. New
  `packages/governance`: platform-owned `policy_definitions`/
  `policy_versions` + `risk_classification_definitions`/
  `risk_classification_versions` (both immutable once published, same
  pattern as prior phases — risk classification is versioned, not a
  mutable lookup table, per review); tenant-owned
  `tenant_policy_assignments`/`tenant_policy_overrides`/`policy_evaluations`/
  `approval_requests`/`approval_decisions`/`approval_assignments`/
  `governance_events`. Deterministic six-tier policy precedence producing
  one of five effects (`BLOCK`/`DENY`/`ESCALATE`/`REQUIRE_APPROVAL`/`ALLOW`,
  in that precedence order); an 8-state approval-request lifecycle with
  quorum, distinct-approver, and separation-of-duties enforcement;
  immutable action snapshots with automatic supersession on drift;
  `approval_requests`/`approval_decisions` are select-only for every
  tenant role — all mutation happens through governed application
  commands, never a client-writable row; exactly-once workflow-step
  resumption reusing Phase 3's atomic-conditional-UPDATE leasing pattern
  (no `workflow_steps` schema change needed). `workflow-engine` reacts to
  governance's decisions but never determines whether approval is
  required, and now also derives run-level completion from step outcomes
  (`reconcileWorkflowRunOutcome`, resolving the Phase 3 auto-completion
  gap); `agent-runtime` declares intended actions but never decides
  approvals. Builds on `packages/shared/src/policy.ts`'s
  `PgTenantAccessEvaluator`, reused unchanged for permission-key checks —
  not replaced. Reference workflow: `client_solution_assessment` v1.1.0
  (adds a `deliver_external` step gated on `communication.send.external`).
  See `FILE_CHANGE_PLAN.md` for tables/migrations/RLS/services.
- **Phase 5 — Model and Tool Gateways.** Provider adapters (§4/§5 below),
  tool registry and execution pipeline (§9 below, "Centralized Tool
  Registry" in `GAP_ANALYSIS.md`).
- **Phase 6 — Memory Engine.** §6 below (ingestion, trust states, retrieval).
- **Phase 7 — Sara Executive Intelligence.**
- **Phase 8 — Executive Agent Team.** Nova, Forge, Guardian, Reven, Pulse
  reach `TOOL_ENABLED`/`APPROVAL_GOVERNED`/`ACTIVE` as their prerequisites
  land in Phases 3–7.
- **Phase 9 — Evaluation and Observability Expansion.** Full `observability`
  package: traces, latency, cost, evaluation harness.
- **Phase 10 — Admin Command Center.** `apps/admin`, the first application;
  Next.js pinned/installed here, not before.
- **Phase 11 — Vertical Agent Pods.** `packages/vertical-os-sdk`,
  `verticals/*` manifests.

## 10. Open questions

The four questions originally listed here (stack, house conventions,
hosting target, branch/commit policy) are **resolved** —
`HOUSE_CONVENTION_REVIEW.md`, `ADR-0001`, `ADR-0011`, and the
`agentflow-v2/phase-1-tenancy-foundation` branch history are the record of
how. Current open items, carried forward rather than newly discovered:

1. **Live Supabase validation** (`PHASE_1_SUPABASE_VALIDATION.md`) — not yet
   executed; no live Supabase project available in this environment. Blocks
   anything that depends on real PostgREST/GoTrue runtime behavior; does not
   block further local-Postgres-testable contract/schema work (Phase 2's
   registry and migrations can proceed the same way Phase 1 did).
2. **~~`AgentStatusSchema` reconciliation~~ — resolved.** Replaced by two
   separate lifecycles (`AgentVersionStatus` platform-side,
   `TenantAgentLifecycleStatus` tenant-side); `AgentManifest.status` removed
   entirely. See `ADR-0013`'s addendum and `FILE_CHANGE_PLAN.md`.
3. **Platform-wide vs. per-tenant agents — resolved.** Platform-defined,
   tenant-installed (`ADR-0013` addendum); this was the open question
   `FILE_CHANGE_PLAN.md`'s first draft surfaced.
4. **~~`packages/shared/src/contentHash.ts` extraction~~ — resolved.**
   Approved instead as a new dedicated package, `packages/platform-kernel`
   (`ADR-0014`) — `packages/shared` gains no new code. See
   `PHASE_3_WORKFLOW_RUNTIME.md` §14.
5. **~~`workflow-engine` depending on `agent-runtime`'s
   `CANONICAL_AGENT_SLUGS`~~ — resolved.** Approved instead as an injected
   `AgentResolver` abstraction: `workflow-engine` declares the interface,
   `agent-runtime` implements it against `PlatformAgentCatalog`, wired at
   the composition root — no compile-time dependency either direction
   beyond the interface. See `PHASE_3_WORKFLOW_RUNTIME.md` §4a. A related
   `CapabilityResolver` seam (§4b) was added at the same time so the
   workflow manifest schema can support capability-based routing later
   without a breaking change; it ships unimplemented in Phase 3.
6. **~~`risk_classifications` versioning~~ — resolved, revised.** Replaced
   by `risk_classification_definitions`/`risk_classification_versions`,
   immutable once published, exactly mirroring `policy_versions`; every
   `policy_evaluations` row records the exact version consulted. See
   `PHASE_4_GOVERNANCE_APPROVALS.md` §1, §4c.
7. **Two contract extensions to already-shipped code — confirmed
   additive.** `AgentExecutionResult` (Phase 1) gains
   `intendedAction`/`selfAssessedRiskLevel`/`requestedCapabilities`;
   `WorkflowStepDefinitionSchema` (Phase 3) gains `governedAction`;
   `workflow-engine`'s run-level `status.ts` gains one additive transition
   (`WAITING_FOR_APPROVAL → BLOCKED`). All backward-compatible with
   required compatibility tests. See `PHASE_4_GOVERNANCE_APPROVALS.md` §9,
   §12, §12a, §15.
8. **~~`approval_requests`' asymmetric per-command RLS~~ — resolved,
   revised.** No client mutation of `approval_requests`/`approval_decisions`
   at all — select-only for every tenant role; every mutation (creation,
   decisions, resumption, cancellation) happens through governed
   application commands over the trusted connection. See
   `PHASE_4_GOVERNANCE_APPROVALS.md` §2, §7.

No other blocker is currently open.
