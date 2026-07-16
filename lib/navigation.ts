import type { RoleKey } from "@/lib/auth/roles";
import { TENANT_ADMIN_ROLES } from "@/lib/auth/roles";

export type NavItem = {
  label: string;
  href: string;
  /** Omit to show for every active tenant role. Purely a UX nicety — the
   * actual gate is the server-side check on each route (see
   * lib/auth/session.ts). Hiding a link is never the security boundary. */
  roles?: RoleKey[];
};

export const APP_NAV: NavItem[] = [
  { label: "Dashboard", href: "/app" },
  { label: "Onboarding", href: "/app/onboarding" },
  { label: "Brand", href: "/app/brand" },
  { label: "Garments", href: "/app/garments" },
  { label: "Design Studio", href: "/app/design-studio" },
  { label: "Mockups", href: "/app/mockups" },
  { label: "Products", href: "/app/products" },
  { label: "Inventory", href: "/app/inventory" },
  { label: "Orders", href: "/app/orders" },
  { label: "Production", href: "/app/production" },
  { label: "Customers", href: "/app/customers" },
  { label: "Storefront", href: "/app/storefront" },
  { label: "Marketing", href: "/app/marketing" },
  { label: "Analytics", href: "/app/analytics" },
  { label: "Startup Kit", href: "/app/startup-kit" },
  { label: "Equipment", href: "/app/equipment" },
  { label: "Suppliers", href: "/app/suppliers" },
  { label: "Academy", href: "/app/academy" },
  { label: "Billing", href: "/app/billing", roles: TENANT_ADMIN_ROLES },
  { label: "Team", href: "/app/team", roles: TENANT_ADMIN_ROLES },
  { label: "Settings", href: "/app/settings", roles: TENANT_ADMIN_ROLES },
  { label: "Support", href: "/app/support" },
];

export function filterNavByRole(items: NavItem[], role: RoleKey): NavItem[] {
  return items.filter((item) => !item.roles || item.roles.includes(role));
}

export const ADMIN_NAV: NavItem[] = [
  { label: "Overview", href: "/admin" },
  { label: "Tenants", href: "/admin/tenants" },
  { label: "Users", href: "/admin/users" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Products", href: "/admin/products" },
  { label: "Equipment", href: "/admin/equipment" },
  { label: "Startup Kits", href: "/admin/startup-kits" },
  { label: "Suppliers", href: "/admin/suppliers" },
  { label: "Courses", href: "/admin/courses" },
  { label: "Content", href: "/admin/content" },
  { label: "Subscriptions", href: "/admin/subscriptions" },
  { label: "Support", href: "/admin/support" },
  { label: "Audit Log", href: "/admin/audit" },
  { label: "Settings", href: "/admin/settings" },
  { label: "System Health", href: "/admin/system-health" },
];
