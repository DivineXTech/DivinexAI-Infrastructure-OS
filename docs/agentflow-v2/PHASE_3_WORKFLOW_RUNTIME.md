# Phase 3 — Workflow Runtime and Durable Execution (Design)

**Status: Planning gate. Nothing in this document has been implemented.**
Stop for review before writing any runtime code, per instruction.

## 0. Ownership recap (per the brief, unchanged)

- **`workflow-engine`** owns: workflow definitions/versions, tenant workflow
  installations, run lifecycle, step lifecycle, dependency-graph validation,
  scheduling, retries, timeouts, leasing, idempotency, cancellation,
  dead-letter handling, execution events.
- **`agent-runtime`** owns: tenant agent resolution, lifecycle eligibility
  checks, mock agent execution, typed agent execution results. **Not yet
  built in Phase 2** — Phase 2 registered agents but never built the mock
  executor itself (`FILE_CHANGE_PLAN.md`'s Phase 2 draft proposed
  `mockExecutor.ts`; the actual Phase 2 commit narrowed scope to
  contracts/registry/provisioning only). Phase 3 must add it, since the
  workflow runtime has nothing to invoke without it.
- **`governance`** exposes only an integration _contract_ for approval-
  required / blocked-by-policy / escalation-required — Phase 3 provides a
  trivial stub implementation; the real policy engine is Phase 4.
- **`observability`** may read persisted execution events; the analytics
  expansion itself is Phase 9.

## 1. Data model

### Platform-owned (no `tenant_id`)

```sql
create table workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,               -- "client_solution_assessment"
  display_name text not null,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workflow_versions (
  id uuid primary key default gen_random_uuid(),
  workflow_definition_id uuid not null references workflow_definitions (id) on delete cascade,
  version text not null,                   -- semver
  manifest jsonb not null,                  -- validated WorkflowManifestMetadata (no Zod schema objects — those stay code-side, same pattern as agent_versions)
  manifest_hash text not null,
  status text not null default 'draft'
    check (status in ('draft', 'validated', 'published', 'deprecated', 'retired')),
  published_at timestamptz,
  deprecated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workflow_definition_id, version)
);
```

Indexes: `workflow_versions(workflow_definition_id)`, `workflow_versions(status)`.

Lifecycle: a new `WorkflowVersionStatus` enum + transition table, structurally
identical to `agent-runtime`'s `AgentVersionStatus` but declared
independently in `workflow-engine` — same reasoning as Phase 2's two
separate agent lifecycles: each package owns its own versioning vocabulary
even where the shape happens to match.

### Tenant-owned (`tenant_id NOT NULL` everywhere, no exceptions)

