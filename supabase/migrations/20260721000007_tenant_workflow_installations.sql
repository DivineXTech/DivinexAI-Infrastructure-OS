-- AgentFlow Pro v2 — Phase 3: tenant workflow installations and durable execution
--
-- Tenant-owned: tenant_id is NOT NULL on every table here, no exceptions —
-- there is no nullable-tenant-id row anywhere representing a "global"
-- workflow; the platform catalog (previous migration) has no tenant_id
-- column at all instead. Every child table denormalizes tenant_id directly
-- (so RLS never needs a join) and enforces consistency with its parent via
-- a composite foreign key (child_fk, tenant_id) references parent (id,
-- tenant_id) — declarative, no trigger — mirroring
-- 20260721000005_tenant_agent_installations.sql's pattern exactly.

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
  -- Pinned at creation; immutable for the run's lifetime — no "latest
  -- version" resolution ever happens after a run exists.
  workflow_version_id uuid not null references workflow_versions (id) on delete restrict,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'PLANNING', 'WAITING_FOR_APPROVAL', 'QUEUED', 'RUNNING',
                       'RETRYING', 'BLOCKED', 'PAUSED', 'WAITING_FOR_INPUT', 'VALIDATING',
                       'COMPLETED', 'FAILED', 'CANCELLED', 'REJECTED', 'EXPIRED')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  idempotency_key text,
  requested_by_user_id uuid references auth.users (id) on delete set null,
  trace_id text not null,
  -- Append-only execution-event sequence counter for this run; incremented
  -- and read in the same statement as the event insert (executionEvents.ts)
  -- so two concurrent appends can never be assigned the same number.
  next_event_sequence bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  foreign key (tenant_workflow_id, tenant_id) references tenant_workflows (id, tenant_id) on delete cascade,
  -- Postgres allows multiple NULLs through a unique constraint, so a run
  -- created without an idempotency key has no idempotency guarantee at all
  -- (each such call creates a new run) — this is deliberate, not a gap.
  unique (tenant_id, idempotency_key),
  unique (id, tenant_id)
);

create table workflow_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  workflow_run_id uuid not null,
  step_key text not null,
  agent_slug text not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'READY', 'LEASED', 'RUNNING', 'WAITING_FOR_APPROVAL',
                       'WAITING_FOR_INPUT', 'RETRY_SCHEDULED', 'SUCCEEDED', 'FAILED',
                       'BLOCKED', 'CANCELLED', 'SKIPPED', 'EXPIRED', 'DEAD_LETTERED')),
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
  -- Materialization idempotency: re-materializing an already-materialized
  -- run inserts nothing new.
  unique (workflow_run_id, step_key),
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
  workflow_step_id uuid, -- nullable: run-level events have none
  event_type text not null,
  actor_type text not null check (actor_type in ('user', 'agent', 'system', 'worker')),
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

create index tenant_workflows_tenant_id_idx on tenant_workflows (tenant_id);
create index workflow_runs_tenant_id_idx on workflow_runs (tenant_id);
create index workflow_runs_status_idx on workflow_runs (status);
create index workflow_runs_tenant_workflow_id_idx on workflow_runs (tenant_workflow_id);
create index workflow_steps_tenant_id_idx on workflow_steps (tenant_id);
create index workflow_steps_run_id_idx on workflow_steps (workflow_run_id);
create index workflow_steps_status_idx on workflow_steps (status);
-- Partial indexes purpose-built for the worker-recovery scans (recovery.ts).
create index workflow_steps_lease_expiry_idx on workflow_steps (lease_expires_at)
  where status in ('LEASED', 'RUNNING');
create index workflow_steps_retry_due_idx on workflow_steps (next_attempt_at)
  where status = 'RETRY_SCHEDULED';
create index workflow_step_dependencies_run_id_idx on workflow_step_dependencies (workflow_run_id);
create index workflow_step_dependencies_depends_on_idx on workflow_step_dependencies (depends_on_step_id);
create index workflow_execution_events_tenant_id_idx on workflow_execution_events (tenant_id);
create index workflow_execution_events_run_id_idx on workflow_execution_events (workflow_run_id);
create index workflow_dead_letters_tenant_id_idx on workflow_dead_letters (tenant_id);

insert into permissions (key, category, description) values
  ('tenant.manage_workflows', 'workflows', 'Install, configure, enable/disable, run, or cancel workflows for the tenant')
on conflict (key) do nothing;

alter table tenant_workflows enable row level security;
alter table workflow_runs enable row level security;
alter table workflow_steps enable row level security;
alter table workflow_step_dependencies enable row level security;
alter table workflow_execution_events enable row level security;
alter table workflow_dead_letters enable row level security;

create policy tenant_workflows_select_member on tenant_workflows
  for select using (is_tenant_member(tenant_id));
create policy tenant_workflows_write_admin on tenant_workflows
  for all using (tenant_has_permission(tenant_id, 'tenant.manage_workflows'))
  with check (tenant_has_permission(tenant_id, 'tenant.manage_workflows'));

create policy workflow_runs_select_member on workflow_runs
  for select using (is_tenant_member(tenant_id));
create policy workflow_runs_write_admin on workflow_runs
  for all using (tenant_has_permission(tenant_id, 'tenant.manage_workflows'))
  with check (tenant_has_permission(tenant_id, 'tenant.manage_workflows'));

create policy workflow_steps_select_member on workflow_steps
  for select using (is_tenant_member(tenant_id));
create policy workflow_steps_write_admin on workflow_steps
  for all using (tenant_has_permission(tenant_id, 'tenant.manage_workflows'))
  with check (tenant_has_permission(tenant_id, 'tenant.manage_workflows'));

create policy workflow_step_dependencies_select_member on workflow_step_dependencies
  for select using (is_tenant_member(tenant_id));
create policy workflow_step_dependencies_write_admin on workflow_step_dependencies
  for all using (tenant_has_permission(tenant_id, 'tenant.manage_workflows'))
  with check (tenant_has_permission(tenant_id, 'tenant.manage_workflows'));

create policy workflow_dead_letters_select_member on workflow_dead_letters
  for select using (is_tenant_member(tenant_id));
create policy workflow_dead_letters_write_admin on workflow_dead_letters
  for all using (tenant_has_permission(tenant_id, 'tenant.manage_workflows'))
  with check (tenant_has_permission(tenant_id, 'tenant.manage_workflows'));

-- Read-only for tenant users; no insert/update/delete policy at all, so
-- only a service-role/owner connection (the worker) can append events —
-- mirroring audit_events/security_events's integrity design. A tenant
-- fabricating its own execution history would undermine the entire
-- ledger's trustworthiness.
create policy workflow_execution_events_select_member on workflow_execution_events
  for select using (is_tenant_member(tenant_id));
