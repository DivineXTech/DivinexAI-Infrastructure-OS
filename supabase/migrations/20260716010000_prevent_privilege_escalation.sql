-- KushPrintCo OS — Phase 1.5 security fix.
--
-- `profiles_update_own` (foundation migration) lets a user update their own
-- `profiles` row via RLS: `using (id = auth.uid()) with check (id =
-- auth.uid())`. RLS is row-level only — that policy has no way to say "but
-- not this column" — so as written, any authenticated user could run
--   update profiles set is_platform_super_admin = true where id = auth.uid();
-- and grant themselves platform-wide admin. This trigger closes that hole:
-- any change to is_platform_super_admin that doesn't come from the
-- service-role connection (which bypasses RLS for trusted server-side
-- tooling — e.g. scripts/seed.ts) is rejected outright, loudly, rather
-- than silently ignored.

create or replace function public.prevent_self_super_admin_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_platform_super_admin is distinct from old.is_platform_super_admin
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      'is_platform_super_admin cannot be changed through this path. Use trusted server-side tooling.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_self_super_admin_escalation on public.profiles;
create trigger prevent_self_super_admin_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_super_admin_escalation();
