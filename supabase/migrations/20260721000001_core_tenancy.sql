-- AgentFlow Pro v2 — Phase 1: core tenancy
--
-- Assumes a Supabase project: the `auth` schema, `auth.users`, and `auth.uid()`
-- already exist and are managed by Supabase Auth — this migration only reads
-- them, never redefines them. For running this same file against a plain
-- (non-Supabase) local Postgres in tests, see
-- `packages/shared/test/sql/000_local_auth_shim.sql`, which provides a
-- test-only stand-in for `auth.uid()`/`auth.users` and must never be applied
-- to a real Supabase project.

create extension if not exists pgcrypto;

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- tenant_id null = a platform-level role shared across all tenants (e.g. a
-- future "platform_admin"). Tenant-scoped roles are unique per (tenant, key).
create table roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants (id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, key)
);

-- Global permission catalog. Not tenant-owned; there is exactly one set of
-- permission keys the whole platform understands.
create table permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  category text
);

create table role_permissions (
  role_id uuid not null references roles (id) on delete cascade,
  permission_id uuid not null references permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null references roles (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'invited', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table tenant_settings (
  tenant_id uuid primary key references tenants (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- tenant_id null = a platform-wide default flag value, overridden per tenant
-- by a row with the same key and a concrete tenant_id.
create table tenant_feature_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants (id) on delete cascade,
  key text not null,
  enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create index tenant_memberships_user_id_idx on tenant_memberships (user_id);
create index roles_tenant_id_idx on roles (tenant_id);
create index tenant_feature_flags_tenant_id_idx on tenant_feature_flags (tenant_id);

-- ---------------------------------------------------------------------------
-- RLS helper functions
--
-- security definer so they can read tenant_memberships/role_permissions on
-- the caller's behalf even though RLS is enabled on those tables too — without
-- this, a policy on tenant_memberships that calls is_tenant_member() would
-- recurse into RLS on tenant_memberships again. search_path is pinned
-- explicitly (search-path hijacking is a known security-definer pitfall).
-- ---------------------------------------------------------------------------

create or replace function is_tenant_member(check_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from tenant_memberships m
    where m.tenant_id = check_tenant_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function tenant_has_permission(check_tenant_id uuid, perm_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from tenant_memberships m
    join role_permissions rp on rp.role_id = m.role_id
    join permissions p on p.id = rp.permission_id
    where m.tenant_id = check_tenant_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and p.key = perm_key
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security — deny by default, explicit allow policies only.
-- ---------------------------------------------------------------------------

alter table tenants enable row level security;
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table tenant_memberships enable row level security;
alter table tenant_settings enable row level security;
alter table tenant_feature_flags enable row level security;

create policy tenants_select_member on tenants
  for select using (is_tenant_member(id));

create policy tenants_update_admin on tenants
  for update using (tenant_has_permission(id, 'tenant.manage'))
  with check (tenant_has_permission(id, 'tenant.manage'));

create policy memberships_select_member on tenant_memberships
  for select using (is_tenant_member(tenant_id));

create policy memberships_write_admin on tenant_memberships
  for all using (tenant_has_permission(tenant_id, 'tenant.manage_members'))
  with check (tenant_has_permission(tenant_id, 'tenant.manage_members'));

-- tenant_id is null for platform-level roles, visible to any authenticated
-- user; tenant-scoped roles are visible only to that tenant's members.
create policy roles_select on roles
  for select using (tenant_id is null or is_tenant_member(tenant_id));

create policy roles_write_admin on roles
  for all using (tenant_id is not null and tenant_has_permission(tenant_id, 'tenant.manage_roles'))
  with check (tenant_id is not null and tenant_has_permission(tenant_id, 'tenant.manage_roles'));

-- Global catalog: readable by any authenticated user, never writable via the
-- API (no insert/update/delete policy — default deny covers those).
create policy permissions_select_authenticated on permissions
  for select using (auth.uid() is not null);

create policy role_permissions_select on role_permissions
  for select using (
    exists (
      select 1
      from roles r
      where r.id = role_permissions.role_id
        and (r.tenant_id is null or is_tenant_member(r.tenant_id))
    )
  );

create policy tenant_settings_select_member on tenant_settings
  for select using (is_tenant_member(tenant_id));

create policy tenant_settings_write_admin on tenant_settings
  for all using (tenant_has_permission(tenant_id, 'tenant.manage'))
  with check (tenant_has_permission(tenant_id, 'tenant.manage'));

create policy feature_flags_select on tenant_feature_flags
  for select using (tenant_id is null or is_tenant_member(tenant_id));

create policy feature_flags_write_admin on tenant_feature_flags
  for all using (tenant_id is not null and tenant_has_permission(tenant_id, 'tenant.manage'))
  with check (tenant_id is not null and tenant_has_permission(tenant_id, 'tenant.manage'));