```sql
create table tenant_workflows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  workflow_definition_id uuid not null references workflow_definitions (id) on delete restrict,
  workflow_version_id uuid not null references workflow_versions (id) on delete restrict,
  enabled boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, workflow_definition_id),
  unique (id, tenant_id)
);

create table workflow_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  tenant_workflow_id uuid not null,
  workflow_version_id uuid not null references workflow_versions (id) on delete restrict, -- pinned at creation; immutable for the run's lifetime
  status text not null default 'DRAFT'
    check (status in ('DRAFT','PLANNING','WAITING_FOR_APPROVAL','QUEUED','RUNNING','RETRYING',
                       'BLOCKED','PAUSED','WAITING_FOR_INPUT','VALIDATING','COMPLETED','FAILED',
                       'CANCELLED','REJECTED','EXPIRED')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  idempotency_key text,
  requested_by_user_id uuid references auth.users (id) on delete set null,
  trace_id text not null,
  next_event_sequence bigint not null default 1, -- see §6, execution-event ordering
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  foreign key (tenant_workflow_id, tenant_id) references tenant_workflows (id, tenant_id) on delete cascade,
  unique (tenant_id, idempotency_key),      -- Postgres allows multiple NULLs; unconstrained when omitted
  unique (id, tenant_id)
);

create table workflow_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  workflow_run_id uuid not null,
  step_key text not null,                  -- stable id from the manifest, e.g. "sara_interpret"
  agent_slug text not null,                -- which canonical agent this step assigns
  status text not null default 'PENDING'
    check (status in ('PENDING','READY','LEASED','RUNNING','WAITING_FOR_APPROVAL','WAITING_FOR_INPUT',
                       'RETRY_SCHEDULED','SUCCEEDED','FAILED','BLOCKED','CANCELLED','SKIPPED',
                       'EXPIRED','DEAD_LETTERED')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  attempt integer not null default 0,
  max_attempts integer not null default 3,
  next_attempt_at timestamptz,
  timeout_ms integer not null,
  lease_owner text,
  lease_token uuid,
  leased_at timestamptz,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  error jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  foreign key (workflow_run_id, tenant_id) references workflow_runs (id, tenant_id) on delete cascade,
  unique (workflow_run_id, step_key),       -- materialization idempotency
  unique (id, tenant_id)
);

create table workflow_step_dependencies (
  tenant_id uuid not null references tenants (id) on delete cascade,
  workflow_run_id uuid not null,
  step_id uuid not null,
  depends_on_step_id uuid not null,
  primary key (step_id, depends_on_step_id),
  foreign key (workflow_run_id, tenant_id) references workflow_runs (id, tenant_id) on delete cascade,
  foreign key (step_id, tenant_id) references workflow_steps (id, tenant_id) on delete cascade,
  foreign key (depends_on_step_id, tenant_id) references workflow_steps (id, tenant_id) on delete cascade
);

create table workflow_execution_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  workflow_run_id uuid not null,
  workflow_step_id uuid,                   -- nullable: run-level events have none
  event_type text not null,
  actor_type text not null check (actor_type in ('user','agent','system','worker')),
  actor_id text,
  trace_id text not null,
  correlation_id text not null,
  causation_id uuid,
  sequence_number bigint not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (workflow_run_id, tenant_id) references workflow_runs (id, tenant_id) on delete cascade,
  unique (workflow_run_id, sequence_number)
);

create table workflow_dead_letters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  workflow_run_id uuid not null,
  workflow_step_id uuid not null,
  reason text not null,
  last_error jsonb,
  attempt_count integer not null,
  created_at timestamptz not null default now(),
  foreign key (workflow_run_id, tenant_id) references workflow_runs (id, tenant_id) on delete cascade,
  foreign key (workflow_step_id, tenant_id) references workflow_steps (id, tenant_id) on delete cascade
);
```

**Why composite foreign keys again:** identical reasoning to Phase 2's
`tenant_agents`/child-table pattern — every child table denormalizes
`tenant_id` directly (so RLS never needs a join), and a composite FK
`(child_fk, tenant_id) references parent (id, tenant_id)` makes Postgres
reject any row whose `tenant_id` doesn't match its parent — declaratively,
no trigger.

### Indexes

```sql
create index tenant_workflows_tenant_id_idx on tenant_workflows (tenant_id);
create index workflow_runs_tenant_id_idx on workflow_runs (tenant_id);
create index workflow_runs_status_idx on workflow_runs (status);
create index workflow_runs_tenant_workflow_id_idx on workflow_runs (tenant_workflow_id);
create index workflow_steps_tenant_id_idx on workflow_steps (tenant_id);
create index workflow_steps_run_id_idx on workflow_steps (workflow_run_id);
create index workflow_steps_status_idx on workflow_steps (status);
create index workflow_steps_lease_expiry_idx on workflow_steps (lease_expires_at)
  where status in ('LEASED', 'RUNNING');    -- for expired-lease recovery scans
create index workflow_steps_retry_due_idx on workflow_steps (next_attempt_at)
  where status = 'RETRY_SCHEDULED';         -- for due-retry requeue scans
create index workflow_step_dependencies_run_id_idx on workflow_step_dependencies (workflow_run_id);
create index workflow_step_dependencies_depends_on_idx on workflow_step_dependencies (depends_on_step_id);
create index workflow_execution_events_tenant_id_idx on workflow_execution_events (tenant_id);
create index workflow_execution_events_run_id_idx on workflow_execution_events (workflow_run_id);
create index workflow_dead_letters_tenant_id_idx on workflow_dead_letters (tenant_id);
```

## 2. RLS policy outline

