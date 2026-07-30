-- AgentFlow Pro v2 — Phase 2: tenant agent installations
--
-- Tenant-owned: tenant_id is NOT NULL on every table here, no exceptions —
-- there is no nullable-tenant-id row anywhere representing a "global"
-- agent; the platform catalog (previous migration) has no tenant_id column
-- at all instead. See ADR-0013's addendum.

create table tenant_agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  agent_definition_id uuid not null references agent_definitions (id) on delete restrict,
  agent_version_id uuid not null references agent_versions (id) on delete restrict,
  display_name_override text,
  lifecycle_status text not null default 'REGISTERED'
    check (lifecycle_status in
      ('REGISTERED', 'MOCK_EXECUTABLE', 'EVALUATION_TESTED', 'TOOL_ENABLED', 'APPROVAL_GOVERNED', 'ACTIVE', 'SUSPENDED')),
  enabled boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  execution_policy jsonb not null default '{}'::jsonb,
  approval_policy jsonb not null default '{}'::jsonb,
  installed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One installation per canonical agent per tenant (Phase 2 scope) —
  -- a future explicit multi-instance requirement would need its own
  -- migration to relax this.
  unique (tenant_id, agent_definition_id),
  -- Lets the child tables below declare a composite foreign key that
  -- forces their own tenant_id to match this row's tenant_id — enforced by
  -- Postgres itself, no trigger needed.
  unique (id, tenant_id)
);

create table tenant_agent_capabilities (
  tenant_agent_id uuid not null,
  tenant_id uuid not null references tenants (id) on delete cascade,
  capability text not null,
  primary key (tenant_agent_id, capability),
  foreign key (tenant_agent_id, tenant_id) references tenant_agents (id, tenant_id) on delete cascade
);

create table agent_tool_permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  tenant_agent_id uuid not null,
  tool_id text not null, -- references tool_definitions once Phase 5 exists
  created_at timestamptz not null default now(),
  unique (tenant_agent_id, tool_id),
  foreign key (tenant_agent_id, tenant_id) references tenant_agents (id, tenant_id) on delete cascade
);

create table agent_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  tenant_agent_id uuid not null,
  knowledge_source_id text not null, -- references knowledge_sources once Phase 6 exists
  created_at timestamptz not null default now(),
  unique (tenant_agent_id, knowledge_source_id),
  foreign key (tenant_agent_id, tenant_id) references tenant_agents (id, tenant_id) on delete cascade
);

create index tenant_agents_tenant_id_idx on tenant_agents (tenant_id);
create index tenant_agent_capabilities_tenant_id_idx on tenant_agent_capabilities (tenant_id);
create index agent_tool_permissions_tenant_id_idx on agent_tool_permissions (tenant_id);
create index agent_knowledge_sources_tenant_id_idx on agent_knowledge_sources (tenant_id);

insert into permissions (key, category, description) values
  ('tenant.manage_agents', 'agents', 'Install, configure, enable/disable, or remove agents for the tenant')
on conflict (key) do nothing;

alter table tenant_agents enable row level security;
alter table tenant_agent_capabilities enable row level security;
alter table agent_tool_permissions enable row level security;
alter table agent_knowledge_sources enable row level security;

create policy tenant_agents_select_member on tenant_agents
  for select using (is_tenant_member(tenant_id));

create policy tenant_agents_write_admin on tenant_agents
  for all using (tenant_has_permission(tenant_id, 'tenant.manage_agents'))
  with check (tenant_has_permission(tenant_id, 'tenant.manage_agents'));

create policy tenant_agent_capabilities_select_member on tenant_agent_capabilities
  for select using (is_tenant_member(tenant_id));

create policy tenant_agent_capabilities_write_admin on tenant_agent_capabilities
  for all using (tenant_has_permission(tenant_id, 'tenant.manage_agents'))
  with check (tenant_has_permission(tenant_id, 'tenant.manage_agents'));

create policy agent_tool_permissions_select_member on agent_tool_permissions
  for select using (is_tenant_member(tenant_id));

create policy agent_tool_permissions_write_admin on agent_tool_permissions
  for all using (tenant_has_permission(tenant_id, 'tenant.manage_agents'))
  with check (tenant_has_permission(tenant_id, 'tenant.manage_agents'));

create policy agent_knowledge_sources_select_member on agent_knowledge_sources
  for select using (is_tenant_member(tenant_id));

create policy agent_knowledge_sources_write_admin on agent_knowledge_sources
  for all using (tenant_has_permission(tenant_id, 'tenant.manage_agents'))
  with check (tenant_has_permission(tenant_id, 'tenant.manage_agents'));
