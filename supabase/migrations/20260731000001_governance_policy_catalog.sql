-- AgentFlow Pro v2 — Phase 4: platform-owned policy and risk classification catalog
--
-- Platform-owned: no tenant_id anywhere in this migration, mirroring
-- 20260721000004_agent_platform_catalog.sql / 20260721000006_workflow_platform_catalog.sql
-- exactly. Four tables (Decision 1 of the Phase 4 review): policy_definitions
-- + policy_versions (immutable once published, exactly like agent/workflow
-- versions), and risk_classification_definitions + risk_classification_versions
-- (also immutable once published — a risk classification materially affects
-- policy decisions, approval requirements, and historical explainability, so
-- it gets the same versioning discipline as everything else a decision
-- depends on, rather than being a mutable lookup table).

create table policy_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Once a version's status reaches 'published' its policy_document is
-- treated as immutable — a changed document creates a new version, never an
-- update to an existing row. Enforced at the application layer by
-- packages/governance/src/seedPlatformPolicyCatalog.ts, which refuses to
-- overwrite a version whose stored policy_hash no longer matches.
create table policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_definition_id uuid not null references policy_definitions (id) on delete cascade,
  version text not null,
  policy_document jsonb not null,
  policy_hash text not null,
  status text not null default 'draft'
    check (status in ('draft', 'validated', 'published', 'deprecated', 'retired')),
  priority integer not null default 100,
  mandatory boolean not null default false,
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
-- specific definition) — always seeded so a floor is always resolvable.
create table risk_classification_definitions (
  id uuid primary key default gen_random_uuid(),
  action text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Immutable once published, exactly mirroring policy_versions above.
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

create index policy_versions_definition_id_idx on policy_versions (policy_definition_id);
create index policy_versions_status_idx on policy_versions (status);
create index risk_classification_versions_definition_id_idx on risk_classification_versions (risk_classification_definition_id);
create index risk_classification_versions_status_idx on risk_classification_versions (status);

alter table policy_definitions enable row level security;
alter table policy_versions enable row level security;
alter table risk_classification_definitions enable row level security;
alter table risk_classification_versions enable row level security;

-- Read-only for tenant users; no insert/update/delete policy exists for any
-- of these four tables, so the `authenticated` role can never write to the
-- platform catalog regardless of tenant permissions held — platform writes
-- happen through a trusted owner/service-role connection (the seeding
-- functions), the same integrity pattern already used for the agent and
-- workflow platform catalogs.

create policy policy_definitions_select_authenticated on policy_definitions
  for select using (auth.uid() is not null);

create policy policy_versions_select_published on policy_versions
  for select using (auth.uid() is not null and status = 'published');

create policy risk_classification_definitions_select_authenticated on risk_classification_definitions
  for select using (auth.uid() is not null);

create policy risk_classification_versions_select_published on risk_classification_versions
  for select using (auth.uid() is not null and status = 'published');
