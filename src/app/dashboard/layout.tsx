import { redirect } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { DashboardNav, DashboardBottomNav } from "@/components/dashboard/dashboard-nav";
import { getCurrentUser } from "@/modules/auth/session";
import { getCreatorMembershipForUser } from "@/modules/creators/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect_to=/dashboard");

  const membership = await getCreatorMembershipForUser(user.id);
  if (!membership) redirect("/onboarding");

  const supabase = await createSupabaseServerClient();
  const { data: storefront } = await supabase
    .from("storefronts")
    .select("slug")
    .eq("creator_id", membership.creator.id)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-paper-muted">
      <header className="border-b border-border bg-paper">
        <Container className="flex h-16 items-center justify-between">
          <Link href="/" className="font-display text-lg font-semibold text-ink">
            FlowraMarket <span className="text-accent-strong">Africa</span>
          </Link>
          {storefront ? (
            <Link href={`/@${storefront.slug}`} className="text-sm text-ink-muted hover:text-ink">
              View storefront
            </Link>
          ) : null}
        </Container>
      </header>
      <Container className="grid gap-8 py-8 pb-20 md:grid-cols-[220px_1fr] md:pb-8">
        <aside className="hidden md:block">
          <DashboardNav />
        </aside>
        <main>{children}</main>
      </Container>
      <DashboardBottomNav />
    </div>
  );
}
