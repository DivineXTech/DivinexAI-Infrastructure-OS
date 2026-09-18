import "server-only";

export const ROLE_KEYS = [
  "platform_super_admin",
  "tenant_owner",
  "tenant_admin",
  "production_manager",
  "designer",
  "sales_rep",
  "support_agent",
  "fulfillment_operator",
  "customer",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

/** Roles with tenant-wide administrative authority. */
export const TENANT_ADMIN_ROLES: RoleKey[] = ["tenant_owner", "tenant_admin"];

/** Staff roles — excludes `customer`, which is storefront-only. */
export const STAFF_ROLES: RoleKey[] = ROLE_KEYS.filter(
  (role) => role !== "customer",
) as RoleKey[];
