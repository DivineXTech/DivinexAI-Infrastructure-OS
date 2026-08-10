-- Atlas AI Video Factory — core schema.
-- Encodes the execution contract in src/types/contract.ts: idempotent runs,
-- per-step status tracking, and an append-only audit log.

create extension if not exists "pgcrypto";

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  require_approval_before_publish boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  graph_id text not null,
  graph_version text not null,
  tenant_id uuid not null references tenants (id),
  idempotency_key text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'waiting_approval', 'succeeded', 'failed', 'dead_letter')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, graph_id, idempotency_key)
);

create table if not exists steps (
  id text primary key,
  run_id uuid not null references runs (id) on delete cascade,
  node_id text not null,
  stage_id text not null,
  kind text not null,
  status text not null
    check (status in ('pending', 'running', 'retrying', 'succeeded', 'failed', 'dead_letter', 'skipped')),
  attempt integer not null default 1,
  idempotency_key text not null,
  started_at timestamptz,
  completed_at timestamptz,
  error jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists steps_run_id_idx on steps (run_id);

create table if not exists ideas (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs (id) on delete cascade,
  tenant_id uuid not null references tenants (id),
  title text not null,
  hook text not null,
  target_audience text not null,
  angle text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs (id) on delete cascade,
  tenant_id uuid not null references tenants (id),
  idea_id uuid references ideas (id),
  asset_url text,
  public_url text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

-- Append-only audit log: every state transition in the pipeline is recorded
-- here and rows are never updated or deleted (enforced by RLS below).
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs (id) on delete cascade,
  node_id text,
  actor text not null check (actor in ('system', 'agent', 'user')),
  actor_user_id uuid,
  action text not null,
  from_status text,
  to_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_run_id_idx on audit_log (run_id);

alter table tenants enable row level security;
alter table runs enable row level security;
alter table steps enable row level security;
alter table ideas enable row level security;
alter table videos enable row level security;
alter table audit_log enable row level security;

-- Service role (used only by server-side code, see src/lib/supabase/server.ts)
-- bypasses RLS by default; these policies scope authenticated tenant users
-- to their own tenant's rows and make audit_log append-only.
create policy "tenant members read own runs" on runs
  for select using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant members read own ideas" on ideas
  for select using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant members read own videos" on videos
  for select using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy "tenant members read own audit log" on audit_log
  for select using (
    run_id in (select id from runs where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );

create policy "audit log is insert-only" on audit_log
  for insert with check (true);
