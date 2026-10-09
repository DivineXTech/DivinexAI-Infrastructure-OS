-- Phase 5: Stripe purchases.
--
-- One row per completed Checkout Session. `stripe_session_id` is unique so
-- the webhook handler can upsert idempotently — Stripe may redeliver the
-- same event, and this makes re-processing a no-op rather than a double
-- fulfillment.

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),

  subscriber_id uuid references public.subscribers (id) on delete set null,
  email text not null,

  stripe_session_id text not null,
  stripe_payment_intent_id text,

  amount_cents integer not null,
  currency text not null,

  status text not null default 'pending'
    check (status in ('pending', 'paid', 'fulfilled', 'refunded')),

  fulfilled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchases_stripe_session_id_unique unique (stripe_session_id)
);

create index if not exists purchases_email_idx on public.purchases (email);
create index if not exists purchases_status_idx on public.purchases (status);

drop trigger if exists purchases_set_updated_at on public.purchases;
create trigger purchases_set_updated_at
  before update on public.purchases
  for each row
  execute function public.set_updated_at();

alter table public.purchases enable row level security;
-- No policies — service-role only, same pattern as the other tables.

-- Private Storage bucket for the full ebook, mirroring chapter12-private
-- from migration 0002. Upload the approved final file here once available;
-- see src/lib/storage/ebook-storage.ts.
insert into storage.buckets (id, name, public)
values ('ebook-private', 'ebook-private', false)
on conflict (id) do nothing;

comment on table public.purchases is
  'Stripe Checkout purchases of the full ebook. Service-role only. Idempotent on stripe_session_id.';