New permission key: `tenant.manage_workflows`.

**`tenant_workflows`, `workflow_runs`, `workflow_steps`,
`workflow_step_dependencies`, `workflow_dead_letters`** — identical shape,
reusing `is_tenant_member`/`tenant_has_permission` exactly as every prior
tenant-owned table has:

```sql
create policy <table>_select_member on <table>
  for select using (is_tenant_member(tenant_id));

create policy <table>_write_admin on <table>
  for all using (tenant_has_permission(tenant_id, 'tenant.manage_workflows'))
  with check (tenant_has_permission(tenant_id, 'tenant.manage_workflows'));
```

**`workflow_execution_events`** — read-only for tenant users, **no**
insert/update/delete policy at all, mirroring `audit_events`/
`security_events`'s integrity design: only a service-role/owner connection
(the worker) may append events. A tenant fabricating its own execution
history would undermine the entire ledger's trustworthiness.

```sql
create policy workflow_execution_events_select_member on workflow_execution_events
  for select using (is_tenant_member(tenant_id));
```

**The worker itself connects via a service-role/owner connection, not the
restricted `authenticated` role** — same as `provisionTenantAgents`/
`recordAuditEvent` in Phase 1–2. RLS protects against unauthorized
_end-user_ access; the worker performs its own explicit tenant-scoped
queries (every query already carries `tenant_id` in its `WHERE`/join, and
the composite FKs prevent cross-tenant corruption regardless of which role
issues the write).

## 3. Workflow manifest schema (Zod)

```ts
export const RetryPolicySchema = z.object({
  maxAttempts: z.number().int().positive(),
  backoff: z.enum(["fixed", "exponential"]),
  backoffMs: z.number().int().positive(),
  timeoutMs: z.number().int().positive(),
  deadLetterOnExhaustion: z.boolean().default(true),
});

export const WorkflowStepDefinitionSchema = z.object({
  stepKey: z.string().min(1),
  agentSlug: z.string().min(1),
  dependsOn: z.array(z.string().min(1)),
  approvalRequired: z.boolean().default(false),
  retryPolicy: RetryPolicySchema,
});

export const WorkflowManifestMetadataSchema = z.object({
  id: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  displayName: z.string().min(1),
  description: z.string().min(1),
  steps: z.array(WorkflowStepDefinitionSchema).min(1),
});

export interface WorkflowManifest<
  TInput = unknown,
  TOutput = unknown,
> extends WorkflowManifestMetadata {
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
}
```

Same pattern as `AgentManifest`: `inputSchema`/`outputSchema` are live Zod
schemas (code, not data), checked via `instanceof z.ZodType` rather than
folded into the metadata schema — `validateWorkflowManifest` does both,
plus the full DAG validation in §4.

## 4. DAG validation algorithm (runs at publish time, not just runtime)

`validateWorkflowManifest(manifest)`, in order, each failure throwing a
specific, named error:

1. **Metadata schema** — `WorkflowManifestMetadataSchema.parse`.
2. **`inputSchema`/`outputSchema` are Zod schemas** — same `instanceof`
   check as `AgentManifest`.
3. **No duplicate `stepKey`** — collect keys into a `Set`; reject if
   `set.size !== steps.length`.
4. **No orphaned dependency references** — every `dependsOn` entry must
   name an existing `stepKey`.
5. **No cycles** — DFS with a recursion stack (standard cycle detection on
   the `stepKey -> dependsOn` adjacency); reject on any back-edge.
6. **At least one entry step** — at least one step with `dependsOn.length
=== 0`.
7. **Every step reachable from an entry step** — BFS/DFS from the set of
   entry steps over the _forward_ edges (dependent → dependency reversed);
   reject any step not visited (an unreachable/orphaned step).
8. **At least one terminal step reachable** — at least one step with no
   other step depending on it, and that step must be reachable per (7).
   Combined with (5)'s acyclicity, this guarantees the graph can actually
   finish.
9. **Every `agentSlug` is a known canonical agent** — checked against
   `agent-runtime`'s exported `CANONICAL_AGENT_SLUGS` (a deliberate,
   narrow, justified new dependency: `workflow-engine` depends on
   `agent-runtime` for this one validation, the same way `agent-runtime`
   depends on `shared` for `Queryable`).

