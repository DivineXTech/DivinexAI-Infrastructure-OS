-- Phase 2: Chapter 12 access control (independent of Supabase Storage's own
-- signed-URL expiry — this lets an administrator revoke a specific
-- subscriber's access even if they still have a valid-looking link/email).

alter table public.subscribers
  add column if not exists chapter12_access_revoked boolean not null default false;

comment on column public.subscribers.chapter12_access_revoked is
  'Administrator-set kill switch for this subscriber''s Chapter 12 access, independent of token/signed-URL expiry.';

-- Private Storage bucket for the Chapter 12 PDF. `public = false` is load-
-- bearing: it means objects are NOT reachable via a public URL — only via
-- createSignedUrl(), which src/lib/storage/chapter12-storage.ts calls with
-- the service-role key. Upload the approved PDF to this bucket as
-- "chapter-12.pdf" (or set CHAPTER12_STORAGE_PATH to match a different
-- object name) via the Supabase dashboard or CLI; no SQL insert can upload
-- the file itself.
insert into storage.buckets (id, name, public)
values ('chapter12-private', 'chapter12-private', false)
on conflict (id) do nothing;

-- No storage.objects policies are created for this bucket, on purpose —
-- same reasoning as the subscribers table RLS: zero policies means only
-- the service-role key (used exclusively by chapter12-storage.ts, never
-- the browser) can read or write objects in it.
