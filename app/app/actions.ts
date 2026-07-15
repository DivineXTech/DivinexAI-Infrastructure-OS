"use server";

import { cookies } from "next/headers";

import { CURRENT_TENANT_COOKIE, listMyTenantMemberships } from "@/lib/auth/session";

/**
 * Switches the current tenant for this browser. Re-validates that the
 * caller actually belongs to the requested tenant before setting the
 * cookie — never trust the slug from the client alone.
 */
export async function setCurrentTenantAction(tenantSlug: string) {
  const memberships = await listMyTenantMemberships();
  const isMember = memberships.some((m) => m.tenantSlug === tenantSlug);
  if (!isMember) return;

  const cookieStore = await cookies();
  cookieStore.set(CURRENT_TENANT_COOKIE, tenantSlug, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
