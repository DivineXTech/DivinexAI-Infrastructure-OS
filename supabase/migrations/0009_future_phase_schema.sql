-- FlowraMarket Africa — 0009: schema for Phase 2/3 domains
--
-- These tables exist so later phases (reviews & trust, subscribers/email,
-- affiliates, courses, memberships, AI Studio, platform subscriptions) can
-- be built without a disruptive schema migration. No application code in
-- Phase 1 reads or writes these tables, and no UI surface links to them —
-- RLS defaults to admin/service-role-only until each domain is implemented.

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id),
  buyer_id uuid not null references public.profiles (id),
  rating smallint not null check (rating between 1 and 5),
  review_text text,
  moderation_status app.moderation_status not null default 'pending',
  creator_response text,
  helpful_votes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_item_id)
);

create table public.review_votes (
  review_id uuid not null references public.reviews (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  is_helpful boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (review_id, voter_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id),
  target_type text not null check (target_type in ('product', 'creator', 'review')),
  target_id uuid not null,
  reason text not null,
  details text,
  status app.moderation_status not null default 'pending',
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles (id),
  order_id uuid references public.orders (id),
  subject text not null,
  status text not null default 'open' check (status in ('open', 'pending', 'resolved', 'closed')),
  assigned_to uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscribers (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_accounts (id) on delete cascade,
  email citext not null,
  source text,
  tags text[] not null default '{}',
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (creator_id, email)
);

create table public.subscriber_consents (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers (id) on delete cascade,
  consent_source text not null,
  consented_at timestamptz not null default now()
);

create table public.affiliate_programs (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_accounts (id) on delete cascade,
  product_id uuid references public.products (id),
  commission_type text not null default 'percentage' check (commission_type in ('percentage', 'fixed')),
  commission_value integer not null default 0,
  attribution_window_days integer not null default 30,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.affiliates (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.affiliate_programs (id) on delete cascade,
  affiliate_user_id uuid not null references public.profiles (id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  created_at timestamptz not null default now(),
  unique (program_id, affiliate_user_id)
);

create table public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_link_id uuid not null references public.affiliate_links (id) on delete cascade,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.affiliate_attributions (
  id uuid primary key default gen_random_uuid(),
  affiliate_link_id uuid not null references public.affiliate_links (id),
  buyer_id uuid references public.profiles (id),
  order_id uuid references public.orders (id),
  attributed_at timestamptz not null default now()
);

create table public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates (id),
  order_id uuid not null references public.orders (id),
  amount_minor integer not null check (amount_minor >= 0),
  currency_code text not null references public.currencies (code),
  status text not null default 'pending' check (status in ('pending', 'approved', 'locked', 'payable', 'paid', 'reversed', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.courses (
  product_id uuid primary key references public.products (id) on delete cascade
);

create table public.course_sections (
  id uuid primary key default gen_random_uuid(),
  course_product_id uuid not null references public.courses (product_id) on delete cascade,
  title text not null,
  sort_order smallint not null default 100
);

create table public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.course_sections (id) on delete cascade,
  title text not null,
  lesson_type text not null default 'video' check (lesson_type in ('video', 'text', 'download', 'external')),
  content_url text,
  content_text text,
  sort_order smallint not null default 100
);

create table public.course_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.course_lessons (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (lesson_id, buyer_id)
);

create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly', 'annual')),
  price_minor integer not null check (price_minor >= 0),
  currency_code text not null references public.currencies (code)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  membership_plan_id uuid not null references public.membership_plans (id),
  buyer_id uuid not null references public.profiles (id),
  status text not null default 'active' check (status in ('active', 'grace_period', 'cancelled', 'expired')),
  started_at timestamptz not null default now(),
  renews_at timestamptz,
  cancelled_at timestamptz
);

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creator_accounts (id),
  requested_by uuid references public.profiles (id),
  tool text not null,
  provider text not null default 'mock',
  prompt_tokens integer,
  completion_tokens integer,
  status text not null default 'succeeded' check (status in ('succeeded', 'failed')),
  applied boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.ai_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_accounts (id) on delete cascade,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.platform_subscriptions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_accounts (id) on delete cascade,
  plan_code text not null references public.platform_plans (code),
  status text not null default 'active' check (status in ('active', 'past_due', 'cancelled')),
  started_at timestamptz not null default now(),
  renews_at timestamptz,
  cancelled_at timestamptz
);

-- RLS: locked to admin/service-role by default since no Phase 1 UI reads or
-- writes these tables yet.
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'reviews','review_votes','reports','support_tickets','subscribers','subscriber_consents',
      'affiliate_programs','affiliates','affiliate_links','affiliate_clicks','affiliate_attributions','affiliate_commissions',
      'courses','course_sections','course_lessons','course_lesson_progress',
      'membership_plans','subscriptions','ai_generations','ai_credit_ledger','platform_subscriptions'
    ])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%I_admin_only" on public.%I for all using (public.is_platform_admin()) with check (public.is_platform_admin())', t, t);
  end loop;
end $$;
