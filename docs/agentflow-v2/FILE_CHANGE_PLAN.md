# File Change Plan — Phase 3: Workflow Runtime and Durable Execution

**Status: Planning gate. Nothing below has been implemented.** This
supersedes the Phase 2 content that previously occupied this file (Phase 2
itself is complete and committed at `aeb0234`; its file-change plan is now
historical and superseded here the same way the original nullable-`tenant_id`
draft was superseded within Phase 2). Full design rationale lives in
`PHASE_3_WORKFLOW_RUNTIME.md`; this file is the file-change-plan excerpt of
that document, kept in the same place Phase 1/Phase 2 readers already look.

## Model, in one sentence

Workflow definitions/versions are platform-owned and immutable once
published, exactly like Phase 2's agents; every tenant installs a workflow by
pinning to one explicit published version; a run is a durable row tree
(`workflow_runs` → `workflow_steps` → `workflow_step_dependencies` →
`workflow_execution_events`) that a stateless worker advances by
database-backed leasing — no workflow state is ever held only in process
memory.

## Revised/new table definitions

See `PHASE_3_WORKFLOW_RUNTIME.md` §1 for full DDL. Summary:

**Platform-owned (no `tenant_id`):** `workflow_definitions`,
`workflow_versions` — same shape as Phase 2's `agent_definitions`/
`agent_versions` (slug, semver `version`, `manifest jsonb`, `manifest_hash`,
5-state `status` lifecycle, immutable once `published`).

**Tenant-owned (`tenant_id NOT NULL` everywhere):** `tenant_workflows` (the
installation row, mirrors `tenant_agents`), `workflow_runs` (15-state
run-level status, already-existing `WorkflowStatusSchema` from
`packages/workflow-engine/src/status.ts`, unchanged), `workflow_steps`
(new 14-state step-level status, leasing columns), `workflow_step_dependencies`
(edge list for the DAG), `workflow_execution_events` (append-only ledger,
sequence-numbered per run), `workflow_dead_letters` (terminal-failure record).

All child tables use the same composite-foreign-key pattern established in
Phase 2 (`(child_fk, tenant_id) references parent (id, tenant_id)`) instead
of triggers, for the same reason: each table denormalizes `tenant_id` for
RLS, and the composite FK is what keeps that denormalization honest.

Indexes: see `PHASE_3_WORKFLOW_RUNTIME.md` §1 — includes two partial indexes
specifically for worker scans (`workflow_steps_lease_expiry_idx` on
`lease_expires_at` where status in `('LEASED','RUNNING')`, and
`workflow_steps_retry_due_idx` on `next_attempt_at` where status =
`'RETRY_SCHEDULED'`).

## Revised registry/service interfaces

New in `packages/workflow-engine/src/`:

```ts
export interface PlatformWorkflowCatalog {
  getDefinitionBySlug(slug: string): Promise<WorkflowDefinition | null>;
  listDefinitions(): Promise<WorkflowDefinition[]>;
  getVersion(workflowVersionId: string): Promise<WorkflowVersion | null>;
  listPublishedVersions(
    workflowDefinitionId: string,
  ): Promise<WorkflowVersion[]>;
}

export interface TenantWorkflowRegistry {
  get(
    tenantId: string,
    workflowDefinitionId: string,
  ): Promise<TenantWorkflowInstallation | null>;
  list(tenantId: string): Promise<TenantWorkflowInstallation[]>;
  setEnabled(tenantWorkflowId: string, enabled: boolean): Promise<void>;
}

export interface WorkflowRunService {
  createWorkflowRun(input: CreateWorkflowRunInput): Promise<WorkflowRun>; // idempotency_key-guarded
  materializeSteps(runId: string): Promise<void>; // manifest steps -> workflow_steps + dependencies, idempotent
  cancelWorkflowRun(runId: string): Promise<void>;
  resumeWorkflowRunAfterApproval(
    runId: string,
    decision: "approved" | "rejected",
  ): Promise<void>;
}

export interface StepLeasing {
  claimStep(
    stepId: string,
    leaseOwner: string,
    leaseMs: number,
  ): Promise<{ leaseToken: string } | null>;
  renewLease(
    stepId: string,
    leaseToken: string,
    leaseMs: number,
  ): Promise<boolean>;
  commitStepSuccess(
    stepId: string,
    leaseToken: string,
    output: unknown,
  ): Promise<boolean>;
  commitStepFailure(
    stepId: string,
    leaseToken: string,
    error: StepError,
  ): Promise<boolean>;
}
```

Extended in `packages/agent-runtime/src/tenantAgentRegistry.ts`:

```ts
export function resolveTenantAgent(
  registry: TenantAgentRegistry,
  tenantId: string,
  agentSlug: string,
): Promise<TenantAgentInstallation>; // throws if not installed, not enabled, or below MOCK_EXECUTABLE
```

New in `packages/agent-runtime/src/`:

```ts
export interface MockAgentAdapter {
  execute(
    installation: TenantAgentInstallation,
    context: AgentExecutionContext,
  ): Promise<AgentExecutionResult>; // deterministic, schema-valid, no real provider call
}

export function assertAgentEligible(
  installation: TenantAgentInstallation,
): void;
```

