import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMinorUnits } from "@/lib/utils";
import { requireUser } from "@/modules/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrderConfirmationPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await requireUser();

  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).eq("buyer_id", user.id).maybeSingle();
  if (!order) notFound();

  const succeeded = order.status === "fulfilled" || order.status === "paid";

  return (
    <div className="mx-auto max-w-md py-16 px-4">
      <Card>
        <CardHeader>
          <CardTitle>{succeeded ? "Purchase complete" : "Payment failed"}</CardTitle>
          <CardDescription>Order {order.order_number}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-muted">Total</span>
            <span className="font-medium text-ink">{formatMinorUnits(order.total_minor, order.currency_code)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-muted">Status</span>
            <StatusBadge status={order.status} />
          </div>

          {succeeded ? (
            <LinkButton href="/library/purchases" className="w-full">
              Go to your library
            </LinkButton>
          ) : (
            <LinkButton href="/discover" variant="secondary" className="w-full">
              Back to marketplace
            </LinkButton>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
