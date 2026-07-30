# Phase 4 — Governance, Policies, Risk Decisions, and Human Approvals (Design)

**Status: Planning gate. Nothing in this document has been implemented.**
Stop for review before writing any runtime code, per instruction.

## 0. Ownership recap (per the brief)

- **`governance`** (new package) owns: policy definitions/versions,
  evaluation, risk classification, policy effects, approval requirements,
  approval requests/decisions/assignments, separation of duties,
  escalation, governance events, decision explanations, policy simulation.
- **`workflow-engine`** owns: entering `WAITING_FOR_APPROVAL`, referencing
  the approval request, resuming/rejecting/expiring/cancelling the waiting
  step, exactly-once continuation, propagating resulting run/step state.
  `workflow-engine` never decides _whether_ approval is required — it only
  reacts to `governance`'s decision.
- **`agent-runtime`** owns: declaring intended actions, structured risk
  indicators, requested capabilities, approval-required execution
  outcomes. Agents never decide approvals themselves.
- **`platform-kernel`** stays limited to content-hashing/versioning
  primitives — `computeContentHash` is reused for policy hashes and
  approval-request payload hashes; no policy/approval logic lives there.
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

-- Platform default risk level per governed action ("*" = default floor for
-- any action with no more specific row). Not versioned like policy_versions
-- — this is a directly-editable current-state catalog (service-role-only
-- writes), not an immutable decision artifact; a policy_document may still
-- assert/override a risk level for a specific match, which takes
-- precedence over this default (§4).
create table risk_classifications (
  id uuid primary key default gen_random_uuid(),
  action text not null unique,
  default_risk_level text not null check (default_risk_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  rationale text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Indexes: `policy_versions(policy_definition_id)`, `policy_versions(status)`.

Lifecycle: a new `PolicyVersionStatus` enum + transition table, structurally
identical to `agent-runtime`'s `AgentVersionStatus`/`workflow-engine`'s
`WorkflowVersionStatus` but declared independently in `governance` — same
reasoning as every prior phase: each package owns its own versioning
vocabulary even where the shape matches exactly.

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
  effect text not null check (effect in ('ALLOW', 'DENY', 'REQUIRE_APPROVAL', 'BLOCK', 'ESCALATE')),
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
`risk_classifications`) — read-only, deny-by-default writes, identical
pattern to `agent_definitions`/`workflow_definitions`:

```sql
create policy policy_definitions_select_authenticated on policy_definitions
  for select using (auth.uid() is not null);
create policy policy_versions_select_published on policy_versions
  for select using (auth.uid() is not null and status = 'published');
create policy risk_classifications_select_authenticated on risk_classifications
  for select using (auth.uid() is not null);
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

**`approval_requests`** — the first table in this codebase needing
asymmetric per-command RLS rather than the uniform select/write-all pair:
creation is always policy-driven (never a raw tenant insert), but an
authorized approver-tier user may cancel a pending request directly.

```sql
create policy approval_requests_select on approval_requests
  for select using (tenant_has_permission(tenant_id, 'tenant.view_approvals'));
-- No insert policy at all: creation is service-role-only (createApprovalRequest).
create policy approval_requests_update_decider on approval_requests
  for update using (tenant_has_permission(tenant_id, 'tenant.decide_approvals'))
  with check (tenant_has_permission(tenant_id, 'tenant.decide_approvals'));
```

**`approval_decisions`** — select gated on `tenant.view_approvals`; write
gated on `tenant.decide_approvals` (matches the brief exactly):

```sql
create policy approval_decisions_select on approval_decisions
  for select using (tenant_has_permission(tenant_id, 'tenant.view_approvals'));
create policy approval_decisions_write on approval_decisions
  for insert with check (tenant_has_permission(tenant_id, 'tenant.decide_approvals'));
```

No update/delete policy on `approval_decisions` — a recorded decision is
never mutated (the append-only-decisions + recomputed-status-on-the-
parent-request pattern is how a "changed mind" would have to work: cast a
new decision only where the policy's quorum model allows it, never edit
history).

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
  effect: z.enum(["ALLOW", "DENY", "REQUIRE_APPROVAL", "BLOCK", "ESCALATE"]),
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

Six-tier precedence, per the brief:

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

**Merge algorithm** (deterministic, pure function of matched rows + context):

```
matches = every policy version from tiers 1-3 whose appliesToActions
          includes the action (or "*") and whose conditions evaluate true
          against context, ordered by (tier, priority, policy_definition_id)
          for deterministic reason ordering (not for precedence itself —
          precedence is "most restrictive wins", order only affects the
          human-readable reasons list's ordering)

effect = the most restrictive effect among all matches, using the fixed
         ranking DENY > BLOCK > ESCALATE > REQUIRE_APPROVAL > ALLOW
         (no match at all -> ALLOW, the safe default only when zero
         policies apply)

for each match with override_policy = 'overridable', apply any tenant
override targeting it (tier 4): effect can only move UP this same ranking
(tighten), requiredApprovalCount can only increase, requiredApproverRoles/
requiredPermissions are unioned (never reduced), tightenedConditions (if
present) is ANDed onto that match's own conditions for future evaluations
of this same match (does not affect whether OTHER matches fired)

apply the workflow step's approvalRequired floor (tier 5): if true and the
merged effect is currently ALLOW, raise it to REQUIRE_APPROVAL with
requiredApprovalCount = max(merged, 1)

riskLevel = the highest RiskLevel asserted by any match's own riskLevel
            field (CRITICAL > HIGH > MEDIUM > LOW); if no match asserts one,
            fall back to risk_classifications' row for this action, or
            risk_classifications' "*" row, defaulting to LOW if neither exists

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
a mandatory `DENY`/`BLOCK` match can never be softened by anything at a
lower tier — there is no code path that averages or lets a later tier
override an earlier one's restrictiveness downward.

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
  effect: z.enum(["ALLOW", "DENY", "REQUIRE_APPROVAL", "BLOCK", "ESCALATE"]),
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

```
recordApprovalDecision(db, access, approvalRequestId, deciderActor, decision, comment):
  1. checkPermission(tenant.decide_approvals) via the reused PgTenantAccessEvaluator
  2. fetch the approval_requests row; if status is terminal, throw AlreadyResolvedError
  3. fetch approval_assignments for this request; assert deciderActor matches
     one by assignee_user_id, OR deciderActor holds one of the assignment's
     assignee_role_key permissions — else throw NotAssignedApproverError
  4. read action_snapshot.requestingActor / requestingTenantAgentId; assert
     deciderActor is none of: the requesting user, the requesting tenant
     agent, the same delegated service identity — else throw
     SelfApprovalProhibitedError (separation of duties)
  5. insert into approval_decisions (unique(approval_request_id,
     decided_by_user_id) enforces distinct-approver at the DB level too —
     a duplicate submission from the same decider is caught here and
     treated as "already recorded," not re-thrown as a new error)
  6. recompute status:
     - decision == REJECTED and reject_on_first_rejection -> REJECTED
     - decision == APPROVED and count(distinct APPROVED deciders) >=
       required_approval_count -> APPROVED
     - decision == APPROVED, quorum not yet reached -> PARTIALLY_APPROVED
       (or stays ASSIGNED if this is literally the first decision recorded
       and required_approval_count > 1 with more than one decision still
       needed — PARTIALLY_APPROVED specifically marks "at least one
       APPROVED decision recorded, quorum not yet reached")
  7. if new status != current status: assertValidApprovalTransition, then
     update the row (+ resolved_at if terminal)
  8. append a governance_events row for the decision, and for the
     terminal outcome if one was reached
  9. if new status == APPROVED: trigger exactly-once resumption (§10)
     if new status == REJECTED: trigger the reject path (§10)
```

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

**Why `intendedAction` matters for "do not duplicate agent or tool
execution":** the agent runs _once_, producing both its final output and
(when applicable) the intended governed action in the same invocation.
`governance` evaluates policy against that already-produced proposal; on
approval, `workflow-engine` replays the **already-computed**
`action_snapshot.proposedOutput` as the step's success payload — the agent
is never re-invoked. This is what makes "exactly once" possible: nothing
about resuming re-runs anything nondeterministic.

## 10. Workflow integration and exactly-once resume

**When `evaluatePolicy` returns `REQUIRE_APPROVAL`** (called by whatever
executes a step — `apps/worker` in Phase 4, same as Phase 3):

1. `governance.createApprovalRequest(...)` — persists the policy decision
   (already done as part of `evaluatePolicy`) and the approval request,
   attached to the workflow run and step (§8).
2. `workflow-engine.enterWaitingForApproval(db, workflowStepId)` —
   transitions the step `RUNNING → WAITING_FOR_APPROVAL` (**already a
   legal transition in Phase 3's `stepStatus.ts` — no schema change
   needed**), releasing the lease (`lease_token = null`, etc., same as
   every other lease-releasing transition).
3. `workflow-engine.syncRunStatusWithSteps(db, workflowRunId)` (new,
   folded into `reconcileWorkflowRuntime`'s tick, §11) — if no other step
   for this run is `READY`/`LEASED`/`RUNNING`/`RETRY_SCHEDULED`, transition
   the _run_ `RUNNING → WAITING_FOR_APPROVAL` too (already legal, Phase 1);
   if other parallel branches are still progressing, the run stays
   `RUNNING` while this one step waits.
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
  3. recompute payloadHash from the snapshot's own action/parameters/
     targetResource; if it no longer matches the stored payload_hash,
     this is a data-integrity failure — log and route to a governance
     escalation event rather than resuming (should be unreachable given
     §8's supersession-on-create guarantee; defense in depth)
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
  6. workflow-engine.syncRunStatusWithSteps(db, workflowRunId) — moves the
     run back to RUNNING if it had been parked at WAITING_FOR_APPROVAL
```

**On rejection, expiration, or cancellation:**

```
workflow-engine.rejectWorkflowStepApproval(db, workflowStepId, reason)   -- WAITING_FOR_APPROVAL -> FAILED (legal, Phase 3)
workflow-engine.expireWorkflowStepApproval(db, workflowStepId)           -- WAITING_FOR_APPROVAL -> EXPIRED (legal, Phase 3)
workflow-engine.cancelWorkflowStepApproval(db, workflowStepId)           -- WAITING_FOR_APPROVAL -> CANCELLED (legal, Phase 3)
```

Each is a direct, single hard terminal transition — **rejection/expiration
are not routed through `retryPolicy.ts`'s retry/dead-letter classifier**;
a human rejection or an unattended expiration is not a transient failure
to retry, it is an authoritative outcome. `governance` calls the matching
function, appends `governance_events`, then calls
`syncRunStatusWithSteps` the same way.

**Package-boundary discipline:** every `workflow-engine` function above
takes plain primitives (`workflowStepId`, `output: unknown`,
`reason: StepError`) — none of them import or query anything from
`governance`'s schema. `governance`'s orchestration functions are the
callers that read `approval_requests`/`action_snapshot` and pass already-
resolved data down. This is the same inversion already used for
`AgentResolver`/`GovernanceGate` in Phase 3 — `workflow-engine` never
determines _whether_ approval is required or _what_ the resumed output
should be; it only executes a state transition it's told to make.

**Note on a pre-existing gap (not fixed here):** Phase 3 never built "run
auto-completes once every step reaches a terminal success" — a run can sit
at `RUNNING` forever after its last step succeeds, with nothing moving it
to `COMPLETED`. Phase 4 does not fix this (out of scope — the brief's
required behaviors are entering/leaving `WAITING_FOR_APPROVAL` correctly,
not run completion), but it's called out explicitly rather than silently
left unaddressed. Tracked as a `RISK_REGISTER.md` row.

## 11. Recovery (governance side)

`reconcileGovernanceRuntime(db)` — stateless, idempotent, safe to
re-run, following the exact discipline of Phase 3's
`reconcileWorkflowRuntime`:

1. **Expire due requests** — `UPDATE approval_requests SET status =
'EXPIRED', resolved_at = now() WHERE status IN ('PENDING', 'ASSIGNED',
'PARTIALLY_APPROVED') AND expires_at IS NOT NULL AND expires_at < now()
RETURNING *`; for each, call
   `workflow-engine.expireWorkflowStepApproval` and append
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
   calling the workflow-engine transition), apply it now.
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
addition: call `syncRunStatusWithSteps` for every active run each tick (not
governance-specific logic — it's a plain function of `workflow_steps`
statuses, owned entirely by `workflow-engine`), so a run parked at
`WAITING_FOR_APPROVAL` correctly returns to `RUNNING` once the gating step
resolves, even if the resumption happened via `apps/worker`'s recovery tick
rather than a live `recordApprovalDecision` call.

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

## 13. Proposed file tree

```
packages/governance/                    (new package)
  package.json, tsconfig.json, eslint.config.js, vitest.config.ts
  src/
    policyVersionLifecycle.ts           (PolicyVersionStatus + transitions)
    actionCatalog.ts                    (GovernedActionSchema, GOVERNED_ACTIONS, extension-contract doc comment)
    policyDocument.ts                   (PolicyDocumentSchema, ConditionNodeSchema, PolicyOverrideDocumentSchema)
    condition.ts                        (evaluateCondition — pure)
    policyDecision.ts                   (PolicyDecisionSchema)
    policyHash.ts                       (thin-wraps platform-kernel's computeContentHash)
    platformPolicyCatalog.ts            (PlatformPolicyCatalog / PgPlatformPolicyCatalog)
    riskClassificationCatalog.ts        (RiskClassificationCatalog / PgRiskClassificationCatalog)
    seedPlatformPolicyCatalog.ts
    tenantPolicyRegistry.ts             (TenantPolicyAssignment/Override get/list/enable, mirrors tenantAgentRegistry.ts)
    provisionTenantPolicy.ts
    evaluatePolicy.ts                   (the precedence + merge algorithm, §4)
    approvalRequestLifecycle.ts         (ApprovalRequestStatus + transitions, §6)
    createApprovalRequest.ts            (§8)
    recordApprovalDecision.ts           (§7)
    resumeApprovedRequest.ts            (§10)
    governanceEvents.ts                 (appendGovernanceEvent)
    recovery.ts                         (reconcileGovernanceRuntime, §11)
    separationOfDuties.ts               (pure eligibility checks used by recordApprovalDecision)

packages/workflow-engine/src/
  approvalIntegration.ts                (new — enterWaitingForApproval, resumeWorkflowStepAfterApproval,
                                          rejectWorkflowStepApproval, expireWorkflowStepApproval,
                                          cancelWorkflowStepApproval, syncRunStatusWithSteps)
  manifest.ts                           (extended — governedAction field on WorkflowStepDefinitionSchema)
  recovery.ts                           (extended — call syncRunStatusWithSteps per active run)
  reference/clientSolutionAssessment.ts (extended — new exported v1.1.0 manifest constant, v1.0.0 untouched)

packages/agent-runtime/src/
  executionResult.ts                   (extended — intendedAction, selfAssessedRiskLevel, requestedCapabilities)
  mockAgentAdapter.ts                   (extended — populate intendedAction when a step declares governedAction)

supabase/migrations/
  <next-ts>_governance_policy_catalog.sql        (new — platform tables)
  <next-ts+1>_tenant_governance_and_approvals.sql (new — tenant tables)

supabase/migrations_rollback/
  <next-ts>_governance_policy_catalog_rollback.sql       (new)
  <next-ts+1>_tenant_governance_and_approvals_rollback.sql (new)
```

## 14. Migration and rollback order

Apply in order: `..._governance_policy_catalog.sql`, then
`..._tenant_governance_and_approvals.sql` (the second migration's
`approval_requests` table has a composite FK to `workflow_steps`, which
already exists from Phase 3 — no change to Phase 3's migrations). Roll
back in reverse: tenant tables first (they hold `on delete restrict`
references to the platform tables and a same-package `on delete cascade`
chain among themselves), then platform tables — the same pattern proven
correct in Phases 2 and 3.

## 15. Test matrix

| Area                                         | File (proposed)                                           | Notes                                                                                                                                                |
| -------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Policy document/override schema validation   | `policyDocument.test.ts`                                  | valid documents pass; each metadata violation rejected                                                                                               |
| Condition evaluation                         | `condition.test.ts`                                       | every operator, `all`/`any` nesting, unknown field path                                                                                              |
| Policy hash integrity                        | `policyHash.test.ts`                                      | mirrors `contentHash.test.ts`'s nested-key-order case                                                                                                |
| Published-policy immutability                | `seedPlatformPolicyCatalog.test.ts`                       | re-seeding a changed document under the same version throws                                                                                          |
| Policy version lifecycle transitions         | `policyVersionLifecycle.test.ts`                          | mirrors `workflowVersionLifecycle.test.ts`                                                                                                           |
| Deterministic policy ordering                | `evaluatePolicy.test.ts`                                  | same inputs -> identical decision content across repeated calls                                                                                      |
| Platform mandatory precedence                | `evaluatePolicy.test.ts`                                  | a mandatory DENY/BLOCK survives regardless of tenant assignment/override                                                                             |
| Tenant override restrictions                 | `evaluatePolicy.test.ts` + `tenantPolicyRegistry.test.ts` | override on an `immutable` policy version rejected at write time; override can only tighten (attempted loosening has no effect / is unrepresentable) |
| Every policy effect                          | `evaluatePolicy.test.ts`                                  | ALLOW, DENY, REQUIRE_APPROVAL, BLOCK, ESCALATE each producible                                                                                       |
| Every risk classification                    | `evaluatePolicy.test.ts`                                  | LOW/MEDIUM/HIGH/CRITICAL, including the `risk_classifications` fallback and a policy-asserted override                                               |
| Governed-action validation                   | `actionCatalog.test.ts`                                   | unknown action string rejected; `"*"` accepted only where designed                                                                                   |
| Approval transition legality                 | `approvalRequestLifecycle.test.ts`                        | exhaustive, mirrors `stepStatus.test.ts`'s style                                                                                                     |
| Terminal transition rejection                | `approvalRequestLifecycle.test.ts`                        | every terminal state has zero outgoing transitions                                                                                                   |
| Single approval                              | `recordApprovalDecision.test.ts`                          | `requiredApprovalCount = 1` reaches `APPROVED` on first decision                                                                                     |
| Multi-approval quorum                        | `recordApprovalDecision.test.ts`                          | `requiredApprovalCount = 2`, first decision -> `PARTIALLY_APPROVED`, second -> `APPROVED`                                                            |
| Distinct approver enforcement                | `recordApprovalDecision.test.ts`                          | same decider deciding twice is rejected/absorbed, not double-counted                                                                                 |
| Partial approval                             | `recordApprovalDecision.test.ts`                          | status reflects one-of-two before quorum                                                                                                             |
| Rejection behavior                           | `recordApprovalDecision.test.ts`                          | short-circuit rejection with `rejectOnFirstRejection = true`                                                                                         |
| Expiration                                   | `recovery.test.ts` (governance)                           | due request expires, linked step transitions to `EXPIRED`                                                                                            |
| Cancellation                                 | `approvalRequestLifecycle.test.ts` + integration          | cancelling a pending/assigned request cancels the linked step                                                                                        |
| Supersession                                 | `createApprovalRequest.test.ts`                           | changed payload hash supersedes the prior active request                                                                                             |
| Unauthorized approver rejection              | `recordApprovalDecision.test.ts`                          | a user with `tenant.decide_approvals` but no assignment is rejected                                                                                  |
| Requester self-approval rejection            | `recordApprovalDecision.test.ts`                          | the requesting user/tenant agent cannot decide its own request                                                                                       |
| Tenant isolation                             | `crossTenantIsolation.test.ts` (governance)               | all 7 tenant tables + 3 platform tables, mirrors Phases 2/3's file                                                                                   |
| Payload-hash mismatch rejection              | `resumeApprovedRequest.test.ts`                           | a (simulated) corrupted snapshot fails closed rather than resuming                                                                                   |
| Idempotent approval creation                 | `createApprovalRequest.test.ts`                           | same payload hash twice returns the same request, no duplicate                                                                                       |
| Idempotent approval decision                 | `recordApprovalDecision.test.ts`                          | duplicate submission from the same decider is absorbed, not double-inserted                                                                          |
| Exactly-once workflow resume                 | `resumeApprovedRequest.test.ts`                           | two concurrent resume attempts — exactly one performs the transition                                                                                 |
| Worker restart during approval wait          | `recovery.test.ts` (governance)                           | simulate a crash between `APPROVED` and resumption; recovery completes it exactly once                                                               |
| Approval reconciliation                      | `recovery.test.ts` (governance)                           | full sweep: expiry, pending-continuation, orphaned-terminal-step cases together                                                                      |
| Full reference-workflow approval integration | `referenceWorkflowApproval.test.ts`                       | `client_solution_assessment` v1.1.0 end-to-end through `deliver_external`'s approval gate, mock agents only                                          |

**Isolation:** a new dedicated local test database
(`agentflow_test_governance`), added to `scripts/setup-local-test-db.sh`'s
`DB_NAMES` array, and `packages/governance/vitest.config.ts` gets
`fileParallelism: false` from the start (it will have multiple DB-backed
test files immediately, unlike `workflow-engine` which only needed this
once it grew past its first).

## 16. Unresolved blockers

1. **`risk_classifications` is not versioned like `policy_versions`** — a
   deliberate design choice (§1), but flagged for explicit confirmation
   since the brief's "Policy Versioning" section could be read as applying
   to risk classification too ("A changed condition, effect, risk
   classification, approval requirement, or scope must produce a new
   policy version" — read here as: a policy _version_ that changes its
   _declared_ risk level for a match must bump its own version, which the
   design already satisfies; it does not necessarily mean the platform's
   baseline `risk_classifications` catalog itself must be versioned).
2. **Two contract extensions to already-shipped code** — `AgentExecutionResult`
   (Phase 1) gains `intendedAction`/`selfAssessedRiskLevel`/
   `requestedCapabilities`; `WorkflowStepDefinitionSchema` (Phase 3) gains
   `governedAction`. Both are additive/backward-compatible (§9, §12), but
   are called out explicitly per instruction since they modify contracts
   from prior, already-reviewed phases.
3. **`approval_requests` needs asymmetric per-command RLS** (§2) — the
   first table in this codebase without a uniform select/write-all pair
   (no insert policy at all; update policy for deciders/cancellers only).
   Confirm this shape is acceptable before it's built.
4. **Run-level auto-completion remains unbuilt** (§10's note) — inherited
   from Phase 3, not fixed here; tracked in `RISK_REGISTER.md`.

The Phase 1 Supabase-validation gate remains open and unrelated to any of
these — Phase 4, like every prior phase, is fully testable against local
Postgres without it.
