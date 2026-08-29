-- A curated public view of creator_profiles for anonymous storefront
-- browsing: only identity fields a creator's public page needs (name,
-- handle, org/workspace ids to scope further public reads), never
-- onboarding_step or flowra_pay_account_id. Deliberately created WITHOUT
-- `security_invoker = true` (the PG15+ default for new views): it must run
-- with the view owner's privileges so it can bypass creator_profiles' own
-- RLS (which has no anon policy at all) rather than inherit it -- this is
-- the standard "security definer view" pattern for a narrow public slice
-- of an otherwise tenant-locked table.
create view public_creator_profiles as
  select id, organization_id, workspace_id, display_name, handle, created_at
  from creator_profiles;

grant select on public_creator_profiles to anon, authenticated;
