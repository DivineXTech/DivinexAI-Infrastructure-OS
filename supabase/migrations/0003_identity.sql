-- FlowraMarket Africa — 0003: identity, profiles, and role-based access

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext unique,
  display_name text,
  avatar_url text,
  country_code text references public.countries (code),
  preferred_currency_code text references public.currencies (code),
  preferred_language text not null default 'en',
  account_purpose text check (account_purpose in ('buy', 'sell', 'both')),
  onboarding_step text not null default 'purpose',
  onboarding_completed_at timestamptz,
  is_suspended boolean not null default false,
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username is null or username ~ '^[a-z0-9][a-z0-9-]{2,29}$')
);

create trigger set_updated_at
  before update on public.profiles
  for each row execute function app.set_updated_at();

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role app.platform_role not null,
  granted_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- Helper functions used throughout RLS policies -------------------------------
create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function public.has_platform_role(check_role app.platform_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = check_role
  );
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role in ('super_admin', 'marketplace_admin', 'moderator', 'support_agent', 'finance_admin')
  );
$$;

-- Auto-provision a profile row whenever a new auth user is created.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'buyer')
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create policy "profiles_read_public" on public.profiles
  for select using (true);

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles_admin_manage" on public.profiles
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "user_roles_read_own" on public.user_roles
  for select using (user_id = auth.uid() or public.is_platform_admin());

create policy "user_roles_admin_manage" on public.user_roles
  for insert with check (public.is_platform_admin());

create policy "user_roles_admin_delete" on public.user_roles
  for delete using (public.is_platform_admin());
