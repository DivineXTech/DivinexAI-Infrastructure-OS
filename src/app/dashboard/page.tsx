import Link from "next/link";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState, ComingSoon } from "@/components/ui/states";
import { formatMinorUnits, formatDate } from "@/lib/utils";
import { requireUser } from "@/modules/auth/session";
import { getCreatorMembershipForUser } from "@/modules/creators/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardOverviewPage() {
  const user = await requireUser();
  const membership = await getCreatorMembershipForUser(user.id);
  if (!membership) return null;

  const supabase = await createSupabaseServerClient();
  const creatorId = membership.creator.id;

  const [{ count: productCount }, { count: publishedCount }, { data: orders }, { data: balance }, { data: topProducts }] =
    await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }).eq("creator_id", creatorId),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("creator_id", creatorId).eq("status", "published"),
      supabase.from("orders").select("*").eq("creator_id", creatorId).order("created_at", { ascending: false }).limit(10),
      supabase.from("creator_balances").select("*").eq("creator_id", creatorId).maybeSingle(),
      supabase.from("products").select("id, title, units_sold, currency_code, base_price_minor").eq("creator_id", creatorId).order("units_sold", { ascending: false }).limit(5),
    ]);

  const fulfilledOrders = (orders ?? []).filter((o) => o.status === "fulfilled" || o.status === "paid");
  const grossSalesMinor = fulfilledOrders.reduce((sum, o) => sum + o.total_minor, 0);
  const currency = membership.creator.country_code ? undefined : "USD";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Overview</h1>
        <p className="text-sm text-ink-muted">{membership.creator.plan_code === "starter" ? "Starter plan" : membership.creator.plan_code}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Gross sales" value={formatMinorUnits(grossSalesMinor, balance?.currency_code ?? currency ?? "USD")} hint="Last 10 orders" />
        <MetricCard label="Net earnings (available)" value={formatMinorUnits(balance?.available_minor ?? 0, balance?.currency_code ?? "USD")} />
        <MetricCard label="Products" value={`${publishedCount ?? 0} / ${productCount ?? 0}`} hint="Published / total" />
        <MetricCard label="Orders" value={String(orders?.length ?? 0)} hint="Most recent 10" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-medium text-ink">Recent orders</h2>
            <Link href="/dashboard/orders" className="text-sm text-accent-strong hover:underline">
              View all
            </Link>
          </div>
          {!orders || orders.length === 0 ? (
            <EmptyState title="No orders yet" description="Orders appear here as soon as a buyer checks out." />
          ) : (
            <ul className="divide-y divide-border">
              {orders.map((order) => (
                <li key={order.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-ink">{order.order_number}</p>
                    <p className="text-xs text-ink-muted">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-ink">{formatMinorUnits(order.total_minor, order.currency_code)}</span>
                    <StatusBadge status={order.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 font-display text-lg font-medium text-ink">Top products</h2>
          {!topProducts || topProducts.length === 0 ? (
            <EmptyState title="No sales yet" />
          ) : (
            <ul className="divide-y divide-border">
              {topProducts.map((product) => (
                <li key={product.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="text-ink">{product.title}</span>
                  <span className="text-ink-muted">{product.units_sold} sold</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-medium text-ink">Conversion &amp; traffic analytics</h2>
          <ComingSoon />
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Store visits, product views, and conversion rate require the analytics event pipeline — tracked in ROADMAP.md.
        </p>
      </div>
    </div>
  );
}
