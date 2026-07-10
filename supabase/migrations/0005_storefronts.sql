-- FlowraMarket Africa — 0005: creator storefronts

create table public.storefronts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null unique references public.creator_accounts (id) on delete cascade,
  slug citext not null unique,
  store_name text not null,
  tagline text,
  description text,
  category text,
  logo_url text,
  cover_image_url text,
  accent_color text,
  seo_title text,
  seo_description text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{2,49}$')
);

create trigger set_updated_at
  before update on public.storefronts
  for each row execute function app.set_updated_at();

create index storefronts_published_idx on public.storefronts (is_published) where is_published;

create table public.storefront_links (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references public.storefronts (id) on delete cascade,
  label text not null,
  url text not null,
  sort_order smallint not null default 100,
  created_at timestamptz not null default now()
);

create table public.followers (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references public.storefronts (id) on delete cascade,
  follower_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (storefront_id, follower_id)
);

alter table public.storefronts enable row level security;
alter table public.storefront_links enable row level security;
alter table public.followers enable row level security;

create policy "storefronts_read_published_or_member" on public.storefronts
  for select using (is_published or public.is_creator_member(creator_id) or public.is_platform_admin());

create policy "storefronts_insert_owner" on public.storefronts
  for insert with check (public.is_creator_member(creator_id, array['owner','administrator']::app.creator_member_role[]));

create policy "storefronts_update_managers" on public.storefronts
  for update using (public.is_creator_member(creator_id, array['owner','administrator','marketing_manager']::app.creator_member_role[]) or public.is_platform_admin())
  with check (public.is_creator_member(creator_id, array['owner','administrator','marketing_manager']::app.creator_member_role[]) or public.is_platform_admin());

create policy "storefront_links_read" on public.storefront_links
  for select using (
    exists (
      select 1 from public.storefronts s
      where s.id = storefront_id and (s.is_published or public.is_creator_member(s.creator_id) or public.is_platform_admin())
    )
  );

create policy "storefront_links_manage" on public.storefront_links
  for all using (
    exists (
      select 1 from public.storefronts s
      where s.id = storefront_id and public.is_creator_member(s.creator_id, array['owner','administrator','marketing_manager']::app.creator_member_role[])
    )
  )
  with check (
    exists (
      select 1 from public.storefronts s
      where s.id = storefront_id and public.is_creator_member(s.creator_id, array['owner','administrator','marketing_manager']::app.creator_member_role[])
    )
  );

create policy "followers_read_own" on public.followers
  for select using (follower_id = auth.uid());

create policy "followers_manage_own" on public.followers
  for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());
