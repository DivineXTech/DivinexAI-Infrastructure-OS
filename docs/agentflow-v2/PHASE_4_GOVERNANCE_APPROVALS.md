# Phase 4 — Governance, Policies, Risk Decisions, and Human Approvals (Design)

**Status: Conditionally approved, revised, implementation proceeding.** Four
required refinements from review are incorporated in this revision:

1. **Versioned risk classifications** — `risk_classifications` (a mutable
   lookup table) is replaced by `risk_classification_definitions` +
   `risk_classification_versions`, immutable once published, exactly
   mirroring `policy_versions`. Every `policy_evaluations` row now records
   the exact risk-classification version consulted (§1, §4).
2. **Contract extensions confirmed additive** — `AgentExecutionResult` and
   `WorkflowStepDefinitionSchema` gain structured, typed, defaulted fields;
   backward-compatibility tests are part of this phase's required test
   matrix, not optional (§9, §12, §15).
3. **No client mutation of approval state at all** — `approval_requests`
   and `approval_decisions` have **no** tenant insert/update/delete policy
   whatsoever, including for cancellation. Every mutation (creation,
   decision, resumption, cancellation) goes through a governance
   application command over a trusted connection (§2, §7).
4. **Run-level completion resolved in this phase** —
   `workflow-engine.reconcileWorkflowRunOutcome` derives run status from
   persisted step outcomes using the existing run transition table,
   closing the gap Phase 3 left open (§10a).

Also incorporated: the corrected effect precedence
`BLOCK > DENY > ESCALATE > REQUIRE_APPROVAL > ALLOW` (§4), replacing this
document's original (incorrect) ranking.

Implementation proceeds from this revision; return for review only if a
new material blocker appears.

## 0. Ownership recap (per the brief)

- **`governance`** (new package) owns: policy definitions/versions, risk
  classification definitions/versions, evaluation, policy effects,
  approval requirements, approval requests/decisions/assignments,
  separation of duties, escalation, governance events, decision
  explanations, policy simulation.
- **`workflow-engine`** owns: entering `WAITING_FOR_APPROVAL`, referencing
  the approval request, resuming/rejecting/expiring/cancelling the waiting
  step, exactly-once continuation, propagating resulting run/step state,
  **and deriving run-level outcome from step outcomes**
  (`reconcileWorkflowRunOutcome`, §10a) — `workflow-engine` never decides
  _whether_ approval is required, and `governance` never derives workflow
  run/step state itself; it only calls `workflow-engine`'s functions with
  already-resolved data.
- **`agent-runtime`** owns: declaring intended actions, structured risk
  indicators, requested capabilities, approval-required execution
  outcomes. Agents never decide approvals themselves.
- **`platform-kernel`** stays limited to content-hashing/versioning
  primitives — `computeContentHash` is reused for policy hashes, risk-
  classification hashes, and approval-request payload hashes; no
  policy/approval/workflow logic lives there.
- **`packages/shared`**'s `PgTenantAccessEvaluator` is reused unchanged for
  permission-key checks (`tenant.decide_approvals` etc.) — `governance`
  adds a materially different, richer capability (versioned structured
  policy evaluation) on top, not a duplicate authorization mechanism. See
  `ADR-0008`'s addendum.

## 1. Data model

### Platform-owned (no `tenant_id`)

```sql
create table policy_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                 -- "financial-action-approval", "destructive-database-guard"
  display_name text not null,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_definition_id uuid not null references policy_definitions (id) on delete cascade,
  version text not null,                      -- semver
  policy_document jsonb not null,             -- validated PolicyDocument (§3)
  policy_hash text not null,                  -- sha256 of the canonicalized document; enforces immutability
  status text not null default 'draft'
    check (status in ('draft', 'validated', 'published', 'deprecated', 'retired')),
  priority integer not null default 100,      -- lower = evaluated first within its tier; deterministic tie-break
  mandatory boolean not null default false,   -- platform-mandatory floor; tenants can never disable or override it
  override_policy text not null default 'overridable'
    check (override_policy in ('immutable', 'overridable')),
  effective_from timestamptz,
  effective_until timestamptz,
  published_at timestamptz,
  deprecated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (policy_definition_id, version)
);

-- Identifies the governed action a risk classification applies to. "*" is
-- reserved for the platform-wide default floor (any action with no more
-- specific definition).
create table risk_classification_definitions (
  id uuid primary key default gen_random_uuid(),
  action text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Immutable once published, exactly mirroring policy_versions/
-- agent_versions/workflow_versions — risk classification materially
-- affects policy decisions, approval requirements, audit explanations,
-- and historical reproducibility (a run evaluated last month must remain
-- explainable against the risk level that actually applied then), so it
-- gets the same versioning discipline as everything else that decisions
-- depend on.
create table risk_classification_versions (
  id uuid primary key default gen_random_uuid(),
  risk_classification_definition_id uuid not null references risk_classification_definitions (id) on delete cascade,
  version text not null,
  risk_level text not null check (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  rationale text not null,
  classification_hash text not null,
  status text not null default 'draft'
    check (status in ('draft', 'validated', 'published', 'deprecated', 'retired')),
  effective_from timestamptz,
  effective_until timestamptz,
  published_at timestamptz,
  deprecated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (risk_classification_definition_id, version)
);
```

Indexes: `policy_versions(policy_definition_id)`, `policy_versions(status)`,
`risk_classification_versions(risk_classification_definition_id)`,
`risk_classification_versions(status)`.

Lifecycle: two new enums + transition tables —
`PolicyVersionStatus` and `RiskClassificationVersionStatus` — structurally
identical to `agent-runtime`'s `AgentVersionStatus`/`workflow-engine`'s
`WorkflowVersionStatus` but declared independently in `governance` — same
reasoning as every prior phase: each package owns its own versioning
vocabulary even where the shape matches exactly.

`classification_hash` is computed the same way as every other content hash
in this codebase (`platform-kernel`'s `computeContentHash` over
`{ action, riskLevel, rationale }`), giving `seedPlatformRiskClassificationCatalog`
the identical "throws rather than silently overwrites a changed, already-
published version" guarantee `seedPlatformPolicyCatalog`/
`seedPlatformWorkflowCatalog`/`seedPlatformAgentCatalog` already have.

**"Tenant policy may raise risk... but must never lower a platform
mandatory classification"** is enforced structurally in the merge
algorithm (§4), not by a separate check: the resolved, published
`risk_classification_versions` row for an action is the evaluation's risk
_floor_; any policy's own asserted `riskLevel` can only raise the merged
result above that floor (`max()`), never below it — there is no code path
that takes the minimum or lets a policy's assertion replace the floor
outright.

### Tenant-owned (`tenant_id NOT NULL` everywhere, no exceptions)

