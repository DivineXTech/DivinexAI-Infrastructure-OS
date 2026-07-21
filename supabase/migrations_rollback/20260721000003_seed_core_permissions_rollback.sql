-- Rollback for supabase/migrations/20260721000003_seed_core_permissions.sql
--
-- Only removes the exact keys this migration inserted, so it's safe even if
-- other permission keys were added later by application code or a
-- subsequent migration. If any role_permissions rows reference these keys,
-- the cascade on role_permissions.permission_id (see
-- supabase/migrations/20260721000001_core_tenancy.sql) removes those
-- grants too — review before running against a database with real
-- tenant data.

delete from permissions where key in (
  'tenant.manage',
  'tenant.manage_members',
  'tenant.manage_roles',
  'tenant.view_audit_log',
  'tenant.view_security_log'
);
