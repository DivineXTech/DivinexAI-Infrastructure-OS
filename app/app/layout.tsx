import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import {
  CURRENT_TENANT_COOKIE,
  getCurrentProfile,
  listMyTenantMemberships,
  resolveCurrentTenantMembership,
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

  // Resolved from the `memberships` array already fetched above, not a
  // second Supabase round trip — avoids both the extra query and a
  // time-of-check/time-of-use gap where membership could change between
  // two independent fetches in the same request.
  const cookieStore = await cookies();
  const preferredSlug = cookieStore.get(CURRENT_TENANT_COOKIE)?.value;
  const current = resolveCurrentTenantMembership(memberships, preferredSlug);
  if (!current) {
    // Structurally unreachable given memberships.length > 0 above and no
    // re-fetch in between — handled explicitly rather than asserted away,
    // in case that invariant ever changes.
    redirect("/app/onboarding");
  }

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
