import type { RoleKey } from "@/lib/auth/roles";

export type TenantMembership = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  roleKey: RoleKey;
  status: "active" | "invited" | "suspended";
};

/**
 * Pure selection logic: given a memberships array already in hand, resolve
 * which one the current request should act on — the tenant matching the
 * `kpc_tenant_slug` cookie (set by the tenant switcher), or the first
 * active membership if the cookie is unset/stale/points at a tenant the
 * caller's since lost access to.
 *
 * Deliberately has no I/O and no imports beyond a type — this is what
 * lets it be unit-tested directly (tests/unit/tenant-selection.test.ts)
 * without pulling in lib/auth/session.ts's Supabase/env/cookies() chain,
 * which requires a configured environment to even import.
 */
export function resolveCurrentTenantMembership(
  memberships: TenantMembership[],
  preferredSlug: string | undefined,
): TenantMembership | null {
  if (memberships.length === 0) return null;
  return memberships.find((m) => m.tenantSlug === preferredSlug) ?? memberships[0];
}
