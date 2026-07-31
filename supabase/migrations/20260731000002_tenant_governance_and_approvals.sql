-- AgentFlow Pro v2 — Phase 4: tenant policy configuration, policy
-- evaluations, and the human-approval lifecycle
--
-- Tenant-owned: tenant_id is NOT NULL on every table here, no exceptions.
-- Every child table denormalizes tenant_id directly and enforces
-- consistency with its parent via a composite foreign key
-- (child_fk, tenant_id) references parent (id, tenant_id) — declarative, no
-- trigger — mirroring 20260721000007_tenant_workflow_installations.sql's
-- pattern exactly. approval_requests references workflow_steps (Phase 3)
-- via the same composite-FK pattern workflow_dead_letters already uses —
-- the link is one-way, governance -> workflow-engine; workflow-engine's own
-- tables and code are entirely unaware of this migration.
--
-- Corrected per review (Decision 3): approval_requests and
-- approval_decisions have NO insert/update/delete policy whatsoever, for
-- any tenant role, under any permission. Every mutation is a governance
-- application command over a trusted service-role/owner connection.

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
  override_document jsonb not null,
  override_hash text not null,
  enabled boolean not null default true,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, policy_definition_id)
);

create table policy_evaluations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  workflow_run_id uuid,
  workflow_step_id uuid,
  actor_type text not null check (actor_type in ('user', 'agent', 'system', 'worker')),
  actor_id text,
  action text not null,
  evaluated_policy_version_ids jsonb not null default '[]'::jsonb,
  -- The exact risk-classification version consulted for this evaluation —
  -- always recorded, never nullable: the platform-seeded "*" definition
  -- guarantees one is always resolvable.
  risk_classification_version_id uuid not null references risk_classification_versions (id) on delete restrict,
  effect text not null check (effect in ('BLOCK', 'DENY', 'ESCALATE', 'REQUIRE_APPROVAL', 'ALLOW')),
  risk_level text not null check (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  reasons jsonb not null default '[]'::jsonb,
  required_permissions jsonb not null default '[]'::jsonb,
  required_approver_roles jsonb not null default '[]'::jsonb,
  required_approval_count integer not null default 0,
  expires_at timestamptz,
  action_hash text not null,
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
  -- Immutable: action, parameters, targetResource, requestingActor,
  -- requestingTenantAgentId, workflowRunId, workflowStepId,
  -- policyDecisionId, riskClassificationVersionId, evidence, traceContext,
  -- proposedOutput (the agent's already-produced result, replayed on
  -- approval so the agent is never re-invoked).
  action_snapshot jsonb not null,
  payload_hash text not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ASSIGNED', 'PARTIALLY_APPROVED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED')),
  required_approval_count integer not null default 1,
  required_approver_roles jsonb not null default '[]'::jsonb,
  reject_on_first_rejection boolean not null default true,
  -- Exactly-once resumption gate: flips false -> true exactly once, via the
  -- same atomic-conditional-UPDATE pattern as workflow-engine's step leasing.
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

-- No per-aggregate sequence counter (unlike workflow_execution_events) — a
-- deliberate simplification: this is a parallel audit/compliance trail
-- whose consumers care about completeness and causation links
-- (causation_id), not a strict per-aggregate ordinal; nothing in recovery
-- depends on detecting a gap here. created_at + id ordering is sufficient.
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

insert into permissions (key, category, description) values
  ('tenant.view_approvals', 'governance', 'View approval requests and decisions for the tenant'),
  ('tenant.decide_approvals', 'governance', 'Decide (approve/reject) or cancel approval requests for the tenant'),
  ('tenant.manage_policies', 'governance', 'Configure tenant policy assignments and overrides'),
  ('tenant.view_governance_events', 'governance', 'View policy evaluations and the governance audit trail')
on conflict (key) do nothing;

alter table tenant_policy_assignments enable row level security;
alter table tenant_policy_overrides enable row level security;
alter table policy_evaluations enable row level security;
alter table approval_requests enable row level security;
alter table approval_decisions enable row level security;
alter table approval_assignments enable row level security;
alter table governance_events enable row level security;

create policy tenant_policy_assignments_select_member on tenant_policy_assignments
  for select using (is_tenant_member(tenant_id));
create policy tenant_policy_assignments_write_admin on tenant_policy_assignments
  for all using (tenant_has_permission(tenant_id, 'tenant.manage_policies'))
  with check (tenant_has_permission(tenant_id, 'tenant.manage_policies'));

create policy tenant_policy_overrides_select_member on tenant_policy_overrides
  for select using (is_tenant_member(tenant_id));
create policy tenant_policy_overrides_write_admin on tenant_policy_overrides
  for all using (tenant_has_permission(tenant_id, 'tenant.manage_policies'))
  with check (tenant_has_permission(tenant_id, 'tenant.manage_policies'));

-- Read-only, gated on the broader governance-view permission (evaluation
-- reasons can reveal policy internals, so membership alone isn't
-- sufficient); no write policy — evaluations are always inserted by the
-- deterministic evaluator over a service-role/owner connection.
create policy policy_evaluations_select on policy_evaluations
  for select using (tenant_has_permission(tenant_id, 'tenant.view_governance_events'));

-- Read-only for every tenant role, full stop. No insert policy. No update
-- policy. No delete policy. Deny-by-default covers all three — the
-- `authenticated` role can select and nothing else, regardless of any
-- permission it holds. Every mutation (creation, quorum recomputation,
-- status transition, cancellation) happens exclusively through a
-- governance application command running over the trusted
-- service-role/owner connection.
create policy approval_requests_select on approval_requests
  for select using (
    tenant_has_permission(tenant_id, 'tenant.view_approvals')
    or tenant_has_permission(tenant_id, 'tenant.decide_approvals')
  );

-- Read-only for every tenant role, full stop. No insert policy. No update
-- policy. No delete policy. Decision submission is exclusively
-- governance.recordApprovalDecision over the trusted connection — the
-- permission check, the assignment check, and the separation-of-duties
-- check all happen in that one function, in that order, before anything is
-- written; none of that logic is expressible as a single RLS WITH CHECK
-- clause, and duplicating even part of it into RLS would be a second,
-- weaker authorization path alongside the real one. Decisions are immutable
-- after insertion by construction.
create policy approval_decisions_select on approval_decisions
  for select using (
    tenant_has_permission(tenant_id, 'tenant.view_approvals')
    or tenant_has_permission(tenant_id, 'tenant.decide_approvals')
  );

-- Assigning approvers is a policy-configuration action.
create policy approval_assignments_select on approval_assignments
  for select using (tenant_has_permission(tenant_id, 'tenant.view_approvals'));
create policy approval_assignments_write_admin on approval_assignments
  for all using (tenant_has_permission(tenant_id, 'tenant.manage_policies'))
  with check (tenant_has_permission(tenant_id, 'tenant.manage_policies'));

-- Read-only, no write policy at all, mirroring workflow_execution_events'
-- integrity design.
create policy governance_events_select on governance_events
  for select using (tenant_has_permission(tenant_id, 'tenant.view_governance_events'));
