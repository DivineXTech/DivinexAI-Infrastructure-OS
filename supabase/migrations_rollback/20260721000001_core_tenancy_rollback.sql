-- Rollback for supabase/migrations/20260721000001_core_tenancy.sql
--
-- NOT auto-applied by the Supabase CLI (it has no down-migration mechanism);
-- keep this file in sync by hand and run it manually if Phase 1 needs to be
-- reverted. Destructive — drops all core tenancy tables and their data.

drop policy if exists feature_flags_write_admin on tenant_feature_flags;
drop policy if exists feature_flags_select on tenant_feature_flags;
drop policy if exists tenant_settings_write_admin on tenant_settings;
drop policy if exists tenant_settings_select_member on tenant_settings;
drop policy if exists role_permissions_select on role_permissions;
drop policy if exists permissions_select_authenticated on permissions;
drop policy if exists roles_write_admin on roles;
drop policy if exists roles_select on roles;
drop policy if exists memberships_write_admin on tenant_memberships;
drop policy if exists memberships_select_member on tenant_memberships;
drop policy if exists tenants_update_admin on tenants;
drop policy if exists tenants_select_member on tenants;

drop function if exists tenant_has_permission(uuid, text);
drop function if exists is_tenant_member(uuid);

drop table if exists tenant_feature_flags;
drop table if exists tenant_settings;
drop table if exists tenant_memberships;
drop table if exists role_permissions;
drop table if exists permissions;
drop table if exists roles;
drop table if exists tenants;
