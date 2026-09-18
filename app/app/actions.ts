"use server";

import { cookies } from "next/headers";

import { writeAuditLog } from "@/lib/audit/log";
import {
  CURRENT_TENANT_COOKIE,
  getCurrentProfile,
  listMyTenantMemberships,
} from "@/lib/auth/session";

/**
 * Switches the current tenant for this browser. Re-validates that the
 * caller actually belongs to the requested tenant before setting the
 * cookie — never trust the slug from the client alone. Logged: switching
 * tenants changes which tenant's data subsequent requests in this browser
 * act on, which is security-sensitive even though it's not a privilege
 * escalation by itself.
 */
export async function setCurrentTenantAction(tenantSlug: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const memberships = await listMyTenantMemberships();
  const target = memberships.find((m) => m.tenantSlug === tenantSlug);
  if (!target) {
    await writeAuditLog({
      actorProfileId: profile.id,
      action: "privileged_action.denied",
      targetTable: "tenants",
      metadata: { attemptedTenantSlug: tenantSlug, reason: "not_a_member" },
    });
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(CURRENT_TENANT_COOKIE, tenantSlug, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  await writeAuditLog({
    tenantId: target.tenantId,
    actorProfileId: profile.id,
    action: "tenant.switched",
    targetTable: "tenants",
    targetId: target.tenantId,
  });
}
