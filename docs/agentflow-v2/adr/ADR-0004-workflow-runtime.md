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
