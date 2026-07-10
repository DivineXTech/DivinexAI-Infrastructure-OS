-- FlowraMarket Africa — 0002: platform lookup and configuration tables

create table public.currencies (
  code text primary key check (code ~ '^[A-Z]{3}$'),
  name text not null,
  minor_unit_exponent smallint not null default 2 check (minor_unit_exponent between 0 and 4),
  is_active boolean not null default true
);

create table public.countries (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name text not null,
  default_currency_code text references public.currencies (code),
  is_launch_market boolean not null default false,
  is_active boolean not null default true,
  sort_order smallint not null default 100
);

create table public.payment_provider_configs (
  id uuid primary key default gen_random_uuid(),
  provider app.payment_provider not null,
  country_code text references public.countries (code),
  is_enabled boolean not null default false,
  is_live_mode boolean not null default false,
  display_name text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, country_code)
);

create trigger set_updated_at
  before update on public.payment_provider_configs
  for each row execute function app.set_updated_at();

create table public.platform_fee_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  product_type app.product_type,
  country_code text references public.countries (code),
  plan_code text,
  percentage_bps integer not null default 0 check (percentage_bps between 0 and 10000),
  fixed_fee_minor integer not null default 0 check (fixed_fee_minor >= 0),
  currency_code text not null references public.currencies (code) default 'USD',
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.platform_fee_rules
  for each row execute function app.set_updated_at();

create table public.platform_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  monthly_price_minor integer not null default 0 check (monthly_price_minor >= 0),
  annual_price_minor integer not null default 0 check (annual_price_minor >= 0),
  currency_code text not null references public.currencies (code) default 'USD',
  max_active_products integer,
  default_transaction_fee_bps integer not null default 900 check (default_transaction_fee_bps between 0 and 10000),
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order smallint not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.platform_plans
  for each row execute function app.set_updated_at();

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.feature_flags (
  key text primary key,
  is_enabled boolean not null default false,
  description text,
  rollout jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  parent_id uuid references public.product_categories (id) on delete set null,
  sort_order smallint not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.product_categories
  for each row execute function app.set_updated_at();

create table public.product_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- Lookup tables are readable by anyone (anon + authenticated); writes are
-- restricted to service role / admin surfaces only.
alter table public.currencies enable row level security;
alter table public.countries enable row level security;
alter table public.payment_provider_configs enable row level security;
alter table public.platform_fee_rules enable row level security;
alter table public.platform_plans enable row level security;
alter table public.platform_settings enable row level security;
alter table public.feature_flags enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_tags enable row level security;

create policy "currencies_read_all" on public.currencies for select using (true);
create policy "countries_read_all" on public.countries for select using (true);
create policy "payment_provider_configs_read_all" on public.payment_provider_configs for select using (is_enabled);
create policy "platform_plans_read_all" on public.platform_plans for select using (is_active);
create policy "feature_flags_read_all" on public.feature_flags for select using (true);
create policy "product_categories_read_all" on public.product_categories for select using (is_active);
create policy "product_tags_read_all" on public.product_tags for select using (true);
-- platform_fee_rules and platform_settings are intentionally not readable by
-- anon/authenticated roles: fee logic is resolved server-side with the
-- service role so raw fee configuration is never exposed to the browser.
