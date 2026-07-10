-- FlowraMarket Africa — 0004: creator accounts, team members, verification

create table public.creator_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  business_type text check (business_type in ('individual', 'registered_business', 'agency', 'institution')),
  plan_code text not null default 'starter' references public.platform_plans (code),
  country_code text references public.countries (code),
  support_email citext,
  is_suspended boolean not null default false,
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.creator_accounts
  for each row execute function app.set_updated_at();

create table public.creator_members (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_accounts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role app.creator_member_role not null default 'owner',
  invited_by uuid references public.profiles (id),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (creator_id, user_id)
);

create table public.seller_verifications (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_accounts (id) on delete cascade,
  status app.verification_status not null default 'not_started',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  rejection_reason text,
  documents jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.seller_verifications
  for each row execute function app.set_updated_at();

-- Helper functions --------------------------------------------------------
create or replace function public.is_creator_member(target_creator_id uuid, allowed_roles app.creator_member_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.creator_members cm
    where cm.creator_id = target_creator_id
      and cm.user_id = auth.uid()
      and cm.accepted_at is not null
      and (allowed_roles is null or cm.role = any(allowed_roles))
  );
$$;

alter table public.creator_accounts enable row level security;
alter table public.creator_members enable row level security;
alter table public.seller_verifications enable row level security;

-- owner_id = auth.uid() is included (not just is_creator_member()) because
-- the owning creator_members row is only inserted by an AFTER INSERT
-- trigger, and Postgres evaluates the RETURNING clause's SELECT policy
-- before that trigger's effects are visible in the same statement.
create policy "creator_accounts_read_members" on public.creator_accounts
  for select using (owner_id = auth.uid() or public.is_creator_member(id) or public.is_platform_admin());

create policy "creator_accounts_insert_owner" on public.creator_accounts
  for insert with check (owner_id = auth.uid());

create policy "creator_accounts_update_managers" on public.creator_accounts
  for update using (public.is_creator_member(id, array['owner','administrator']::app.creator_member_role[]) or public.is_platform_admin())
  with check (public.is_creator_member(id, array['owner','administrator']::app.creator_member_role[]) or public.is_platform_admin());

create policy "creator_members_read" on public.creator_members
  for select using (public.is_creator_member(creator_id) or public.is_platform_admin());

create policy "creator_members_manage" on public.creator_members
  for all using (public.is_creator_member(creator_id, array['owner','administrator']::app.creator_member_role[]) or public.is_platform_admin())
  with check (public.is_creator_member(creator_id, array['owner','administrator']::app.creator_member_role[]) or public.is_platform_admin());

create policy "seller_verifications_read" on public.seller_verifications
  for select using (public.is_creator_member(creator_id) or public.is_platform_admin());

create policy "seller_verifications_owner_submit" on public.seller_verifications
  for insert with check (public.is_creator_member(creator_id, array['owner','administrator']::app.creator_member_role[]));

create policy "seller_verifications_admin_review" on public.seller_verifications
  for update using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Automatically add the creator's owner as an accepted "owner" team member.
create or replace function public.handle_new_creator_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.creator_members (creator_id, user_id, role, accepted_at)
  values (new.id, new.owner_id, 'owner', now());

  insert into public.user_roles (user_id, role)
  values (new.owner_id, 'creator')
  on conflict do nothing;

  insert into public.seller_verifications (creator_id, status)
  values (new.id, 'not_started');

  return new;
end;
$$;

create trigger on_creator_account_created
  after insert on public.creator_accounts
  for each row execute function public.handle_new_creator_account();
