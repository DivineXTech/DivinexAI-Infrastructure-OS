-- TEST-ONLY shim. Never apply this to a real Supabase project — Supabase
-- Auth already provides `auth.users` and `auth.uid()`; this file exists so
-- the real migration (`supabase/migrations/20260721000001_core_tenancy.sql`)
-- can be exercised against a plain local Postgres instance in tests without
-- running the full Supabase stack.
--
-- `auth.uid()` here reproduces Supabase's actual implementation: it reads a
-- per-session Postgres setting (`request.jwt.claim.sub`) that PostgREST sets
-- from the caller's JWT on every request. Tests set the same setting via
-- `select set_config('request.jwt.claim.sub', $1, false)` to simulate
-- "requests" from a given authenticated user.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
