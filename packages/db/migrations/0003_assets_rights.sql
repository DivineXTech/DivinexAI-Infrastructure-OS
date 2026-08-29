create table assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  creator_id uuid not null references creator_profiles (id) on delete cascade,
  type text not null check (type in ('MUSIC_TRACK', 'VIDEO', 'SHORT_FORM_VIDEO', 'PODCAST_EPISODE', 'IMAGE', 'LICENSE_BUNDLE')),
  title text not null check (char_length(title) between 1 and 300),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'RIGHTS_PENDING', 'PUBLISHED', 'TAKEN_DOWN')),
  source text not null check (source in ('AI_GENERATED', 'UPLOADED', 'HYBRID')),
  storage_path text,
  duration_seconds numeric,
  provenance jsonb not null default '[]'::jsonb,
  territories text[] not null default array['WORLDWIDE'],
  commercial_use_authorized boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index assets_organization_id_idx on assets (organization_id);
create index assets_workspace_id_idx on assets (workspace_id);
create index assets_creator_id_idx on assets (creator_id);
create index assets_status_idx on assets (status);

create table contributors (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid,
  display_name text not null check (char_length(display_name) between 1 and 200),
  role text not null check (role in ('PRIMARY_ARTIST', 'FEATURED_ARTIST', 'PRODUCER', 'WRITER', 'COMPOSER', 'PERFORMER', 'EDITOR', 'OTHER')),
  revenue_split_bps int not null check (revenue_split_bps between 0 and 10000),
  created_at timestamptz not null default now()
);

create index contributors_asset_id_idx on contributors (asset_id);
create index contributors_organization_id_idx on contributors (organization_id);

create table rights_declarations (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  rights_type text not null check (rights_type in ('MASTER', 'PUBLISHING')),
  owner_user_id uuid not null,
  ownership_pct numeric not null check (ownership_pct >= 0 and ownership_pct <= 100),
  created_at timestamptz not null default now()
);

create index rights_declarations_asset_id_idx on rights_declarations (asset_id);
create index rights_declarations_organization_id_idx on rights_declarations (organization_id);

create table license_grants (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  license_type text not null check (license_type in ('SYNC', 'COVER', 'SAMPLE', 'DISTRIBUTION', 'CUSTOM')),
  licensee_name text not null check (char_length(licensee_name) between 1 and 200),
  territories text[] not null default array['WORLDWIDE'],
  commercial_use boolean not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create index license_grants_asset_id_idx on license_grants (asset_id);
create index license_grants_organization_id_idx on license_grants (organization_id);

-- Explicit, revocable consent from the person whose voice or likeness is
-- used. Required before any AI job may clone/synthesize that subject;
-- enforced in application code via @divinexai/rights and re-checked here
-- structurally (revoked_at, scope) for auditability.
create table consent_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  subject_type text not null check (subject_type in ('VOICE', 'LIKENESS')),
  subject_user_id uuid not null,
  granted_by_user_id uuid not null,
  scope text not null check (scope in ('ORGANIZATION_ONLY', 'SPECIFIC_ASSETS')),
  asset_id_scope uuid[] not null default array[]::uuid[],
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index consent_records_organization_id_idx on consent_records (organization_id);
create index consent_records_subject_user_id_idx on consent_records (subject_user_id);
