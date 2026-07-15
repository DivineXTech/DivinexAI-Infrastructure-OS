import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import {
  getCurrentProfile,
  getCurrentTenantMembership,
  listMyTenantMemberships,
} from "@/lib/auth/session";
import { APP_NAV, filterNavByRole } from "@/lib/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const memberships = await listMyTenantMemberships();

  if (memberships.length === 0) {
    // No AppShell chrome (no tenant to show nav/breadcrumbs/switcher for)
    // — but `children` still renders, so /app/onboarding (which has no
    // tenant-membership requirement, by design) can render its
    // create-tenant form. Every other /app/* page redirects itself to
    // /app/onboarding via requireCurrentTenantRole when membership is
    // null, so nothing else meaningfully renders through this branch.
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        {children}
      </div>
    );
  }

  const current = (await getCurrentTenantMembership())!;
  const navItems = filterNavByRole(APP_NAV, current.roleKey);

  return (
    <AppShell
      brand="KushPrintCo OS"
      brandHref="/app"
      navItems={navItems}
      breadcrumbRootLabel="Dashboard"
      tenant={{
        tenantId: current.tenantId,
        tenantSlug: current.tenantSlug,
        tenantName: current.tenantName,
      }}
      tenantOptions={memberships.map((m) => ({
        tenantId: m.tenantId,
        tenantSlug: m.tenantSlug,
        tenantName: m.tenantName,
      }))}
    >
      {children}
    </AppShell>
  );
}
