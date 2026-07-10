-- Local-only compatibility shim that emulates just enough of Supabase's
-- `auth` and `storage` schemas to let `supabase/migrations/*.sql` be
-- applied and exercised against a plain local PostgreSQL instance.
--
-- NEVER run this against a real Supabase project — Supabase already
-- provides real, complete `auth` and `storage` schemas, and this shim's
-- objects would conflict with them.
--
-- Usage: psql "$DATABASE_URL" -f scripts/local-dev-auth-shim.sql
--        (run BEFORE applying supabase/migrations/*.sql)

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- In real Supabase, auth.uid() reads the JWT claim of the current request.
-- Locally, tests/scripts set it per-session with:
--   select set_config('request.jwt.claim.sub', '<uuid>', true);
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now()
);

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select string_to_array(name, '/');
$$;
