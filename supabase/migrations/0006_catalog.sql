-- FlowraMarket Africa — 0006: product catalog

create table public.products (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_accounts (id) on delete cascade,
  category_id uuid references public.product_categories (id),
  -- Globally unique (not scoped to creator_id): the public route is the
  -- flat /product/[slug], so slugs must be unique platform-wide.
  slug citext not null,
  title text not null check (char_length(title) between 3 and 140),
  short_description text check (char_length(short_description) <= 200),
  full_description text,
  product_type app.product_type not null,
  status app.product_status not null default 'draft',
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),

  pricing_model text not null default 'fixed' check (pricing_model in ('fixed', 'pay_what_you_want', 'free')),
  base_price_minor integer not null default 0 check (base_price_minor >= 0),
  compare_at_price_minor integer check (compare_at_price_minor is null or compare_at_price_minor >= 0),
  pwyw_minimum_minor integer not null default 0 check (pwyw_minimum_minor >= 0),
  currency_code text not null default 'USD' references public.currencies (code),

  license_type text,
  sales_limit integer check (sales_limit is null or sales_limit > 0),
  units_sold integer not null default 0,
  launch_date timestamptz,
  demo_url text,
  refund_policy text,
  support_terms text,
  service_delivery_days integer,
  faqs jsonb not null default '[]'::jsonb,

  is_marketplace_submitted boolean not null default false,
  published_at timestamptz,
  rejected_reason text,

  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (slug)
);

create trigger set_updated_at
  before update on public.products
  for each row execute function app.set_updated_at();

create index products_status_idx on public.products (status);
create index products_creator_idx on public.products (creator_id);
create index products_category_idx on public.products (category_id);
create index products_published_idx on public.products (status, published_at desc) where status = 'published';

create table public.product_category_assignments (
  product_id uuid not null references public.products (id) on delete cascade,
  category_id uuid not null references public.product_categories (id) on delete cascade,
  primary key (product_id, category_id)
);

create table public.product_tag_assignments (
  product_id uuid not null references public.products (id) on delete cascade,
  tag_id uuid not null references public.product_tags (id) on delete cascade,
  primary key (product_id, tag_id)
);

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  media_type text not null check (media_type in ('cover', 'gallery', 'preview')),
  storage_path text,
  external_url text,
  alt_text text,
  sort_order smallint not null default 100,
  created_at timestamptz not null default now(),
  constraint media_source check (storage_path is not null or external_url is not null)
);

-- Private, entitlement-gated files. `storage_path` points into a private
-- Supabase Storage bucket; access is only ever granted via short-lived
-- signed URLs issued after verifying an entitlement (see modules/files).
create table public.product_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  content_type text,
  version text not null default '1.0',
  download_limit integer,
  sort_order smallint not null default 100,
  created_at timestamptz not null default now()
);

create table public.product_submissions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  status app.submission_status not null default 'pending',
  notes text,
  submitted_by uuid not null references public.profiles (id),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz
);

create index product_submissions_pending_idx on public.product_submissions (status) where status = 'pending';

create table public.product_bundles (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products (id) on delete cascade
);

create table public.bundle_items (
  bundle_id uuid not null references public.product_bundles (id) on delete cascade,
  included_product_id uuid not null references public.products (id) on delete cascade,
  sort_order smallint not null default 100,
  primary key (bundle_id, included_product_id)
);

-- RLS --------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.product_category_assignments enable row level security;
alter table public.product_tag_assignments enable row level security;
alter table public.product_media enable row level security;
alter table public.product_files enable row level security;
alter table public.product_submissions enable row level security;
alter table public.product_bundles enable row level security;
alter table public.bundle_items enable row level security;

create policy "products_read_published_or_member" on public.products
  for select using (
    (status = 'published' and visibility in ('public', 'unlisted'))
    or public.is_creator_member(creator_id)
    or public.is_platform_admin()
  );

create policy "products_insert_managers" on public.products
  for insert with check (public.is_creator_member(creator_id, array['owner','administrator','product_manager']::app.creator_member_role[]));

create policy "products_update_managers" on public.products
  for update using (public.is_creator_member(creator_id, array['owner','administrator','product_manager']::app.creator_member_role[]) or public.is_platform_admin())
  with check (public.is_creator_member(creator_id, array['owner','administrator','product_manager']::app.creator_member_role[]) or public.is_platform_admin());

