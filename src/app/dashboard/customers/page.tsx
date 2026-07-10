import { EmptyState } from "@/components/ui/states";
import { formatMinorUnits, formatDate } from "@/lib/utils";
import { requireUser } from "@/modules/auth/session";
import { getCreatorMembershipForUser } from "@/modules/creators/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardCustomersPage() {
  const user = await requireUser();
  const membership = await getCreatorMembershipForUser(user.id);
  if (!membership) return null;

  const supabase = await createSupabaseServerClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .eq("creator_id", membership.creator.id)
    .order("last_order_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-medium text-ink">Customers</h1>
      {!customers || customers.length === 0 ? (
        <EmptyState title="No customers yet" description="Buyers appear here after their first purchase." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-paper-muted text-left text-xs font-medium uppercase text-ink-muted">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Lifetime spend</th>
                <th className="px-4 py-3">Last order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-4 py-3 font-medium text-ink">{customer.email}</td>
                  <td className="px-4 py-3 text-ink-muted">{customer.orders_count}</td>
                  <td className="px-4 py-3 text-ink">
                    {formatMinorUnits(customer.lifetime_spend_minor, customer.currency_code ?? "USD")}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{formatDate(customer.last_order_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
