-- KushPrintCo OS — Phase 2 lead capture.
-- `leads` is intentionally not tenant-owned: submissions come from
-- anonymous public-site visitors who have no tenant yet. RLS still
-- applies (default-deny), it just isn't tenant-scoped RLS.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  lead_type text not null check (lead_type in (
    'general_contact',
    'consultation_request',
    'startup_kit_interest',
    'equipment_interest',
    'white_label_interest',
    'early_access_signup'
  )),
  full_name text not null,
  email text not null,
  message text,
  consent_given boolean not null default false,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

comment on table public.leads is 'Public lead-capture submissions (contact, consultation, kit/equipment/white-label interest, early access). Not tenant-owned — see docs/SECURITY.md.';
create index if not exists leads_lead_type_idx on public.leads (lead_type);
create index if not exists leads_created_at_idx on public.leads (created_at desc);

alter table public.leads enable row level security;
alter table public.leads force row level security;

-- Public lead-capture forms submit without an authenticated session, so
-- inserts must be open to the `anon` role. Every field is validated at the
-- application layer (lib/validation/lead.ts) before this insert runs —
-- RLS's job here is only to guarantee no one can read, update, or delete
-- another submitter's lead, not to validate content.
drop policy if exists leads_insert_public on public.leads;
create policy leads_insert_public on public.leads
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists leads_select_super_admin on public.leads;
create policy leads_select_super_admin on public.leads
  for select using (public.is_platform_super_admin());