Implemented as small, independently testable pure functions in `dag.ts`
(`findDuplicateStepKeys`, `findOrphanedDependencies`, `detectCycle`,
`computeEntrySteps`, `computeReachableSteps`, `computeTerminalSteps`), each
returning a result `validateWorkflowManifest` composes and reports from —
so a test can exercise "cycle detection" in isolation from "orphaned
reference rejection" rather than only through the top-level function.

## 5. Run and step state machines

**Run-level (`workflow_runs.status`)** — the 15 statuses and transition
table **already exist** (`packages/workflow-engine/src/status.ts`, built in
Phase 1, tested with 22 passing tests). Reused verbatim; no changes needed.

**Step-level (`workflow_steps.status`, new)** — 14 statuses:

```
PENDING → READY → LEASED → RUNNING → SUCCEEDED
                                    → FAILED
                                    → DEAD_LETTERED
                                    → RETRY_SCHEDULED → READY (loop)
                                    → WAITING_FOR_APPROVAL → RUNNING | FAILED | EXPIRED
                                    → WAITING_FOR_INPUT → RUNNING | EXPIRED
                                    → BLOCKED → READY | FAILED
(CANCELLED reachable from every non-terminal state, same as workflow_runs)
```

Full transition table:

| From                                                                           | To                                                                                                                                        |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `PENDING`                                                                      | `READY`, `CANCELLED`, `SKIPPED`                                                                                                           |
| `READY`                                                                        | `LEASED`, `CANCELLED`, `SKIPPED`                                                                                                          |
| `LEASED`                                                                       | `RUNNING`, `EXPIRED`, `CANCELLED`                                                                                                         |
| `RUNNING`                                                                      | `SUCCEEDED`, `FAILED`, `DEAD_LETTERED`, `RETRY_SCHEDULED`, `WAITING_FOR_APPROVAL`, `WAITING_FOR_INPUT`, `BLOCKED`, `EXPIRED`, `CANCELLED` |
| `WAITING_FOR_APPROVAL`                                                         | `RUNNING`, `FAILED`, `CANCELLED`, `EXPIRED`                                                                                               |
| `WAITING_FOR_INPUT`                                                            | `RUNNING`, `CANCELLED`, `EXPIRED`                                                                                                         |
| `RETRY_SCHEDULED`                                                              | `READY`, `CANCELLED`                                                                                                                      |
| `BLOCKED`                                                                      | `READY`, `FAILED`, `CANCELLED`                                                                                                            |
| `SUCCEEDED` / `FAILED` / `CANCELLED` / `SKIPPED` / `EXPIRED` / `DEAD_LETTERED` | _(terminal — none)_                                                                                                                       |

`FAILED` and `DEAD_LETTERED` are both reachable directly from `RUNNING` (not
through each other) — the choice between them is made once, at the moment
attempts are exhausted (§7), based on the step's `deadLetterOnExhaustion`
policy flag, not by transitioning through an intermediate state.

**A step becomes `READY` only when its dependencies are satisfied** — this
is a _scheduling_ function, not a raw transition-table lookup:
`computeReadySteps(runId)` finds every `PENDING` step whose every
`workflow_step_dependencies` row points at a `SUCCEEDED` (or `SKIPPED`)
step, and transitions each `PENDING → READY`. It's safe to call repeatedly
(idempotent — steps already `READY` or past it simply don't match the
`WHERE status = 'PENDING'` clause on a second call).

## 6. Leasing algorithm

**Claim** (atomic, single conditional `UPDATE`, no separate `SELECT`):

```sql
update workflow_steps
set status = 'LEASED',
    lease_owner = $2,
    lease_token = gen_random_uuid(),
    leased_at = now(),
    lease_expires_at = now() + ($3 || ' milliseconds')::interval,
    heartbeat_at = now()
where id = $1 and status = 'READY'
returning lease_token;
```

