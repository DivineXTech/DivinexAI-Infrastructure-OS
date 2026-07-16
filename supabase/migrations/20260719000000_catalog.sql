-- KushPrintCo OS — Phase 4 catalog schema: garment templates, design studio,
-- mockups, and the product catalog.
--
-- Ownership model for garment_templates (and its four child tables, which
-- denormalize the same tenant_id for RLS directness): tenant_id is
-- NULLABLE. NULL means a platform-owned, shared template — readable by
-- every active tenant member, writable only by a platform super admin.
-- A non-null tenant_id means a tenant-created custom template — readable
-- and writable only by that tenant's owner/admin, never by other tenants,
-- and never editable by anyone else even though they can read shared
-- platform templates. This is the one place in the schema where
-- "tenant-owned" does not mean "every row has a tenant" — see
-- docs/GARMENT_TEMPLATES.md.
--
-- Every other table here is tenant-owned in the ordinary sense (tenant_id
-- uuid not null). Child tables (versions, elements, placements, assets,
-- variants, images, cost components, price/status history) denormalize
-- tenant_id from their parent rather than requiring a join for RLS or for
-- the application layer's explicit tenant_id-scoped queries — the same
-- pattern the Phase 3 onboarding migration established, and the same
-- "every query resolves tenant_id from the caller's own session, never
-- from client input, and every RLS-relevant table is scoped explicitly by
-- it" contract that the 61b1b83 fix and the Phase 3 review both hold to.
-- No table here is queried by a "my X" contract that trusts RLS breadth
-- alone.

-- ---------------------------------------------------------------------------
-- garment_templates
-- ---------------------------------------------------------------------------
create table if not exists public.garment_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete cascade,
  slug text not null,
  name text not null,
  category text not null check (category in (
    't_shirt', 'long_sleeve_shirt', 'hoodie', 'sweatshirt', 'polo', 'tank_top',
    'hat', 'workwear', 'athletic_apparel', 'childrens_apparel', 'bag', 'promotional_item'
  )),
  manufacturer text,
  style_number text,
  description text,
  fabric_composition text,
  weight text,
  fit text,
  audience text,
  supported_production_methods text[] not null default '{}',
  base_wholesale_cost_cents int,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.garment_templates is 'tenant_id null = platform-owned shared template; tenant_id set = tenant-created custom template, private to that tenant.';
create unique index if not exists garment_templates_platform_slug_idx on public.garment_templates (slug) where tenant_id is null;
create unique index if not exists garment_templates_tenant_slug_idx on public.garment_templates (tenant_id, slug) where tenant_id is not null;
create index if not exists garment_templates_tenant_id_idx on public.garment_templates (tenant_id);

