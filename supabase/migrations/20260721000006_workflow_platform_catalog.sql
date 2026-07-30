-- AgentFlow Pro v2 — Phase 3: platform-owned workflow catalog
--
-- Platform-owned: no tenant_id anywhere in this migration, mirroring
-- 20260721000004_agent_platform_catalog.sql's pattern exactly. A workflow
-- (e.g. "client_solution_assessment") is defined once here and versioned
-- immutably; a tenant that wants to run it gets its own installation row in
-- tenant_workflows (see the companion migration
-- 20260721000007_tenant_workflow_installations.sql) referencing one
-- explicit published version from this catalog.

create table workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Once a version's status reaches 'published' its manifest is treated as
-- immutable — a changed manifest creates a new version, never an update to
-- an existing row. See packages/workflow-engine/src/seedPlatformWorkflowCatalog.ts,
-- which enforces this at the application layer by refusing to overwrite a
-- version whose stored manifest_hash no longer matches.
create table workflow_versions (
  id uuid primary key default gen_random_uuid(),
  workflow_definition_id uuid not null references workflow_definitions (id) on delete cascade,
  version text not null,
  manifest jsonb not null,
  manifest_hash text not null,
  status text not null default 'draft'
    check (status in ('draft', 'validated', 'published', 'deprecated', 'retired')),
  published_at timestamptz,
  deprecated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workflow_definition_id, version)
);

create index workflow_versions_definition_id_idx on workflow_versions (workflow_definition_id);
create index workflow_versions_status_idx on workflow_versions (status);

alter table workflow_definitions enable row level security;
alter table workflow_versions enable row level security;

-- Read-only for tenant users; no insert/update/delete policy exists for
-- either table, so the `authenticated` role can never write to the
-- platform catalog regardless of tenant permissions held — platform writes
-- happen through a trusted owner/service-role connection (the seeding
-- function above), the same integrity pattern already used for
-- agent_definitions/agent_versions and audit_events/security_events.

create policy workflow_definitions_select_authenticated on workflow_definitions
  for select using (auth.uid() is not null);

create policy workflow_versions_select_published on workflow_versions
  for select using (auth.uid() is not null and status = 'published');
