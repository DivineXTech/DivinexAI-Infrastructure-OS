import "server-only";
import { redirect } from "next/navigation";

import { writeAuditLog } from "@/lib/audit/log";
import {
  getCurrentProfile,
  getCurrentTenantMembership,
  requireCurrentTenantRole,
  type AuthedProfile,
  type TenantMembership,
} from "@/lib/auth/session";
import type { RoleKey } from "@/lib/auth/roles";

/**
 * Section 15: tenant_owner/tenant_admin have full product/pricing/catalog
 * access. Nothing else in this phase (designer, production_manager,
 * sales_rep) can create or edit a product or its pricing — designer's
 * scope is design projects, not the catalog; production_manager and
 * sales_rep get read-only access enforced by RLS
 * (supabase/migrations/20260719000000_catalog.sql), not by a write path
 * through this guard. "Sales rep can draft descriptions if entitled" from
 * the spec is deferred to the same permissions/role_permissions machinery
 * Phase 3's "Authorized manager" tier deferred to — see docs/TECH_DEBT.md.
 */
export const CATALOG_EDIT_ROLES: RoleKey[] = ["tenant_owner", "tenant_admin"];
export const CATALOG_READ_ROLES: RoleKey[] = ["tenant_owner", "tenant_admin", "sales_rep", "production_manager"];

export type CatalogAccessContext = {
  profile: AuthedProfile;
  membership: TenantMembership;
};

export async function requireCatalogEditAccess(): Promise<CatalogAccessContext> {
  const membership = await requireCurrentTenantRole(CATALOG_EDIT_ROLES);
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return { profile, membership };
}

/**
 * Broader read gate for /app/products (list/detail pages) — owner/admin
 * see everything; sales_rep/production_manager see whatever RLS narrows
 * them to (active products only, or approved-product production specs
 * respectively). Anyone else is denied and logged, mirroring
 * lib/onboarding/guard.ts's requireOnboardingReviewAccess pattern.
 */
export async function requireCatalogReadAccess(): Promise<CatalogAccessContext> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/app/onboarding");
  if (membership.status !== "active") redirect("/app");

  if (!profile.isPlatformSuperAdmin && !CATALOG_READ_ROLES.includes(membership.roleKey)) {
    await writeAuditLog({
      tenantId: membership.tenantId,
      actorProfileId: profile.id,
      action: "privileged_action.denied",
      metadata: { actualRole: membership.roleKey, area: "catalog" },
    });
    redirect("/app");
  }

  return { profile, membership };
}
