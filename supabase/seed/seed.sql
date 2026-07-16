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

-- ---------------------------------------------------------------------------
-- Phase 4: platform-owned garment templates (tenant_id null — shared,
-- readable by every tenant, editable only by a platform super admin; see
-- docs/GARMENT_TEMPLATES.md). Generic development placeholders only —
-- original inline SVG silhouettes, no third-party product photography or
-- brand marks, per section 19.
-- ---------------------------------------------------------------------------
insert into public.garment_templates
  (id, tenant_id, slug, name, category, description, supported_production_methods, base_wholesale_cost_cents, status)
values
  ('a1000000-0000-0000-0000-000000000001', null, 'generic-t-shirt', 'Generic T-Shirt', 't_shirt',
   'A basic short-sleeve crewneck tee — development placeholder, not a real supplier SKU.',
   array['heat_transfer_vinyl', 'dtf', 'screen_printing'], 600, 'active'),
  ('a1000000-0000-0000-0000-000000000002', null, 'generic-hoodie', 'Generic Hoodie', 'hoodie',
   'A basic pullover hoodie — development placeholder, not a real supplier SKU.',
   array['dtf', 'screen_printing', 'embroidery'], 1800, 'active'),
  ('a1000000-0000-0000-0000-000000000003', null, 'generic-sweatshirt', 'Generic Sweatshirt', 'sweatshirt',
   'A basic crewneck sweatshirt — development placeholder, not a real supplier SKU.',
   array['dtf', 'screen_printing'], 1400, 'active')
on conflict do nothing;

insert into public.garment_template_sizes (garment_template_id, tenant_id, size_label, sort_order)
select t.id, null, s.label, s.ord
from public.garment_templates t
cross join (values ('S', 1), ('M', 2), ('L', 3), ('XL', 4), ('2XL', 5)) as s(label, ord)
where t.id in (
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003'
)
on conflict do nothing;

insert into public.garment_template_colors (garment_template_id, tenant_id, name, hex_value, sort_order)
select t.id, null, c.name, c.hex, c.ord
from public.garment_templates t
cross join (values ('Black', '#111111', 1), ('White', '#f5f5f5', 2), ('Heather Gray', '#9ca3af', 3)) as c(name, hex, ord)
where t.id in (
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003'
)
on conflict do nothing;

-- Generic silhouettes — simple original shapes (rounded torso + sleeves),
-- deliberately not attempting photorealistic garment rendering. `color`
-- comes from the CSS `color` property the viewer sets, so one silhouette
-- recolors for every garment color.
insert into public.garment_template_views (garment_template_id, tenant_id, view_key, svg_markup, sort_order)
select t.id, null, v.view_key, v.markup, v.ord
from public.garment_templates t
cross join (
  values
    ('front', '<svg viewBox="0 0 200 200"><path d="M60 20 L80 10 L120 10 L140 20 L170 55 L145 75 L135 60 L135 190 L65 190 L65 60 L55 75 L30 55 Z" fill="currentColor" stroke="#00000022" stroke-width="2"/></svg>', 1),
    ('back', '<svg viewBox="0 0 200 200"><path d="M60 20 L80 10 L120 10 L140 20 L170 55 L145 75 L135 60 L135 190 L65 190 L65 60 L55 75 L30 55 Z" fill="currentColor" stroke="#00000022" stroke-width="2" stroke-dasharray="1 0"/><line x1="100" y1="15" x2="100" y2="185" stroke="#00000015" stroke-width="1"/></svg>', 2),
    ('left', '<svg viewBox="0 0 200 200"><path d="M85 15 L115 15 L130 45 L150 60 L135 80 L120 65 L120 190 L80 190 L80 65 Z" fill="currentColor" stroke="#00000022" stroke-width="2"/></svg>', 3),
    ('right', '<svg viewBox="0 0 200 200"><path d="M115 15 L85 15 L70 45 L50 60 L65 80 L80 65 L80 190 L120 190 L120 65 Z" fill="currentColor" stroke="#00000022" stroke-width="2"/></svg>', 4)
) as v(view_key, markup, ord)
where t.id in (
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003'
)
on conflict do nothing;

insert into public.garment_print_zones
  (garment_template_id, tenant_id, zone_key, view_key, x, y, width, height, safe_width, safe_height, supported_production_methods)
select t.id, null, z.zone_key, z.view_key, z.x, z.y, z.width, z.height, z.safe_width, z.safe_height, z.methods
from public.garment_templates t
cross join (
  values
    ('full_front', 'front', 30, 25, 40, 45, 34, 39, array['heat_transfer_vinyl','dtf','screen_printing']::text[]),
    ('center_chest', 'front', 38, 25, 24, 18, 20, 15, array['heat_transfer_vinyl','dtf','embroidery']::text[]),
    ('full_back', 'back', 25, 20, 50, 55, 44, 49, array['dtf','screen_printing']::text[])
) as z(zone_key, view_key, x, y, width, height, safe_width, safe_height, methods)
where t.id in (
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003'
)
on conflict do nothing;
