-- AgentFlow Pro v2 — Phase 1 (increment 2): audit + security event base schema
--
-- Append-only logs. Deliberately no insert/update/delete RLS policy exists
-- for either table below — with RLS enabled and no such policy, the
-- `authenticated` role (used by end-user requests) cannot write to these
-- tables even though it holds a blanket table-level GRANT, and even a
-- tenant member with every other permission cannot fabricate an audit
-- entry. Only a direct owner/service-role connection (which bypasses RLS
-- entirely) can insert — see packages/shared/src/events.ts. This protects
-- audit-log integrity per the source brief's security requirements.

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_type text not null default 'user' check (actor_type in ('user', 'service', 'agent', 'system')),
  event_type text not null,
  resource_type text,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table security_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  event_type text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_tenant_id_idx on audit_events (tenant_id);
create index audit_events_created_at_idx on audit_events (created_at);
create index security_events_tenant_id_idx on security_events (tenant_id);
create index security_events_created_at_idx on security_events (created_at);

alter table audit_events enable row level security;
alter table security_events enable row level security;

create policy audit_events_select_permission on audit_events
  for select using (tenant_id is not null and tenant_has_permission(tenant_id, 'tenant.view_audit_log'));

create policy security_events_select_permission on security_events
  for select using (tenant_id is not null and tenant_has_permission(tenant_id, 'tenant.view_security_log'));
