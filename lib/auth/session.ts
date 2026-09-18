import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { writeAuditLog } from "@/lib/audit/log";
import { resolveCurrentTenantMembership } from "@/lib/auth/tenant-selection";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RoleKey } from "@/lib/auth/roles";
import type { TenantMembership } from "@/lib/auth/tenant-selection";

export { resolveCurrentTenantMembership };
export type { TenantMembership };

/** Not httpOnly: the tenant switcher (a Client Component) reads it for
 * optimistic UI; it only ever holds a non-sensitive slug, and every read is
 * re-validated against real membership rows server-side before use. */
export const CURRENT_TENANT_COOKIE = "kpc_tenant_slug";

export type AuthedProfile = {
  id: string;
  fullName: string | null;
  isPlatformSuperAdmin: boolean;
};

/**
 * Reads the current session's profile. This is the only place session
 * state should be read from in Server Components — do not read the
 * Supabase session directly in route code so authorization stays
 * centralized and testable.
 */
export async function getCurrentProfile(): Promise<AuthedProfile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, is_platform_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    fullName: profile.full_name,
    isPlatformSuperAdmin: profile.is_platform_super_admin,
  };
}

/**
 * Fetches every active tenant membership row for the current user, without
 * relying on Postgrest embedded-resource joins (those need full
 * `Relationships` metadata from a real generated Database type, which
 * lib/supabase/types.ts intentionally doesn't hand-maintain — see its file
 * header). Tenant/role names are then resolved in a second pass.
 *
 * Explicitly filters by `profile_id`. This is deliberate, not redundant
 * with RLS: `tenant_memberships_select_member` authorizes a row by "is the
 * caller an active member of this row's tenant_id" (so tenant
 * owners/admins can legitimately list *other* members for team-management
 * features), not "is this the caller's own row." A function whose
 * contract is "my memberships" must not assume table-level RLS narrows
 * results to the caller's own rows — it doesn't, and previously didn't
 * here, which let one member's session resolve another member's row (and
 * role) as its own. See docs/SECURITY.md.
 */
async function fetchMyActiveMembershipRows(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profileId: string,
) {
  const { data: memberships } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role_id, status")
    .eq("profile_id", profileId)
    .eq("status", "active");
  if (!memberships || memberships.length === 0) return [];

  const tenantIds = [...new Set(memberships.map((m) => m.tenant_id))];
  const roleIds = [...new Set(memberships.map((m) => m.role_id))];

  const [{ data: tenants }, { data: roles }] = await Promise.all([
    supabase.from("tenants").select("id, slug, name").in("id", tenantIds),
    supabase.from("roles").select("id, key").in("id", roleIds),
  ]);

  const tenantById = new Map((tenants ?? []).map((t) => [t.id, t]));
  const roleById = new Map((roles ?? []).map((r) => [r.id, r]));

  return memberships
    .map((m) => {
      const tenant = tenantById.get(m.tenant_id);
      const role = roleById.get(m.role_id);
      if (!tenant || !role) return null;
      const result: TenantMembership = {
        tenantId: m.tenant_id,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        roleKey: role.key as RoleKey,
        status: m.status,
      };
      return result;
    })
    .filter((m): m is TenantMembership => m !== null);
}

/**
 * Resolves the authenticated caller's id, without the extra `profiles`
 * table round trip `getCurrentProfile()` does — callers here only need the
 * id to scope a `tenant_memberships` query to "mine."
 */
async function getCurrentUserId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Loads the caller's membership + role for a specific tenant. Scoped to the
 * caller's own `profile_id` (see `fetchMyActiveMembershipRows`), so an
 * empty result reliably means "not a member" rather than "hidden by a
 * client-side check" — and never another member's row for that tenant.
 */
export async function getTenantMembership(
  tenantSlug: string,
): Promise<TenantMembership | null> {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return null;
  const all = await fetchMyActiveMembershipRows(supabase, userId);
  return all.find((m) => m.tenantSlug === tenantSlug) ?? null;
}

/**
 * Lists every tenant the current user actively belongs to — and only the
 * current user's own membership row per tenant (see
 * `fetchMyActiveMembershipRows`). Used to pick a default tenant and to
 * power the tenant switcher.
 */
export async function listMyTenantMemberships(): Promise<TenantMembership[]> {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return [];
  return fetchMyActiveMembershipRows(supabase, userId);
}

/**
 * Resolves which tenant the current request should act on. Layouts cannot
 * read `searchParams`, so the cookie is the mechanism for "current tenant"
 * rather than a query string. Prefer `resolveCurrentTenantMembership`
 * directly when `memberships` has already been fetched in the same
 * request.
 */
export async function getCurrentTenantMembership(): Promise<TenantMembership | null> {
  const memberships = await listMyTenantMemberships();
  const cookieStore = await cookies();
  const preferredSlug = cookieStore.get(CURRENT_TENANT_COOKIE)?.value;
  return resolveCurrentTenantMembership(memberships, preferredSlug);
}

/**
 * Server-side authorization gate for the current tenant (see
 * `getCurrentTenantMembership`). Redirects (never just hides UI) when the
 * requirement is not met.
 */
export async function requireCurrentTenantRole(
  allowedRoles: RoleKey[],
): Promise<TenantMembership> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const membership = await getCurrentTenantMembership();
  // No tenant at all (vs. a tenant but the wrong role) sends the user
  // somewhere that can actually resolve it, rather than back to a
  // dashboard route that would just redirect them here again.
  if (!membership) redirect("/app/onboarding");
  if (membership.status !== "active") redirect("/app");
  if (!profile.isPlatformSuperAdmin && !allowedRoles.includes(membership.roleKey)) {
    await writeAuditLog({
      tenantId: membership.tenantId,
      actorProfileId: profile.id,
      action: "privileged_action.denied",
      metadata: { requiredRoles: allowedRoles, actualRole: membership.roleKey },
    });
    redirect("/app");
  }

  return membership;
}

/**
 * Server-side authorization gate. Redirects (never just hides UI) when the
 * requirement is not met — every `/app/*` and `/admin/*` route that needs a
 * specific role must call this, since Proxy-level checks are optimistic
 * only (see proxy.ts).
 */
export async function requireTenantRole(
  tenantSlug: string,
  allowedRoles: RoleKey[],
): Promise<TenantMembership> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  if (profile.isPlatformSuperAdmin) {
    const membership = await getTenantMembership(tenantSlug);
    if (membership) return membership;
    redirect("/app");
  }

  const membership = await getTenantMembership(tenantSlug);
  if (!membership || membership.status !== "active") {
    redirect("/app");
  }
  if (!allowedRoles.includes(membership.roleKey)) {
    await writeAuditLog({
      tenantId: membership.tenantId,
      actorProfileId: profile.id,
      action: "privileged_action.denied",
      metadata: { requiredRoles: allowedRoles, actualRole: membership.roleKey },
    });
    redirect("/app");
  }

  return membership;
}

export async function requirePlatformSuperAdmin(): Promise<AuthedProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.isPlatformSuperAdmin) {
    await writeAuditLog({
      actorProfileId: profile.id,
      action: "privileged_action.denied",
      metadata: { requiredRole: "platform_super_admin" },
    });
    redirect("/app");
  }
  await writeAuditLog({
    actorProfileId: profile.id,
    action: "admin.accessed",
  });
  return profile;
}