Race-free by construction: if two workers race to claim the same step, only
the first `UPDATE` to commit still sees `status = 'READY'`; the second's
`WHERE` clause matches zero rows once the first has committed (Postgres
MVCC + row-level locking serializes concurrent updates to the same row).
For claiming across _many_ candidate steps efficiently, the natural upgrade
is `SELECT id FROM workflow_steps WHERE status='READY' ... FOR UPDATE SKIP
LOCKED LIMIT N` followed by per-row claims — noted as the scale-up path,
not needed for Phase 3's single-worker test scenario.

**Heartbeat/renew** (requires the current token):

```sql
update workflow_steps
set heartbeat_at = now(), lease_expires_at = now() + ($3 || ' milliseconds')::interval
where id = $1 and lease_token = $2 and status = 'RUNNING';
```

**Commit success/failure** (requires the current token — this is what makes
"only the lease holder may commit" true):

```sql
update workflow_steps
set status = $3, output = $4, completed_at = now(), ...
where id = $1 and lease_token = $2;
```

If the lease was reclaimed by recovery (§9) before the original holder's
commit arrives, its token no longer matches — the `UPDATE` affects zero
rows, and the caller must detect this (`rowCount === 0`) and treat its own
result as discarded rather than silently succeeding. This is the concrete
mechanism behind "invalid lease-token rejection."

## 7. Idempotency model

| Operation                           | Mechanism                                                                                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflow run creation               | `idempotency_key` unique per `(tenant_id, idempotency_key)`; `INSERT ... ON CONFLICT DO NOTHING`, and on conflict, `SELECT` and return the existing row instead of erroring                                                           |
| Step materialization                | `INSERT ... ON CONFLICT (workflow_run_id, step_key) DO NOTHING` per step — re-materializing an already-materialized run is a no-op                                                                                                    |
| Step scheduling (`PENDING → READY`) | Idempotent by construction — the scheduler's `UPDATE` only ever matches currently-`PENDING` rows                                                                                                                                      |
| Agent invocation                    | The `(step_id, attempt)` pair is the invocation idempotency key — before invoking, check whether output for the current attempt already exists (crash between "adapter returned" and "commit result" must not double-invoke on retry) |
| Retry scheduling                    | Guarded by the lease token, same as any other commit — a duplicate retry-scheduling call from a stale holder affects zero rows                                                                                                        |
| Approval/input resume               | Guarded by current status — resuming an already-resumed step (no longer `WAITING_FOR_*`) is a no-op, not an error                                                                                                                     |
| Cancellation                        | `cancelWorkflowRun`/`cancelStep` check current status first; already-terminal is a successful no-op, not a thrown error                                                                                                               |

## 8. Retry and dead-letter model

On a step failure (from `RUNNING`), the decision is deterministic, computed
once, not by transitioning through intermediate states:

```
if error.retryable and attempt < maxAttempts:
    next_attempt_at = now() + backoffMs * (backoff == "exponential" ? 2^(attempt-1) : 1)
    → RETRY_SCHEDULED
else if deadLetterOnExhaustion:
    → DEAD_LETTERED, insert workflow_dead_letters row
else:
    → FAILED
```

Errors are a structured shape (`{ retryable: boolean; code: string; message:
string }`), never a raw exception matched by string — so the retry decision
is data-driven and testable without needing to trigger a real failure mode.

## 9. Worker recovery / reconciliation algorithm

A single idempotent function, `reconcileWorkflowRuntime(db)`, safe to run on
worker startup and on a recurring timer — **queries the database fresh
every time; holds no in-memory workflow state**:

1. **Reclaim expired leases** — `UPDATE workflow_steps SET status =
(recompute via the retry/dead-letter decision in §8, treating the
expiry as a failed attempt), lease_token = NULL, ... WHERE status IN
('LEASED','RUNNING') AND lease_expires_at < now()`, and append a
   `step.lease_reclaimed` execution event for each.
2. **Requeue due retries** — `UPDATE workflow_steps SET status = 'READY'
WHERE status = 'RETRY_SCHEDULED' AND next_attempt_at <= now()`.
3. **Advance dependency-satisfied steps** — call `computeReadySteps` (§5)
   for every run still in a non-terminal status.
