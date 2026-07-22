-- DivinexAI BookOS Launch Engine — initial schema
-- Table: subscribers (the pre-launch waitlist for The Billionaire Blueprint 2.0)
--
-- Security model: Row-Level Security is enabled with NO policies defined.
-- This locks the table to the Postgres `service_role` only (which bypasses
-- RLS by design in Supabase). All reads/writes happen server-side through
-- API routes using SUPABASE_SERVICE_ROLE_KEY — never from the browser with
-- the anon key. This is intentional: subscriber PII (email, phone) should
-- never be queryable directly from client code.

create extension if not exists "pgcrypto";

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),

  first_name text not null,
  last_name text,
  email text not null,
  phone text,
  country text,

  marketing_consent boolean not null default false,
  terms_accepted boolean not null default false,
  accepted_early_access_terms_at timestamptz not null default now(),

  referral_code text not null,
  referred_by text,

  social_follow_confirmed boolean not null default false,
  social_like_confirmed boolean not null default false,
  social_share_confirmed boolean not null default false,

  chapter12_accessed_at timestamptz,

  unsubscribed boolean not null default false,
  unsubscribed_at timestamptz,

  source text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint subscribers_email_unique unique (email),
  constraint subscribers_referral_code_unique unique (referral_code)
);

create index if not exists subscribers_referred_by_idx on public.subscribers (referred_by);
create index if not exists subscribers_created_at_idx on public.subscribers (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscribers_set_updated_at on public.subscribers;
create trigger subscribers_set_updated_at
  before update on public.subscribers
  for each row
  execute function public.set_updated_at();

alter table public.subscribers enable row level security;

-- No policies are created here on purpose. With RLS enabled and zero
-- policies, anon/authenticated roles get zero rows; only service_role
-- (which bypasses RLS) can read or write. If you later add an admin
-- dashboard authenticated via Supabase Auth, add explicit SELECT policies
-- scoped to an `is_admin` claim rather than opening this table broadly.

comment on table public.subscribers is
  'Pre-launch waitlist subscribers for DivinexAI BookOS launch campaigns. Service-role access only — see RLS note above.';
