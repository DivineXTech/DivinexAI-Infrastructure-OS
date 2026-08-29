create table ai_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  creator_id uuid not null references creator_profiles (id) on delete cascade,
  capability text not null check (capability in ('TEXT_TO_MUSIC', 'TEXT_TO_VIDEO', 'IMAGE_TO_VIDEO', 'TEXT_TO_IMAGE', 'VOICE', 'DUBBING', 'LYRICS', 'SCRIPT', 'THUMBNAIL', 'SHORT_FORM_VIDEO')),
  provider_id text not null,
  status text not null default 'QUEUED' check (status in ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'REJECTED_CONSENT')),
  input_prompt text,
  source_asset_ids uuid[] not null default array[]::uuid[],
  voice_subject_user_id uuid,
  likeness_subject_user_id uuid,
  credit_cost numeric not null check (credit_cost >= 0),
  provider_cost_minor_units bigint,
  output_asset_id uuid references assets (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index ai_jobs_organization_id_idx on ai_jobs (organization_id);
create index ai_jobs_creator_id_idx on ai_jobs (creator_id);

-- AI credit balance ledger. Writes only via the service role (the AI
-- gateway reserves/refunds credits server-side); creators can read their
-- own organization's balance history.
create table ai_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  ai_job_id uuid references ai_jobs (id) on delete set null,
  delta numeric not null,
  reason text not null check (reason in ('GRANT', 'CONSUMPTION', 'REFUND')),
  created_at timestamptz not null default now()
);

create index ai_credit_ledger_organization_id_idx on ai_credit_ledger (organization_id);
