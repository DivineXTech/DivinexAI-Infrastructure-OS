-- KushPrintCo OS — Phase 1.5 storage foundation.
-- Tenant-aware Supabase Storage buckets + RLS on storage.objects.
--
-- Path convention for every tenant-scoped bucket: the object name's FIRST
-- path segment is the tenant_id (as text), e.g.
--   {tenant_id}/logo.png
--   {tenant_id}/products/{product_id}/front.png
-- Policies below use storage.foldername(name)[1] to read that segment and
-- check it against the caller's active tenant memberships — the same
-- is_tenant_member()/has_tenant_role() helpers the app schema RLS uses, so
-- there is exactly one definition of "is this caller a member of this
-- tenant" in the whole system.
--
-- Deliberately excluded from every bucket's allowed MIME types:
-- image/svg+xml. Raw user-uploaded SVG served back to a browser is a
-- well-known stored-XSS vector (SVG can embed <script>); rasterized
-- formats only until/unless a sanitization step is added ahead of
-- accepting SVG uploads.

-- ---------------------------------------------------------------------------
-- Buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- Public-read, tenant-write: brand identity assets shown on storefronts.
  ('logos', 'logos', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('brand-assets', 'brand-assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('product-images', 'product-images', true, 10485760, array['image/png', 'image/jpeg', 'image/webp']),

  -- Private, tenant-only: customer/production-facing working files.
  ('design-uploads', 'design-uploads', false, 26214400, array['image/png', 'image/jpeg', 'application/pdf']),
  ('artwork', 'artwork', false, 26214400, array['image/png', 'image/jpeg', 'application/pdf']),
  ('support-attachments', 'support-attachments', false, 10485760, array['image/png', 'image/jpeg', 'application/pdf']),

  -- Platform-wide (not tenant-scoped), authenticated-read: training content.
  ('course-files', 'course-files', false, 209715200, array['video/mp4', 'application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Helper: is the first path segment of a storage object a tenant the
-- caller actively belongs to? Mirrors is_tenant_member() but reads a
-- storage path instead of a table's tenant_id column.
-- ---------------------------------------------------------------------------
create or replace function storage.kpc_is_tenant_object(object_name text)
returns boolean
language sql
security definer
set search_path = public, storage
stable
as $$
  select
    case
      when (storage.foldername(object_name))[1] is null then false
      else public.is_tenant_member((storage.foldername(object_name))[1]::uuid)
    end;
$$;

create or replace function storage.kpc_has_tenant_admin_role(object_name text)
returns boolean
language sql
security definer
set search_path = public, storage
stable
as $$
  select
    case
      when (storage.foldername(object_name))[1] is null then false
      else public.has_tenant_role(
        (storage.foldername(object_name))[1]::uuid,
        array['tenant_owner', 'tenant_admin']
      )
    end;
$$;

-- Every policy below is preceded by `drop policy if exists` so this
-- migration can be safely re-run (see docs/MIGRATION_VALIDATION.md).

-- ---------------------------------------------------------------------------
-- Tenant-scoped private buckets: design-uploads, artwork, support-attachments.
-- Any active member of the tenant encoded in the path may read/write;
-- there is no public access at all.
-- ---------------------------------------------------------------------------
drop policy if exists kpc_tenant_private_select on storage.objects;
create policy kpc_tenant_private_select on storage.objects
  for select using (
    bucket_id in ('design-uploads', 'artwork', 'support-attachments')
    and storage.kpc_is_tenant_object(name)
  );

drop policy if exists kpc_tenant_private_insert on storage.objects;
create policy kpc_tenant_private_insert on storage.objects
  for insert with check (
    bucket_id in ('design-uploads', 'artwork', 'support-attachments')
    and storage.kpc_is_tenant_object(name)
  );

drop policy if exists kpc_tenant_private_update on storage.objects;
create policy kpc_tenant_private_update on storage.objects
  for update using (
    bucket_id in ('design-uploads', 'artwork', 'support-attachments')
    and storage.kpc_is_tenant_object(name)
  ) with check (
    bucket_id in ('design-uploads', 'artwork', 'support-attachments')
    and storage.kpc_is_tenant_object(name)
  );

drop policy if exists kpc_tenant_private_delete on storage.objects;
create policy kpc_tenant_private_delete on storage.objects
  for delete using (
    bucket_id in ('design-uploads', 'artwork', 'support-attachments')
    and storage.kpc_is_tenant_object(name)
  );

-- ---------------------------------------------------------------------------
-- Tenant-scoped public-read buckets: logos, brand-assets, product-images.
-- Read is public (storefronts are public pages); writes require tenant
-- membership. logos/brand-assets writes are further restricted to
-- tenant_owner/tenant_admin since they're brand identity settings;
-- product-images writes are open to any active tenant member (designers/
-- production staff manage product photography too).
-- ---------------------------------------------------------------------------
drop policy if exists kpc_public_read_select on storage.objects;
create policy kpc_public_read_select on storage.objects
  for select using (
    bucket_id in ('logos', 'brand-assets', 'product-images')
  );

drop policy if exists kpc_brand_assets_write_admin on storage.objects;
create policy kpc_brand_assets_write_admin on storage.objects
  for insert with check (
    bucket_id in ('logos', 'brand-assets')
    and storage.kpc_has_tenant_admin_role(name)
  );

drop policy if exists kpc_brand_assets_update_admin on storage.objects;
create policy kpc_brand_assets_update_admin on storage.objects
  for update using (
    bucket_id in ('logos', 'brand-assets')
    and storage.kpc_has_tenant_admin_role(name)
  ) with check (
    bucket_id in ('logos', 'brand-assets')
    and storage.kpc_has_tenant_admin_role(name)
  );

drop policy if exists kpc_brand_assets_delete_admin on storage.objects;
create policy kpc_brand_assets_delete_admin on storage.objects
  for delete using (
    bucket_id in ('logos', 'brand-assets')
    and storage.kpc_has_tenant_admin_role(name)
  );

drop policy if exists kpc_product_images_write_member on storage.objects;
create policy kpc_product_images_write_member on storage.objects
  for insert with check (
    bucket_id = 'product-images' and storage.kpc_is_tenant_object(name)
  );

drop policy if exists kpc_product_images_update_member on storage.objects;
create policy kpc_product_images_update_member on storage.objects
  for update using (
    bucket_id = 'product-images' and storage.kpc_is_tenant_object(name)
  ) with check (
    bucket_id = 'product-images' and storage.kpc_is_tenant_object(name)
  );

drop policy if exists kpc_product_images_delete_member on storage.objects;
create policy kpc_product_images_delete_member on storage.objects
  for delete using (
    bucket_id = 'product-images' and storage.kpc_is_tenant_object(name)
  );

-- ---------------------------------------------------------------------------
-- Platform-wide bucket: course-files. Not tenant-scoped — readable by any
-- authenticated user (training content), writable only by platform super
-- admins until the courses/enrollments tables (Phase 7) add real
-- entitlement checks.
-- ---------------------------------------------------------------------------
drop policy if exists kpc_course_files_select_authenticated on storage.objects;
create policy kpc_course_files_select_authenticated on storage.objects
  for select using (
    bucket_id = 'course-files' and auth.role() = 'authenticated'
  );

drop policy if exists kpc_course_files_write_super_admin on storage.objects;
create policy kpc_course_files_write_super_admin on storage.objects
  for insert with check (
    bucket_id = 'course-files' and public.is_platform_super_admin()
  );

drop policy if exists kpc_course_files_update_super_admin on storage.objects;
create policy kpc_course_files_update_super_admin on storage.objects
  for update using (
    bucket_id = 'course-files' and public.is_platform_super_admin()
  ) with check (
    bucket_id = 'course-files' and public.is_platform_super_admin()
  );

drop policy if exists kpc_course_files_delete_super_admin on storage.objects;
create policy kpc_course_files_delete_super_admin on storage.objects
  for delete using (
    bucket_id = 'course-files' and public.is_platform_super_admin()
  );
