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
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold text-ink">
          Welcome, {profile.fullName ?? "there"}.
        </h1>
        <p className="max-w-md text-sm text-ink-muted">
          Your account isn&apos;t linked to a tenant yet. The brand
          onboarding wizard (Phase 3) will create your first tenant
          automatically — until then, an admin can add you to one.
        </p>
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
