-- KushPrintCo OS — Phase 1 foundation schema.
-- Tables: profiles, tenants, tenant_memberships, roles, permissions,
-- role_permissions, audit_logs. Every tenant-owned table carries tenant_id
-- and default-deny RLS; policies are added at the end of this file.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: one row per authenticated Supabase user (auth.users is 1:1).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  is_platform_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per Supabase auth user; platform-wide identity, not tenant-scoped.';
comment on column public.profiles.is_platform_super_admin is 'Grants cross-tenant Platform Super Admin access. Set only via trusted server-side tooling.';

-- ---------------------------------------------------------------------------
-- tenants: one row per KushPrintCo OS tenant/operator (white-label unit).
-- ---------------------------------------------------------------------------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.tenants is 'A KushPrintCo OS tenant (e.g. KushPrintCo itself, or a white-label operator).';
create index if not exists tenants_slug_idx on public.tenants (slug) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- roles / permissions: platform-defined RBAC, not tenant-editable in Phase 1.
-- ---------------------------------------------------------------------------
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

comment on table public.roles is 'Platform-defined roles: super_admin, tenant_owner, tenant_admin, production_manager, designer, sales_rep, support_agent, fulfillment_operator, customer.';

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

-- ---------------------------------------------------------------------------
-- tenant_memberships: links a profile to a tenant with a role. This is the
-- join table every RLS policy below uses to establish tenant access.
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'invited', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, profile_id)
);

comment on table public.tenant_memberships is 'A user''s membership, role, and status within a single tenant.';
create index if not exists tenant_memberships_tenant_id_idx on public.tenant_memberships (tenant_id);
create index if not exists tenant_memberships_profile_id_idx on public.tenant_memberships (profile_id);

-- ---------------------------------------------------------------------------
-- audit_logs: append-only privileged-action trail. Tenant-scoped; nullable
-- tenant_id is reserved for platform-level (cross-tenant) admin actions.
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is 'Append-only log of privileged actions. Insert-only from application code; never updated or deleted by tenant users.';
create index if not exists audit_logs_tenant_id_idx on public.audit_logs (tenant_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Auto-create a profile row whenever a new Supabase auth user is created.
-- Runs as security definer because auth.users triggers cannot rely on the
-- new user's own RLS context yet.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.tenants;
create trigger set_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.tenant_memberships;
create trigger set_updated_at before update on public.tenant_memberships
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helper functions used by RLS policies (security definer, minimal surface).
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_platform_super_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_tenant_member(check_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = check_tenant_id
      and tm.profile_id = auth.uid()
      and tm.status = 'active'
  );
$$;

create or replace function public.has_tenant_role(check_tenant_id uuid, allowed_role_keys text[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    join public.roles r on r.id = tm.role_id
    where tm.tenant_id = check_tenant_id
      and tm.profile_id = auth.uid()
      and tm.status = 'active'
      and r.key = any (allowed_role_keys)
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security: default-deny. Enable + FORCE on every table, then add
-- narrow allow policies. No table is left with RLS disabled.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

alter table public.tenants enable row level security;
alter table public.tenants force row level security;

alter table public.roles enable row level security;
alter table public.roles force row level security;

alter table public.permissions enable row level security;
alter table public.permissions force row level security;

alter table public.role_permissions enable row level security;
alter table public.role_permissions force row level security;

alter table public.tenant_memberships enable row level security;
alter table public.tenant_memberships force row level security;

alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

-- Every policy below is preceded by `drop policy if exists` so this
-- migration can be safely re-run against a database that already has it
-- applied (see docs/MIGRATION_VALIDATION.md) — Postgres has no
-- `create policy if not exists`.

-- profiles: a user can read/update their own profile; super admins read all.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or public.is_platform_super_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());

-- tenants: readable by members of that tenant, or platform super admins.
drop policy if exists tenants_select_member on public.tenants;
create policy tenants_select_member on public.tenants
  for select using (
    public.is_tenant_member(id) or public.is_platform_super_admin()
  );

drop policy if exists tenants_update_owner_admin on public.tenants;
create policy tenants_update_owner_admin on public.tenants
  for update using (
    public.has_tenant_role(id, array['tenant_owner']) or public.is_platform_super_admin()
  ) with check (
    public.has_tenant_role(id, array['tenant_owner']) or public.is_platform_super_admin()
  );

drop policy if exists tenants_insert_super_admin on public.tenants;
create policy tenants_insert_super_admin on public.tenants
  for insert with check (public.is_platform_super_admin());

-- roles / permissions: platform-defined reference data, readable by any
-- authenticated user, writable only by platform super admins.
drop policy if exists roles_select_authenticated on public.roles;
create policy roles_select_authenticated on public.roles
  for select using (auth.role() = 'authenticated');

drop policy if exists roles_write_super_admin on public.roles;
create policy roles_write_super_admin on public.roles
  for all using (public.is_platform_super_admin())
  with check (public.is_platform_super_admin());

drop policy if exists permissions_select_authenticated on public.permissions;
create policy permissions_select_authenticated on public.permissions
  for select using (auth.role() = 'authenticated');

drop policy if exists permissions_write_super_admin on public.permissions;
create policy permissions_write_super_admin on public.permissions
  for all using (public.is_platform_super_admin())
  with check (public.is_platform_super_admin());

drop policy if exists role_permissions_select_authenticated on public.role_permissions;
create policy role_permissions_select_authenticated on public.role_permissions
  for select using (auth.role() = 'authenticated');

drop policy if exists role_permissions_write_super_admin on public.role_permissions;
create policy role_permissions_write_super_admin on public.role_permissions
  for all using (public.is_platform_super_admin())
  with check (public.is_platform_super_admin());

-- tenant_memberships: a member can see other members of their own tenant(s);
-- only tenant owners/admins or super admins can write membership rows.
drop policy if exists tenant_memberships_select_member on public.tenant_memberships;
create policy tenant_memberships_select_member on public.tenant_memberships
  for select using (
    public.is_tenant_member(tenant_id) or public.is_platform_super_admin()
  );

drop policy if exists tenant_memberships_write_owner_admin on public.tenant_memberships;
create policy tenant_memberships_write_owner_admin on public.tenant_memberships
  for all using (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  ) with check (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  );

-- audit_logs: tenant owners/admins can read their tenant's log; super admins
-- read everything. Inserts happen only via server-side code (service role),
-- so there is no authenticated insert policy.
drop policy if exists audit_logs_select_owner_admin on public.audit_logs;
create policy audit_logs_select_owner_admin on public.audit_logs
  for select using (
    (tenant_id is not null and public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin']))
    or public.is_platform_super_admin()
  );