Agent execution inside a workflow step resolves exclusively through
`resolveTenantAgent` + `MockAgentAdapter` — a workflow step never talks to
`PlatformAgentCatalog` directly, mirroring "execution resolves exclusively
through `TenantAgentRegistry`" from Phase 2's plan.

## Workflow provisioning service

```ts
// packages/workflow-engine/src/provisionTenantWorkflow.ts
export interface ProvisionTenantWorkflowInput {
  tenantId: string;
  actorUserId: string;
  workflowDefinitionSlug: string;
  workflowVersionId: string; // explicit — never resolved implicitly to "latest published"
}
export async function provisionTenantWorkflow(
  db: Queryable,
  catalog: PlatformWorkflowCatalog,
  access: TenantAccessEvaluator,
  input: ProvisionTenantWorkflowInput,
): Promise<{ installation: TenantWorkflowInstallation; created: boolean }>;
```

Same shape as Phase 2's `provisionTenantAgents`: checks
`tenant.manage_workflows` via the reused `PgTenantAccessEvaluator`,
`insert ... on conflict (tenant_id, workflow_definition_id) do nothing
returning id` for idempotency, defaults `enabled = false`, calls
`recordAuditEvent` only when a row is actually created, no database trigger.
Singular (one workflow per call) rather than Phase 2's "all six at once,"
since workflows aren't a fixed enumerable set the way the six named agents
are.

## Platform catalog seeding

`packages/workflow-engine/src/seedPlatformWorkflowCatalog.ts` — identical
pattern to `seedPlatformAgentCatalog`: derives the seed from code-authored
`WorkflowManifest` objects (starting with `reference/clientSolutionAssessment.ts`),
validates via `validateWorkflowManifest` (which runs the full DAG check, not
just schema parsing), computes a content hash, upserts `workflow_definitions`
by slug, inserts or hash-verifies `workflow_versions`. A hash mismatch on an
existing `(definition, version)` pair throws rather than silently
overwriting — the same immutability guarantee as agents.

## Migrations

- `supabase/migrations/<next-timestamp>_workflow_platform_catalog.sql` — the
  two platform tables, RLS read-only for `authenticated` scoped to
  `published` versions, no write policy (service-role/owner-only, same as
  `agent_definitions`/`agent_versions`).
- `supabase/migrations/<next-timestamp+1>_tenant_workflow_installations.sql`
  — the six tenant-owned tables, all indexes, RLS reusing
  `is_tenant_member`/`tenant_has_permission`, insert of the new
  `tenant.manage_workflows` permission key into the existing `permissions`
  catalog.
- Matching rollback files under `supabase/migrations_rollback/`.

Apply order: platform catalog, then tenant installations (tenant tables
reference the platform tables). Roll back in reverse: tenant tables first
(they hold `on delete restrict` references to the platform tables), then
platform tables — same pattern validated in Phase 2's two-migration pair.

## Complete RLS policy outline

**Platform tables** (`workflow_definitions`, `workflow_versions`) — read-only
for tenant users, deny-by-default for `authenticated` writes:

- `workflow_definitions`: `for select using (auth.uid() is not null)`.
- `workflow_versions`: `for select using (auth.uid() is not null and status =
'published')`.

**Tenant tables** (`tenant_workflows`, `workflow_runs`, `workflow_steps`,
`workflow_step_dependencies`, `workflow_dead_letters`) — identical shape on
all five:

- Select: `for select using (is_tenant_member(tenant_id))`.
- Write: `for all using (tenant_has_permission(tenant_id,
'tenant.manage_workflows')) with check (tenant_has_permission(tenant_id,
'tenant.manage_workflows'))`.

**`workflow_execution_events`** — select-only for tenant members, **no**
insert/update/delete policy for `authenticated` at all — only a
service-role/owner connection (the worker) may append, mirroring
`audit_events`/`security_events`'s integrity design. See
`PHASE_3_WORKFLOW_RUNTIME.md` §2 for the literal SQL.

No second authorization mechanism anywhere in this migration.

## Tenant provisioning / runtime test cases

Against real local Postgres, restricted `authenticated` role, mirroring the
exact pattern proven in Phase 2:

1. Provisioning a tenant workflow with no existing installation creates
   exactly one `tenant_workflows` row, `enabled = false`.
2. Re-running provisioning is idempotent — zero additional rows, reported as
   already-existing.
3. A caller without `tenant.manage_workflows` is rejected before any row is
   written.
4. Tenant A cannot read or write tenant B's rows in any of the six tenant
   tables.
5. Any authenticated user can select a `published` `workflow_versions` row;
   none can insert/update/delete it.
6. `seedPlatformWorkflowCatalog` run twice with an identical manifest is a
   no-op the second time; a changed manifest under the same version string
   throws before writing anything.
7. Full DAG validation, leasing, idempotency, retry/dead-letter, recovery,
   and reference-workflow cases — see `PHASE_3_WORKFLOW_RUNTIME.md` §16 for
   the complete test matrix (this file does not duplicate it).

## Superseded

The Phase 2 content previously in this file (platform agent catalog / tenant
agent installation file-change plan) is superseded by this Phase 3 revision
for the purpose of "what does this file currently describe" — it remains
accurate historical record in git history (commit `aeb0234` and the
`PHASE_2_AGENT_RUNTIME.md` completion doc) and is not restated here.
