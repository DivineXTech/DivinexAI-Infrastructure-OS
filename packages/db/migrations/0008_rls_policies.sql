-- Multi-tenant isolation via Row Level Security.
--
-- Two access patterns:
--   1. "Tenant-scoped" tables (organizations, workspaces, creator_profiles,
--      assets, rights, commerce config) are readable/writable only by
--      members of the owning organization, via app.current_org_ids().
--      PUBLISHED assets and ACTIVE products additionally get a public-read
--      carve-out so fans (who are never organization members) can browse
--      and purchase.
--   2. "Financial/privileged" tables (orders, memberships, ledger_entries,
--      payouts status, ai_jobs, ai_credit_ledger, audit_log) accept
--      SELECT from the relevant parties but NO write policy for the
--      `authenticated` role at all -- they are only ever written by
--      trusted server code using the Supabase service role, which bypasses
--      RLS. This makes financial mutation a privileged, server-mediated
--      operation by construction, not just by convention.

alter table organizations enable row level security;
alter table workspaces enable row level security;
alter table organization_members enable row level security;
alter table creator_profiles enable row level security;
alter table fan_profiles enable row level security;
alter table assets enable row level security;
alter table contributors enable row level security;
alter table rights_declarations enable row level security;
alter table license_grants enable row level security;
alter table consent_records enable row level security;
alter table products enable row level security;
alter table memberships enable row level security;
alter table orders enable row level security;
alter table ledger_entries enable row level security;
alter table payouts enable row level security;
alter table ai_jobs enable row level security;
alter table ai_credit_ledger enable row level security;
alter table audit_log enable row level security;

-- organizations
create policy organizations_select on organizations
  for select to authenticated
  using (id in (select app.current_org_ids()));

create policy organizations_insert on organizations
  for insert to authenticated
  with check (auth.uid() is not null);

create policy organizations_update on organizations
  for update to authenticated
  using (app.is_org_admin(id))
  with check (app.is_org_admin(id));

-- workspaces
create policy workspaces_select on workspaces
  for select to authenticated
  using (organization_id in (select app.current_org_ids()));

create policy workspaces_insert on workspaces
  for insert to authenticated
  with check (app.is_org_admin(organization_id));

create policy workspaces_update on workspaces
  for update to authenticated
  using (app.is_org_admin(organization_id))
  with check (app.is_org_admin(organization_id));

-- organization_members
create policy organization_members_select on organization_members
  for select to authenticated
  using (organization_id in (select app.current_org_ids()));

create policy organization_members_insert on organization_members
  for insert to authenticated
  with check (user_id = auth.uid() or app.is_org_admin(organization_id));

create policy organization_members_update on organization_members
  for update to authenticated
  using (app.is_org_admin(organization_id))
  with check (app.is_org_admin(organization_id));

-- creator_profiles
create policy creator_profiles_select on creator_profiles
  for select to authenticated
  using (organization_id in (select app.current_org_ids()));

create policy creator_profiles_insert on creator_profiles
  for insert to authenticated
  with check (
    organization_id in (select app.current_org_ids())
    and (user_id = auth.uid() or app.is_org_admin(organization_id))
  );

create policy creator_profiles_update on creator_profiles
  for update to authenticated
  using (user_id = auth.uid() or app.is_org_admin(organization_id))
  with check (user_id = auth.uid() or app.is_org_admin(organization_id));

-- fan_profiles: platform-wide identity, not tenant-owned. Self access only.
create policy fan_profiles_select on fan_profiles
  for select to authenticated
  using (user_id = auth.uid());

create policy fan_profiles_insert on fan_profiles
  for insert to authenticated
  with check (user_id = auth.uid());

create policy fan_profiles_update on fan_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- assets: tenant-managed, plus public read once published
create policy assets_select on assets
  for select to authenticated, anon
  using (status = 'PUBLISHED' or organization_id in (select app.current_org_ids()));

create policy assets_insert on assets
  for insert to authenticated
  with check (organization_id in (select app.current_org_ids()));

create policy assets_update on assets
  for update to authenticated
  using (organization_id in (select app.current_org_ids()))
  with check (organization_id in (select app.current_org_ids()));

-- contributors: tenant-managed, publicly visible for published assets (credit transparency)
create policy contributors_select on contributors
  for select to authenticated, anon
  using (
    organization_id in (select app.current_org_ids())
    or asset_id in (select id from assets where status = 'PUBLISHED')
  );

