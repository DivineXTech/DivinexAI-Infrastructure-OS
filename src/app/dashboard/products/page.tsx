import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
import { formatMinorUnits } from "@/lib/utils";
import { requireUser } from "@/modules/auth/session";
import { getCreatorMembershipForUser } from "@/modules/creators/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardProductsPage() {
  const user = await requireUser();
  const membership = await getCreatorMembershipForUser(user.id);
  if (!membership) return null;

  const supabase = await createSupabaseServerClient();
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("creator_id", membership.creator.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium text-ink">Products</h1>
        <LinkButton href="/dashboard/products/new">New product</LinkButton>
      </div>

      {!products || products.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Create your first product to start selling on FlowraMarket Africa."
          action={<LinkButton href="/dashboard/products/new">Create a product</LinkButton>}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-paper-muted text-left text-xs font-medium uppercase text-ink-muted">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Sold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-paper-muted">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/products/${product.id}`} className="font-medium text-ink hover:text-accent-strong">
                      {product.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {product.pricing_model === "free" ? "Free" : formatMinorUnits(product.base_price_minor, product.currency_code)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={product.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{product.units_sold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
