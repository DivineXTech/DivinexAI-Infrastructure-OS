-- Development-only seed data. Never run against a production database —
-- see docs/DEPLOYMENT.md. Supabase CLI runs this automatically for
-- `supabase db reset` in local development.

insert into public.roles (key, name, description) values
  ('platform_super_admin', 'Platform Super Admin', 'Cross-tenant platform operator.'),
  ('tenant_owner', 'Tenant Owner', 'Full control over a single tenant.'),
  ('tenant_admin', 'Tenant Admin', 'Administrative access within a tenant.'),
  ('production_manager', 'Production Manager', 'Manages production jobs and inventory.'),
  ('designer', 'Designer', 'Creates and manages design projects and mockups.'),
  ('sales_rep', 'Sales Representative', 'Manages customers, orders, and marketing.'),
  ('support_agent', 'Support Agent', 'Handles support tickets.'),
  ('fulfillment_operator', 'Fulfillment Operator', 'Manages shipping and fulfillment.'),
  ('customer', 'Customer', 'Storefront customer, not a staff role.')
on conflict (key) do nothing;

-- Two tenants exist specifically so integration/e2e tests can prove
-- cross-tenant isolation (see docs/SECURITY.md and tests/integration).
insert into public.tenants (id, slug, name, status) values
  ('11111111-1111-1111-1111-111111111111', 'kushprintco', 'KushPrintCo', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'demo-isolation-tenant', 'Demo Isolation Tenant', 'active')
on conflict (slug) do nothing;

-- Note: profiles/tenant_memberships for demo users are created via
-- `npm run seed` (see package.json), which uses the Supabase service-role
-- client to create real auth.users rows first (auth.users cannot be
-- inserted directly from SQL) and then links them here.