create policy contributors_insert on contributors
  for insert to authenticated
  with check (organization_id in (select app.current_org_ids()));

create policy contributors_update on contributors
  for update to authenticated
  using (organization_id in (select app.current_org_ids()))
  with check (organization_id in (select app.current_org_ids()));

-- rights_declarations: internal to the organization
create policy rights_declarations_select on rights_declarations
  for select to authenticated
  using (organization_id in (select app.current_org_ids()));

create policy rights_declarations_insert on rights_declarations
  for insert to authenticated
  with check (organization_id in (select app.current_org_ids()));

create policy rights_declarations_update on rights_declarations
  for update to authenticated
  using (app.is_org_admin(organization_id))
  with check (app.is_org_admin(organization_id));

-- license_grants: internal to the organization
create policy license_grants_select on license_grants
  for select to authenticated
  using (organization_id in (select app.current_org_ids()));

create policy license_grants_insert on license_grants
  for insert to authenticated
  with check (organization_id in (select app.current_org_ids()));

create policy license_grants_update on license_grants
  for update to authenticated
  using (app.is_org_admin(organization_id))
  with check (app.is_org_admin(organization_id));

-- consent_records: sensitive; visible to org admins and to the subject themselves
create policy consent_records_select on consent_records
  for select to authenticated
  using (app.is_org_admin(organization_id) or subject_user_id = auth.uid());

create policy consent_records_insert on consent_records
  for insert to authenticated
  with check (organization_id in (select app.current_org_ids()) and granted_by_user_id = auth.uid());

create policy consent_records_update on consent_records
  for update to authenticated
  using (subject_user_id = auth.uid() or granted_by_user_id = auth.uid() or app.is_org_admin(organization_id))
  with check (subject_user_id = auth.uid() or granted_by_user_id = auth.uid() or app.is_org_admin(organization_id));

-- products: tenant-managed, publicly visible while active (storefront)
create policy products_select on products
  for select to authenticated, anon
  using (active = true or organization_id in (select app.current_org_ids()));

create policy products_insert on products
  for insert to authenticated
  with check (organization_id in (select app.current_org_ids()));

create policy products_update on products
  for update to authenticated
  using (organization_id in (select app.current_org_ids()))
  with check (organization_id in (select app.current_org_ids()));

-- memberships: financial record. Readable by the org and by the fan who holds it. No authenticated write policy -- only the service role (server-mediated purchase flow) may write.
create policy memberships_select on memberships
  for select to authenticated
  using (organization_id in (select app.current_org_ids()) or fan_id = auth.uid());

-- orders: financial record, same pattern as memberships.
create policy orders_select on orders
  for select to authenticated
  using (organization_id in (select app.current_org_ids()) or fan_id = auth.uid());

-- ledger_entries: append-only financial ledger. Readable by the org and by
-- a contributor viewing their own balance. No authenticated write policy.
create policy ledger_entries_select on ledger_entries
  for select to authenticated
  using (
    organization_id in (select app.current_org_ids())
    or (account_type = 'CONTRIBUTOR_BALANCE' and account_ref_id = auth.uid())
  );

-- payouts: readable by the org and by the requesting creator. Only the
-- creator may REQUEST one (insert); status transitions are service-role only.
create policy payouts_select on payouts
  for select to authenticated
  using (
    organization_id in (select app.current_org_ids())
    or exists (select 1 from creator_profiles cp where cp.id = payouts.creator_id and cp.user_id = auth.uid())
  );

create policy payouts_insert on payouts
  for insert to authenticated
  with check (
    organization_id in (select app.current_org_ids())
    and exists (select 1 from creator_profiles cp where cp.id = payouts.creator_id and cp.user_id = auth.uid())
  );

-- ai_jobs: readable by the org. Creation/completion happens server-side
-- (credit metering + consent gating must be atomic with the job record).
create policy ai_jobs_select on ai_jobs
  for select to authenticated
  using (organization_id in (select app.current_org_ids()));

-- ai_credit_ledger: readable by the org. Service-role writes only.
create policy ai_credit_ledger_select on ai_credit_ledger
  for select to authenticated
  using (organization_id in (select app.current_org_ids()));

-- audit_log: readable by org admins only. Service-role writes only.
create policy audit_log_select on audit_log
  for select to authenticated
  using (app.is_org_admin(organization_id));
