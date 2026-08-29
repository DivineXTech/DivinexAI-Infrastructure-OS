-- Append-only double-entry ledger. Rows are never updated or deleted;
-- corrections are compensating entries referencing reversal_of_entry_id.
-- Writes happen only through the service role (see 0009_rls_policies.sql),
-- driven by @divinexai/ledger so every entry is part of a balanced,
-- idempotent transaction.
create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  transaction_id uuid not null,
  order_id uuid references orders (id) on delete restrict,
  account_type text not null check (account_type in ('PLATFORM_REVENUE', 'CREATOR_BALANCE', 'CONTRIBUTOR_BALANCE', 'FAN_PAYMENT_CLEARING', 'PAYOUT_CLEARING')),
  account_ref_id uuid not null,
  entry_type text not null check (entry_type in ('SALE_GROSS', 'PLATFORM_FEE', 'CREATOR_NET', 'CONTRIBUTOR_SPLIT', 'PAYOUT', 'REFUND', 'COMPENSATING')),
  direction text not null check (direction in ('DEBIT', 'CREDIT')),
  amount_minor_units bigint not null check (amount_minor_units >= 0),
  currency text not null check (char_length(currency) = 3),
  reversal_of_entry_id uuid references ledger_entries (id),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key, account_type, account_ref_id, entry_type, direction)
);

create index ledger_entries_organization_id_idx on ledger_entries (organization_id);
create index ledger_entries_transaction_id_idx on ledger_entries (transaction_id);
create index ledger_entries_account_idx on ledger_entries (account_type, account_ref_id);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  creator_id uuid not null references creator_profiles (id) on delete restrict,
  amount_minor_units bigint not null check (amount_minor_units > 0),
  currency text not null check (char_length(currency) = 3),
  status text not null check (status in ('REQUESTED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELED')),
  flowra_pay_payout_id text,
  idempotency_key text not null,
  requested_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (organization_id, idempotency_key)
);

create index payouts_organization_id_idx on payouts (organization_id);
create index payouts_creator_id_idx on payouts (creator_id);