-- ---------------------------------------------------------------------------
-- garment_template_views (front/back/left/right/detail)
-- ---------------------------------------------------------------------------
create table if not exists public.garment_template_views (
  id uuid primary key default gen_random_uuid(),
  garment_template_id uuid not null references public.garment_templates (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete cascade,
  view_key text not null check (view_key in ('front', 'back', 'left', 'right', 'detail')),
  image_path text,
  svg_markup text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (garment_template_id, view_key)
);

create index if not exists garment_template_views_template_id_idx on public.garment_template_views (garment_template_id);
create index if not exists garment_template_views_tenant_id_idx on public.garment_template_views (tenant_id);

-- ---------------------------------------------------------------------------
-- garment_template_colors
-- ---------------------------------------------------------------------------
create table if not exists public.garment_template_colors (
  id uuid primary key default gen_random_uuid(),
  garment_template_id uuid not null references public.garment_templates (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete cascade,
  name text not null,
  hex_value text not null,
  swatch_image_path text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (garment_template_id, name)
);

create index if not exists garment_template_colors_template_id_idx on public.garment_template_colors (garment_template_id);
create index if not exists garment_template_colors_tenant_id_idx on public.garment_template_colors (tenant_id);

-- ---------------------------------------------------------------------------
-- garment_template_sizes
-- ---------------------------------------------------------------------------
create table if not exists public.garment_template_sizes (
  id uuid primary key default gen_random_uuid(),
  garment_template_id uuid not null references public.garment_templates (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete cascade,
  size_label text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (garment_template_id, size_label)
);

create index if not exists garment_template_sizes_template_id_idx on public.garment_template_sizes (garment_template_id);
create index if not exists garment_template_sizes_tenant_id_idx on public.garment_template_sizes (tenant_id);

-- ---------------------------------------------------------------------------
-- garment_print_zones. Coordinates are percentages (0-100) of the garment
-- view's image, not absolute pixels — resolution-independent, and exactly
-- what lib/catalog/print-zone-validation.ts's pure boundary checks operate
-- on. See docs/GARMENT_TEMPLATES.md "Print-zone coordinate model".
-- ---------------------------------------------------------------------------
create table if not exists public.garment_print_zones (
  id uuid primary key default gen_random_uuid(),
  garment_template_id uuid not null references public.garment_templates (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete cascade,
  zone_key text not null check (zone_key in (
    'full_front', 'center_chest', 'left_chest', 'right_chest', 'full_back',
    'upper_back', 'lower_back', 'left_sleeve', 'right_sleeve', 'hat_front', 'hat_side'
  )),
  view_key text not null check (view_key in ('front', 'back', 'left', 'right')),
  x numeric not null,
  y numeric not null,
  width numeric not null,
  height numeric not null,
  safe_width numeric,
  safe_height numeric,
  max_width_inches numeric,
  max_height_inches numeric,
  supported_production_methods text[] not null default '{}',
  rotation_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (garment_template_id, zone_key)
);

create index if not exists garment_print_zones_template_id_idx on public.garment_print_zones (garment_template_id);
create index if not exists garment_print_zones_tenant_id_idx on public.garment_print_zones (tenant_id);

-- ---------------------------------------------------------------------------
-- design_projects
-- ---------------------------------------------------------------------------
create table if not exists public.design_projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null default 'Untitled design',
  status text not null default 'draft' check (status in (
    'draft', 'needs_artwork', 'ready_for_review', 'changes_requested',
    'approved', 'converted_to_product', 'archived'
  )),
  garment_template_id uuid references public.garment_templates (id),
  garment_color_id uuid references public.garment_template_colors (id),
  production_method text check (production_method in (
    'heat_transfer_vinyl', 'dtf', 'sublimation', 'screen_printing',
    'embroidery', 'outsourced', 'hybrid'
  )),
  owner_profile_id uuid references public.profiles (id),
  assigned_designer_id uuid references public.profiles (id),
  internal_notes text,
  customer_notes text,
  created_from text not null default 'manual' check (created_from in ('manual', 'onboarding')),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists design_projects_tenant_id_idx on public.design_projects (tenant_id);
create index if not exists design_projects_status_idx on public.design_projects (tenant_id, status);

-- ---------------------------------------------------------------------------
-- design_project_versions. A version is an immutable snapshot of the
-- normalized project state at a point in time — restoring a version means
-- replacing the current design_elements/design_placements rows with the
-- snapshot's contents, not "undoing" through design_elements history
-- directly. See docs/DESIGN_STUDIO.md "Versioning vs. undo/redo".
-- ---------------------------------------------------------------------------
create table if not exists public.design_project_versions (
  id uuid primary key default gen_random_uuid(),
  design_project_id uuid not null references public.design_projects (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  version_number int not null,
  label text,
  state jsonb not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (design_project_id, version_number)
);

create index if not exists design_project_versions_project_id_idx on public.design_project_versions (design_project_id);
create index if not exists design_project_versions_tenant_id_idx on public.design_project_versions (tenant_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'design_projects_current_version_fk'
  ) then
    alter table public.design_projects
      add constraint design_projects_current_version_fk
      foreign key (current_version_id) references public.design_project_versions (id) on delete set null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- design_assets. Uploaded artwork. Private by default — served only via
-- signed URL, never a public bucket URL. See docs/ARTWORK_SECURITY.md.
-- ---------------------------------------------------------------------------
create table if not exists public.design_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  design_project_id uuid references public.design_projects (id) on delete set null,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/svg+xml', 'image/webp')),
  file_size_bytes int not null,
  width_px int,
  height_px int,
  estimated_dpi numeric,
  has_transparency boolean,
  checksum text,
  status text not null default 'active' check (status in ('active', 'replaced', 'deleted')),
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists design_assets_tenant_id_idx on public.design_assets (tenant_id);
create index if not exists design_assets_project_id_idx on public.design_assets (design_project_id);
create index if not exists design_assets_checksum_idx on public.design_assets (tenant_id, checksum);

-- ---------------------------------------------------------------------------
-- design_elements. The abstract "things on the canvas" — text or image —
-- deliberately independent of any canvas/rendering library. See
-- docs/DESIGN_STUDIO.md "Editor architecture".
-- ---------------------------------------------------------------------------
create table if not exists public.design_elements (
  id uuid primary key default gen_random_uuid(),
  design_project_id uuid not null references public.design_projects (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  element_type text not null check (element_type in ('text', 'image')),
  z_index int not null default 0,
  locked boolean not null default false,
  hidden boolean not null default false,
  text_content text,
  font_key text,
  font_size numeric,
  text_color text,
  text_align text check (text_align in ('left', 'center', 'right')),
  design_asset_id uuid references public.design_assets (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists design_elements_project_id_idx on public.design_elements (design_project_id);
create index if not exists design_elements_tenant_id_idx on public.design_elements (tenant_id);

-- ---------------------------------------------------------------------------
-- design_placements. An element's transform (position/size/rotation) within
-- one specific garment view + print zone — kept separate from
-- design_elements so the same element could (in principle) be placed in
-- more than one zone without duplicating its content.
-- ---------------------------------------------------------------------------
create table if not exists public.design_placements (
  id uuid primary key default gen_random_uuid(),
  design_element_id uuid not null references public.design_elements (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  print_zone_id uuid references public.garment_print_zones (id),
  garment_view text not null check (garment_view in ('front', 'back', 'left', 'right')),
  x numeric not null,
  y numeric not null,
  width numeric not null,
  height numeric not null,
  rotation numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists design_placements_element_id_idx on public.design_placements (design_element_id);
create index if not exists design_placements_tenant_id_idx on public.design_placements (tenant_id);

-- ---------------------------------------------------------------------------
-- mockups / mockup_views. Browser-generated digital previews, never
-- described as production proofs. See docs/DESIGN_STUDIO.md "Mockup
-- limitations".
-- ---------------------------------------------------------------------------
create table if not exists public.mockups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  design_project_id uuid references public.design_projects (id) on delete cascade,
  design_project_version_id uuid references public.design_project_versions (id),
  status text not null default 'generated' check (status in ('generated', 'downloaded')),
  has_watermark boolean not null default false,
  generated_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists mockups_tenant_id_idx on public.mockups (tenant_id);
create index if not exists mockups_project_id_idx on public.mockups (design_project_id);

create table if not exists public.mockup_views (
  id uuid primary key default gen_random_uuid(),
  mockup_id uuid not null references public.mockups (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  view_key text not null check (view_key in ('front', 'back', 'left', 'right', 'composite')),
  image_path text not null,
  created_at timestamptz not null default now(),
  unique (mockup_id, view_key)
);

create index if not exists mockup_views_mockup_id_idx on public.mockup_views (mockup_id);
create index if not exists mockup_views_tenant_id_idx on public.mockup_views (tenant_id);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  slug text not null,
  short_description text,
  full_description text,
  category text,
  garment_template_id uuid references public.garment_templates (id),
  design_project_id uuid references public.design_projects (id),
  production_method text check (production_method in (
    'heat_transfer_vinyl', 'dtf', 'sublimation', 'screen_printing',
    'embroidery', 'outsourced', 'hybrid'
  )),
  status text not null default 'draft' check (status in (
    'draft', 'ready_for_review', 'approved', 'active', 'paused', 'archived'
  )),
  sales_channels text[] not null default '{}',
  is_featured boolean not null default false,
  seo_title text,
  seo_description text,
  tags text[] not null default '{}',
  primary_image_path text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (tenant_id, slug)
);

create index if not exists products_tenant_id_idx on public.products (tenant_id);
create index if not exists products_status_idx on public.products (tenant_id, status);

-- ---------------------------------------------------------------------------
-- product_variants. Duplicate-combination prevention is null-safe via a
-- coalesce-based expression index — see lib/catalog/variant-matrix.ts for
-- the same rule enforced (and unit-tested) at the application layer before
-- any insert is attempted.
-- ---------------------------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sku text not null,
  barcode text,
  size_label text,
  color_name text,
  garment_style text,
  material text,
  print_location text,
  base_garment_cost_cents int not null default 0,
  print_cost_cents int not null default 0,
  packaging_cost_cents int not null default 0,
  additional_cost_cents int not null default 0,
  retail_price_cents int,
  wholesale_price_cents int,
  compare_at_price_cents int,
  weight_grams int,
  is_active boolean not null default true,
  track_inventory boolean not null default true,
  supplier_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku)
);

create index if not exists product_variants_product_id_idx on public.product_variants (product_id);
create index if not exists product_variants_tenant_id_idx on public.product_variants (tenant_id);
create unique index if not exists product_variants_combo_idx on public.product_variants (
  product_id,
  coalesce(size_label, ''),
  coalesce(color_name, ''),
  coalesce(garment_style, ''),
  coalesce(material, ''),
  coalesce(print_location, '')
);

-- ---------------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------------
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  image_path text not null,
  alt_text text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists product_images_product_id_idx on public.product_images (product_id);
create index if not exists product_images_tenant_id_idx on public.product_images (tenant_id);

-- ---------------------------------------------------------------------------
-- product_design_links
-- ---------------------------------------------------------------------------
create table if not exists public.product_design_links (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  design_project_id uuid not null references public.design_projects (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (product_id, design_project_id)
);

create index if not exists product_design_links_product_id_idx on public.product_design_links (product_id);
create index if not exists product_design_links_tenant_id_idx on public.product_design_links (tenant_id);

-- ---------------------------------------------------------------------------
-- product_cost_components
-- ---------------------------------------------------------------------------
create table if not exists public.product_cost_components (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references public.product_variants (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  component_key text not null check (component_key in (
    'blank_garment', 'printing', 'packaging', 'labor', 'transaction_estimate', 'fulfillment', 'other'
  )),
  amount_cents int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_variant_id, component_key)
);

create index if not exists product_cost_components_variant_id_idx on public.product_cost_components (product_variant_id);
create index if not exists product_cost_components_tenant_id_idx on public.product_cost_components (tenant_id);

-- ---------------------------------------------------------------------------
-- product_price_history / product_status_history — append-only.
-- ---------------------------------------------------------------------------
create table if not exists public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references public.product_variants (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  retail_price_cents int,
  wholesale_price_cents int,
  compare_at_price_cents int,
  changed_by uuid references public.profiles (id),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists product_price_history_variant_id_idx on public.product_price_history (product_variant_id);
create index if not exists product_price_history_tenant_id_idx on public.product_price_history (tenant_id);

create table if not exists public.product_status_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists product_status_history_product_id_idx on public.product_status_history (product_id);
create index if not exists product_status_history_tenant_id_idx on public.product_status_history (tenant_id);

-- ---------------------------------------------------------------------------
-- Storage: allow sanitized SVG + WebP into the design-uploads bucket.
--
-- Phase 1.5 (20260716000000_storage.sql) deliberately excluded
-- image/svg+xml from every bucket, since a raw user-uploaded SVG served
-- back to a browser is a well-known stored-XSS vector. Phase 4's design
-- studio requires SVG artwork uploads (section 7), so that invariant is
-- narrowed — not removed — for exactly one bucket: every SVG accepted
-- here is sanitized server-side before it is written to storage
-- (lib/catalog/svg-sanitizer.ts, applied in the upload Server Action,
-- never trusting the client-supplied file extension or MIME type). See
-- docs/ARTWORK_SECURITY.md for the full threat model and the compensating
-- controls. No other bucket's allowed_mime_types changes.
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'application/pdf', 'image/svg+xml', 'image/webp']
where id = 'design-uploads';

-- ---------------------------------------------------------------------------
-- updated_at maintenance on every mutable table above.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'garment_templates', 'garment_template_views', 'garment_template_colors',
    'garment_template_sizes', 'garment_print_zones', 'design_projects',
    'design_assets', 'design_elements', 'design_placements', 'products',
    'product_variants', 'product_cost_components'
  ]
  loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I; create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t, t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security: default-deny on every table above.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'garment_templates', 'garment_template_views', 'garment_template_colors',
    'garment_template_sizes', 'garment_print_zones', 'design_projects',
    'design_project_versions', 'design_assets', 'design_elements',
    'design_placements', 'mockups', 'mockup_views', 'products',
    'product_variants', 'product_images', 'product_design_links',
    'product_cost_components', 'product_price_history', 'product_status_history'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
  end loop;
end;
$$;

-- garment_templates and its four child tables: any active tenant member (or
-- super admin) reads platform templates (tenant_id null) and their own
-- tenant's custom templates; only a platform super admin writes platform
-- templates, only that tenant's owner/admin writes their own custom ones.
do $$
declare
  t text;
begin
  foreach t in array array[
    'garment_templates', 'garment_template_views', 'garment_template_colors',
    'garment_template_sizes', 'garment_print_zones'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format(
      $p$create policy %I_select on public.%I
        for select using (
          tenant_id is null
          or public.is_tenant_member(tenant_id)
          or public.is_platform_super_admin()
        );$p$,
      t, t
    );

    execute format('drop policy if exists %I_platform_write on public.%I;', t, t);
    execute format(
      $p$create policy %I_platform_write on public.%I
        for all using (
          tenant_id is null and public.is_platform_super_admin()
        ) with check (
          tenant_id is null and public.is_platform_super_admin()
        );$p$,
      t, t
    );

    execute format('drop policy if exists %I_tenant_write on public.%I;', t, t);
    execute format(
      $p$create policy %I_tenant_write on public.%I
        for all using (
          tenant_id is not null
          and public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
        ) with check (
          tenant_id is not null
          and public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
        );$p$,
      t, t
    );
  end loop;
end;
$$;

-- design_projects: owner/admin/designer full access; production_manager
-- read-only, and only once a project has left draft/review (approved or
-- already converted) — never drafts or in-review work.
drop policy if exists design_projects_owner_admin_designer on public.design_projects;
create policy design_projects_owner_admin_designer on public.design_projects
  for all using (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin', 'designer'])
    or public.is_platform_super_admin()
  ) with check (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin', 'designer'])
    or public.is_platform_super_admin()
  );

drop policy if exists design_projects_production_manager_read on public.design_projects;
create policy design_projects_production_manager_read on public.design_projects
  for select using (
    public.has_tenant_role(tenant_id, array['production_manager'])
    and status in ('approved', 'converted_to_product')
  );

-- design_project_versions / design_assets / design_elements / design_placements:
-- same shape, but the "approved" check requires a subquery back to
-- design_projects since these child tables don't carry their own status.
do $$
declare
  t text;
  project_fk text;
begin
  foreach t in array array['design_project_versions', 'design_assets', 'design_elements']
  loop
    project_fk := 'design_project_id';

    execute format('drop policy if exists %I_owner_admin_designer on public.%I;', t, t);
    execute format(
      $p$create policy %I_owner_admin_designer on public.%I
        for all using (
          public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin', 'designer'])
          or public.is_platform_super_admin()
        ) with check (
          public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin', 'designer'])
          or public.is_platform_super_admin()
        );$p$,
      t, t
    );

    execute format('drop policy if exists %I_production_manager_read on public.%I;', t, t);
    execute format(
      $p$create policy %I_production_manager_read on public.%I
        for select using (
          public.has_tenant_role(tenant_id, array['production_manager'])
          and exists (
            select 1 from public.design_projects dp
            where dp.id = %I.%I
              and dp.status in ('approved', 'converted_to_product')
          )
        );$p$,
      t, t, t, project_fk
    );
  end loop;
end;
$$;

-- design_placements references design_elements, not design_projects
-- directly, so its production-manager read policy joins through it.
drop policy if exists design_placements_owner_admin_designer on public.design_placements;
create policy design_placements_owner_admin_designer on public.design_placements
  for all using (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin', 'designer'])
    or public.is_platform_super_admin()
  ) with check (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin', 'designer'])
    or public.is_platform_super_admin()
  );

drop policy if exists design_placements_production_manager_read on public.design_placements;
create policy design_placements_production_manager_read on public.design_placements
  for select using (
    public.has_tenant_role(tenant_id, array['production_manager'])
    and exists (
      select 1 from public.design_elements de
      join public.design_projects dp on dp.id = de.design_project_id
      where de.id = design_placements.design_element_id
        and dp.status in ('approved', 'converted_to_product')
    )
  );

-- mockups / mockup_views: owner/admin/designer only (no production_manager
-- grant — the spec does not ask for mockup visibility for that role).
do $$
declare
  t text;
begin
  foreach t in array array['mockups', 'mockup_views']
  loop
    execute format('drop policy if exists %I_owner_admin_designer on public.%I;', t, t);
    execute format(
      $p$create policy %I_owner_admin_designer on public.%I
        for all using (
          public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin', 'designer'])
          or public.is_platform_super_admin()
        ) with check (
          public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin', 'designer'])
          or public.is_platform_super_admin()
        );$p$,
      t, t
    );
  end loop;
end;
$$;

-- products: owner/admin full access; sales_rep read-only on active
-- products only (never drafts/internal notes on unpublished work).
drop policy if exists products_owner_admin on public.products;
create policy products_owner_admin on public.products
  for all using (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  ) with check (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  );

drop policy if exists products_sales_rep_read_active on public.products;
create policy products_sales_rep_read_active on public.products
  for select using (
    public.has_tenant_role(tenant_id, array['sales_rep'])
    and status = 'active'
  );

-- product_variants / product_images / product_cost_components: owner/admin
-- full; sales_rep reads variants/images of active products only;
-- production_manager reads variants/cost_components ("production
-- specifications") of approved-or-active products only.
do $$
declare
  t text;
begin
  foreach t in array array['product_variants', 'product_images', 'product_cost_components']
  loop
    execute format('drop policy if exists %I_owner_admin on public.%I;', t, t);
    execute format(
      $p$create policy %I_owner_admin on public.%I
        for all using (
          public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
          or public.is_platform_super_admin()
        ) with check (
          public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
          or public.is_platform_super_admin()
        );$p$,
      t, t
    );
  end loop;
end;
$$;

drop policy if exists product_variants_sales_rep_read on public.product_variants;
create policy product_variants_sales_rep_read on public.product_variants
  for select using (
    public.has_tenant_role(tenant_id, array['sales_rep'])
    and exists (select 1 from public.products p where p.id = product_variants.product_id and p.status = 'active')
  );

drop policy if exists product_variants_production_manager_read on public.product_variants;
create policy product_variants_production_manager_read on public.product_variants
  for select using (
    public.has_tenant_role(tenant_id, array['production_manager'])
    and exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.status in ('approved', 'active')
    )
  );

drop policy if exists product_images_sales_rep_read on public.product_images;
create policy product_images_sales_rep_read on public.product_images
  for select using (
    public.has_tenant_role(tenant_id, array['sales_rep'])
    and exists (select 1 from public.products p where p.id = product_images.product_id and p.status = 'active')
  );

drop policy if exists product_cost_components_production_manager_read on public.product_cost_components;
create policy product_cost_components_production_manager_read on public.product_cost_components
  for select using (
    public.has_tenant_role(tenant_id, array['production_manager'])
    and exists (
      select 1 from public.product_variants pv
      join public.products p on p.id = pv.product_id
      where pv.id = product_cost_components.product_variant_id and p.status in ('approved', 'active')
    )
  );

-- product_design_links / product_price_history / product_status_history:
-- owner/admin only (financial + provenance detail, no broader read grant).
do $$
declare
  t text;
begin
  foreach t in array array['product_design_links', 'product_price_history', 'product_status_history']
  loop
    execute format('drop policy if exists %I_owner_admin on public.%I;', t, t);
    execute format(
      $p$create policy %I_owner_admin on public.%I
        for all using (
          public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
          or public.is_platform_super_admin()
        ) with check (
          public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
          or public.is_platform_super_admin()
        );$p$,
      t, t
    );
  end loop;
end;
$$;
