create table creator_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  user_id uuid not null,
  display_name text not null check (char_length(display_name) between 1 and 120),
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,40}$'),
  onboarding_step text not null default 'ACCOUNT_CREATED'
    check (onboarding_step in ('ACCOUNT_CREATED', 'PROFILE_COMPLETED', 'PAYOUT_ACCOUNT_LINKED', 'RIGHTS_ACKNOWLEDGED', 'COMPLETED')),
  flowra_pay_account_id text,
  created_at timestamptz not null default now()
);

create index creator_profiles_organization_id_idx on creator_profiles (organization_id);
create index creator_profiles_user_id_idx on creator_profiles (user_id);

-- Fan identities are platform-wide (a fan can follow/purchase from many
-- creators across many organizations), so this table is NOT tenant-owned.
-- Access is restricted to the fan's own row; anything a creator needs to
-- see about a fan (display name, purchase history) is denormalized onto
-- the tenant-owned orders/memberships rows at the time of the transaction.
create table fan_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  display_name text not null check (char_length(display_name) between 1 and 120),
  created_at timestamptz not null default now()
);
