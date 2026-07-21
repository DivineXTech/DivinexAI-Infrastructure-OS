# Implementation Plan — AgentFlow Pro v2

Status: **Proposal, pending stack confirmation.** This document reflects a
greenfield repository (see `REPOSITORY_AUDIT.md`). Nothing below has been
built. Nothing should be built from this plan until the open questions in
§10 are answered, per the brief's own working method (§XXII: "wait for
approval before entering the next major phase").

## 1. Recommended stack

No stack is established in this repo or inferable from its history. The brief
itself leaves several strong hints rather than an explicit choice:

- It requires "row-level security **or equivalent**" for tenant isolation —
  RLS is a Postgres-specific mechanism, and the phrasing plus the presence of
  `Supabase` in the initial tool-adapter candidate list (§IX) both point at
  **Postgres, most plausibly via Supabase** (managed Postgres + auth + RLS +
  storage in one place, common across small DivineXTech-style teams).
- The workflow domain model (§V) already assumes durable *tables*
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

## 2. Proposed target folder structure

```
/
├── apps/
│   └── web/                        # Next.js app (business UI + admin/developer views)
│       ├── app/
│       │   ├── (business)/         # Department activation, agent directory, approvals, memory center
│       │   ├── (executive)/        # Sara / executive command center routes (§XII)
│       │   ├── (admin)/            # Provider routing, tool registry, observability — technical views
│       │   └── api/                # Thin route handlers delegating to packages/*
│       └── ...
├── packages/
│   ├── agent-runtime/              # AgentProvider, ModelProvider, AgentExecutor, etc. (§VI)
│   │   ├── providers/
│   │   │   ├── anthropic/
│   │   │   ├── openai/
│   │   │   ├── google-gemini/
│   │   │   └── google-adk/         # Isolated adapter, feature-flagged, never imported outside this package
│   │   └── routing/
│   ├── memory-engine/              # Ingestion, trust states, retrieval, provenance (§VII–VIII)
│   ├── tool-registry/              # Tool definitions, tenant connections, execution pipeline (§IX)
│   │   └── adapters/               # gmail/, stripe/, whatsapp/, flutterwave/, paystack/, ... (mock-first)
│   ├── workflow-engine/            # Durable workflow execution (§X)
│   ├── governance/                 # Policy engine + approvals (§XI)
│   ├── sara/                       # Executive intelligence, built as a consumer of the above, not a superuser (§XII)
│   ├── vertical-os-sdk/            # VerticalOSManifest + template contracts (§XIII)
│   ├── observability/              # Tracing, cost tracking, evaluation harness (§XIV)
│   └── shared/                     # Cross-cutting types, tenant context, feature flags
├── supabase/
│   ├── migrations/                 # SQL migrations, one concern per file
│   └── policies/                   # RLS policy definitions kept alongside schema
├── verticals/
│   ├── restaurant-os/              # Manifest + templates only — installs into shared runtime, does not fork it
│   ├── book-os/
│   └── mediaforge-os/
├── docs/agentflow-v2/              # This documentation set
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

Rationale: every module in §VI–XIV maps to exactly one `packages/*` directory
so the "no business-domain module may directly depend on a provider-specific
SDK" rule (§II) is enforced by the folder boundary itself — only
`agent-runtime/providers/*` may import a provider SDK, and only
`google-adk/` may import Google's ADK package.

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
(Phase 3 for memory_*, Phase 4 for tool_*, etc.) rather than all at once —
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
- `AgentToolResolver` / `AgentMemoryResolver` — resolve *only* the tools and
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
   operational/financial memory, and uses AI only to *explain* those already-
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
`verticals/mediaforge-os` is *configuration* (templates, policy packs,
metric definitions) that installs into the shared runtime — none of them may
contain their own copy of the agent runtime, memory engine, or workflow
engine. This is enforced at the folder-boundary level the same way provider
isolation is (§2).

Before writing the MediaForgeOS example manifest, `DivineXTech/-MediaForgeOS`
(same org, not yet added to this session) should be inspected — if it already
contains a working implementation, the manifest should describe how that
gets *wrapped*, not duplicate it from scratch.

## 9. Phase plan

Follow §XX as written — there is no existing system whose migration order
would justify reordering it. Given the greenfield state, Phase 0 is
effectively complete once this plan is approved; Phase 1 (shared domain
foundation: tenancy tables, RLS, feature flags, base service interfaces) is
the next concrete unit of work.

## 10. Open questions blocking Phase 1

These are the genuine blockers (brief §XXIII.14) — not broad discovery
questions, but specific decisions that change what Phase 1's first migration
and first package look like:

1. **Stack confirmation** — approve the Next.js + Supabase (Postgres +
   RLS + pgvector) recommendation in §1, or specify a different stack. This
   determines the literal language Phase 1's code is written in.
2. **House conventions** — should `DivineXTech/-MediaForgeOS`,
   `afrogrow360-core`, or `africaone-landing` be inspected first for an
   existing DivineXTech stack convention (auth provider, deployment target,
   payment integration pattern) that this build should match instead of the
   default above?
3. **Hosting/deployment target** — Vercel, a VPS, or something else — affects
   whether the workflow worker (§7) can run as a long-lived process or needs
   to be scheduled-function-shaped from day one.
4. **Branch and commit policy for this repo** — this session has no
   pre-assigned branch for `divinexai-infrastructure-os` (unlike `jcode360`).
   Confirm a branch name and whether Phase 0's docs should be pushed now or
   held until Phase 1 code is ready to accompany them.

No other blocker prevents the repository audit itself — it's complete. These
four gate Phase 1 specifically.
