-- Phase 3: referral reward engine.
--
-- One row per (subscriber, milestone) they've qualified for. The unique
-- constraint is what makes fulfillment idempotent: the engine upserts
-- defensively, and a milestone can only ever be granted once per
-- subscriber no matter how many times the evaluator re-runs.

create table if not exists public.reward_grants (
  id uuid primary key default gen_random_uuid(),

  subscriber_id uuid not null references public.subscribers (id) on delete cascade,
  milestone_id text not null,
  qualified_count_at_grant integer not null,

  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'denied', 'fulfilled')),

  fraud_flag boolean not null default false,
  fraud_reason text,
  denied_reason text,

  approved_by text,
  approved_at timestamptz,
  fulfilled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reward_grants_subscriber_milestone_unique unique (subscriber_id, milestone_id)
);

create index if not exists reward_grants_status_idx on public.reward_grants (status);
create index if not exists reward_grants_subscriber_idx on public.reward_grants (subscriber_id);

drop trigger if exists reward_grants_set_updated_at on public.reward_grants;
create trigger reward_grants_set_updated_at
  before update on public.reward_grants
  for each row
  execute function public.set_updated_at();

alter table public.reward_grants enable row level security;
-- No policies — service-role only, same pattern as `subscribers`.

comment on table public.reward_grants is
  'One row per (subscriber, milestone) referral reward. status=fulfilled only ever reached after admin approval, except milestone-1 (pure recognition, no asset).';