```sql
create table tenant_policy_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  policy_definition_id uuid not null references policy_definitions (id) on delete restrict,
  policy_version_id uuid not null references policy_versions (id) on delete restrict,
  enabled boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, policy_definition_id),
  unique (id, tenant_id)
);

create table tenant_policy_overrides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  policy_definition_id uuid not null references policy_definitions (id) on delete restrict,
  override_document jsonb not null,           -- validated PolicyOverrideDocument (§3); deltas only, never a full replacement
  override_hash text not null,
  enabled boolean not null default true,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, policy_definition_id)    -- one active override doc per tenant per policy definition
);

create table policy_evaluations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  workflow_run_id uuid,                       -- nullable: not every evaluation is workflow-triggered
  workflow_step_id uuid,
  actor_type text not null check (actor_type in ('user', 'agent', 'system', 'worker')),
  actor_id text,
  action text not null,                       -- governed action key (§5)
  evaluated_policy_version_ids jsonb not null default '[]'::jsonb,
  -- The exact risk-classification version consulted for this evaluation —
  -- always recorded, never nullable: the platform-seeded "*" definition
  -- guarantees one is always resolvable (§4).
  risk_classification_version_id uuid not null references risk_classification_versions (id) on delete restrict,
  effect text not null check (effect in ('BLOCK', 'DENY', 'ESCALATE', 'REQUIRE_APPROVAL', 'ALLOW')),
  risk_level text not null check (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  reasons jsonb not null default '[]'::jsonb,
  required_permissions jsonb not null default '[]'::jsonb,
  required_approver_roles jsonb not null default '[]'::jsonb,
  required_approval_count integer not null default 0,
  expires_at timestamptz,
  action_hash text not null,                  -- hash of (action, parameters, targetResource) — the "immutable request/action hash"
  trace_id text not null,
  correlation_id text not null,
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (workflow_run_id, tenant_id) references workflow_runs (id, tenant_id),
  foreign key (workflow_step_id, tenant_id) references workflow_steps (id, tenant_id),
  unique (id, tenant_id)
);

create table approval_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  policy_evaluation_id uuid not null,
  workflow_run_id uuid not null,
  workflow_step_id uuid not null,
  action_snapshot jsonb not null,             -- immutable: action, parameters, targetResource, requestingActor,
                                               -- requestingTenantAgentId, workflowRunId, workflowStepId,
                                               -- policyDecisionId, riskClassification, evidence, traceContext,
                                               -- proposedOutput (the agent's already-produced result, replayed on approval)
  payload_hash text not null,                 -- hash of (action, parameters, targetResource) only — detects drift
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ASSIGNED', 'PARTIALLY_APPROVED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED')),
  required_approval_count integer not null default 1,
  required_approver_roles jsonb not null default '[]'::jsonb,
  reject_on_first_rejection boolean not null default true,
  -- Exactly-once resumption gate: flips false -> true exactly once, via the
  -- same atomic-conditional-UPDATE pattern as workflow-engine's step
  -- leasing (§10).
  continuation_committed boolean not null default false,
  expires_at timestamptz,
  superseded_by_request_id uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (policy_evaluation_id, tenant_id) references policy_evaluations (id, tenant_id) on delete restrict,
  foreign key (workflow_step_id, tenant_id) references workflow_steps (id, tenant_id) on delete cascade,
  foreign key (superseded_by_request_id, tenant_id) references approval_requests (id, tenant_id),
  unique (id, tenant_id)
);
-- Exactly one *active* (non-terminal) approval request per step at any time.
create unique index approval_requests_active_per_step_idx on approval_requests (workflow_step_id)
  where status not in ('APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED');

create table approval_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  approval_request_id uuid not null,
  decision text not null check (decision in ('APPROVED', 'REJECTED')),
  decided_by_user_id uuid not null references auth.users (id) on delete restrict,
  comment text,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (approval_request_id, tenant_id) references approval_requests (id, tenant_id) on delete cascade,
  -- Distinct-approver enforcement at the database level: one decision per (request, approver).
  unique (approval_request_id, decided_by_user_id)
);

create table approval_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  approval_request_id uuid not null,
  assignee_user_id uuid references auth.users (id) on delete cascade,
  assignee_role_key text,
  status text not null default 'ASSIGNED' check (status in ('ASSIGNED', 'DECIDED', 'EXPIRED', 'REVOKED')),
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (approval_request_id, tenant_id) references approval_requests (id, tenant_id) on delete cascade,
  check (assignee_user_id is not null or assignee_role_key is not null)
);
create unique index approval_assignments_unique_user_idx on approval_assignments (approval_request_id, assignee_user_id)
  where assignee_user_id is not null;
create unique index approval_assignments_unique_role_idx on approval_assignments (approval_request_id, assignee_role_key)
  where assignee_role_key is not null;

create table governance_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  workflow_run_id uuid,
  workflow_step_id uuid,
  approval_request_id uuid,
  policy_evaluation_id uuid,
  event_type text not null,
  actor_type text not null check (actor_type in ('user', 'agent', 'system', 'worker')),
  actor_id text,
  trace_id text not null,
  correlation_id text not null,
  causation_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

**Why `governance_events` has no sequence-locked counter (unlike
`workflow_execution_events`):** `workflow_execution_events`' strict
per-run gapless sequencing exists specifically so worker recovery can
detect _missed_ events for one causally-linked run. `governance_events` is
a parallel audit/compliance trail whose consumers care about completeness
and causation links (`causation_id`), not a strict per-aggregate ordinal —
nothing in recovery (§11) depends on reading a gap in this table's
numbering. `created_at` + `id` ordering is sufficient. Flagged here as a
deliberate simplification versus the `workflow_execution_events` pattern,
not an oversight.

**No schema change to `workflow_steps`.** `approval_requests` references
`workflow_steps` via the same composite-FK pattern
`workflow_dead_letters` already uses (Phase 3) — the link is one-way,
`governance → workflow-engine`, exactly mirroring an existing precedent.
`workflow-engine`'s own code never queries `governance`'s tables directly
for decision-making (see §10); it only receives already-resolved outputs
as plain function parameters.

### Indexes

```sql
create index tenant_policy_assignments_tenant_id_idx on tenant_policy_assignments (tenant_id);
create index tenant_policy_overrides_tenant_id_idx on tenant_policy_overrides (tenant_id);
create index policy_evaluations_tenant_id_idx on policy_evaluations (tenant_id);
create index policy_evaluations_workflow_step_id_idx on policy_evaluations (workflow_step_id);
create index approval_requests_tenant_id_idx on approval_requests (tenant_id);
create index approval_requests_workflow_step_id_idx on approval_requests (workflow_step_id);
create index approval_requests_status_idx on approval_requests (status);
create index approval_requests_expiry_idx on approval_requests (expires_at)
  where status in ('PENDING', 'ASSIGNED', 'PARTIALLY_APPROVED');
create index approval_requests_pending_continuation_idx on approval_requests (id)
  where status = 'APPROVED' and continuation_committed = false;
create index approval_decisions_request_id_idx on approval_decisions (approval_request_id);
create index approval_assignments_request_id_idx on approval_assignments (approval_request_id);
create index governance_events_tenant_id_idx on governance_events (tenant_id);
create index governance_events_approval_request_id_idx on governance_events (approval_request_id);
create index governance_events_workflow_run_id_idx on governance_events (workflow_run_id);
```

## 2. RLS policy outline

New permission keys (exactly the four named): `tenant.view_approvals`,
`tenant.decide_approvals`, `tenant.manage_policies`,
`tenant.view_governance_events`. No fifth key invented — `tenant.manage_policies`
covers both `tenant_policy_assignments` and `tenant_policy_overrides`
writes.

**Platform tables** (`policy_definitions`, `policy_versions`,
`risk_classification_definitions`, `risk_classification_versions`) —
read-only, deny-by-default writes, identical pattern to
`agent_definitions`/`workflow_definitions`:

```sql
create policy policy_definitions_select_authenticated on policy_definitions
  for select using (auth.uid() is not null);
create policy policy_versions_select_published on policy_versions
  for select using (auth.uid() is not null and status = 'published');
create policy risk_classification_definitions_select_authenticated on risk_classification_definitions
  for select using (auth.uid() is not null);
create policy risk_classification_versions_select_published on risk_classification_versions
  for select using (auth.uid() is not null and status = 'published');
```

**`tenant_policy_assignments`, `tenant_policy_overrides`** — standard
select-member/write-admin pair, gated on `tenant.manage_policies`:

```sql
create policy <table>_select_member on <table>
  for select using (is_tenant_member(tenant_id));
create policy <table>_write_admin on <table>
  for all using (tenant_has_permission(tenant_id, 'tenant.manage_policies'))
  with check (tenant_has_permission(tenant_id, 'tenant.manage_policies'));
```

**`policy_evaluations`** — read-only, gated on the broader governance-view
permission (evaluation reasons can reveal policy internals, so membership
alone isn't sufficient); no write policy — evaluations are always inserted
by the deterministic evaluator over a service-role/owner connection.

```sql
create policy policy_evaluations_select on policy_evaluations
  for select using (tenant_has_permission(tenant_id, 'tenant.view_governance_events'));
```

**`approval_requests`** — **read-only for every tenant role, full stop.**
Reviewed and corrected from the original proposal (which allowed a
decider-permission-gated `UPDATE`): no tenant client may mutate
`approval_requests` state under any circumstance, including cancellation.
Every mutation — creation, quorum recomputation, status transition,
cancellation — happens exclusively through a `governance` application
command running over the trusted service-role/owner connection (§7),
never through an RLS-permitted client write.

```sql
create policy approval_requests_select on approval_requests
  for select using (
    tenant_has_permission(tenant_id, 'tenant.view_approvals')
    or tenant_has_permission(tenant_id, 'tenant.decide_approvals')
  );
-- No insert policy. No update policy. No delete policy. Deny-by-default
-- covers all three — the `authenticated` role can select and nothing else,
-- regardless of any permission it holds.
```

An authorized user "requesting cancellation" is a call to
`governance.cancelApprovalRequest(db, access, input)` (§7) — a governed
command with its own `tenant.decide_approvals` permission check, not a
row-level grant. This mirrors exactly how `provisionTenantAgents`/
`provisionTenantWorkflow` have never been raw RLS-permitted inserts either
— the permission check lives in application code, RLS is the deny-by-
default backstop.

**`approval_decisions`** — **read-only for every tenant role, full stop.**
Also corrected: the original proposal's `for insert with check
(tenant_has_permission(...))` policy is removed. Decision submission is
exclusively `governance.recordApprovalDecision(...)` (§7) over the trusted
connection — the permission check (`tenant.decide_approvals`), the
assignment check, and the separation-of-duties check all happen in that
one function, in that order, before anything is written; none of that
logic is expressible as a single RLS `WITH CHECK` clause, and duplicating
even part of it into RLS would be a second, weaker authorization path
alongside the real one.

```sql
create policy approval_decisions_select on approval_decisions
  for select using (
    tenant_has_permission(tenant_id, 'tenant.view_approvals')
    or tenant_has_permission(tenant_id, 'tenant.decide_approvals')
  );
-- No insert policy. No update policy. No delete policy.
```

Decisions are immutable after insertion by construction — there is no
application function that ever updates an `approval_decisions` row, and
now no RLS path could permit it even if one existed.

**No second authorization model is introduced anywhere in this design.**
Every check — in RLS and in every governance application command — is
`is_tenant_member`/`tenant_has_permission` against the existing
`tenant_memberships`/`role_permissions`/`permissions` tables, via the
reused `PgTenantAccessEvaluator`, exactly as every prior phase.

**`approval_assignments`** — select/write-admin pair gated on
`tenant.manage_policies` (assigning approvers is a policy-configuration
action):

```sql
create policy approval_assignments_select on approval_assignments
  for select using (tenant_has_permission(tenant_id, 'tenant.view_approvals'));
create policy approval_assignments_write_admin on approval_assignments
  for all using (tenant_has_permission(tenant_id, 'tenant.manage_policies'))
  with check (tenant_has_permission(tenant_id, 'tenant.manage_policies'));
