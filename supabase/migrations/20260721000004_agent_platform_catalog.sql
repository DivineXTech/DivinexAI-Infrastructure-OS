-- AgentFlow Pro v2 — Phase 2: platform-owned agent catalog
--
-- Platform-owned: no tenant_id anywhere in this migration. Sara, Nova,
-- Forge, Guardian, Reven, and Pulse are each defined once here and
-- versioned immutably; a tenant that wants one gets its own installation
-- row in tenant_agents (see the companion migration
-- 20260721000005_tenant_agent_installations.sql) referencing one explicit
-- published version from this catalog. See ADR-0013's addendum.

create table agent_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  role text not null,
  description text not null,
  ownership_type text not null default 'platform' check (ownership_type in ('platform')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Once a version's status reaches 'published' its manifest is treated as
-- immutable — a changed manifest creates a new version, never an update to
-- an existing row. See packages/agent-runtime/src/seedPlatformCatalog.ts,
-- which enforces this at the application layer by refusing to overwrite a
-- version whose stored manifest_hash no longer matches.
create table agent_versions (
  id uuid primary key default gen_random_uuid(),
  agent_definition_id uuid not null references agent_definitions (id) on delete cascade,
  version text not null,
  manifest jsonb not null,
  manifest_hash text not null,
  status text not null default 'draft'
    check (status in ('draft', 'validated', 'published', 'deprecated', 'retired')),
  published_at timestamptz,
  deprecated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (agent_definition_id, version)
);

create table agent_capability_definitions (
  agent_version_id uuid not null references agent_versions (id) on delete cascade,
  capability text not null,
  primary key (agent_version_id, capability)
);

create index agent_versions_definition_id_idx on agent_versions (agent_definition_id);
create index agent_versions_status_idx on agent_versions (status);

alter table agent_definitions enable row level security;
alter table agent_versions enable row level security;
alter table agent_capability_definitions enable row level security;

-- Read-only for tenant users; no insert/update/delete policy exists for any
-- of the three tables below, so the `authenticated` role can never write to
-- the platform catalog regardless of tenant permissions held — platform
-- writes happen through a trusted owner/service-role connection (the
-- seeding function above), the same integrity pattern already used for
-- audit_events/security_events.

create policy agent_definitions_select_authenticated on agent_definitions
  for select using (auth.uid() is not null);

create policy agent_versions_select_published on agent_versions
  for select using (auth.uid() is not null and status = 'published');

create policy agent_capability_definitions_select on agent_capability_definitions
  for select using (
    auth.uid() is not null
    and exists (
      select 1 from agent_versions v
      where v.id = agent_capability_definitions.agent_version_id
        and v.status = 'published'
    )
  );
