-- FlowraMarket Africa — 0007: checkout, orders, payments, entitlements, coupons

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_accounts (id) on delete cascade,
  code citext not null,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value integer not null check (discount_value > 0),
  currency_code text references public.currencies (code),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemption_count integer not null default 0,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id, code),
  constraint percentage_bounds check (discount_type <> 'percentage' or discount_value <= 100)
);

create trigger set_updated_at
  before update on public.coupons
  for each row execute function app.set_updated_at();

create table public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.profiles (id),
  buyer_email citext not null,
  product_id uuid not null references public.products (id),
  creator_id uuid not null references public.creator_accounts (id),
  coupon_id uuid references public.coupons (id),
  affiliate_link_code text,
  pwyw_amount_minor integer,
  currency_code text not null references public.currencies (code),
  subtotal_minor integer not null,
  discount_minor integer not null default 0,
  platform_fee_minor integer not null default 0,
  tax_minor integer not null default 0,
  total_minor integer not null,
  status text not null default 'open' check (status in ('open', 'completed', 'expired', 'cancelled')),
  completed_order_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes')
);

create index checkout_sessions_buyer_idx on public.checkout_sessions (buyer_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  checkout_session_id uuid references public.checkout_sessions (id),
  buyer_id uuid references public.profiles (id),
  buyer_email citext not null,
  creator_id uuid not null references public.creator_accounts (id),
  currency_code text not null references public.currencies (code),
  subtotal_minor integer not null check (subtotal_minor >= 0),
  discount_minor integer not null default 0 check (discount_minor >= 0),
  platform_fee_minor integer not null default 0 check (platform_fee_minor >= 0),
  tax_minor integer not null default 0 check (tax_minor >= 0),
  total_minor integer not null check (total_minor >= 0),
  coupon_id uuid references public.coupons (id),
  affiliate_link_code text,
  status app.order_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.orders
  for each row execute function app.set_updated_at();

create index orders_buyer_idx on public.orders (buyer_id);
create index orders_creator_idx on public.orders (creator_id);
create index orders_status_idx on public.orders (status);

-- Immutable line-item snapshot: product edits after purchase never alter
-- historical orders because pricing/title are copied at checkout time.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  product_title_snapshot text not null,
  product_type_snapshot app.product_type not null,
  unit_price_minor integer not null check (unit_price_minor >= 0),
  quantity integer not null default 1 check (quantity > 0),
  line_subtotal_minor integer not null check (line_subtotal_minor >= 0),
  creator_net_minor integer not null check (creator_net_minor >= 0),
  platform_fee_minor integer not null default 0 check (platform_fee_minor >= 0),
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider app.payment_provider not null,
  provider_reference text,
  status app.payment_status not null default 'requires_payment',
  amount_minor integer not null check (amount_minor >= 0),
  currency_code text not null references public.currencies (code),
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.payments
  for each row execute function app.set_updated_at();

create index payments_order_idx on public.payments (order_id);

-- Idempotency + reconciliation: every inbound provider webhook is recorded
-- once, keyed on (provider, provider_event_id), before being processed.
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments (id) on delete set null,
  provider app.payment_provider not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  payment_id uuid not null references public.payments (id),
  amount_minor integer not null check (amount_minor > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'succeeded', 'failed')),
  requested_by uuid references public.profiles (id),
  processed_by uuid references public.profiles (id),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  payment_id uuid references public.payments (id),
  reason text,
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved', 'lost')),
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_notes text
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  order_id uuid not null references public.orders (id),
  buyer_id uuid references public.profiles (id),
  discount_minor integer not null check (discount_minor >= 0),
  created_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);

-- Entitlements are the single source of truth for library/download access —
-- never derive access from order status directly.
create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  product_id uuid not null references public.products (id),
  buyer_id uuid not null references public.profiles (id),
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  download_limit integer,
  downloads_used integer not null default 0,
  expires_at timestamptz,
  revoked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_item_id)
);

create trigger set_updated_at
  before update on public.entitlements
  for each row execute function app.set_updated_at();

create index entitlements_buyer_idx on public.entitlements (buyer_id);
create index entitlements_product_idx on public.entitlements (product_id);

