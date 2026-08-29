create table products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  creator_id uuid not null references creator_profiles (id) on delete cascade,
  asset_id uuid references assets (id) on delete set null,
  type text not null check (type in ('MEMBERSHIP', 'DIGITAL_DOWNLOAD', 'TIP', 'PPV', 'LICENSE')),
  name text not null check (char_length(name) between 1 and 200),
  price_amount_minor_units bigint not null check (price_amount_minor_units >= 0),
  price_currency text not null check (char_length(price_currency) = 3),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index products_organization_id_idx on products (organization_id);
create index products_workspace_id_idx on products (workspace_id);
create index products_creator_id_idx on products (creator_id);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  fan_id uuid not null,
  fan_display_name text not null,
  status text not null check (status in ('ACTIVE', 'CANCELED', 'EXPIRED')),
  started_at timestamptz not null default now(),
  renews_at timestamptz,
  canceled_at timestamptz
);

create index memberships_organization_id_idx on memberships (organization_id);
create index memberships_product_id_idx on memberships (product_id);
create index memberships_fan_id_idx on memberships (fan_id);

-- A single purchase of a product by a fan. Rows are immutable once
-- COMPLETED: corrections happen via ledger compensating entries and a
-- status transition to REFUNDED, never by editing the gross amount.
create table orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  product_id uuid not null references products (id) on delete restrict,
  creator_id uuid not null references creator_profiles (id) on delete restrict,
  fan_id uuid not null,
  fan_display_name text not null,
  status text not null check (status in ('PENDING', 'COMPLETED', 'REFUNDED', 'FAILED')),
  gross_amount_minor_units bigint not null check (gross_amount_minor_units >= 0),
  gross_currency text not null check (char_length(gross_currency) = 3),
  flowra_pay_charge_id text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create index orders_organization_id_idx on orders (organization_id);
create index orders_fan_id_idx on orders (fan_id);
create index orders_creator_id_idx on orders (creator_id);
