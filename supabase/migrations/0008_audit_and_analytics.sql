-- FlowraMarket Africa — 0008: audit logging, analytics, and notifications

-- Every material admin/mutating action of consequence writes one row here.
-- Rows are append-only: no update or delete policy is defined for anyone.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  actor_id uuid references public.profiles (id),
  creator_id uuid references public.creator_accounts (id),
  product_id uuid references public.products (id),
  session_id text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index analytics_events_name_idx on public.analytics_events (event_name, created_at desc);
create index analytics_events_creator_idx on public.analytics_events (creator_id, created_at desc);
create index analytics_events_product_idx on public.analytics_events (product_id, created_at desc);

create table public.daily_analytics_rollups (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creator_accounts (id),
  product_id uuid references public.products (id),
  day date not null,
  store_visits integer not null default 0,
  product_views integer not null default 0,
  checkout_starts integer not null default 0,
  orders_count integer not null default 0,
  gross_sales_minor bigint not null default 0,
  refunds_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (creator_id, product_id, day)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null,
  title text not null,
  body text,
  link_url text,
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, is_read, created_at desc);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  marketing_emails_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;
alter table public.analytics_events enable row level security;
alter table public.daily_analytics_rollups enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

create policy "audit_logs_admin_read" on public.audit_logs
  for select using (public.is_platform_admin());

create policy "analytics_events_creator_read" on public.analytics_events
  for select using (
    (creator_id is not null and public.is_creator_member(creator_id, array['owner','administrator','analyst','marketing_manager']::app.creator_member_role[]))
    or public.is_platform_admin()
  );

create policy "daily_analytics_rollups_read" on public.daily_analytics_rollups
  for select using (
    (creator_id is not null and public.is_creator_member(creator_id, array['owner','administrator','analyst','marketing_manager']::app.creator_member_role[]))
    or public.is_platform_admin()
  );

create policy "notifications_read_own" on public.notifications
  for select using (recipient_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

create policy "notification_preferences_read_own" on public.notification_preferences
  for select using (user_id = auth.uid());

create policy "notification_preferences_update_own" on public.notification_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- audit_logs and analytics_events are written exclusively by server-side
-- services using the service role; no client-facing insert policy exists.
