import { MetricCard } from "@/components/ui/metric-card";
import { formatMinorUnits } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminOverviewPage() {
  const supabase = await createSupabaseServerClient();

  const [{ count: creatorCount }, { count: productCount }, { count: orderCount }, { data: orders }, { count: pendingModeration }] =
    await Promise.all([
      supabase.from("creator_accounts").select("id", { count: "exact", head: true }),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("total_minor, currency_code").in("status", ["paid", "fulfilled"]),
      supabase.from("product_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

  const grossVolumeMinor = (orders ?? []).reduce((sum, o) => sum + o.total_minor, 0);
  const currency = orders?.[0]?.currency_code ?? "USD";

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-medium text-ink">Overview</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Gross marketplace volume" value={formatMinorUnits(grossVolumeMinor, currency)} />
        <MetricCard label="Active creators" value={String(creatorCount ?? 0)} />
        <MetricCard label="Published products" value={String(productCount ?? 0)} />
        <MetricCard label="Total orders" value={String(orderCount ?? 0)} />
      </div>
      <div className="rounded-lg border border-warning-soft bg-warning-soft p-4 text-sm text-warning">
        {pendingModeration ?? 0} product{pendingModeration === 1 ? "" : "s"} pending moderation review.
      </div>
    </div>
  );
}
