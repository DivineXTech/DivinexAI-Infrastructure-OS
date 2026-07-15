import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RoleKey } from "@/lib/auth/roles";

/** Not httpOnly: the tenant switcher (a Client Component) reads it for
 * optimistic UI; it only ever holds a non-sensitive slug, and every read is
 * re-validated against real membership rows server-side before use. */
export const CURRENT_TENANT_COOKIE = "kpc_tenant_slug";

export type AuthedProfile = {
  id: string;
  fullName: string | null;
  isPlatformSuperAdmin: boolean;
};

export type TenantMembership = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  roleKey: RoleKey;
  status: "active" | "invited" | "suspended";
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
 */
async function fetchMyActiveMembershipRows(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const { data: memberships } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role_id, status")
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
 * Loads the caller's membership + role for a specific tenant. Relies on
 * `tenant_memberships` RLS (a user can only see rows for tenants they
 * belong to), so an empty result reliably means "not a member" rather than
 * "hidden by a client-side check."
 */
export async function getTenantMembership(
  tenantSlug: string,
): Promise<TenantMembership | null> {
  const supabase = await createSupabaseServerClient();
  const all = await fetchMyActiveMembershipRows(supabase);
  return all.find((m) => m.tenantSlug === tenantSlug) ?? null;
}

/**
 * Lists every tenant the current user actively belongs to. Used to pick a
 * default tenant and to power the tenant switcher — RLS already scopes this
 * to the caller's own memberships.
 */
export async function listMyTenantMemberships(): Promise<TenantMembership[]> {
  const supabase = await createSupabaseServerClient();
  return fetchMyActiveMembershipRows(supabase);
}

/**
 * Resolves which tenant the current request should act on: the tenant
 * matching the `kpc_tenant_slug` cookie (set by the tenant switcher), or
 * the user's first active membership if the cookie is unset/stale/points
 * at a tenant they've since lost access to. Layouts cannot read
 * `searchParams`, so the cookie is the mechanism for "current tenant"
 * rather than a query string.
 */
export async function getCurrentTenantMembership(): Promise<TenantMembership | null> {
  const memberships = await listMyTenantMemberships();
  if (memberships.length === 0) return null;

  const cookieStore = await cookies();
  const preferredSlug = cookieStore.get(CURRENT_TENANT_COOKIE)?.value;
  return memberships.find((m) => m.tenantSlug === preferredSlug) ?? memberships[0];
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
  if (!membership || membership.status !== "active") redirect("/app");
  if (!profile.isPlatformSuperAdmin && !allowedRoles.includes(membership.roleKey)) {
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
    redirect("/app");
  }

  return membership;
}

export async function requirePlatformSuperAdmin(): Promise<AuthedProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.isPlatformSuperAdmin) redirect("/app");
  return profile;
}
