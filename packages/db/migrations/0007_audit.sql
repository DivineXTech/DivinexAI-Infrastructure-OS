-- Every privileged action (rights declaration, publication, payout
-- request, consent grant/revocation, fee override) writes an audit
-- record. Insert-only via the service role; organization admins can read
-- their own organization's trail.
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  actor_user_id uuid,
  action text not null check (char_length(action) between 1 and 120),
  entity_type text not null check (char_length(entity_type) between 1 and 120),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_organization_id_idx on audit_log (organization_id);
create index audit_log_entity_idx on audit_log (entity_type, entity_id);