create policy "products_delete_managers" on public.products
  for delete using (public.is_creator_member(creator_id, array['owner','administrator']::app.creator_member_role[]));

create policy "product_category_assignments_read" on public.product_category_assignments
  for select using (true);

create policy "product_category_assignments_manage" on public.product_category_assignments
  for all using (
    exists (select 1 from public.products p where p.id = product_id and public.is_creator_member(p.creator_id, array['owner','administrator','product_manager']::app.creator_member_role[]))
  )
  with check (
    exists (select 1 from public.products p where p.id = product_id and public.is_creator_member(p.creator_id, array['owner','administrator','product_manager']::app.creator_member_role[]))
  );

create policy "product_tag_assignments_read" on public.product_tag_assignments
  for select using (true);

create policy "product_tag_assignments_manage" on public.product_tag_assignments
  for all using (
    exists (select 1 from public.products p where p.id = product_id and public.is_creator_member(p.creator_id, array['owner','administrator','product_manager']::app.creator_member_role[]))
  )
  with check (
    exists (select 1 from public.products p where p.id = product_id and public.is_creator_member(p.creator_id, array['owner','administrator','product_manager']::app.creator_member_role[]))
  );

create policy "product_media_read" on public.product_media
  for select using (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and ((p.status = 'published' and p.visibility in ('public','unlisted')) or public.is_creator_member(p.creator_id) or public.is_platform_admin())
    )
  );

create policy "product_media_manage" on public.product_media
  for all using (
    exists (select 1 from public.products p where p.id = product_id and public.is_creator_member(p.creator_id, array['owner','administrator','product_manager']::app.creator_member_role[]))
  )
  with check (
    exists (select 1 from public.products p where p.id = product_id and public.is_creator_member(p.creator_id, array['owner','administrator','product_manager']::app.creator_member_role[]))
  );

-- product_files metadata is only visible to the owning creator team and
-- platform admins. Buyers never query this table directly — downloads are
-- served through a server route that checks entitlements and mints a
-- signed URL, so no policy here grants buyer SELECT access.
create policy "product_files_manage" on public.product_files
  for all using (
    exists (select 1 from public.products p where p.id = product_id and public.is_creator_member(p.creator_id, array['owner','administrator','product_manager']::app.creator_member_role[]))
    or public.is_platform_admin()
  )
  with check (
    exists (select 1 from public.products p where p.id = product_id and public.is_creator_member(p.creator_id, array['owner','administrator','product_manager']::app.creator_member_role[]))
  );

create policy "product_submissions_read" on public.product_submissions
  for select using (
    exists (select 1 from public.products p where p.id = product_id and public.is_creator_member(p.creator_id))
    or public.is_platform_admin()
  );

create policy "product_submissions_insert" on public.product_submissions
  for insert with check (
    exists (select 1 from public.products p where p.id = product_id and public.is_creator_member(p.creator_id, array['owner','administrator','product_manager']::app.creator_member_role[]))
  );

create policy "product_submissions_admin_review" on public.product_submissions
  for update using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "product_bundles_read" on public.product_bundles for select using (true);
create policy "product_bundles_manage" on public.product_bundles
  for all using (
    exists (select 1 from public.products p where p.id = product_id and public.is_creator_member(p.creator_id, array['owner','administrator','product_manager']::app.creator_member_role[]))
  )
  with check (
    exists (select 1 from public.products p where p.id = product_id and public.is_creator_member(p.creator_id, array['owner','administrator','product_manager']::app.creator_member_role[]))
  );

create policy "bundle_items_read" on public.bundle_items for select using (true);
create policy "bundle_items_manage" on public.bundle_items
  for all using (
    exists (
      select 1 from public.product_bundles b
      join public.products p on p.id = b.product_id
      where b.id = bundle_id and public.is_creator_member(p.creator_id, array['owner','administrator','product_manager']::app.creator_member_role[])
    )
  )
  with check (
    exists (
      select 1 from public.product_bundles b
      join public.products p on p.id = b.product_id
      where b.id = bundle_id and public.is_creator_member(p.creator_id, array['owner','administrator','product_manager']::app.creator_member_role[])
    )
  );