```

**`governance_events`** — read-only, gated on `tenant.view_governance_events`;
no write policy at all, mirroring `workflow_execution_events`/`audit_events`'
integrity design:

```sql
create policy governance_events_select on governance_events
  for select using (tenant_has_permission(tenant_id, 'tenant.view_governance_events'));
```

No second authorization mechanism anywhere in either migration —
`is_tenant_member`/`tenant_has_permission` throughout, `PgTenantAccessEvaluator`
reused unchanged for application-layer checks.

## 3. Governed action catalog and policy document schema

### 3a. Governed action catalog

A closed Zod enum for Phase 4's 19 named actions, namespaced
`domain.resource.verb`:

```ts
export const GOVERNED_ACTIONS = [
  "code.deploy.production",
  "database.execute.destructive",
  "security.policy.modify",
  "permission.modify",
  "secret.access",
  "secret.rotate",
  "communication.send.external",
  "content.publish.external",
  "contract.commit",
  "pricing.modify",
  "billing.modify",
  "refund.issue",
  "payment.initiate",
  "payout.initiate",
  "data.export",
  "data.delete",
  "workflow.override",
  "agent.activate",
  "agent.permission.modify",
] as const;
export const GovernedActionSchema = z.enum(GOVERNED_ACTIONS);
export type GovernedAction = z.infer<typeof GovernedActionSchema>;
```

No arbitrary action string is ever accepted at a runtime evaluation
boundary — every call site parses through `GovernedActionSchema` (or the
literal `"*"`, reserved for platform-mandatory catch-all policies/risk
defaults) and rejects anything else.

**Future vertical-namespace extension (documented, not built in Phase 4):**
Phase 11's `vertical-os-sdk` will need namespaced actions per vertical
(e.g. `restaurant-os.order.refund`) that this closed enum cannot express.
The extension contract: replace `GovernedActionSchema` with a
registry-backed validator (`isRegisteredGovernedAction(action: string):
boolean`, backed by a small platform-owned `governed_action_definitions`
table analogous to `agent_definitions`) once a real vertical needs it —
every other part of this design (policy documents, risk classifications,
approval requests) already stores the action as a plain `text`/string
field, so this swap requires no schema migration, only a validator change
at the code boundary. Not implemented now — flagged so a future phase
doesn't have to rediscover this seam.

### 3b. Policy document schema (Zod, stored in `policy_versions.policy_document`)

```ts
export const ConditionClauseSchema = z.object({
  field: z.string().min(1), // dot-path into evaluation context, e.g. "parameters.amountUsd", "riskLevel"
  operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in"]),
  value: z.unknown(),
});
export type ConditionNode =
  | z.infer<typeof ConditionClauseSchema>
  | { all: ConditionNode[] }
  | { any: ConditionNode[] };
export const ConditionNodeSchema: z.ZodType<ConditionNode> = z.lazy(() =>
  z.union([
    ConditionClauseSchema,
    z.object({ all: z.array(ConditionNodeSchema) }),
    z.object({ any: z.array(ConditionNodeSchema) }),
  ]),
);

export const PolicyDocumentSchema = z.object({
  appliesToActions: z
    .array(z.union([GovernedActionSchema, z.literal("*")]))
    .min(1),
  conditions: ConditionNodeSchema,
  effect: z.enum(["BLOCK", "DENY", "ESCALATE", "REQUIRE_APPROVAL", "ALLOW"]),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).nullable(),
  requiredPermissions: z.array(z.string().min(1)),
  requiredApproverRoles: z.array(z.string().min(1)),
  requiredApprovalCount: z.number().int().positive(),
  rejectOnFirstRejection: z.boolean().default(true),
  approvalExpirationMs: z.number().int().positive().nullable(),
});
export type PolicyDocument = z.infer<typeof PolicyDocumentSchema>;
```

`evaluateCondition(node, context): boolean` is a small, pure, recursive
function over this data-only structure — no `eval`, no code strings, no
model call. Fully deterministic and independently testable per operator
and per combinator.

### 3c. Policy override document schema (`tenant_policy_overrides.override_document`)

```ts
export const PolicyOverrideDocumentSchema = z.object({
  additionalRequiredApprovalCount: z.number().int().nonnegative().default(0), // added to the base, never subtracted
  additionalRequiredApproverRoles: z.array(z.string().min(1)).default([]), // unioned with the base, never removed
  additionalRequiredPermissions: z.array(z.string().min(1)).default([]),
  tightenedConditions: ConditionNodeSchema.nullable().default(null), // ANDed with the base conditions (narrows when it fires, never widens)
});
```

Overrides are expressed as **deltas that can only tighten** — there is no
field capable of loosening `effect`, lowering `requiredApprovalCount`, or
removing a required role/permission. This is enforced by the schema shape
itself (no "replace effect" or "remove requirement" field exists), not
merely by a runtime check — see §4 for the merge algorithm.

## 4. Policy precedence and evaluation algorithm

### 4a. Effect precedence (corrected)

```
BLOCK > DENY > ESCALATE > REQUIRE_APPROVAL > ALLOW
```

| Effect             | Semantics                                                                                                                                                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BLOCK`            | Absolute prohibition. Ordinary approval **cannot** override it — there is no code path from `BLOCK` to any resumed/approved outcome.                                                                                                                                 |
| `DENY`             | Contextual policy or authorization denial — the action is refused for this specific context, but the prohibition isn't absolute the way `BLOCK` is (a different context, or a corrected authorization, could evaluate differently).                                  |
| `ESCALATE`         | Elevated governance review required — routed the same way as `REQUIRE_APPROVAL` mechanically (an approval request, §6–8), but its `required_approver_roles` are expected to name a higher-privilege role tier (a policy-document concern, not a separate code path). |
| `REQUIRE_APPROVAL` | Ordinary authorized approval may permit continuation.                                                                                                                                                                                                                |
| `ALLOW`            | Execution may continue; the safe default only when zero policies match.                                                                                                                                                                                              |

`EFFECT_PRECEDENCE = ["BLOCK", "DENY", "ESCALATE", "REQUIRE_APPROVAL", "ALLOW"]`
(index 0 = most restrictive) is the single source of truth both for the
merge algorithm below and for validating a tenant override never moves an
effect to a higher index (§4c).

### 4b. Six-tier precedence, per the brief

1. **Platform mandatory** — published `policy_versions` with
   `mandatory = true` matching the action.
2. **Platform default** — published, non-mandatory `policy_versions`
   matching the action, active unless a tenant has an explicit
   `tenant_policy_assignments` row disabling it (`enabled = false`).
   Default-on unless opted out.