4. **Never touch terminal rows** — every query above filters to
   non-terminal statuses explicitly; `SUCCEEDED`/`FAILED`/`CANCELLED`/
   `SKIPPED`/`EXPIRED`/`DEAD_LETTERED` rows are never written by recovery.
5. **No duplicate completion is possible** — a worker that crashed
   mid-commit either (a) committed the terminal state before crashing
   (recovery sees a terminal row, skips it), or (b) didn't commit
   (recovery sees the row still `LEASED`/`RUNNING` past its lease
   expiry, reclaims it) — there is no third state where a step is both
   "done" and "reclaimable."

## 10. Governance integration contract (stub only — Phase 4 builds the real thing)

```ts
export interface GovernanceGate {
  evaluateStep(context: {
    tenantId: string;
    workflowRunId: string;
    stepKey: string;
    agentSlug: string;
  }): Promise<{
    approvalRequired: boolean;
    blocked: boolean;
    blockReason: string | null;
    escalationRequired: boolean;
  }>;
}
```

Phase 3 ships `StaticGovernanceGate`: returns the manifest-declared
`approvalRequired` flag verbatim, never blocks, never escalates. Phase 4
replaces this with a real evaluator built on `packages/shared`'s
`PgTenantAccessEvaluator`-style deterministic pattern — the interface
shape is fixed now specifically so that swap requires no change to
`workflow-engine`'s calling code.

## 11. Mock agent execution (new in Phase 3, `agent-runtime`)

Per the ownership split, `agent-runtime` gains:

- `mockAgentAdapter.ts` — `MockAgentAdapter`: given a
  `TenantAgentInstallation` + `AgentExecutionContext`, returns a
  deterministic, schema-valid `AgentExecutionResult` (`status: "completed"`,
  a canned summary referencing the agent's slug and the step's objective) —
  no real model/provider call, matching Phase 2's original intent for
  `MOCK_EXECUTABLE`.
- `eligibility.ts` — `assertAgentEligible(installation)`: throws unless
  `enabled === true` and `lifecycleStatus` is at least `MOCK_EXECUTABLE`
  (i.e., not `REGISTERED`) — "lifecycle eligibility checks."
- `resolveTenantAgent(registry, tenantId, agentSlug)` (extends
  `tenantAgentRegistry.ts`) — "tenant agent resolution": given a step's
  `agentSlug`, finds the tenant's installed agent, its pinned version, and
  manifest, ready for invocation.

## 12. Reference workflow: `client_solution_assessment` v1.0.0

```
sara_interpret (sara)
  └─▶ nova_plan (nova)
        ├─▶ pulse_market (pulse)   ─┐
        ├─▶ reven_pricing (reven)  ─┼─▶ guardian_review (guardian) ─▶ sara_synthesize (sara)
        └─▶ forge_technical (forge)─┘
```

Seven manifest steps. **The "durable approval-wait state before completion"
is modeled as the _run_ transitioning `RUNNING → WAITING_FOR_APPROVAL`
after `sara_synthesize` succeeds — not an eighth graph step.** `workflow_runs`
already supports this transition (`RUNNING → WAITING_FOR_APPROVAL` is legal
in the existing run-level table, Phase 1). A placeholder
`resumeWorkflowRunAfterApproval(runId, decision)` moves the run
`WAITING_FOR_APPROVAL → RUNNING → ... → COMPLETED` (approved) or `→
REJECTED` (denied) — a stub standing in for Phase 4's real approval
lifecycle, consistent with "governance exposes only integration contracts"
and the brief's own "approval waiting and resume placeholder" test item.

Each step's `retryPolicy`: `maxAttempts: 3, backoff: "exponential",
backoffMs: 1000, timeoutMs: 60000, deadLetterOnExhaustion: true`
(placeholder values, revisit once real providers exist in Phase 5).

## 13. Proposed file tree

```
packages/agent-runtime/src/
  mockAgentAdapter.ts        (new)
  eligibility.ts             (new)
  tenantAgentRegistry.ts     (extended: resolveTenantAgent)

