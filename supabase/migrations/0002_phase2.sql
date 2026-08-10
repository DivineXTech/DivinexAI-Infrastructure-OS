-- Atlas AI Video Factory — Phase 2 schema additions.
-- Adds idea selection, scene/script storage, provider job tracking (with
-- cost and simulation flags), generated artifacts, and run-level cost +
-- simulation rollups needed for the end-to-end pipeline.

alter table runs
  add column if not exists selected_idea_id uuid references ideas (id),
  add column if not exists total_cost_usd numeric(10, 4) not null default 0,
  add column if not exists simulation_mode boolean not null default false;

alter table ideas
  add column if not exists selected boolean not null default false;

-- One row per scene in the Prompt Director Agent's scene plan: visual
-- prompt, voiceover line, caption text, and per-scene voice/music direction.
create table if not exists scenes (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs (id) on delete cascade,
  idea_id uuid not null references ideas (id),
  scene_order integer not null,
  duration_seconds numeric(6, 2) not null,
  visual_prompt text not null,
  voiceover_line text not null,
  caption_text text,
  voice_direction text,
  music_direction text,
  created_at timestamptz not null default now(),
  unique (run_id, scene_order)
);

create index if not exists scenes_run_id_idx on scenes (run_id);

-- Script-level metadata (title, total duration, overall music mood/direction)
-- that doesn't belong to any single scene.
create table if not exists scripts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs (id) on delete cascade unique,
  idea_id uuid not null references ideas (id),
  title text not null,
  total_duration_seconds numeric(6, 2) not null,
  music_mood text not null,
  music_direction text,
  created_at timestamptz not null default now()
);

-- One row per external job submitted to a video/music/voice/publishing
-- provider. Tracks the provider's own job id (for idempotent webhook/poll
-- correlation), cost, and whether the job ran against a real vendor or a
-- deterministic mock (`simulated`).
create table if not exists provider_jobs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs (id) on delete cascade,
  scene_id uuid references scenes (id),
  capability text not null check (capability in ('video', 'voice', 'music', 'publishing')),
  provider_name text not null,
  external_job_id text not null,
  status text not null
    check (status in ('queued', 'processing', 'completed', 'failed')),
  simulated boolean not null default false,
  cost_usd numeric(10, 4) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (capability, provider_name, external_job_id)
);

create index if not exists provider_jobs_run_id_idx on provider_jobs (run_id);

-- Every durable media artifact produced along the way (per-scene video clip,
-- narration track, music track, final assembled video, caption file).
create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs (id) on delete cascade,
  scene_id uuid references scenes (id),
  kind text not null
    check (kind in ('scene_video', 'narration', 'music', 'captions', 'final_video')),
  storage_path text not null,
  url text,
  simulated boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists artifacts_run_id_idx on artifacts (run_id);

-- One artifact of a given kind per (run, scene) for scene-scoped artifacts,
-- and one per (run, kind) for run-level artifacts (final_video, music) where
-- scene_id is null. Two partial indexes rather than one expression index so
-- Supabase's upsert(..., { onConflict }) can target each directly. Lets
-- every artifact-producing step upsert by natural key and stay idempotent
-- on Inngest step retries.
create unique index if not exists artifacts_scene_kind_idx
  on artifacts (run_id, scene_id, kind) where scene_id is not null;
create unique index if not exists artifacts_run_kind_idx
  on artifacts (run_id, kind) where scene_id is null;

alter table videos
  add column if not exists cost_usd numeric(10, 4) not null default 0,
  add column if not exists simulated boolean not null default false,
  add column if not exists publishing_provider_job_id uuid references provider_jobs (id);

create unique index if not exists videos_run_id_unique_idx on videos (run_id);

alter table scenes enable row level security;
alter table scripts enable row level security;
alter table provider_jobs enable row level security;
alter table artifacts enable row level security;

create policy "tenant members read own scenes" on scenes
  for select using (
    run_id in (select id from runs where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );

create policy "tenant members read own scripts" on scripts
  for select using (
    run_id in (select id from runs where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );

create policy "tenant members read own provider jobs" on provider_jobs
  for select using (
    run_id in (select id from runs where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );

create policy "tenant members read own artifacts" on artifacts
  for select using (
    run_id in (select id from runs where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );
