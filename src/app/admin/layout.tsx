import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { AdminNav } from "@/components/admin/admin-nav";
import { getCurrentUser, isPlatformAdmin } from "@/modules/auth/session";

// Every route under /admin reads the session and queries per-request data —
// never statically prerendered.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect_to=/admin");
  // 404 (not 403) for non-admins: this route's existence isn't disclosed to
  // regular users, matching admin.is_platform_admin() enforcement in RLS.
  if (!isPlatformAdmin(user)) notFound();

  return (
    <div className="min-h-screen bg-paper-muted">
      <header className="border-b border-border bg-ink">
        <Container className="flex h-16 items-center justify-between">
          <Link href="/admin" className="font-display text-lg font-semibold text-paper">
            FlowraMarket <span className="text-accent-strong">Admin</span>
          </Link>
        </Container>
      </header>
      <Container className="grid gap-8 py-8 md:grid-cols-[200px_1fr]">
        <aside>
          <AdminNav />
        </aside>
        <main>{children}</main>
      </Container>
    </div>
  );
}
