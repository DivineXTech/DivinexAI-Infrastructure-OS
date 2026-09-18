import { AppShell } from "@/components/app-shell/app-shell";
import { requirePlatformSuperAdmin } from "@/lib/auth/session";
import { ADMIN_NAV } from "@/lib/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlatformSuperAdmin();

  return (
    <AppShell
      brand="KushPrintCo OS Admin"
      brandHref="/admin"
      navItems={ADMIN_NAV}
      breadcrumbRootLabel="Admin"
    >
      {children}
    </AppShell>
  );
}
