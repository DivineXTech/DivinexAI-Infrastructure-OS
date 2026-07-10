import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
import { formatMinorUnits, formatDate } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminOrdersPage() {
  const supabase = await createSupabaseServerClient();
  const { data: orders } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-medium text-ink">Orders</h1>
      {!orders || orders.length === 0 ? (
        <EmptyState title="No orders yet" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-paper-muted text-left text-xs font-medium uppercase text-ink-muted">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3 font-medium text-ink">{order.order_number}</td>
                  <td className="px-4 py-3 text-ink-muted">{order.buyer_email}</td>
                  <td className="px-4 py-3 text-ink">{formatMinorUnits(order.total_minor, order.currency_code)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{formatDate(order.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
