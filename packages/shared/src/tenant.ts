import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Thrown when a caller isn't an active member of the tenant they asked to
 * act on, or lacks a required permission. Callers should map this to a 403,
 * never leak whether the tenant/row exists.
 */
export class TenantAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantAuthorizationError";
  }
}

/**
 * Explicit, server-side tenant-membership check. Required (rule #8: never
 * trust a tenant ID supplied only by the client) for any code path running
 * under the service-role client (`createServiceRoleClient`), since that
 * client bypasses Row-Level Security entirely — background workers, cron
 * jobs, and webhook handlers must call this before touching tenant-owned
 * data on a client-supplied `tenantId`.
 *
 * Request-scoped clients (`createUserScopedClient`) are already enforced by
 * RLS at the database layer; calling this in addition is harmless
 * (defense in depth) but not load-bearing for them.
 */
export async function assertTenantMembership(
  client: SupabaseClient,
  tenantId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await client
    .from("tenant_memberships")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new TenantAuthorizationError(
      `Failed to verify tenant membership: ${error.message}`,
    );
  }
  if (!data) {
    throw new TenantAuthorizationError(
      "User is not an active member of the requested tenant",
    );
  }
}

/**
 * Explicit, server-side permission check, mirroring the `tenant_has_permission`
 * SQL helper used by RLS policies (`supabase/migrations/00000001_core_tenancy.sql`).
 * Same rule as `assertTenantMembership`: required before any service-role
 * code path performs a permission-gated action on a client-supplied tenant ID.
 */
export async function assertTenantPermission(
  client: SupabaseClient,
  tenantId: string,
  userId: string,
  permissionKey: string,
): Promise<void> {
  const membership = await client
    .from("tenant_memberships")
    .select("role_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membership.error) {
    throw new TenantAuthorizationError(
      `Failed to verify tenant permission: ${membership.error.message}`,
    );
  }
  if (!membership.data) {
    throw new TenantAuthorizationError(
      "User is not an active member of the requested tenant",
    );
  }

  const permission = await client
    .from("role_permissions")
    .select("permissions!inner(key)")
    .eq("role_id", membership.data.role_id)
    .eq("permissions.key", permissionKey)
    .maybeSingle();

  if (permission.error) {
    throw new TenantAuthorizationError(
      `Failed to verify tenant permission: ${permission.error.message}`,
    );
  }
  if (!permission.data) {
    throw new TenantAuthorizationError(
      `User lacks required permission "${permissionKey}" in this tenant`,
    );
  }
}