create table public.download_events (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null references public.entitlements (id) on delete cascade,
  product_file_id uuid references public.product_files (id),
  buyer_id uuid not null references public.profiles (id),
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Append-only financial ledger. Corrections are new rows, never updates.
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in (
    'customer_payment', 'platform_fee', 'creator_earning', 'affiliate_commission',
    'refund', 'chargeback', 'payout', 'payout_reversal', 'adjustment', 'tax_withholding'
  )),
  direction text not null check (direction in ('debit', 'credit')),
  amount_minor integer not null check (amount_minor >= 0),
  currency_code text not null references public.currencies (code),
  order_id uuid references public.orders (id),
  payment_id uuid references public.payments (id),
  creator_id uuid references public.creator_accounts (id),
  affiliate_id uuid,
  provider app.payment_provider,
  provider_reference text,
  status text not null default 'posted' check (status in ('posted', 'pending', 'reversed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ledger_entries_creator_idx on public.ledger_entries (creator_id);
create index ledger_entries_order_idx on public.ledger_entries (order_id);

create table public.creator_balances (
  creator_id uuid primary key references public.creator_accounts (id) on delete cascade,
  currency_code text not null references public.currencies (code),
  available_minor bigint not null default 0,
  pending_minor bigint not null default 0,
  lifetime_earnings_minor bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- customers: per-creator CRM view of a buyer's relationship, maintained by
-- the checkout/fulfillment service on order completion.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_accounts (id) on delete cascade,
  buyer_id uuid references public.profiles (id),
  email citext not null,
  first_order_at timestamptz not null default now(),
  last_order_at timestamptz not null default now(),
  orders_count integer not null default 0,
  lifetime_spend_minor bigint not null default 0,
  currency_code text references public.currencies (code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id, email)
);

create trigger set_updated_at
  before update on public.customers
  for each row execute function app.set_updated_at();

-- RLS ----------------------------------------------------------------------
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.checkout_sessions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.refunds enable row level security;
alter table public.disputes enable row level security;
alter table public.entitlements enable row level security;
alter table public.download_events enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.creator_balances enable row level security;
alter table public.customers enable row level security;

create policy "coupons_manage_creator" on public.coupons
  for all using (public.is_creator_member(creator_id, array['owner','administrator','marketing_manager']::app.creator_member_role[]) or public.is_platform_admin())
  with check (public.is_creator_member(creator_id, array['owner','administrator','marketing_manager']::app.creator_member_role[]) or public.is_platform_admin());

create policy "coupon_redemptions_read" on public.coupon_redemptions
  for select using (
    buyer_id = auth.uid()
    or exists (select 1 from public.coupons c where c.id = coupon_id and public.is_creator_member(c.creator_id))
    or public.is_platform_admin()
  );

-- checkout_sessions: only the buyer who opened the session (or the
-- server, using the service role) can read/write it.
create policy "checkout_sessions_owner" on public.checkout_sessions
  for select using (buyer_id = auth.uid() or public.is_platform_admin());

create policy "orders_read" on public.orders
  for select using (
    buyer_id = auth.uid()
    or public.is_creator_member(creator_id)
    or public.is_platform_admin()
  );

create policy "order_items_read" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.buyer_id = auth.uid() or public.is_creator_member(o.creator_id) or public.is_platform_admin())
    )
  );

create policy "payments_read" on public.payments
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.buyer_id = auth.uid() or public.is_creator_member(o.creator_id) or public.is_platform_admin())
    )
  );

create policy "refunds_read" on public.refunds
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.buyer_id = auth.uid() or public.is_creator_member(o.creator_id) or public.is_platform_admin())
    )
  );

create policy "refunds_admin_manage" on public.refunds
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "disputes_read" on public.disputes
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.buyer_id = auth.uid() or public.is_creator_member(o.creator_id) or public.is_platform_admin())
    )
  );

create policy "entitlements_read_own" on public.entitlements
  for select using (buyer_id = auth.uid() or public.is_platform_admin());

create policy "entitlements_read_creator" on public.entitlements
  for select using (
    exists (select 1 from public.products p where p.id = product_id and public.is_creator_member(p.creator_id))
  );

create policy "download_events_read_own" on public.download_events
  for select using (buyer_id = auth.uid() or public.is_platform_admin());

create policy "ledger_entries_read_creator" on public.ledger_entries
  for select using (
    (creator_id is not null and public.is_creator_member(creator_id, array['owner','administrator','finance_viewer']::app.creator_member_role[]))
    or public.is_platform_admin()
  );

create policy "creator_balances_read" on public.creator_balances
  for select using (public.is_creator_member(creator_id, array['owner','administrator','finance_viewer']::app.creator_member_role[]) or public.is_platform_admin());

create policy "customers_read" on public.customers
  for select using (public.is_creator_member(creator_id) or public.is_platform_admin());

-- All INSERT/UPDATE on checkout, orders, payments, entitlements, ledger and
-- customer records happens through server-side services using the Supabase
-- service role, which bypasses RLS. No anon/authenticated INSERT or UPDATE
-- policy is defined for these tables, so a browser client can never create
-- or mutate an order, price, or entitlement directly.
