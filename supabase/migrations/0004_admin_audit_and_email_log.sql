-- Phase 4: admin dashboard support tables — email delivery log + audit log.

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid references public.subscribers (id) on delete set null,
  email_type text not null,
  to_email text not null,
  delivered boolean not null,
  simulated boolean not null,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists email_logs_created_at_idx on public.email_logs (created_at desc);
create index if not exists email_logs_subscriber_idx on public.email_logs (subscriber_id);

alter table public.email_logs enable row level security;
-- No policies — service-role only.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  target text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;
-- No policies — service-role only.

comment on table public.email_logs is
  'Transactional email delivery log (confirmation, status link, reward notifications, ...). Service-role only.';
comment on table public.audit_logs is
  'Admin dashboard action log (login, reward approvals, CSV exports, access revocations, ...). Service-role only.';
