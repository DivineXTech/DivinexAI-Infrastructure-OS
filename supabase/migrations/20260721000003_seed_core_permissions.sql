-- AgentFlow Pro v2 — Phase 1 (increment 2): baseline permission catalog
--
-- Idempotent (on conflict do nothing) so this is safe to run alongside
-- application-level seeding and safe to re-run. Tenant-scoped roles created
-- later (e.g. per-tenant "owner"/"member") attach to these via
-- role_permissions; this migration only ensures the permission keys
-- referenced by RLS policies and services in this phase actually exist.

insert into permissions (key, category, description) values
  ('tenant.manage', 'tenant', 'Manage tenant-level settings and configuration'),
  ('tenant.manage_members', 'tenant', 'Add, remove, or change the role of tenant members'),
  ('tenant.manage_roles', 'tenant', 'Create or modify tenant-scoped roles and their permissions'),
  ('tenant.view_audit_log', 'tenant', 'View the tenant''s audit event log'),
  ('tenant.view_security_log', 'tenant', 'View the tenant''s security event log')
on conflict (key) do nothing;