packages/workflow-engine/src/
  status.ts                  (existing, unchanged — run-level WorkflowStatus)
  stepStatus.ts               (new — WorkflowStepStatus + transitions)
  workflowVersionLifecycle.ts (new — WorkflowVersionStatus + transitions)
  manifest.ts                 (new — WorkflowManifest schema + validateWorkflowManifest)
  dag.ts                       (new — pure graph algorithms)
  platformWorkflowCatalog.ts  (new — PlatformWorkflowCatalog / PgPlatformWorkflowCatalog)
  tenantWorkflowRegistry.ts    (new — TenantWorkflowRegistry / PgTenantWorkflowRegistry)
  seedPlatformWorkflowCatalog.ts (new)
  provisionTenantWorkflow.ts   (new)
  workflowRunService.ts        (new — createWorkflowRun, materializeSteps, cancelWorkflowRun, resumeWorkflowRunAfterApproval)
  stepScheduler.ts             (new — computeReadySteps)
  stepLeasing.ts               (new — claimStep, renewLease, commitStepSuccess, commitStepFailure)
  retryPolicy.ts               (new — computeNextAttempt, classifyOutcome)
  executionEvents.ts           (new — appendWorkflowExecutionEvent, sequence-locked)
  recovery.ts                  (new — reconcileWorkflowRuntime)
  governanceGate.ts            (new — GovernanceGate contract + StaticGovernanceGate)
  reference/clientSolutionAssessment.ts (new — the manifest)

packages/shared/src/
  contentHash.ts               (new, proposed extraction — see §14)

apps/worker/                   (new — thin polling loop; all decision logic
                                 lives in workflow-engine, tested independently
                                 of the process itself. Not gated by the
                                 apps/admin/Next.js deferral in ADR-0013 §3 —
                                 that deferral is about the UI framework, and
                                 apps/worker was always planned as a separate,
                                 framework-less concern.)

supabase/migrations/
  <next-ts>_workflow_platform_catalog.sql       (new)
  <next-ts+1>_tenant_workflow_installations.sql (new)

supabase/migrations_rollback/
  <next-ts>_workflow_platform_catalog_rollback.sql       (new)
  <next-ts+1>_tenant_workflow_installations_rollback.sql (new)
