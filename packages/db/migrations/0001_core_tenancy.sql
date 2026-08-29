-- Core multi-tenant boundary: organizations, workspaces, and membership.
-- Every other tenant-owned table keys off organization_id (and usually
-- workspace_id) and is locked down by the RLS policies in
-- 0009_rls_policies.sql.

create schema if not exists app;

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  plan_tier text not null default 'FREE' check (plan_tier in ('FREE', 'PRO', 'BUSINESS', 'STUDIO', 'ENTERPRISE')),
  created_at timestamptz not null default now()
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now()
);

create index workspaces_organization_id_idx on workspaces (organization_id);

create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('OWNER', 'ADMIN', 'CONTRIBUTOR', 'VIEWER')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_members_user_id_idx on organization_members (user_id);

-- Returns the set of organization ids the currently authenticated user
-- belongs to. SECURITY DEFINER so it can read organization_members despite
-- that table's own RLS policies (auth.uid() is fixed server-side and cannot
-- be spoofed by the caller, so this does not leak cross-tenant access).
create or replace function app.current_org_ids() returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from organization_members where user_id = auth.uid()
$$;

create or replace function app.is_org_admin(org_id uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organization_members
    where organization_id = org_id and user_id = auth.uid() and role in ('OWNER', 'ADMIN')
  )
$$;

grant usage on schema app to anon, authenticated;
grant execute on function app.current_org_ids() to anon, authenticated;
grant execute on function app.is_org_admin(uuid) to anon, authenticated;