3. **Tenant policies** — the _same_ lookup as tier 2 from an
   implementation standpoint: a tenant's `tenant_policy_assignments` row
   (whether it's "the platform default, left enabled" or "explicitly
   assigned/configured by the tenant") is the tenant's active policy set.
   Tiers 2 and 3 are one code path — the distinction is about _source/intent_
   (platform-authored default vs. tenant-curated), not separate mechanisms.
4. **Tenant permitted overrides** — `tenant_policy_overrides`, applied only
   to policy versions whose `override_policy = 'overridable'` (an override
   targeting an `'immutable'` policy version is rejected at write time by
   `createTenantPolicyOverride`, before it ever reaches evaluation).
5. **Workflow-specific constraints** — the workflow manifest step's own
   `approvalRequired: true` flag (already in Phase 3's
   `WorkflowStepDefinitionSchema`) acts as a floor: it can raise the merged
   effect to at least `REQUIRE_APPROVAL` and `requiredApprovalCount` to at
   least 1, even if no matching policy version would otherwise require it.
   This is the field Phase 3 declared specifically for this purpose,
   unused until now.
6. **Requested action evaluation** — not an independent rule source; this
   is the runtime context (action, parameters, target resource, actor,
   risk indicators) that tiers 1–5's conditions are evaluated against.

### 4c. Merge algorithm (deterministic, pure function of matched rows + context)

```
riskClassificationVersion = the published risk_classification_versions row
          for this action, falling back to the published row for "*" if
          no action-specific one exists (always resolvable — the platform
          seed guarantees a "*" row exists); this is recorded verbatim on
          the policy_evaluations row (risk_classification_version_id) and
          becomes the risk-level FLOOR below

matches = every policy version from tiers 1-3 whose appliesToActions
          includes the action (or "*") and whose conditions evaluate true
          against context, ordered by (tier, priority, policy_definition_id)
          for deterministic reason ordering (not for precedence itself —
          precedence is "most restrictive wins", order only affects the
          human-readable reasons list's ordering)

effect = the most restrictive effect among all matches, using
         EFFECT_PRECEDENCE (§4a) — index 0 (BLOCK) wins over any higher
         index; no match at all -> ALLOW, the safe default only when zero
         policies apply

for each match with override_policy = 'overridable', apply any tenant
override targeting it (tier 4): effect can only move to a LOWER
EFFECT_PRECEDENCE index (tighten, e.g. REQUIRE_APPROVAL -> ESCALATE is a
legal tightening; ESCALATE -> REQUIRE_APPROVAL is not), requiredApprovalCount
can only increase, requiredApproverRoles/requiredPermissions are unioned
(never reduced), tightenedConditions (if present) is ANDed onto that
match's own conditions for future evaluations of this same match (does not
affect whether OTHER matches fired)

apply the workflow step's approvalRequired floor (tier 5): if true and the
merged effect's EFFECT_PRECEDENCE index is currently ALLOW's, raise it to
REQUIRE_APPROVAL with requiredApprovalCount = max(merged, 1)

riskLevel = max(riskClassificationVersion.riskLevel, the highest RiskLevel
            asserted by any match's own riskLevel field) using
            CRITICAL > HIGH > MEDIUM > LOW — the classification version is
            always the FLOOR; a policy assertion can only raise it, never
            lower it (Decision 1's explicit requirement), enforced by this
            max() rather than letting a policy's assertion replace the floor

requiredApprovalCount = max() across every match requiring approval
requiredApproverRoles = union across every match requiring approval
requiredPermissions = union across every match
expiresAt = min() of every match's approvalExpirationMs converted to an
            absolute timestamp from evaluatedAt (shortest window wins —
            never let an approval linger longer than the strictest policy)
reasons = one entry per match: { policyVersionId, code, message }
```

**Mandatory-policy floor is structural, not a special-cased check:**
because the merge always picks the _most restrictive_ effect across every
matching policy (mandatory or not) and tier-4 overrides can only tighten,
a mandatory `BLOCK`/`DENY` match can never be softened by anything at a
lower tier — there is no code path that averages or lets a later tier
override an earlier one's restrictiveness downward. The same structural
argument applies to risk level via the classification-version floor above.

**Deterministic conflict resolution at every precedence level is a
required, explicit test** (not just an implicit property): §15's test
matrix includes a dedicated case exercising every pairwise combination of
matching effects (e.g. a `BLOCK` match alongside an `ALLOW` match resolves
to `BLOCK`; `DENY` alongside `REQUIRE_APPROVAL` resolves to `DENY`; etc.)
to prove the ranking, not just the two or three cases a reference workflow
happens to exercise.

**Determinism:** the entire algorithm — matching, merging, risk
resolution — is a pure function of (published policy version rows +
assignment/override rows + workflow step config + input context). No
timestamp-dependent randomness, no model call. Identical inputs produce an
identical `PolicyDecision` (its `id` and `evaluatedAt` are metadata added
once per call, not part of the deterministic content itself).

## 5. Policy decision contract

```ts
export const PolicyDecisionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  evaluatedPolicyVersionIds: z.array(z.string().uuid()),
  riskClassificationVersionId: z.string().uuid(),
  effect: z.enum(["BLOCK", "DENY", "ESCALATE", "REQUIRE_APPROVAL", "ALLOW"]),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  reasons: z.array(
    z.object({
      policyVersionId: z.string().uuid().nullable(),
      code: z.string(),
      message: z.string(),
    }),
  ),
  requiredPermissions: z.array(z.string()),
  requiredApproverRoles: z.array(z.string()),
  requiredApprovalCount: z.number().int().nonnegative(),
  expiresAt: z.string().datetime().nullable(),
  actionHash: z.string(),
  evaluatedAt: z.string().datetime(),
  traceId: z.string(),
  workflowRunId: z.string().uuid().nullable(),
  workflowStepId: z.string().uuid().nullable(),
});
```

`evaluatePolicy(db, context): Promise<PolicyDecision>` runs the algorithm
in §4, persists one `policy_evaluations` row per call (every evaluation is
a meaningful audit event — this is not a cache; re-evaluating identical
inputs is expected to produce an identical `effect`/`riskLevel` per the
determinism guarantee, but each call is still recorded), and returns the
decision to the caller.

## 6. Approval request lifecycle (state machine)

Eight states, five terminal:

```
PENDING -> ASSIGNED -> PARTIALLY_APPROVED -> APPROVED
                     -> APPROVED (direct, when requiredApprovalCount == 1)
                     -> REJECTED (short-circuit)
(CANCELLED, EXPIRED, SUPERSEDED reachable from PENDING/ASSIGNED/PARTIALLY_APPROVED)
```

Full transition table:

| From                                                             | To                                                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `PENDING`                                                        | `ASSIGNED`, `EXPIRED`, `CANCELLED`, `SUPERSEDED`                                   |
| `ASSIGNED`                                                       | `PARTIALLY_APPROVED`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`, `SUPERSEDED` |
| `PARTIALLY_APPROVED`                                             | `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`, `SUPERSEDED`                       |
| `APPROVED` / `REJECTED` / `EXPIRED` / `CANCELLED` / `SUPERSEDED` | _(terminal — none)_                                                                |

`PENDING` cannot jump directly to `APPROVED`/`REJECTED`: a decision
requires an `approval_assignments` row to exist first (checked
procedurally by `recordApprovalDecision`, §7), so the request must already
be at least `ASSIGNED` by the time any decision lands — the transition
table itself also refuses to let `PENDING` skip straight to a decided
state, catching a bug in the calling code rather than only the calling
code's own logic.

Recording another `APPROVED` decision while still below quorum does not
re-invoke the transition-table assertion if the recomputed status equals
the current one (e.g. `PARTIALLY_APPROVED → PARTIALLY_APPROVED` is a no-op
data update, not a lifecycle transition) — mirrors how `workflow_steps`
only asserts a transition when the target status actually differs.

## 7. Approval decision, quorum, and separation-of-duties algorithm

**Corrected per review**: this is the exact 9-step sequence required, with
action-snapshot/payload-hash verification made an explicit numbered step
(previously implicit, only performed at resumption time). All nine steps
run inside `governance.recordApprovalDecision`, over the trusted
service-role/owner connection — there is no RLS path that performs any
part of this; every check is application code.

```
recordApprovalDecision(db, access, approvalRequestId, deciderActor, decision, comment):
  1. TENANT PERMISSION CHECK — checkPermission(tenant.decide_approvals) via
     the reused PgTenantAccessEvaluator; throws TenantAuthorizationError
  2. APPROVAL ASSIGNMENT CHECK — fetch the approval_requests row (throw
     AlreadyResolvedError if status is terminal); fetch approval_assignments
     for this request; assert deciderActor matches one by assignee_user_id,
     OR deciderActor holds one of the assignment's assignee_role_key
     permissions — else throw NotAssignedApproverError
  3. SEPARATION-OF-DUTIES CHECK — read action_snapshot.requestingActor /
     requestingTenantAgentId; assert deciderActor is none of: the
     requesting user, the requesting tenant agent, the same delegated
     service identity — else throw SelfApprovalProhibitedError
  4. ACTION SNAPSHOT AND PAYLOAD-HASH VERIFICATION — recompute
     computeContentHash({ action, parameters, targetResource }) from the
     row's own action_snapshot and assert it equals the stored
     payload_hash — throw PayloadIntegrityError if not (this can only fail
     if the immutable snapshot was somehow corrupted; a real, explicit
     check rather than an assumption, and the same check §10's resumption
     path reuses)
  5. IMMUTABLE DECISION INSERTION — insert into approval_decisions
     (unique(approval_request_id, decided_by_user_id) enforces distinct-
     approver at the DB level too — a duplicate submission from the same
     decider is caught here and treated as "already recorded," not
     re-thrown as a new error)
  6. QUORUM RECOMPUTATION —
     - decision == REJECTED and reject_on_first_rejection -> REJECTED
     - decision == APPROVED and count(distinct APPROVED deciders) >=
       required_approval_count -> APPROVED
     - decision == APPROVED, quorum not yet reached -> PARTIALLY_APPROVED
  7. APPROVAL-REQUEST STATUS TRANSITION — if the recomputed status differs
     from the current one: assertValidApprovalTransition, then update the
     row (+ resolved_at if terminal); recomputing to the same status is a
     data update, not a lifecycle transition (§6)
  8. WORKFLOW CONTINUATION OR TERMINAL HANDLING — if new status ==
     APPROVED: call resumeApprovedRequest (§10, exactly-once); if new
     status == REJECTED: call workflow-engine.rejectWorkflowStepApproval
     then workflow-engine.reconcileWorkflowRunOutcome (§10a)
  9. GOVERNANCE AND WORKFLOW EVENT RECORDING — append a governance_events
     row for the decision and, if a terminal outcome was reached, for that
     outcome; step 8's own calls append their own workflow_execution_events
     rows through workflow-engine's existing ledger
```

**`cancelApprovalRequest(db, access, approvalRequestId, actorUserId)`** —
the governed command backing "authorized users may request cancellation":

```
cancelApprovalRequest(db, access, approvalRequestId, actorUserId):
  1. checkPermission(tenant.decide_approvals) — no new permission key invented
  2. fetch the approval_requests row; if status is terminal, this is a
     successful no-op (idempotent), not an error
  3. assertValidApprovalTransition(current, 'CANCELLED'); update the row
     (+ resolved_at)
  4. call workflow-engine.cancelWorkflowStepApproval then
     workflow-engine.reconcileWorkflowRunOutcome
  5. append governance_events + (via step 4) workflow_execution_events
```

Like `recordApprovalDecision`, this runs entirely over the trusted
connection — there is still no tenant `UPDATE` policy on `approval_requests`
of any kind; "requesting cancellation" means calling this function, not
writing to the row directly.

Quorum default for Phase 4: `requiredApprovalCount = 1`,
`rejectOnFirstRejection = true` for every policy actually exercised
(including the reference workflow) — the schema and this algorithm
already support `requiredApprovalCount > 1` with distinct-approver
enforcement, so a future higher-stakes policy needs no schema change to
turn on dual-control, only a different `policy_document`.

## 8. Approval integrity (action snapshot and supersession)

`createApprovalRequest` computes `payloadHash =
computeContentHash({ action, parameters, targetResource })` (via
`platform-kernel`, not the whole `action_snapshot` — timestamps and trace
IDs vary legitimately without the underlying request changing) and:

1. Checks for an existing _active_ (non-terminal) `approval_requests` row
   for the same `workflow_step_id` (the partial unique index in §1
   guarantees at most one exists).
2. If none exists: insert a new `PENDING` row.
3. If one exists with the **same** `payload_hash`: return it unchanged
   (idempotent creation — re-triggering governance for the same
   already-gated step is a no-op, not a duplicate).
4. If one exists with a **different** `payload_hash` (the proposed action
   changed since the earlier request was created): mark the existing row
   `SUPERSEDED` (with `superseded_by_request_id` pointing at the new row),
   then insert the new `PENDING` row. The old request can never authorize
   the new action, by construction — its `payload_hash` no longer matches
   anything anyone would try to verify against.

`recordApprovalDecision`'s resumption path (§10) re-verifies
`payload_hash` against a freshly recomputed hash of the snapshot's own
`action`/`parameters`/`targetResource` before resuming — a corrupted or
tampered snapshot fails closed.

## 9. Governed action declaration (agent-runtime contract change)

**Proposed change to `AgentExecutionResult`** (flagged explicitly per
instruction — this touches an already-shipped, tested Phase 1 contract):

```ts
export const AgentExecutionResultSchema = z.object({
  // ...all existing fields, unchanged...
  intendedAction: z
    .object({
      action: z.union([GovernedActionSchema, z.literal("*")]),
      parameters: z.record(z.string(), z.unknown()),
      targetResource: z.string().nullable(),
    })
    .nullable()
    .default(null), // new: what this invocation proposes to do, if governed
  selfAssessedRiskLevel: z
    .enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
    .nullable()
    .default(null), // new: advisory only, never authoritative
  requestedCapabilities: z.array(z.string()).default([]), // new: capabilities the agent asks to use beyond what it already had
});
```

All three fields are additive with defaults — a backward-compatible
extension of a runtime (not a versioned/immutable) contract, safe to
change without a manifest version bump. `approvalRequired: boolean`
already exists on this schema since Phase 1 and was unused until now;
Phase 4 makes it meaningful by having `governance` actually consume it as
one input (informational only — the real gate is `evaluatePolicy`, never
the agent's own claim).

**Required per review**: a compatibility test (§15) parses a
Phase-1/2/3-shaped `AgentExecutionResult` payload — one that predates
these three fields entirely, as every already-executed mock result in
this codebase's existing test fixtures does — through
`parseAgentExecutionResult` and asserts it still succeeds, with
`intendedAction`/`selfAssessedRiskLevel` defaulted to `null` and
`requestedCapabilities` defaulted to `[]`. New fields are structured and
typed (a concrete object shape, an enum, a string array) — not an
unbounded `metadata: Record<string, unknown>` bag — per the explicit
requirement to keep them typed rather than free-form.

**Why `intendedAction` matters for "do not duplicate agent or tool
execution":** the agent runs _once_, producing both its final output and
(when applicable) the intended governed action in the same invocation.
`governance` evaluates policy against that already-produced proposal; on
approval, `workflow-engine` replays the **already-computed**
`action_snapshot.proposedOutput` as the step's success payload — the agent
is never re-invoked. This is what makes "exactly once" possible: nothing
about resuming re-runs anything nondeterministic.

## 10. Workflow integration and exactly-once resume

**When `evaluatePolicy` returns an effect requiring approval
(`REQUIRE_APPROVAL` or `ESCALATE`)** (called by whatever executes a step —
`apps/worker` in Phase 4, same as Phase 3):

1. `governance.createApprovalRequest(...)` — persists the policy decision
   (already done as part of `evaluatePolicy`) and the approval request,
   attached to the workflow run and step (§8).
2. `workflow-engine.enterWaitingForApproval(db, workflowStepId)` —
   transitions the step `RUNNING → WAITING_FOR_APPROVAL` (**already a
   legal transition in Phase 3's `stepStatus.ts` — no schema change
   needed**), releasing the lease (`lease_token = null`, etc., same as
   every other lease-releasing transition).
3. `workflow-engine.reconcileWorkflowRunOutcome(db, workflowRunId)` (§10a)
   — if no other step for this run is
   `READY`/`LEASED`/`RUNNING`/`RETRY_SCHEDULED`, transitions the _run_
   `RUNNING → WAITING_FOR_APPROVAL` too (already legal, Phase 1); if other
   parallel branches are still progressing, the run stays `RUNNING` while
   this one step waits.
4. The worker's normal step-scan (`select ... where status = 'READY'`)
   simply never selects this step again while it's `WAITING_FOR_APPROVAL`
   — no re-execution is possible without an explicit resume call.

**On approval (`recordApprovalDecision` reaches `APPROVED`, or recovery
finds an `APPROVED` row with `continuation_committed = false`, §11):**

```
resumeApprovedRequest(db, approvalRequestId):
  1. atomic conditional UPDATE: continuation_committed false -> true,
     WHERE id = $1 AND status = 'APPROVED' AND continuation_committed = false
     -- exactly-once gate #1: a concurrent/duplicate caller gets zero rows
     -- back and treats itself as already-handled (no-op), exactly like a
     -- stale lease-token commit in Phase 3.
  2. if the UPDATE affected zero rows, return (already resumed by someone else)
  3. re-verify the action snapshot's payload_hash (the same check
     recordApprovalDecision's step 4 performs) — a data-integrity failure
     here routes to a governance escalation event rather than resuming
     (should be unreachable given §8's supersession-on-create guarantee;
     defense in depth)
  4. workflow-engine.resumeWorkflowStepAfterApproval(db, workflowStepId,
     snapshot.proposedOutput)
       -- exactly-once gate #2, inside workflow-engine: an atomic
       -- conditional UPDATE gated on `status = 'WAITING_FOR_APPROVAL'`
       -- performs WAITING_FOR_APPROVAL -> RUNNING -> SUCCEEDED (both
       -- already-legal transitions) in one function, committing
       -- proposedOutput as the step's output — the agent is never
       -- re-invoked (§9). If the step is no longer WAITING_FOR_APPROVAL
       -- (already resumed through some other path), this is a no-op.
  5. append governance_events ('approval.approved', 'workflow.resumed')
  6. workflow-engine.reconcileWorkflowRunOutcome(db, workflowRunId) — moves
     the run back to RUNNING if it had been parked at WAITING_FOR_APPROVAL,
     and derives COMPLETED if this was the run's last outstanding step (§10a)
```

**On rejection, expiration, or cancellation:**

```
workflow-engine.rejectWorkflowStepApproval(db, workflowStepId, reason)   -- WAITING_FOR_APPROVAL -> FAILED (legal, Phase 3)
workflow-engine.expireWorkflowStepApproval(db, workflowStepId)           -- WAITING_FOR_APPROVAL -> EXPIRED (legal, Phase 3)
workflow-engine.cancelWorkflowStepApproval(db, workflowStepId)           -- WAITING_FOR_APPROVAL -> CANCELLED (legal, Phase 3)
```

`reason` for `rejectWorkflowStepApproval` always carries
`{ code: "approval_rejected", ... }` — this is how
`reconcileWorkflowRunOutcome` (§10a) distinguishes a governance rejection
from an ordinary execution failure without a separate step-level status:
a structured error code inspected by the run-outcome deriver, exactly the
"structured, not string-matched" error discipline `retryPolicy.ts`
established in Phase 3.

Each of the three functions above is a direct, single hard terminal
transition — **rejection/expiration are not routed through
`retryPolicy.ts`'s retry/dead-letter classifier**; a human rejection or an
unattended expiration is not a transient failure to retry, it is an
authoritative outcome. `governance` calls the matching function, appends
`governance_events`, then calls `reconcileWorkflowRunOutcome` the same way.

**Package-boundary discipline:** every `workflow-engine` function above
takes plain primitives (`workflowStepId`, `output: unknown`,
`reason: StepError`) — none of them import or query anything from
`governance`'s schema. `governance`'s orchestration functions are the
callers that read `approval_requests`/`action_snapshot` and pass already-
resolved data down. This is the same inversion already used for
`AgentResolver`/`GovernanceGate` in Phase 3 — `workflow-engine` never
determines _whether_ approval is required or _what_ the resumed output
should be; it only executes a state transition it's told to make.

### 10a. Run-level completion: `reconcileWorkflowRunOutcome`

**Resolves the Phase 3 gap** ("run auto-completes once every step reaches
a terminal success" was never built) — required now because the reference
approval workflow cannot complete correctly without it. Owned entirely by
`workflow-engine`; `governance` only calls it with a `workflowRunId`,
never derives run/step state itself.

**Implementation-discovered sub-gap, resolved the same way:** nothing in
Phase 3 ever moves a run's status _out of_ `DRAFT` in the first place —
`createWorkflowRun` inserts at `DRAFT` and no code path advances it, so
every one of the transitions below (`VALIDATING`, `WAITING_FOR_APPROVAL`,
etc.) would otherwise be structurally unreachable (`isValidWorkflowTransition`
has no `DRAFT -> VALIDATING` entry). `reconcileWorkflowRunOutcome` closes
this first, before evaluating the rest of the algorithm below: if a run has
materialized steps and its status is still `DRAFT`/`PLANNING`/`QUEUED`, it
walks the already-legal chain `DRAFT -> PLANNING -> QUEUED -> RUNNING` in
the same call (each hop its own conditional `UPDATE` gated on the current
status, appending a single `run.started` event only if any hop actually
applied), then proceeds using the now-current status. No new transition
was added to `status.ts` for this — the chain was already legal, just
never driven by anything.

```ts
export async function reconcileWorkflowRunOutcome(
  db: Queryable,
  workflowRunId: string,
): Promise<{ changed: boolean; outcome: WorkflowStatus | null }>;
```

A single, pure-of-side-effects-beyond-its-own-table function, re-derivable
from scratch every call — **idempotent, concurrency-safe, safe to invoke
from normal execution and from reconciliation, and structurally unable to
bypass a legal transition**:

```
reconcileWorkflowRunOutcome(db, workflowRunId):
  1. fetch the run (status, tenant_id); if isTerminalWorkflowStatus(status),
     return { changed: false, outcome: null } -- idempotent no-op guard
  2. fetch every workflow_steps row for this run (status, error); if none
     exist yet (not materialized), return { changed: false, outcome: null }

  3. rejectedStep = steps.find(s => s.status === 'FAILED'
                                  && s.error?.code === 'approval_rejected')
     if rejectedStep and run.status === 'WAITING_FOR_APPROVAL':
       -- direct, already-legal transition (WAITING_FOR_APPROVAL -> REJECTED)
       atomically UPDATE ... SET status='REJECTED', completed_at=now()
         WHERE id=$1 AND status=$currentStatus  -- concurrency gate
       append workflow_execution_event('run.rejected'); return {changed:true, outcome:'REJECTED'}

  4. expiredStep = steps.find(s => s.status === 'EXPIRED')
     if expiredStep and run.status === 'WAITING_FOR_APPROVAL':
       -- Baseline behavior (this phase): terminate. WAITING_FOR_APPROVAL's
       -- transition table also legally allows -> BLOCKED (added in this
       -- phase, §12a) for a future manifest-level "block instead of
       -- terminate on expiry" policy field — not selectable by anything
       -- built in Phase 4, so EXPIRED is the only outcome actually
       -- produced today; documented, not silently narrowed.
       atomically UPDATE ... SET status='EXPIRED', completed_at=now()
         WHERE id=$1 AND status=$currentStatus
       append workflow_execution_event('run.expired'); return {changed:true, outcome:'EXPIRED'}

  5. cancelledStep = steps.find(s => s.status === 'CANCELLED')
     if cancelledStep and run.status === 'WAITING_FOR_APPROVAL':
       atomically UPDATE ... SET status='CANCELLED', completed_at=now()
         WHERE id=$1 AND status=$currentStatus
       -- cancel any remaining non-terminal steps too, reusing the same
       -- query cancelWorkflowRun (Phase 3) already uses
       append workflow_execution_event('run.cancelled'); return {changed:true, outcome:'CANCELLED'}

  6. anyHardFailure = steps.some(s => s.status === 'FAILED' || s.status === 'DEAD_LETTERED')
     if anyHardFailure and isValidWorkflowTransition(run.status, 'FAILED'):
       atomically UPDATE ... SET status='FAILED', completed_at=now()
         WHERE id=$1 AND status=$currentStatus
       append workflow_execution_event('run.failed'); return {changed:true, outcome:'FAILED'}

  7. allTerminalSuccess = steps.every(s => s.status === 'SUCCEEDED' || s.status === 'SKIPPED')
     if allTerminalSuccess and isValidWorkflowTransition(run.status, 'VALIDATING'):
       atomically UPDATE ... SET status='VALIDATING' WHERE id=$1 AND status=$currentStatus
       atomically UPDATE ... SET status='COMPLETED', completed_at=now()
         WHERE id=$1 AND status='VALIDATING'
       append workflow_execution_event('run.completed'); return {changed:true, outcome:'COMPLETED'}

  8. -- still genuinely in progress: derive RUNNING <-> WAITING_FOR_APPROVAL bookkeeping
     activeCount = count of steps with status in
       ('READY','LEASED','RUNNING','RETRY_SCHEDULED')
     waitingCount = count of steps with status = 'WAITING_FOR_APPROVAL'
     if activeCount === 0 and waitingCount > 0 and run.status === 'RUNNING':
       atomically UPDATE ... SET status='WAITING_FOR_APPROVAL'
         WHERE id=$1 AND status='RUNNING'
       append workflow_execution_event('run.waiting_for_approval'); return {changed:true, outcome:'WAITING_FOR_APPROVAL'}
     if activeCount > 0 and run.status === 'WAITING_FOR_APPROVAL':
       atomically UPDATE ... SET status='RUNNING' WHERE id=$1 AND status='WAITING_FOR_APPROVAL'
       append workflow_execution_event('run.resumed'); return {changed:true, outcome:'RUNNING'}

  9. return { changed: false, outcome: null } -- nothing to do yet
```

Every `UPDATE` is gated `WHERE id = $1 AND status = $currentStatus`
(no bare unconditional update anywhere) — the same concurrency-safety
discipline as step leasing's atomic conditional `UPDATE`s: two concurrent
callers computing the same target transition only let one of them actually
apply it; the other's `UPDATE` affects zero rows and its own return value
reflects that (`changed: false`), never a duplicate event.

Every transition goes through `isValidWorkflowTransition`/the existing
`WorkflowStatusSchema` table (Phase 1, unchanged except for the one
addition in §12a) — there is no code path that writes a `workflow_runs.status`
value without going through this check first, so the function is
structurally unable to perform an illegal transition regardless of what
step data it's fed.

**Where it's called from:**

- `governance`'s orchestration, immediately after every step-level
  transition it drives (`enterWaitingForApproval`,
  `resumeWorkflowStepAfterApproval`, `rejectWorkflowStepApproval`,
  `expireWorkflowStepApproval`, `cancelWorkflowStepApproval`) — synchronous
  reflection of the run's state right after the event that caused it.
- `workflow-engine`'s own `reconcileWorkflowRuntime` (Phase 3's recovery
  tick, §11's addition) — called for every non-terminal run each tick,
  so completion/failure/wait-state derivation happens for **every**
  workflow, not only ones that happen to touch governance, closing the
  Phase 3 gap generally rather than only for the governance-integrated
  path.
- `apps/worker`'s per-step execution loop, right after `commitStepSuccess`/
  `commitStepFailure` for a step with no governed action at all — so a
  workflow with zero approval gates still completes correctly.

**Scope note, documented rather than silently generalized:** this design
handles the common case exercised by the reference workflow — one gating
step blocking the run at a time. A workflow with multiple simultaneously
`WAITING_FOR_APPROVAL` steps across independent parallel branches, where
one branch's rejection should arguably cancel a sibling branch's still-
pending approval, is not built in Phase 4 (the reference workflow has
exactly one approval gate, at the end, after its parallel branches already
converged). Flagged in `RISK_REGISTER.md` as a known limitation rather than
silently assumed away.

## 11. Recovery (governance side)

`reconcileGovernanceRuntime(db)` — stateless, idempotent, safe to
re-run, following the exact discipline of Phase 3's
`reconcileWorkflowRuntime`:

1. **Expire due requests** — `UPDATE approval_requests SET status =
'EXPIRED', resolved_at = now() WHERE status IN ('PENDING', 'ASSIGNED',
'PARTIALLY_APPROVED') AND expires_at IS NOT NULL AND expires_at < now()
RETURNING *`; for each, call
   `workflow-engine.expireWorkflowStepApproval`,
   `workflow-engine.reconcileWorkflowRunOutcome`, and append
   `governance_events`.
2. **Reached quorum but not yet resumed** — `SELECT * FROM
approval_requests WHERE status = 'APPROVED' AND continuation_committed
= false` (the partial index in §1 makes this cheap); call
   `resumeApprovedRequest` for each — the exact same function
   `recordApprovalDecision` calls synchronously, so there is exactly one
   code path for resumption regardless of whether it fires immediately or
   after a crash.
3. **Steps waiting on an already-resolved terminal request** — join
   `workflow_steps` (`status = 'WAITING_FOR_APPROVAL'`) against
   `approval_requests`; if the linked request is already
   `REJECTED`/`EXPIRED`/`CANCELLED`/`SUPERSEDED` but the step missed its
   corresponding transition (e.g. a crash between updating the request and
   calling the workflow-engine transition), apply it now, then call
   `reconcileWorkflowRunOutcome`.
4. **Duplicate decision attempts** — prevented structurally by
   `unique(approval_request_id, decided_by_user_id)`; recovery does
   nothing here beyond documenting that this is a non-issue by
   construction, the same way Phase 3 documented lease-token rejection as
   structural rather than something recovery has to detect and fix.
5. **Abandoned approval assignments** — `approval_assignments` rows still
   `ASSIGNED` whose parent request already reached a terminal state get
   marked `EXPIRED` (cosmetic/audit accuracy, not functionally
   load-bearing — no step-state depends on assignment status).
6. **Superseded action snapshots** — safety net only: `createApprovalRequest`
   already supersedes at creation time (§8); recovery re-checks for any
   request whose `workflow_step_id` has a newer non-superseded request and
   marks the older one `SUPERSEDED` if somehow missed.

`workflow-engine`'s own `reconcileWorkflowRuntime` (Phase 3) gains one
addition: call `reconcileWorkflowRunOutcome` for every active run each tick
(not governance-specific logic — it's a plain function of `workflow_steps`
statuses, owned entirely by `workflow-engine`), so every run — governance-
gated or not — correctly reaches `COMPLETED`/`FAILED`/`WAITING_FOR_APPROVAL`/
back to `RUNNING` as its steps resolve, even if nothing governance-specific
ever ran for it.

## 12. Reference workflow: extending `client_solution_assessment`

**New workflow version, not a mutation of the published Phase 3 version**
(`1.0.0`): version `1.1.0` adds an eighth step,

```
... -> sara_synthesize (sara) -> deliver_external (sara)
```

`deliver_external` declares `governedAction: "communication.send.external"`
(a new, optional field on `WorkflowStepDefinitionSchema` — additive, `null`
by default, so `1.0.0`'s already-published manifest remains valid without
re-parsing; see the implementation note below) and depends on
`sara_synthesize`. Its mock agent output includes an `intendedAction`
matching that governed action with canned parameters (e.g. `{ recipient:
"client@example.com", subject: "Solution Assessment" }`) and a canned
`proposedOutput`.

`evaluatePolicy` for `communication.send.external` under the platform's
mandatory default policy set is expected to produce `REQUIRE_APPROVAL`
(this is exactly the kind of external-communication action the platform
mandatory floor treats as requiring approval by default, per
`ADR-0008`'s original direction). The workflow durably parks at
`WAITING_FOR_APPROVAL` on this step; a test-issued `recordApprovalDecision`
(`APPROVED`) resumes it exactly once, replaying the snapshotted
`proposedOutput` — no real external communication is sent (Phase 4 stays
mock-only here, per instruction).

**Implementation note on reading old manifest rows:** `platformWorkflowCatalog.ts`'s
`mapVersion` returns `row.manifest` typed as `WorkflowManifestMetadata`
without a runtime `.parse()` call (only `seedPlatformWorkflowCatalog`
re-validates at write time). A `1.0.0` row stored before this field existed
genuinely lacks the `governedAction` key in its raw JSON — TypeScript's
type will claim it's `null` (the schema default), but at runtime it will
actually be `undefined` for old rows. Every consumer must treat
`step.governedAction` as absent-safe (`?? null`), not assume the Zod
default retroactively backfills stored data. Flagged explicitly as an
implementation detail to get right, the same category of gotcha as the
`interface`-vs-`type` `Queryable` issue documented in Phase 1.

## 12a. One additive change to the existing run-level transition table

`packages/workflow-engine/src/status.ts`'s `ALLOWED_TRANSITIONS` (Phase 1,
unchanged until now) gains `"BLOCKED"` as a legal target from
`WAITING_FOR_APPROVAL` (previously: `["QUEUED", "RUNNING", "REJECTED",
"EXPIRED", "CANCELLED"]`; now adds `"BLOCKED"`). This is what makes
Decision 4's "approval expiration: transition to EXPIRED or BLOCKED
according to the immutable workflow policy" reachable at all —
`BLOCKED` is a non-terminal status with its own existing legal exits
(`["WAITING_FOR_APPROVAL", "RUNNING", "FAILED", "CANCELLED"]`, unchanged),
so this is purely additive: one new entry in one status's transition list,
no status added or removed, no existing transition changed or removed.
`packages/workflow-engine/test/status.test.ts` (Phase 1, 22 tests) gains
one new case for this transition; every existing test continues to pass
unmodified.

**Only `EXPIRED` is actually produced in Phase 4** (§10a step 4) — `BLOCKED`
is schema-supported, by design, for a future manifest-level policy field
(e.g. `onApprovalExpiration: "terminate" | "block"`) that nothing in this
phase builds or selects. Documented as a deliberate, flagged simplification
(the same pattern as Phase 3's unimplemented `CapabilityResolver` seam),
not a partial/half-built feature.

## 13. Proposed file tree

```
packages/governance/                    (new package)
  package.json, tsconfig.json, eslint.config.js, vitest.config.ts
  src/
    policyVersionLifecycle.ts           (PolicyVersionStatus + transitions)
    riskClassificationVersionLifecycle.ts (RiskClassificationVersionStatus + transitions, mirrors the above)
    actionCatalog.ts                    (GovernedActionSchema, GOVERNED_ACTIONS, extension-contract doc comment)
    policyDocument.ts                   (PolicyDocumentSchema, ConditionNodeSchema, PolicyOverrideDocumentSchema, EFFECT_PRECEDENCE)
    condition.ts                        (evaluateCondition — pure)
    policyDecision.ts                   (PolicyDecisionSchema)
    contentHash.ts                      (computePolicyHash, computeRiskClassificationHash — both thin-wrap platform-kernel's computeContentHash)
    platformPolicyCatalog.ts            (PlatformPolicyCatalog / PgPlatformPolicyCatalog)
    platformRiskClassificationCatalog.ts (PlatformRiskClassificationCatalog / PgPlatformRiskClassificationCatalog)
    seedPlatformPolicyCatalog.ts
    seedPlatformRiskClassificationCatalog.ts
    tenantPolicyRegistry.ts             (TenantPolicyAssignment/Override get/list/enable, mirrors tenantAgentRegistry.ts)
    provisionTenantPolicy.ts
    evaluatePolicy.ts                   (the precedence + merge algorithm, §4)
    approvalRequestLifecycle.ts         (ApprovalRequestStatus + transitions, §6)
    createApprovalRequest.ts            (§8)
    recordApprovalDecision.ts           (the 9-step command, §7)
    cancelApprovalRequest.ts            (the governed cancellation command, §7)
    resumeApprovedRequest.ts            (§10)
    governanceEvents.ts                 (appendGovernanceEvent)
    recovery.ts                         (reconcileGovernanceRuntime, §11)
    separationOfDuties.ts               (pure eligibility checks used by recordApprovalDecision)
    index.ts                            (barrel)

packages/workflow-engine/src/
  approvalIntegration.ts                (new — enterWaitingForApproval, resumeWorkflowStepAfterApproval,
                                          rejectWorkflowStepApproval, expireWorkflowStepApproval,
                                          cancelWorkflowStepApproval)
  reconcileWorkflowRunOutcome.ts         (new — §10a; the run-completion capability)
  status.ts                             (extended — one additive transition, WAITING_FOR_APPROVAL -> BLOCKED, §12a)
  manifest.ts                           (extended — governedAction field on WorkflowStepDefinitionSchema)
  recovery.ts                           (extended — call reconcileWorkflowRunOutcome per active run)
  reference/clientSolutionAssessment.ts (extended — new exported v1.1.0 manifest constant, v1.0.0 untouched)

packages/agent-runtime/src/
  executionResult.ts                   (extended — intendedAction, selfAssessedRiskLevel, requestedCapabilities)
  mockAgentAdapter.ts                   (extended — populate intendedAction when a step declares governedAction)

apps/worker/src/index.ts                (extended — evaluatePolicy + createApprovalRequest when a mock
                                          result's intendedAction requires it; reconcileWorkflowRunOutcome
                                          after every step outcome and every reconciliation tick)

supabase/migrations/
  <next-ts>_governance_policy_catalog.sql        (new — 4 platform tables)
  <next-ts+1>_tenant_governance_and_approvals.sql (new — 7 tenant tables)

supabase/migrations_rollback/
  <next-ts>_governance_policy_catalog_rollback.sql       (new)
  <next-ts+1>_tenant_governance_and_approvals_rollback.sql (new)
```

## 14. Migration and rollback order

Apply in order: `..._governance_policy_catalog.sql` (now four platform
tables: `policy_definitions`, `policy_versions`,
`risk_classification_definitions`, `risk_classification_versions`), then
`..._tenant_governance_and_approvals.sql` (the second migration's
`approval_requests` table has a composite FK to `workflow_steps`, which
already exists from Phase 3 — no change to Phase 3's migrations, aside
from the separate, code-only `status.ts` transition-table addition in
§12a, which is not a migration at all). Roll back in reverse: tenant
tables first (they hold `on delete restrict` references to the platform
tables and a same-package `on delete cascade` chain among themselves),
then platform tables — the same pattern proven correct in Phases 2 and 3.

## 15. Test matrix

| Area                                                                    | File (proposed)                                                    | Notes                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Policy document/override schema validation                              | `policyDocument.test.ts`                                           | valid documents pass; each metadata violation rejected                                                                                                                                                                                                                    |
| Condition evaluation                                                    | `condition.test.ts`                                                | every operator, `all`/`any` nesting, unknown field path                                                                                                                                                                                                                   |
| Policy hash / risk-classification hash integrity                        | `contentHash.test.ts` (governance)                                 | mirrors `platform-kernel`'s `contentHash.test.ts`'s nested-key-order case                                                                                                                                                                                                 |
| Published-policy immutability                                           | `seedPlatformPolicyCatalog.test.ts`                                | re-seeding a changed document under the same version throws                                                                                                                                                                                                               |
| Published-risk-classification immutability                              | `seedPlatformRiskClassificationCatalog.test.ts`                    | re-seeding a changed risk level/rationale under the same version throws                                                                                                                                                                                                   |
| Policy version lifecycle transitions                                    | `policyVersionLifecycle.test.ts`                                   | mirrors `workflowVersionLifecycle.test.ts`                                                                                                                                                                                                                                |
| Risk-classification version lifecycle transitions                       | `riskClassificationVersionLifecycle.test.ts`                       | mirrors the above                                                                                                                                                                                                                                                         |
| Deterministic policy ordering                                           | `evaluatePolicy.test.ts`                                           | same inputs -> identical decision content across repeated calls                                                                                                                                                                                                           |
| Platform mandatory precedence                                           | `evaluatePolicy.test.ts`                                           | a mandatory `BLOCK`/`DENY` survives regardless of tenant assignment/override                                                                                                                                                                                              |
| **Deterministic conflict resolution at every precedence level**         | `evaluatePolicy.test.ts`                                           | every pairwise combination of matching effects resolves per `EFFECT_PRECEDENCE`: `BLOCK`+anything -> `BLOCK`; `DENY`+`{ESCALATE,REQUIRE_APPROVAL,ALLOW}` -> `DENY`; `ESCALATE`+`{REQUIRE_APPROVAL,ALLOW}` -> `ESCALATE`; `REQUIRE_APPROVAL`+`ALLOW` -> `REQUIRE_APPROVAL` |
| Tenant override restrictions                                            | `evaluatePolicy.test.ts` + `tenantPolicyRegistry.test.ts`          | override on an `immutable` policy version rejected at write time; override can only tighten (attempted loosening has no effect / is unrepresentable)                                                                                                                      |
| Every policy effect                                                     | `evaluatePolicy.test.ts`                                           | `BLOCK`, `DENY`, `ESCALATE`, `REQUIRE_APPROVAL`, `ALLOW` each producible                                                                                                                                                                                                  |
| Every risk classification                                               | `evaluatePolicy.test.ts`                                           | LOW/MEDIUM/HIGH/CRITICAL, including the `risk_classification_versions` floor and a policy-asserted raise (never a lower override)                                                                                                                                         |
| `policy_evaluations` records the exact risk-classification version used | `evaluatePolicy.test.ts`                                           | the persisted row's `risk_classification_version_id` matches the version actually resolved                                                                                                                                                                                |
| Governed-action validation                                              | `actionCatalog.test.ts`                                            | unknown action string rejected; `"*"` accepted only where designed                                                                                                                                                                                                        |
| Approval transition legality                                            | `approvalRequestLifecycle.test.ts`                                 | exhaustive, mirrors `stepStatus.test.ts`'s style                                                                                                                                                                                                                          |
| Terminal transition rejection                                           | `approvalRequestLifecycle.test.ts`                                 | every terminal state has zero outgoing transitions                                                                                                                                                                                                                        |
| Single approval                                                         | `recordApprovalDecision.test.ts`                                   | `requiredApprovalCount = 1` reaches `APPROVED` on first decision                                                                                                                                                                                                          |
| Multi-approval quorum                                                   | `recordApprovalDecision.test.ts`                                   | `requiredApprovalCount = 2`, first decision -> `PARTIALLY_APPROVED`, second -> `APPROVED`                                                                                                                                                                                 |
| Distinct approver enforcement                                           | `recordApprovalDecision.test.ts`                                   | same decider deciding twice is rejected/absorbed, not double-counted                                                                                                                                                                                                      |
| Partial approval                                                        | `recordApprovalDecision.test.ts`                                   | status reflects one-of-two before quorum                                                                                                                                                                                                                                  |
| Rejection behavior                                                      | `recordApprovalDecision.test.ts`                                   | short-circuit rejection with `rejectOnFirstRejection = true`                                                                                                                                                                                                              |
| Expiration                                                              | `recovery.test.ts` (governance)                                    | due request expires, linked step transitions to `EXPIRED`                                                                                                                                                                                                                 |
| Cancellation via governed command                                       | `cancelApprovalRequest.test.ts`                                    | cancelling a pending/assigned request cancels the linked step; idempotent on an already-terminal request                                                                                                                                                                  |
| **Direct client mutation attempts rejected**                            | `crossTenantIsolation.test.ts` (governance)                        | an authenticated user holding every relevant permission still cannot `INSERT`/`UPDATE`/`DELETE` `approval_requests` or `approval_decisions` directly — only `SELECT` succeeds                                                                                             |
| Supersession                                                            | `createApprovalRequest.test.ts`                                    | changed payload hash supersedes the prior active request                                                                                                                                                                                                                  |
| Unauthorized approver rejection                                         | `recordApprovalDecision.test.ts`                                   | a user with `tenant.decide_approvals` but no assignment is rejected                                                                                                                                                                                                       |
| Requester self-approval rejection                                       | `recordApprovalDecision.test.ts`                                   | the requesting user/tenant agent cannot decide its own request                                                                                                                                                                                                            |
| Tenant isolation                                                        | `crossTenantIsolation.test.ts` (governance)                        | all 7 tenant tables + 4 platform tables, mirrors Phases 2/3's file                                                                                                                                                                                                        |
| Payload-hash mismatch rejection                                         | `resumeApprovedRequest.test.ts` + `recordApprovalDecision.test.ts` | a (simulated) corrupted snapshot fails closed rather than resuming/deciding                                                                                                                                                                                               |
| Idempotent approval creation                                            | `createApprovalRequest.test.ts`                                    | same payload hash twice returns the same request, no duplicate                                                                                                                                                                                                            |
| Idempotent approval decision                                            | `recordApprovalDecision.test.ts`                                   | duplicate submission from the same decider is absorbed, not double-inserted                                                                                                                                                                                               |
| Exactly-once workflow resume (concurrency)                              | `resumeApprovedRequest.test.ts`                                    | two concurrent resume attempts — exactly one performs the transition                                                                                                                                                                                                      |
| Worker restart during approval wait                                     | `recovery.test.ts` (governance)                                    | simulate a crash between `APPROVED` and resumption; recovery completes it exactly once                                                                                                                                                                                    |
| Approval reconciliation                                                 | `recovery.test.ts` (governance)                                    | full sweep: expiry, pending-continuation, orphaned-terminal-step cases together                                                                                                                                                                                           |
| **Run auto-completion — all required steps succeed/skip**               | `reconcileWorkflowRunOutcome.test.ts`                              | run reaches `VALIDATING` then `COMPLETED`                                                                                                                                                                                                                                 |
| **Run auto-completion — a required step hard-fails**                    | `reconcileWorkflowRunOutcome.test.ts`                              | run reaches `FAILED`                                                                                                                                                                                                                                                      |
| **Run auto-completion — approval rejection**                            | `reconcileWorkflowRunOutcome.test.ts`                              | run reaches `REJECTED`, not generic `FAILED` (distinguished via the step error's `code`)                                                                                                                                                                                  |
| **Run auto-completion — approval expiration**                           | `reconcileWorkflowRunOutcome.test.ts`                              | run reaches `EXPIRED` (Phase 4's baseline; `BLOCKED` schema-reachable but not selected by anything built)                                                                                                                                                                 |
| **Run auto-completion — cancellation**                                  | `reconcileWorkflowRunOutcome.test.ts`                              | remaining non-terminal steps cancelled, run reaches `CANCELLED`                                                                                                                                                                                                           |
| **Run auto-completion — concurrency safety**                            | `reconcileWorkflowRunOutcome.test.ts`                              | two concurrent calls for the same run — exactly one applies each transition, no duplicate event                                                                                                                                                                           |
| **Run auto-completion — idempotent no-op on an already-terminal run**   | `reconcileWorkflowRunOutcome.test.ts`                              | calling it again after `COMPLETED` changes nothing and produces no new event                                                                                                                                                                                              |
| **Run auto-completion — cannot bypass a legal transition**              | `reconcileWorkflowRunOutcome.test.ts`                              | a contrived step-state combination that would imply an illegal target transition is safely rejected/no-op, not silently forced                                                                                                                                            |
| Compatibility: existing `AgentExecutionResult` payloads                 | `executionResult.test.ts` (agent-runtime)                          | a Phase-1/2/3-shaped payload (no `intendedAction`/`selfAssessedRiskLevel`/`requestedCapabilities`) still parses, with the new fields defaulted (`null`/`null`/`[]`)                                                                                                       |
| Compatibility: existing workflow manifests                              | `manifest.test.ts` (workflow-engine)                               | a step definition without `governedAction` still parses, defaulted to `null`; the already-published `client_solution_assessment` v1.0.0 row is read back unchanged and unaffected                                                                                         |
| Full reference-workflow approval integration                            | `referenceWorkflowApproval.test.ts`                                | `client_solution_assessment` v1.1.0 end-to-end through `deliver_external`'s approval gate to `COMPLETED`, mock agents only                                                                                                                                                |

**Isolation:** a new dedicated local test database
(`agentflow_test_governance`), added to `scripts/setup-local-test-db.sh`'s
`DB_NAMES` array, and `packages/governance/vitest.config.ts` gets
`fileParallelism: false` from the start (it will have multiple DB-backed
test files immediately, unlike `workflow-engine` which only needed this
once it grew past its first).

## 16. Resolved and remaining items

All four required refinements are incorporated above (§1/§4 for
versioned risk classifications; §9/§12/§15 for the contract extensions and
their compatibility tests; §2/§7 for the corrected RLS and mutation model;
§10a/§12a for run-level completion). No new material blocker has appeared
during this revision — implementation proceeds.

One inherited, explicitly-scoped limitation remains (not a blocker, tracked
in `RISK_REGISTER.md`): §10a's note on multiple simultaneous
`WAITING_FOR_APPROVAL` steps across independent parallel branches within
one run — the reference workflow doesn't exercise this shape (its single
approval gate sits after all parallel branches already converged), and
building full cross-branch rejection propagation is out of scope for this
phase.

The Phase 1 Supabase-validation gate remains open and unrelated to any of
this — Phase 4, like every prior phase, is fully testable against local
Postgres without it.
