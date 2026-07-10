-- FlowraMarket Africa — 0010: storage buckets and policies
--
-- `product-files` is private: no public read policy exists anywhere, and
-- the only way to read an object is a short-lived signed URL minted by
-- the server after verifying an entitlement (see src/modules/files).
-- `product-media` and `avatars` are public read buckets for cover images,
-- gallery images, and profile/storefront branding.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-files', 'product-files', false, 524288000, null),
  ('product-media', 'product-media', true, 10485760, array['image/png','image/jpeg','image/webp','image/gif']),
  ('avatars', 'avatars', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- Path convention: product-files/{creator_id}/{product_id}/{file_id}-{filename}
create policy "product_files_creator_write"
  on storage.objects for insert
  with check (
    bucket_id = 'product-files'
    and public.is_creator_member((storage.foldername(name))[1]::uuid, array['owner','administrator','product_manager']::app.creator_member_role[])
  );

create policy "product_files_creator_manage"
  on storage.objects for all
  using (
    bucket_id = 'product-files'
    and public.is_creator_member((storage.foldername(name))[1]::uuid, array['owner','administrator','product_manager']::app.creator_member_role[])
  )
  with check (
    bucket_id = 'product-files'
    and public.is_creator_member((storage.foldername(name))[1]::uuid, array['owner','administrator','product_manager']::app.creator_member_role[])
  );

-- No SELECT policy is defined for authenticated/anon roles on product-files:
-- downloads only ever go through the service-role signed-URL endpoint.

create policy "product_media_public_read"
  on storage.objects for select
  using (bucket_id = 'product-media');

create policy "product_media_creator_write"
  on storage.objects for insert
  with check (
    bucket_id = 'product-media'
    and public.is_creator_member((storage.foldername(name))[1]::uuid, array['owner','administrator','product_manager','marketing_manager']::app.creator_member_role[])
  );

create policy "product_media_creator_manage"
  on storage.objects for all
  using (
    bucket_id = 'product-media'
    and public.is_creator_member((storage.foldername(name))[1]::uuid, array['owner','administrator','product_manager','marketing_manager']::app.creator_member_role[])
  )
  with check (
    bucket_id = 'product-media'
    and public.is_creator_member((storage.foldername(name))[1]::uuid, array['owner','administrator','product_manager','marketing_manager']::app.creator_member_role[])
  );

create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_owner_write"
  on storage.objects for all
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