```

## 14. Proposed small refactor: shared content-hashing utility

Phase 2 built `packages/agent-runtime/src/manifestHash.ts` (canonicalize +
sha256). Phase 3 needs the identical logic for `workflow_versions`. Per
`CAPABILITY_PACKAGE_MAPPING.md`'s own stated trigger condition ("move only
when there is a clear ownership boundary... a specific move has clear
ownership"), a second package independently needing the exact same
canonicalize-then-hash logic is that trigger. Proposed: extract
`packages/shared/src/contentHash.ts` (`computeContentHash(value: unknown):
string`), and have both `agent-runtime/src/manifestHash.ts` and the new
`workflow-engine/src/manifestHash.ts` thin-wrap it (`computeManifestHash =
(m) => computeContentHash(extractMetadata(m))`). This is the one proposed
exception to "don't move things into `packages/shared`" — flagged
explicitly rather than done silently, per instruction.

## 15. Migration and rollback order

Apply in order: `..._workflow_platform_catalog.sql`, then
`..._tenant_workflow_installations.sql` (tenant tables reference the
platform tables). Roll back in the reverse order — tenant tables first
(they hold the `on delete restrict` references to the platform tables),
then platform tables — exactly the same pattern already proven correct in
Phase 2's two migrations.

## 16. Test matrix

| Area                                      | File (proposed)                                                                          | Notes                                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Workflow manifest validation              | `manifest.test.ts`                                                                       | valid manifest passes; each metadata violation rejected                                                 |
| Cycle detection                           | `dag.test.ts`                                                                            | direct cycle, indirect cycle, self-reference                                                            |
| Invalid dependency rejection              | `dag.test.ts`                                                                            | orphaned reference, duplicate step key, no entry step, unreachable step                                 |
| Workflow version immutability             | `workflowVersionLifecycle.test.ts`                                                       | mirrors `agentVersionLifecycle.test.ts`                                                                 |
| Explicit version pinning                  | `workflowRunService.test.ts`                                                             | run always carries a concrete `workflow_version_id`; no "latest" resolution path exists to test against |
| Tenant workflow provisioning              | `provisionTenantWorkflow.test.ts`                                                        | idempotent, permission-checked, audit-logged — mirrors `provisionTenantAgents.test.ts`                  |
| Cross-tenant RLS isolation                | `crossTenantIsolation.test.ts`                                                           | all 6 tenant tables + 2 platform tables, mirrors Phase 2's file                                         |
| Legal/illegal run transitions             | _(already covered — `packages/workflow-engine/test/status.test.ts`, Phase 1, unchanged)_ |                                                                                                         |
| Legal/illegal step transitions            | `stepStatus.test.ts`                                                                     | exhaustive, mirrors `status.test.ts`'s style                                                            |
| Parallel branch eligibility               | `stepScheduler.test.ts`                                                                  | pulse/reven/forge all become `READY` together once `nova_plan` succeeds                                 |
| Dependency gating                         | `stepScheduler.test.ts`                                                                  | `guardian_review` stays `PENDING` until all three siblings `SUCCEEDED`                                  |
| Atomic step claiming                      | `stepLeasing.test.ts`                                                                    | two concurrent claim attempts on one step — exactly one succeeds                                        |
| Stale lease recovery                      | `recovery.test.ts`                                                                       | expired lease reclaimed, attempt incremented, retry/dead-letter decision applied                        |
| Invalid lease-token rejection             | `stepLeasing.test.ts`                                                                    | commit with a stale/reclaimed token affects zero rows                                                   |
| Idempotent workflow creation              | `workflowRunService.test.ts`                                                             | same `idempotency_key` twice returns the same run, no duplicate                                         |
| Idempotent step materialization           | `workflowRunService.test.ts`                                                             | materializing twice creates no duplicate steps/dependencies                                             |
| Retry scheduling                          | `retryPolicy.test.ts`                                                                    | exponential/fixed backoff computation                                                                   |
| Maximum-attempt handling                  | `retryPolicy.test.ts`                                                                    | attempt reaches `maxAttempts` → dead-letter or fail per policy                                          |
| Dead-letter creation                      | `retryPolicy.test.ts` + `recovery.test.ts`                                               | `workflow_dead_letters` row created exactly once                                                        |
| Cancellation propagation                  | `workflowRunService.test.ts`                                                             | cancelling a run cancels its `PENDING`/`READY`/`LEASED` steps, leaves `SUCCEEDED` ones alone            |
| Worker restart recovery                   | `recovery.test.ts`                                                                       | simulate a crash mid-step (lease never renewed), confirm reconciliation recovers it exactly once        |
| Approval waiting and resume placeholder   | `workflowRunService.test.ts`                                                             | `WAITING_FOR_APPROVAL → RUNNING`/`REJECTED` stub                                                        |
| Complete reference workflow (mock agents) | `referenceWorkflow.test.ts`                                                              | full `client_solution_assessment` run start-to-finish, integration-style                                |

**Isolation:** same pattern as Phase 2 — a dedicated local test database
(proposed name: `agentflow_test_workflow_engine`), added to
`scripts/setup-local-test-db.sh`'s `DB_NAMES` array, and
`packages/workflow-engine/vitest.config.ts` gets `fileParallelism: false`
(needed once workflow-engine has more than one DB-backed test file, which
it will after this phase — it doesn't yet).

## 17. Unresolved blockers

None that block _this planning document_. Two decisions to confirm before
implementation starts:

1. **The `packages/shared/src/contentHash.ts` extraction (§14)** — a
   deliberate, narrow exception to "don't move things into `packages/shared`
   casually." Flagged for explicit sign-off rather than assumed.
2. **`workflow-engine` importing `agent-runtime`'s `CANONICAL_AGENT_SLUGS`**
   for DAG validation (§4, item 9) — a new inter-package dependency in the
   _other_ direction from Phase 2's `agent-runtime → shared` dependency.
   Confirm this is an acceptable coupling (it's one-way: `workflow-engine`
   depends on `agent-runtime`, never the reverse) before it's built.

The Phase 1 Supabase-validation gate remains open and unrelated to either
of these — Phase 3, like Phase 2, is fully testable against local Postgres
without it.
