# ADR-0004: Workflow Runtime

**Status:** Proposed — to be finalized in Phase 5 once step-volume and
concurrency requirements are known from Phases 1-4

## Context

The source brief requires long-running, resumable, durable workflows (§X),
with the domain model (§V) already specifying tables that record every step
run, event, failure, and compensation — implying the database itself is
meant to be the durable record, not just a log alongside an external
orchestrator's internal state.

There is no existing queue or orchestration infrastructure in this
organization (per `../REPOSITORY_AUDIT.md`).

## Decision

Start with a **Postgres-native durable execution model**:

- `workflow_instances` / `workflow_step_runs` / `workflow_events` are the
  system of record for workflow state.
- A worker process claims due steps (via `SELECT ... FOR UPDATE SKIP LOCKED`
  or equivalent), executes them, and writes results — resumable by
  construction, since no state lives only in application memory between
  steps.
- Retries, timeouts, and compensation are modeled as explicit rows/state
  transitions, not implicit runtime behavior.

Revisit this decision once real step-volume, concurrency, and latency
requirements exist. If a bespoke worker can't keep up, the schema does not
need to change to adopt a dedicated durable-execution product (e.g. Temporal
or Inngest) fronting the same tables — only the execution driver changes.

## Consequences

- No new vendor/ops dependency is introduced before it's proven necessary
  ("least disruptive option," §X).
- The team owns retry/timeout/concurrency logic directly rather than
  delegating to a mature orchestrator's battle-tested implementation —
  accepted risk at current scale, to be re-evaluated per the trigger above.

## Alternatives considered

- Temporal — most robust, but a real ops dependency (its own cluster or
  managed-cloud cost) unjustified at zero existing workflow volume.
- Inngest — lower ops burden than Temporal, good Next.js fit, but still a
  new vendor dependency; deferred until the Postgres-native approach is
  shown to be insufficient.

## Related

- `ADR-0011` — this ADR decides the execution _model_ (Postgres tables as
  source of truth, worker polls and claims steps); ADR-0011 decides _where
  the worker process physically runs_ (VPS, Cloud Run, Railway, Render,
  Fly.io, or a managed workflow engine instead of this model entirely). Both
  must be settled before Phase 5.
- `ADR-0013` — the tenancy/package-taxonomy reconciliation whose two-lifecycle
  versioning pattern (platform definition + tenant installation, immutable
  once published) is reused verbatim below for workflows.

## Addendum (Phase 3 planning gate): concrete shape of the Postgres-native model

The decision above is now concrete, not just directional. Recorded here
rather than in a new ADR because this is the same "Postgres tables as source
of truth, worker claims and executes" decision reaching its detailed design,
not a new decision. Full design: `../PHASE_3_WORKFLOW_RUNTIME.md`.

- **Versioning mirrors `ADR-0013`'s agent pattern exactly.** Workflows split
  into platform-owned `workflow_definitions`/`workflow_versions` (immutable
  once `published`, content-hash-verified) and tenant-owned
  `tenant_workflows` installations pinned to one explicit published version
  — never a nullable-`tenant_id` row, never an implicit "latest."
- **Claiming a due step is one atomic conditional `UPDATE`** (`SET status =
'LEASED', lease_token = gen_random_uuid(), ... WHERE id = $1 AND status =
'READY' RETURNING lease_token`), not a `SELECT` followed by a separate
  `UPDATE`. This is what "resumable by construction" concretely means: no
  advisory lock, no external queue, and exactly one concurrent claimer wins
  by Postgres MVCC alone. `SELECT ... FOR UPDATE SKIP LOCKED` is the noted
  upgrade path for claiming many steps in one round-trip at higher volume —
  not needed at Phase 3's scale.
- **Only the current lease-token holder may commit.** Every commit
  (`RUNNING → SUCCEEDED/FAILED/...`) is itself a conditional `UPDATE ...
WHERE id = $1 AND lease_token = $2`; a stale or reclaimed token matches
  zero rows, and the caller must treat that as its own result being
  discarded, not as a silent success.
- **Recovery is a single stateless, idempotent, re-runnable function**
  (`reconcileWorkflowRuntime`) queried fresh from the database on every
  worker start and on a recurring timer — it holds no in-memory workflow
  state, reclaims expired leases (applying the same retry/dead-letter
  decision a live failure would), requeues due retries, and advances
  dependency-satisfied steps. This is the concrete mechanism by which "no
  state lives only in application memory between steps" (this ADR's original
  Decision) is enforced, not just aspired to.
- **Execution history is an append-only, per-run sequence-numbered ledger**
  (`workflow_execution_events`), writable only by a service-role/owner
  connection — mirroring `audit_events`/`security_events`'s existing
  integrity design rather than inventing a second one.
- **Governance is integrated as a narrow contract (`GovernanceGate`), stubbed
  in Phase 3 (`StaticGovernanceGate`) and replaced without a calling-code
  change once Phase 4's real policy engine lands** — the workflow runtime
  never grows its own bespoke approval logic in the interim.
- **No vendor orchestrator (Temporal/Inngest) is introduced in this phase.**
  The original Decision's trigger for revisiting this ("if a bespoke worker
  can't keep up") has not fired — Phase 3 is a single-worker, mock-adapter
  reference scenario. This addendum does not change the Alternatives-considered
  section above; it remains the record of why a vendor orchestrator was not
  chosen at all, not just not chosen yet.
