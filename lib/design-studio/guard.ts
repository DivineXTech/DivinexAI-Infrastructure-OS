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
 * Section 15: tenant_owner/tenant_admin/designer can create and edit
 * design projects, upload artwork, generate mockups, and submit for
 * review. Designers explicitly cannot approve their own or anyone else's
 * design (see requireDesignApprovalAccess) or touch billing/tenant
 * ownership — there is no code path here that grants either.
 */
export const DESIGN_EDIT_ROLES: RoleKey[] = ["tenant_owner", "tenant_admin", "designer"];

/** Only tenant_owner/tenant_admin may approve a design or request
 * changes — designers can submit for review but never self-approve. */
export const DESIGN_APPROVAL_ROLES: RoleKey[] = ["tenant_owner", "tenant_admin"];

/** production_manager is read-only, and RLS further narrows that to
 * approved/converted designs only (see the catalog migration) — this
 * list is for the page-level gate, RLS is what actually enforces the
 * approved-only narrowing at the query layer. */
export const DESIGN_READ_ROLES: RoleKey[] = ["tenant_owner", "tenant_admin", "designer", "production_manager"];

export type DesignStudioAccessContext = {
  profile: AuthedProfile;
  membership: TenantMembership;
};

export async function requireDesignStudioEditAccess(): Promise<DesignStudioAccessContext> {
  const membership = await requireCurrentTenantRole(DESIGN_EDIT_ROLES);
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return { profile, membership };
}

export async function requireDesignApprovalAccess(): Promise<DesignStudioAccessContext> {
  const membership = await requireCurrentTenantRole(DESIGN_APPROVAL_ROLES);
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return { profile, membership };
}

export async function requireDesignReadAccess(): Promise<DesignStudioAccessContext> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/app/onboarding");
  if (membership.status !== "active") redirect("/app");

  if (!profile.isPlatformSuperAdmin && !DESIGN_READ_ROLES.includes(membership.roleKey)) {
    await writeAuditLog({
      tenantId: membership.tenantId,
      actorProfileId: profile.id,
      action: "privileged_action.denied",
      metadata: { actualRole: membership.roleKey, area: "design_studio" },
    });
    redirect("/app");
  }

  return { profile, membership };
}
